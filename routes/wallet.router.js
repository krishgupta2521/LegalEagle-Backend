import express from 'express';
import { 
  addMoneyToWallet, 
  getWalletBalance,
  getTransactions
} from '../controllers/wallet.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.post('/add', authMiddleware, addMoneyToWallet);
router.get('/:userId', authMiddleware, getWalletBalance);
router.get('/:userId/transactions', authMiddleware, getTransactions);

export default router;
