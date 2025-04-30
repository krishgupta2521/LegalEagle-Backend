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

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json());

app.use('/api/lawyer', lawyerRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/wallet', walletRoutes);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('sendMessage', async ({ roomId, sender, text }) => {
    const chat = await ChatRoom.findById(roomId);
    if (!chat?.isChatUnlocked) return;

    const message = { sender, text, timestamp: new Date() };
    chat.messages.push(message);
    await chat.save();

    io.to(roomId).emit('receiveMessage', message);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('MongoDB connected');
    server.listen(5000, () => console.log('Server running on port 5000'));
  })
  .catch((err) => console.error(err));
