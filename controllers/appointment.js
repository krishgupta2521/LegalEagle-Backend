import Appointment from '../models/Appointment.js';
import Lawyer from '../models/LawyerProfile.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

export const bookAppointment = async (req, res) => {
  try {
    const { userId, lawyerId, date, time, notes } = req.body;
    
    console.log(`Creating appointment: user ${userId}, lawyer ${lawyerId}, date ${date}, time ${time}`);
    
    const user = await User.findById(userId);
    const lawyer = await Lawyer.findById(lawyerId);

    if (!user || !lawyer) {
      return res.status(404).json({ error: 'User or lawyer not found' });
    }

    if (user.walletBalance < lawyer.pricePerSession) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Check for existing appointment with this lawyer today
    const existingAppointment = await Appointment.findOne({
      userId,
      lawyerId,
      date,
      status: { $in: ['confirmed', 'completed'] }
    });

    if (existingAppointment) {
      console.log(`Found existing appointment: ${existingAppointment._id}`);
      return res.status(200).json({
        message: 'You already have an appointment with this lawyer today',
        appointment: existingAppointment
      });
    }

    const appointment = new Appointment({
      userId,
      lawyerId,
      date,
      time,
      notes,
      isPaid: true,
      amount: lawyer.pricePerSession,
      status: 'confirmed',
      duration: 60 // Default 60 minutes
    });

    await appointment.save();
    console.log(`Appointment created with ID: ${appointment._id}`);
    
    // Deduct amount from user's wallet
    user.walletBalance -= lawyer.pricePerSession;
    await user.save();
    
    // Create a transaction record
    const transaction = new Transaction({
      userId,
      recipientId: lawyerId,
      type: 'payment',
      amount: lawyer.pricePerSession,
      status: 'completed',
      description: `Consultation with ${lawyer.name}`,
      appointmentId: appointment._id
    });
    await transaction.save();
    console.log(`Transaction created with ID: ${transaction._id}`);

    res.status(201).json({
      appointment,
      transaction: {
        id: transaction._id,
        amount: transaction.amount,
        status: transaction.status
      }
    });
  } catch (err) {
    console.error("Error booking appointment:", err);
    res.status(400).json({ error: err.message });
  }
};

export const getLawyerAppointments = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const { status, startDate, endDate } = req.query;
    
    console.log(`Getting appointments for lawyer ${lawyerId}`);
    
    // Check authorization - either direct lawyer login or user with lawyer role
    if (req.isLawyerDirect) {
      // For direct lawyer login, the ID should match the lawyerId param
      if (req.user._id.toString() !== lawyerId) {
        console.log(`Access denied: Lawyer ID mismatch. User: ${req.user._id}, Requested: ${lawyerId}`);
        return res.status(403).json({ error: 'Not authorized to access these appointments' });
      }
    } else if (req.user.role === 'lawyer') {
      // Allow access for lawyer users - in a real app, you might want to verify ownership
      console.log(`Lawyer user ${req.user._id} accessing appointments for lawyer ${lawyerId}`);
    } else {
      console.log(`Access denied: User ${req.user._id} with role ${req.user.role} attempted to access lawyer appointments`);
      return res.status(403).json({ error: 'Not authorized to access lawyer appointments' });
    }
    
    let query = { lawyerId };
    
    if (status) {
      query.status = status;
    }
    
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }
    
    console.log("Query:", JSON.stringify(query));
    
    const appointments = await Appointment.find(query)
      .populate('userId', 'name email')
      .sort({ date: 1, time: 1 });
    
    console.log(`Found ${appointments.length} appointments`);
    
    res.json(appointments);
  } catch (err) {
    console.error('Error getting lawyer appointments:', err);
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
