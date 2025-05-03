import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { initSocketServer } from './socketServer.js';

import lawyerRoutes from './routes/lawyer.router.js';
import appointmentRoutes from './routes/appointment.router.js';
import chatRoutes from './routes/chat.router.js';
import walletRoutes from './routes/wallet.router.js';
import authRoutes from './routes/auth.router.js';

dotenv.config();
const app = express();
const server = http.createServer(app);

initSocketServer(server);

app.use(cors())
app.use(express.json());

app.use('/api/lawyer', lawyerRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/auth', authRoutes);

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error('MongoDB connection error:', err));