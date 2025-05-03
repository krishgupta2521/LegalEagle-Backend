import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

export const addMoneyToWallet = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    
    if (!userId || !amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update wallet balance
    user.walletBalance += Number(amount);
    await user.save();
    
    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: 'deposit',
      amount,
      status: 'completed',
      description: 'Wallet recharge'
    });
    await transaction.save();
    
    res.json({ 
      success: true,
      balance: user.walletBalance,
      transaction: {
        id: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        createdAt: transaction.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getWalletBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ balance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, page = 1 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('recipientId', 'name');
    
    const totalCount = await Transaction.countDocuments({ userId });
    
    res.json({
      transactions,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: Number(page)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
