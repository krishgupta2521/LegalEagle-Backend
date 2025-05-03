import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';

import lawyerRoutes from './routes/lawyer.router.js';
import appointmentRoutes from './routes/appointment.router.js';
import chatRoutes from './routes/chat.router.js';
import walletRoutes from './routes/wallet.router.js';
import authRoutes from './routes/auth.router.js';
import ChatRoom from './models/ChatRoom.js';
import User from './models/User.js';
import Lawyer from './models/LawyerProfile.js';
import Appointment from './models/Appointment.js';

dotenv.config();
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  },
});

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use('/api/lawyer', lawyerRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/auth', authRoutes);

const userSocketMap = new Map();
const lawyerSocketMap = new Map();
const socketUserMap = new Map();

const verifyUserSession = async (userId, token) => {
  try {
    const user = await User.findOne({ 
      _id: userId,
      'sessions.token': token 
    });
    return !!user;
  } catch (err) {
    console.error('Session verification error:', err);
    return false;
  }
};

const isAppointmentActive = (appointment) => {
  if (!appointment) return false;
  
  const [year, month, day] = appointment.date.split('-').map(num => parseInt(num));
  const [hours, minutes] = appointment.time.split(':').map(num => parseInt(num));
  
  const appointmentDate = new Date(year, month - 1, day, hours, minutes);
  const endDate = new Date(appointmentDate.getTime() + (appointment.duration * 60000));
  
  const currentDate = new Date();
  return currentDate < endDate;
};

const verifyPaymentStatus = async (userId, chatId) => {
  try {
    const chat = await ChatRoom.findById(chatId);
    if (!chat) return false;
    
    const paidAppointment = await Appointment.findOne({
      userId: userId,
      lawyerId: chat.lawyerId,
      isPaid: true,
      status: { $in: ['confirmed', 'completed'] }
    });
    
    return !!paidAppointment;
  } catch (err) {
    console.error('Payment verification error:', err);
    return false;
  }
};

const verifyAppointmentActive = async (userId, chatId) => {
  try {
    const chat = await ChatRoom.findById(chatId);
    if (!chat) return false;
    
    const appointment = await Appointment.findOne({
      userId: userId,
      lawyerId: chat.lawyerId,
      isPaid: true,
      status: { $in: ['confirmed', 'completed'] }
    }).sort({ date: -1, time: -1 });
    
    return isAppointmentActive(appointment);
  } catch (err) {
    console.error('Appointment verification error:', err);
    return false;
  }
};

io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('authenticate', async ({ userId, role, token }) => {
    if (!userId || !role || !token) {
      socket.emit('authError', { message: 'Missing authentication data' });
      return;
    }

    const isValidSession = await verifyUserSession(userId, token);
    if (!isValidSession) {
      socket.emit('authError', { message: 'Invalid session' });
      return;
    }
    socketUserMap.set(socket.id, { userId, role });

    if (role === 'user') {
      userSocketMap.set(userId, socket.id);
      
      const userChats = await ChatRoom.find({ userId });
      userChats.forEach(chat => {
        socket.join(chat._id.toString());
      });
      
      console.log(`User ${userId} authenticated and joined their rooms`);
    } else if (role === 'lawyer') {
      const lawyerProfile = await Lawyer.findOne({ userId });
      
      if (lawyerProfile) {
        const lawyerId = lawyerProfile._id.toString();
        lawyerSocketMap.set(lawyerId, socket.id);
        
        const lawyerChats = await ChatRoom.find({ lawyerId });
        lawyerChats.forEach(chat => {
          socket.join(chat._id.toString());
        });
        
        console.log(`Lawyer ${userId} (profile ${lawyerId}) authenticated and joined their rooms`);
      } else {
        socket.emit('authError', { message: 'Lawyer profile not found' });
      }
    }

    socket.emit('authenticated', { success: true });
  });

  socket.on('joinRoom', async ({ chatId }) => {
    if (!socketUserMap.has(socket.id)) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }
    
    const { userId, role } = socketUserMap.get(socket.id);
    
    if (role === 'user') {
      const hasPaid = await verifyPaymentStatus(userId, chatId);
      if (!hasPaid) {
        socket.emit('error', { 
          message: 'You must have a paid appointment with this lawyer to join the chat'
        });
        return;
      }
      
      const isActive = await verifyAppointmentActive(userId, chatId);
      if (!isActive) {
        socket.emit('appointmentEnded', { 
          message: 'Your appointment has ended. You can view the chat but cannot send new messages.',
          chatId
        });
      }
    } else if (role === 'lawyer') {
      const chat = await ChatRoom.findById(chatId);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }
      
      const lawyer = await Lawyer.findOne({ userId });
      if (!lawyer || chat.lawyerId.toString() !== lawyer._id.toString()) {
        socket.emit('error', { message: 'Not authorized to join this chat' });
        return;
      }
    }
    
    socket.join(chatId);
    console.log(`Client ${socket.id} joined room ${chatId}`);
  });

  socket.on('sendMessage', async ({ chatId, text }) => {
    try {
      if (!socketUserMap.has(socket.id)) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { userId, role } = socketUserMap.get(socket.id);
      const sender = role === 'user' ? 'user' : 'lawyer';
      
      const chat = await ChatRoom.findById(chatId);
      if (!chat) {
        socket.emit('error', { message: 'Chat room not found' });
        return;
      }

      if (sender === 'user') {
        const hasPaid = await verifyPaymentStatus(userId, chatId);
        if (!hasPaid) {
          socket.emit('error', { 
            message: 'You must have a paid appointment with this lawyer to send messages'
          });
          return;
        }
        
        const isActive = await verifyAppointmentActive(userId, chatId);
        if (!isActive) {
          socket.emit('appointmentEnded', { 
            message: 'Your appointment has ended. You can view the chat but cannot send new messages.',
            chatId
          });
          return;
        }
        
        if (chat.userId.toString() !== userId) {
          socket.emit('error', { message: 'Not authorized to send messages in this chat' });
          return;
        }
      } else if (sender === 'lawyer') {
        const lawyer = await Lawyer.findOne({ userId });
        if (!lawyer || chat.lawyerId.toString() !== lawyer._id.toString()) {
          socket.emit('error', { message: 'Not authorized to send messages in this chat' });
          return;
        }
      }

      if (!chat.isChatUnlocked) {
        socket.emit('error', { message: 'Chat is locked. Please unlock to send messages.' });
        return;
      }

      const message = {
        sender,
        text,
        timestamp: new Date(),
        read: false
      };

      chat.messages.push(message);
      chat.lastActivity = new Date();
      await chat.save();

      io.to(chatId).emit('receiveMessage', { 
        ...message, 
        chatId,
        messageIndex: chat.messages.length - 1
      });

      let recipientSocketId;
      if (sender === 'user') {
        recipientSocketId = lawyerSocketMap.get(chat.lawyerId.toString());
      } else {
        recipientSocketId = userSocketMap.get(chat.userId.toString());
      }

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('newMessageNotification', {
          chatId,
          message,
          from: sender
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing', ({ chatId }) => {
    if (!socketUserMap.has(socket.id)) return;
    
    const { role } = socketUserMap.get(socket.id);
    socket.to(chatId).emit('userTyping', { role });
  });

  socket.on('stopTyping', ({ chatId }) => {
    socket.to(chatId).emit('userStoppedTyping');
  });

  socket.on('markAsRead', async ({ chatId }) => {
    try {
      if (!socketUserMap.has(socket.id)) return;
      
      const { userId, role } = socketUserMap.get(socket.id);
      const reader = role === 'user' ? 'user' : 'lawyer';
      
      const chat = await ChatRoom.findById(chatId);
      if (!chat) return;
      
      if (reader === 'user' && chat.userId.toString() !== userId) return;
      else if (reader === 'lawyer') {
        const lawyer = await Lawyer.findOne({ userId });
        if (!lawyer || chat.lawyerId.toString() !== lawyer._id.toString()) return;
      }
      
      let updated = false;
      
      chat.messages = chat.messages.map(message => {
        if (message.sender !== reader && !message.read) {
          message.read = true;
          updated = true;
        }
        return message;
      });
      
      if (updated) {
        await chat.save();
        io.to(chatId).emit('messagesRead', { reader, chatId });
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  });

  socket.on('disconnect', () => {
    const userData = socketUserMap.get(socket.id);
    if (userData) {
      const { userId, role } = userData;
      
      if (role === 'user') {
        userSocketMap.delete(userId);
        console.log(`User ${userId} disconnected`);
      } else if (role === 'lawyer') {
        Lawyer.findOne({ userId }).then(lawyer => {
          if (lawyer) {
            lawyerSocketMap.delete(lawyer._id.toString());
            console.log(`Lawyer ${userId} (profile ${lawyer._id}) disconnected`);
          }
        }).catch(err => console.error('Error during lawyer disconnect:', err));
      }
      
      socketUserMap.delete(socket.id);
    }
  });
});

mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/legaleagle', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error('MongoDB connection error:', err));
