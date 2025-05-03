import User from '../models/User.js';
import Lawyer from '../models/LawyerProfile.js';

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
      role: user.role,
      name: user.name
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, checkBoth = true, isLawyerLogin = false } = req.body;
    
    console.log(`Login attempt: ${email}, checkBoth: ${checkBoth}, isLawyerLogin: ${isLawyerLogin}`);
    
    // If isLawyerLogin is true, prioritize lawyer collection
    let responseObj = null;
    
    if (isLawyerLogin) {
      console.log('Checking lawyer collection first');
      const lawyer = await Lawyer.findOne({ email });
      
      if (lawyer) {
        try {
          const passwordMatches = await lawyer.comparePassword(password);
          if (passwordMatches) {
            console.log('Lawyer found and password matches');
            
            const sessionToken = lawyer.generateSessionToken();
            await lawyer.save();
            
            responseObj = {
              token: sessionToken,
              userId: lawyer._id, 
              lawyerId: lawyer._id,
              role: 'lawyer',
              name: lawyer.name,
              email: lawyer.email,
              source: 'lawyer'
            };
          } else {
            console.log('Lawyer found but password does not match');
          }
        } catch (passwordError) {
          console.error('Error comparing lawyer password:', passwordError);
        }
      } else {
        console.log('Lawyer not found with email:', email);
      }
    }
    
    // If responseObj is still null and checkBoth is true, try User collection
    if (!responseObj && checkBoth) {
      console.log('Checking user collection');
      const user = await User.findOne({ email });
      
      if (user) {
        try {
          const isValidPassword = await user.comparePassword(password);
          
          if (isValidPassword) {
            console.log('User found and password matches');
            
            const sessionToken = user.generateSessionToken();
            await user.save();
            
            responseObj = { 
              token: sessionToken, 
              userId: user._id, 
              role: user.role,
              name: user.name,
              email: user.email,
              walletBalance: user.walletBalance,
              source: 'user'
            };
            
            if (user.role === 'lawyer') {
              const lawyerProfile = await Lawyer.findOne({ userId: user._id });
              if (lawyerProfile) {
                responseObj.lawyerProfile = lawyerProfile;
                responseObj.lawyerId = lawyerProfile._id;
              }
            }
          } else {
            console.log('User found but password does not match');
          }
        } catch (passwordError) {
          console.error('Error comparing user password:', passwordError);
        }
      } else {
        console.log('User not found with email:', email);
      }
    }
    
    // If no valid user found in either collection
    if (!responseObj) {
      console.log('No valid user/lawyer found with the provided credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('Login successful:', responseObj.source, responseObj.role);
    res.json(responseObj);
  } catch (err) {
    console.error('Login error:', err);
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
