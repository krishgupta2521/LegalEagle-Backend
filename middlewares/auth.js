import User from '../models/User.js';
import Lawyer from '../models/LawyerProfile.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('No token provided in request');
      return res.status(401).json({ error: 'No token provided' });
    }

    // Try to find the token in User collection
    let user = await User.findOne({ 'sessions.token': token });
    let isLawyerDirect = false;

    // If not found in User collection, try Lawyer collection
    if (!user) {
      console.log('Token not found in User collection, checking Lawyer collection');
      const lawyer = await Lawyer.findOne({ 'sessions.token': token });
      
      if (lawyer) {
        console.log(`Found lawyer with token: ${lawyer._id}`);
        isLawyerDirect = true;
        // Create a user-like object from lawyer data
        user = {
          _id: lawyer._id,
          name: lawyer.name,
          email: lawyer.email,
          role: 'lawyer',
          isLawyerDirect: true
        };
      } else {
        console.log('Token not found in Lawyer collection either');
      }
    } else {
      console.log(`Found user with token: ${user._id}, role: ${user.role}`);
    }

    if (!user) {
      console.log('No user or lawyer found with the provided token');
      return res.status(401).json({ error: 'Invalid session' });
    }

    req.user = user;
    req.isLawyerDirect = isLawyerDirect;
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
};
