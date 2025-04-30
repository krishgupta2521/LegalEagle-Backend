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

dotenv.config();
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"],
    credentials: true
  },
});

app.use(cors())
app.use(express.json());

app.use('/api/lawyer', lawyerRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/auth', authRoutes);

const userSocketMap = new Map();
const lawyerSocketMap = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', ({ userId, role }) => {
    if (role === 'user') {
      userSocketMap.set(userId, socket.id);
      console.log(`User ${userId} authenticated`);
    } else if (role === 'lawyer') {
      lawyerSocketMap.set(userId, socket.id);
      console.log(`Lawyer ${userId} authenticated`);
    }
  });

  socket.on('joinRoom', ({ chatId, userId, role }) => {
    socket.join(chatId);
    console.log(`${role} ${userId} joined room ${chatId}`);
  });

  socket.on('sendMessage', async ({ chatId, sender, text, userId, lawyerId }) => {
    try {
      const chat = await ChatRoom.findById(chatId);

      if (!chat) {
        socket.emit('error', { message: 'Chat room not found' });
        return;
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

      io.to(chatId).emit('receiveMessage', message);

      const recipientRole = sender === 'user' ? 'lawyer' : 'user';
      const recipientId = sender === 'user' ? lawyerId : userId;
      const recipientSocketId = recipientRole === 'user'
        ? userSocketMap.get(recipientId.toString())
        : lawyerSocketMap.get(recipientId.toString());

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('newMessageNotification', {
          chatId,
          message,
          from: sender === 'user' ? 'client' : 'lawyer'
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing', ({ chatId, user }) => {
    socket.to(chatId).emit('userTyping', { user });
  });

  socket.on('stopTyping', ({ chatId }) => {
    socket.to(chatId).emit('userStoppedTyping');
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }

    for (const [lawyerId, socketId] of lawyerSocketMap.entries()) {
      if (socketId === socket.id) {
        lawyerSocketMap.delete(lawyerId);
        console.log(`Lawyer ${lawyerId} disconnected`);
        break;
      }
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
