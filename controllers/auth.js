import User from '../models/User.js';

export const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const user = new User({ email, password, name, role });
    const sessionToken = user.generateSessionToken();
    await user.save();

    res.status(201).json({ 
      token: sessionToken, 
      userId: user._id, 
      role: user.role 
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionToken = user.generateSessionToken();
    await user.save();

    res.json({ 
      token: sessionToken, 
      userId: user._id, 
      role: user.role 
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    const user = await User.findById(req.user._id);
    user.removeSession(token);
    await user.save();

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
