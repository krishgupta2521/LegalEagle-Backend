import express from 'express';
import { 
  createChatRoom, 
  unlockChat, 
  getChatHistory, 
  markMessagesAsRead, 
  getUserChats, 
  getLawyerChats, 
  sendMessage,
  checkAppointmentStatus
} from '../controllers/chat.js';
import { authMiddleware } from '../middlewares/auth.js';
import { paymentVerificationMiddleware, activeAppointmentMiddleware } from '../middlewares/payment.js';

const router = express.Router();

router.post('/', authMiddleware, createChatRoom);
router.patch('/:chatId/unlock', authMiddleware, unlockChat);
router.get('/:chatId', authMiddleware, paymentVerificationMiddleware, getChatHistory);
router.get('/:chatId/status', authMiddleware, paymentVerificationMiddleware, checkAppointmentStatus);
router.post('/:chatId/message', authMiddleware, paymentVerificationMiddleware, activeAppointmentMiddleware, sendMessage);
router.get('/user/:userId', authMiddleware, getUserChats);
router.get('/lawyer/:lawyerId', authMiddleware, getLawyerChats);
router.patch('/:chatId/read', authMiddleware, paymentVerificationMiddleware, markMessagesAsRead);

export default router;
