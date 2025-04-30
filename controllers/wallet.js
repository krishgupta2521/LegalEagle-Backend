import User from '../models/User.js';

export const addMoneyToWallet = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const user = await User.findById(userId);
    user.walletBalance += amount;
    await user.save();
    res.json({ balance: user.walletBalance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getWalletBalance = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.json({ balance: user.walletBalance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
