import express from 'express';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/profile/:userId', authMiddleware, (req, res) => {
  res.status(200).json({ message: 'User profile endpoint' });
});

router.patch('/profile/:userId', authMiddleware, (req, res) => {
  res.status(200).json({ message: 'Update user profile endpoint' });
});

router.get('/wallet/:userId', authMiddleware, (req, res) => {
  res.status(200).json({ message: 'User wallet endpoint' });
});

export default router;
