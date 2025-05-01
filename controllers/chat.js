import ChatRoom from '../models/ChatRoom.js';
import User from '../models/User.js';
import Lawyer from '../models/LawyerProfile.js';
import Appointment from '../models/Appointment.js';

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

export const createChatRoom = async (req, res) => {
  try {
    const { userId, lawyerId } = req.body;

    // Check if user has already created a chat with this lawyer
    const existingRoom = await ChatRoom.findOne({ userId, lawyerId });
    if (existingRoom) {
      return res.status(200).json(existingRoom);
    }

    // Verify the user has a confirmed/paid appointment with this lawyer
    const paidAppointment = await Appointment.findOne({ 
      userId, 
      lawyerId, 
      isPaid: true,
      status: { $in: ['confirmed', 'completed'] }
    });

    if (!paidAppointment) {
      return res.status(403).json({ 
        error: 'You must have a paid appointment with this lawyer to start a chat' 
      });
    }

    const user = await User.findById(userId);
    const lawyer = await Lawyer.findById(lawyerId);

    if (!user || !lawyer) {
      return res.status(404).json({ error: 'User or lawyer not found' });
    }

    const chat = new ChatRoom({
      userId,
      lawyerId,
      messages: [],
      // Auto-unlock chat for users who have paid appointments
      isChatUnlocked: true
    });

    await chat.save();
    res.status(201).json(chat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const unlockChat = async (req, res) => {
  try {
    const chat = await ChatRoom.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

    chat.isChatUnlocked = true;
    await chat.save();
    res.json({ success: true, chatId: chat._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const { userId, lawyerId } = req.query;

    let query = { _id: req.params.chatId };
    if (userId && lawyerId) {
      query = { userId, lawyerId };
    }

    const chat = await ChatRoom.findOne(query)
      .populate('userId', 'name')
      .populate('lawyerId', 'name');

    if (!chat) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

    // Check appointment status if user is requesting
    let appointmentActive = true;
    if (req.user.role === 'user') {
      const appointment = await Appointment.findOne({
        userId: chat.userId,
        lawyerId: chat.lawyerId,
        isPaid: true,
        status: { $in: ['confirmed', 'completed'] }
      }).sort({ date: -1, time: -1 });
      
      appointmentActive = isAppointmentActive(appointment);
    }

    res.json({
      ...chat.toObject(),
      appointmentActive
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const checkAppointmentStatus = async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await ChatRoom.findById(chatId);
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    const appointment = await Appointment.findOne({
      userId: chat.userId,
      lawyerId: chat.lawyerId,
      isPaid: true,
      status: { $in: ['confirmed', 'completed'] }
    }).sort({ date: -1, time: -1 });
    
    const active = isAppointmentActive(appointment);
    
    res.json({
      chatId,
      appointmentActive: active,
      appointmentDetails: active ? appointment : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUserChats = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify user is accessing their own chats or is admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to access these chats' });
    }
    
    // Get all paid appointments (both active and completed)
    const paidLawyers = await Appointment.distinct('lawyerId', { 
      userId, 
      isPaid: true,
      status: { $in: ['confirmed', 'completed'] }
    });

    const chats = await ChatRoom.find({ 
      userId,
      lawyerId: { $in: paidLawyers }
    })
      .populate('lawyerId', 'name specialization profilePicture')
      .sort({ lastActivity: -1 });
    
    // Get active appointments to check which chats are still active
    const activeAppointments = await Appointment.find({
      userId,
      isPaid: true,
      status: { $in: ['confirmed', 'completed'] }
    });
    
    // Map to store which lawyers have active appointments
    const activeLawyerMap = new Map();
    activeAppointments.forEach(appointment => {
      if (isAppointmentActive(appointment)) {
        activeLawyerMap.set(appointment.lawyerId.toString(), true);
      }
    });
    
    // Format for frontend with unread count and active status
    const formattedChats = chats.map(chat => {
      const unreadCount = chat.messages.filter(
        msg => msg.sender === 'lawyer' && !msg.read
      ).length;
      
      const isActive = activeLawyerMap.has(chat.lawyerId.toString());
      
      return {
        _id: chat._id,
        lawyer: chat.lawyerId,
        lastMessage: chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null,
        unreadCount,
        isChatUnlocked: chat.isChatUnlocked,
        appointmentActive: isActive,
        lastActivity: chat.lastActivity
      };
    });
    
    res.json(formattedChats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getLawyerChats = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    
    const lawyer = await Lawyer.findOne({ userId: req.user._id });
    
    if (!lawyer || lawyer._id.toString() !== lawyerId) {
      return res.status(403).json({ error: 'Not authorized to access these chats' });
    }
    
    const chats = await ChatRoom.find({ lawyerId })
      .populate('userId', 'name')
      .sort({ lastActivity: -1 });
    
    const formattedChats = chats.map(chat => {
      const unreadCount = chat.messages.filter(
        msg => msg.sender === 'user' && !msg.read
      ).length;
      
      return {
        _id: chat._id,
        user: chat.userId,
        lastMessage: chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null,
        unreadCount,
        isChatUnlocked: chat.isChatUnlocked,
        lastActivity: chat.lastActivity
      };
    });
    
    res.json(formattedChats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { reader } = req.body;

    const chat = await ChatRoom.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

    if (
      (reader === 'user' && chat.userId.toString() !== req.user._id.toString()) ||
      (reader === 'lawyer' && !(await Lawyer.findOne({ userId: req.user._id, _id: chat.lawyerId })))
    ) {
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }

    chat.messages = chat.messages.map(message => {
      if (message.sender !== reader && !message.read) {
        message.read = true;
      }
      return message;
    });

    chat.lastActivity = new Date();
    await chat.save();

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text, sender } = req.body;
    
    const chat = await ChatRoom.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat room not found' });
    }
    
    if (
      (sender === 'user' && chat.userId.toString() !== req.user._id.toString()) ||
      (sender === 'lawyer' && !(await Lawyer.findOne({ userId: req.user._id, _id: chat.lawyerId })))
    ) {
      return res.status(403).json({ error: 'Not authorized to send messages in this chat' });
    }
    
    if (!chat.isChatUnlocked) {
      return res.status(400).json({ error: 'Chat is locked. Please unlock to send messages.' });
    }
    
    const message = {
      sender,
      text,
      timestamp: new Date(),
      read: false
    };
    
    chat.messages.push(message);
    chat.lastActivity = new Date();
    await chat.save();
    
    res.status(201).json({
      message,
      messageIndex: chat.messages.length - 1
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
