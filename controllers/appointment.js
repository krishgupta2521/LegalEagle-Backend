import Appointment from '../models/Appointment.js';
import Lawyer from '../models/LawyerProfile.js';
import User from '../models/User.js';

export const bookAppointment = async (req, res) => {
  try {
    const { userId, lawyerId, date, time, notes } = req.body;
    const user = await User.findById(userId);
    const lawyer = await Lawyer.findById(lawyerId);

    if (!user || !lawyer) {
      return res.status(404).json({ error: 'User or lawyer not found' });
    }

    if (user.walletBalance < lawyer.pricePerSession) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const appointment = new Appointment({
      userId,
      lawyerId,
      date,
      time,
      notes,
      isPaid: true,
      amount: lawyer.pricePerSession,
      status: 'confirmed'
    });

    await appointment.save();
    user.walletBalance -= lawyer.pricePerSession;
    await user.save();

    res.status(201).json(appointment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getLawyerAppointments = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const { status, startDate, endDate } = req.query;
    
    let query = { lawyerId };
    
    if (status) {
      query.status = status;
    }
    
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }
    
    const appointments = await Appointment.find(query)
      .populate('userId', 'name email')
      .sort({ date: 1, time: 1 });
      
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUserAppointments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;
    
    let query = { userId };
    
    if (status) {
      query.status = status;
    }
    
    const appointments = await Appointment.find(query)
      .populate('lawyerId', 'name specialization')
      .sort({ date: 1, time: 1 });
      
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const updates = req.body;
    
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    

    // refund logic
    if (updates.status === 'cancelled' && appointment.isPaid) {
      const user = await User.findById(appointment.userId);
      user.walletBalance += appointment.amount;
      await user.save();
    }
    
    Object.keys(updates).forEach(key => {
      appointment[key] = updates[key];
    });
    
    await appointment.save();
    res.json(appointment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


export const getAppointmentDetails = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    const appointment = await Appointment.findById(appointmentId)
      .populate('userId', 'name email')
      .populate('lawyerId', 'name specialization');
      
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
