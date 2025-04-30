import Appointment from '../models/Appointment.js';
import Lawyer from '../models/LawyerProfile.js';
import User from '../models/User.js';

export const bookAppointment = async (req, res) => {
  try {
    const { userId, lawyerId, date, time } = req.body;
    const user = await User.findById(userId);
    const lawyer = await Lawyer.findById(lawyerId);

    if (user.walletBalance < lawyer.pricePerSession) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const appointment = new Appointment({
      userId,
      lawyerId,
      date,
      time,
      isPaid: true,
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
