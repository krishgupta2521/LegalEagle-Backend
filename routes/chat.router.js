import express from 'express';
import { 
  createChatRoom, 
  getChatHistory, 
  getUserChats, 
  getLawyerChats, 
  sendMessage, 
  markMessagesAsRead,
  handleChatRequest
} from '../controllers/chat.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// Initialize function to be called from server.js
export const initChatRoutes = (app, io) => {
  // Middleware to add io to request object
  const addIoMiddleware = (req, res, next) => {
    req.io = io;
    next();
  };

  // Important: Route order matters - more specific routes first
  router.get('/user/:userId', authMiddleware, getUserChats);
  router.get('/lawyer/:lawyerId', authMiddleware, getLawyerChats);
  
  router.post('/', authMiddleware, addIoMiddleware, createChatRoom);
  router.get('/:chatId', authMiddleware, getChatHistory);
  router.post('/:chatId/message', authMiddleware, addIoMiddleware, sendMessage);
  router.patch('/:chatId/read', authMiddleware, markMessagesAsRead);
  router.post('/:chatId/request', authMiddleware, addIoMiddleware, handleChatRequest);

  app.use('/api/chat', router);
  
  console.log("Chat routes initialized with socket.io integration");
};

export default router;
