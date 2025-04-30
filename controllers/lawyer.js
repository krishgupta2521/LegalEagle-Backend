import Lawyer from '../models/LawyerProfile.js';

export const getAllLawyers = async (req, res) => {
  try {
    const lawyers = await Lawyer.find();
    res.json(lawyers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createLawyerProfile = async (req, res) => {
  try {
    const lawyer = new Lawyer(req.body);
    await lawyer.save();
    res.status(201).json(lawyer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
