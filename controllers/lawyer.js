import Lawyer from '../models/LawyerProfile.js';
import User from '../models/User.js';

export const getAllLawyers = async (req, res) => {
  try {
    const { specialization } = req.query;
    let query = {};
    
    if (specialization) {
      query.specialization = specialization;
    }
    
    const lawyers = await Lawyer.find(query);
    res.json(lawyers);
  } catch (err) {
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
