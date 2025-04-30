import express from 'express';
import { createChatRoom, unlockChat, getChatHistory, markMessagesAsRead } from '../controllers/chat.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authMiddleware, createChatRoom);
router.patch('/:chatId/unlock', authMiddleware, unlockChat);
router.get('/:chatId', authMiddleware, getChatHistory);
router.get('/', authMiddleware, getChatHistory);
router.patch('/:chatId/read', authMiddleware, markMessagesAsRead);
export default router;
