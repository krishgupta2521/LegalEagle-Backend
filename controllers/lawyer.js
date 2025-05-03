import Lawyer from '../models/LawyerProfile.js';
import User from '../models/User.js';

export const getAllLawyers = async (req, res) => {
  try {
    const { specialization } = req.query;
    let query = {};
    
    if (specialization) {
      query.specialization = specialization;
    }
    
    const lawyers = await Lawyer.find(query).select('-password -sessions');
    console.log(`Found ${lawyers.length} lawyers`);
    
    if (lawyers.length === 0) {
      return res.json({ message: 'No lawyers found' });
    }
    
    res.json(lawyers);
  } catch (err) {
    console.error("Error in getAllLawyers:", err);
    res.status(500).json({ error: err.message });
  }
};

export const createLawyerProfile = async (req, res) => {
  try {
    const { userId, name, email, specialization, experience, pricePerSession, availability } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.role !== 'lawyer') {
      user.role = 'lawyer';
      await user.save();
    }
    
    const existingProfile = await Lawyer.findOne({ userId });
    if (existingProfile) {
      return res.status(400).json({ error: 'Lawyer profile already exists for this user' });
    }
    
    const lawyer = new Lawyer({
      userId,
      name,
      email,
      specialization,
      experience,
      pricePerSession,
      availability: availability || []
    });
    
    await lawyer.save();
    res.status(201).json(lawyer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getLawyerProfile = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const profile = await Lawyer.findById(lawyerId);
    
    if (!profile) {
      return res.status(404).json({ error: 'Lawyer profile not found' });
    }
    
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getLawyerProfileByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await Lawyer.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({ error: 'Lawyer profile not found' });
    }
    
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateLawyerProfile = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const updates = req.body;
    
    const lawyer = await Lawyer.findById(lawyerId);
    
    if (!lawyer) {
      return res.status(404).json({ error: 'Lawyer profile not found' });
    }
    
    Object.keys(updates).forEach(key => {
      lawyer[key] = updates[key];
    });
    
    await lawyer.save();
    res.json(lawyer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateLawyerAvailability = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const { availability } = req.body;
    
    const lawyer = await Lawyer.findById(lawyerId);
    
    if (!lawyer) {
      return res.status(404).json({ error: 'Lawyer profile not found' });
    }
    
    lawyer.availability = availability;
    await lawyer.save();
    
    res.json(lawyer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const registerLawyer = async (req, res) => {
  try {
    const { name, email, phone, license, specialization, experience, pricePerSession, username, password } = req.body;
    
    // Check if email already exists in the lawyers collection
    const existingLawyer = await Lawyer.findOne({ email });
    if (existingLawyer) {
      return res.status(400).json({ error: 'Email already registered as a lawyer' });
    }
    
    // Create a new lawyer directly in the lawyers collection
    const lawyer = new Lawyer({
      name,
      email,
      phone,
      licenseNumber: license,
      specialization,
      experience,
      pricePerSession,
      username,
      password, // This will be hashed by the pre-save hook
      bio: '',
      education: '',
      profilePicture: '',
      availability: []
    });
    
    // Generate session token for direct login
    const sessionToken = lawyer.generateSessionToken();
    await lawyer.save();
    
    console.log(`New lawyer registered with ID: ${lawyer._id}`);
    
    res.status(201).json({ 
      success: true,
      message: 'Lawyer registered successfully',
      lawyerId: lawyer._id,
      id: lawyer._id, // Add ID field for consistent access in frontend
      token: sessionToken,
      name: lawyer.name,
      email: lawyer.email,
      role: 'lawyer',
      source: 'lawyer' // Add source field to identify this is a direct lawyer login
    });
  } catch (err) {
    console.error("Error registering lawyer:", err);
    res.status(400).json({ error: err.message });
  }
};

export const loginLawyer = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const lawyer = await Lawyer.findOne({ email });
    if (!lawyer || !(await lawyer.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionToken = lawyer.generateSessionToken();
    await lawyer.save();

    res.json({ 
      token: sessionToken, 
      lawyerId: lawyer._id,
      id: lawyer._id, // Add ID field for consistent access
      role: 'lawyer',
      name: lawyer.name,
      email: lawyer.email,
      source: 'lawyer' // Add source field for identification
    });
  } catch (err) {
    console.error("Error logging in lawyer:", err);
    res.status(400).json({ error: err.message });
  }
};
