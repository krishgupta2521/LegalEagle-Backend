import express from 'express';
import { addMoneyToWallet, getWalletBalance } from '../controllers/wallet.js';

const router = express.Router();

router.post('/add', addMoneyToWallet);
router.get('/:userId', getWalletBalance);

export default router;
