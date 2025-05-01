import Appointment from '../models/Appointment.js';
import ChatRoom from '../models/ChatRoom.js';
import Lawyer from '../models/LawyerProfile.js';

// Helper function to check if an appointment is still active
const isAppointmentActive = (appointment) => {
  if (!appointment) return false;
  
  // Get the appointment date and time
  const [year, month, day] = appointment.date.split('-').map(num => parseInt(num));
  const [hours, minutes] = appointment.time.split(':').map(num => parseInt(num));
  
  // Create date objects for the appointment start and end times
  const appointmentDate = new Date(year, month - 1, day, hours, minutes);
  const endDate = new Date(appointmentDate.getTime() + (appointment.duration * 60000));
  
  // Check if the current time is before the end time
  const currentDate = new Date();
  return currentDate < endDate;
};

export const paymentVerificationMiddleware = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    const role = req.user.role;
    
    // If the user is a lawyer, verify this chat belongs to them
    if (role === 'lawyer') {
      const chat = await ChatRoom.findById(chatId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }
      
      const lawyer = await Lawyer.findOne({ userId });
      if (!lawyer) {
        return res.status(404).json({ error: 'Lawyer profile not found' });
      }
      
      if (chat.lawyerId.toString() !== lawyer._id.toString()) {
        return res.status(403).json({ error: 'Not authorized to access this chat' });
      }
      
      next();
      return;
    }
    
    // For regular users, verify payment
    const chat = await ChatRoom.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Verify the chat belongs to this user
    if (chat.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }
    
    // Verify user has a paid appointment with this lawyer
    const paidAppointment = await Appointment.findOne({
      userId,
      lawyerId: chat.lawyerId,
      isPaid: true,
      status: { $in: ['confirmed', 'completed'] }
    });
    
    if (!paidAppointment) {
      return res.status(403).json({ 
        error: 'You must have a paid appointment with this lawyer to access this chat' 
      });
    }
    
    // Chat access is allowed for viewing, proceed
    next();
  } catch (err) {
    res.status(500).json({ error: 'Payment verification failed: ' + err.message });
  }
};

// Middleware to verify if user can send messages (appointment still active)
export const activeAppointmentMiddleware = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    const role = req.user.role;
    
    // Skip for lawyers - they can always send messages
    if (role === 'lawyer') {
      next();
      return;
    }
    
    const chat = await ChatRoom.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Find the most recent appointment
    const appointment = await Appointment.findOne({
      userId,
      lawyerId: chat.lawyerId,
      isPaid: true,
      status: { $in: ['confirmed', 'completed'] }
    }).sort({ date: -1, time: -1 });
    
    // Check if appointment is still active
    if (!isAppointmentActive(appointment)) {
      return res.status(403).json({
        error: 'Your appointment has ended. You can view this chat but cannot send new messages.',
        appointmentEnded: true
      });
    }
    
    next();
  } catch (err) {
    res.status(500).json({ error: 'Appointment verification failed: ' + err.message });
  }
};
