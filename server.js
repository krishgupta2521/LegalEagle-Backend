import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';

// Import routes
import authRouter from './routes/auth.router.js';
import userRouter from './routes/user.router.js';
import lawyerRouter from './routes/lawyer.router.js';
import appointmentRouter from './routes/appointment.router.js';
import walletRouter from './routes/wallet.router.js';
// Import chat routes initialization function
import { initChatRoutes } from './routes/chat.router.js';

// Import socket handler
import initSocketHandler from './socket/socketHandler.js';

dotenv.config();
const app = express();
const server = http.createServer(app);

// Setup CORS
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

app.use(express.json());

// Initialize socket handlers
initSocketHandler(io);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/lawyer', lawyerRouter);
app.use('/api/appointments', appointmentRouter);
app.use('/api/wallet', walletRouter);

// Initialize chat routes with io instance
initChatRoutes(app, io);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/legal-eagle')
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });