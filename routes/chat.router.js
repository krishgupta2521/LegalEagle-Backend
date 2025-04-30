import express from 'express';
import { createChatRoom, unlockChat } from '../controllers/chat.js';

const router = express.Router();

router.post('/', createChatRoom);

router.patch('/:chatId/unlock', unlockChat);

export default router;
