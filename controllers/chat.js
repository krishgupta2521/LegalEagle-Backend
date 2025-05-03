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
    const { userId, lawyerId, forceCreation } = req.body;

    console.log(`Chat room creation request: userId=${userId}, lawyerId=${lawyerId}, forceCreation=${forceCreation}`);
    console.log("Request user:", req.user);

    // Check authentication
    if (!req.user) {
      console.log("No authenticated user found in request");
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if the requesting user matches the provided userId (unless admin)
    const requestUserId = req.user._id.toString();
    if (requestUserId !== userId && req.user.role !== 'admin') {
      console.log(`User ID mismatch: request user ${requestUserId}, requested userId ${userId}`);
      console.log(`Using authenticated user ID ${requestUserId} instead of provided ${userId}`);
    }

    // Use the authenticated user's ID to ensure security
    const effectiveUserId = requestUserId;

    // Check if user has already created a chat with this lawyer
    const existingRoom = await ChatRoom.findOne({ 
      userId: effectiveUserId, 
      lawyerId 
    });
    
    if (existingRoom) {
      console.log(`Found existing chat room: ${existingRoom._id}`);
      
      // Check if there's a paid appointment before allowing access
      const paidAppointment = await Appointment.findOne({
        userId: effectiveUserId,
        lawyerId,
        isPaid: true,
        status: { $in: ['confirmed', 'completed'] }
      });
      
      if (!paidAppointment && !forceCreation) {
        console.log('No paid appointment found for existing chat room');
        return res.status(403).json({ 
          error: 'You must have a paid appointment with this lawyer to access this chat', 
          code: 'NO_APPOINTMENT' 
        });
      }
      
      return res.status(200).json(existingRoom);
    }

    // If no existing room, check for paid appointment before creating one
    console.log(`Checking appointments for user ${effectiveUserId} with lawyer ${lawyerId}`);
    const paidAppointment = await Appointment.findOne({ 
      userId: effectiveUserId, 
      lawyerId,
      isPaid: true,
      status: { $in: ['confirmed', 'completed'] }
    });

    console.log('Appointment check result:', paidAppointment ? 'Found' : 'Not found');

    if (!paidAppointment && !forceCreation) {
      return res.status(403).json({ 
        error: 'You must have a paid appointment with this lawyer to start a chat', 
        code: 'NO_APPOINTMENT'
      });
    }

    // Check if user and lawyer exist
    const user = await User.findById(effectiveUserId);
    const lawyer = await Lawyer.findById(lawyerId);

    if (!user) {
      console.error(`User with ID ${effectiveUserId} not found`);
      return res.status(404).json({ error: 'User not found' });
    }

    if (!lawyer) {
      console.error(`Lawyer with ID ${lawyerId} not found`);
      return res.status(404).json({ error: 'Lawyer not found' });
    }

    console.log(`Creating new chat room between user ${effectiveUserId} and lawyer ${lawyerId}`);
    
    // Create a new chat room with pending status
    const chat = new ChatRoom({
      userId: effectiveUserId,
      lawyerId,
      messages: [{
        sender: 'system',
        text: 'Chat request has been sent to the lawyer. Please wait for their response.',
        timestamp: new Date(),
        read: true
      }],
      isChatUnlocked: false, // Chat starts locked until lawyer accepts
      lastActivity: new Date(),
      status: 'pending', // New status for lawyer approval
      paymentStatus: paidAppointment ? true : false,
      appointmentId: paidAppointment ? paidAppointment._id : null
    });

    await chat.save();
    
    console.log(`Chat room created successfully with ID: ${chat._id}`);
    
    // Emit socket event to notify lawyer about the new chat request
    if (req.io) {
      req.io.to(`lawyer-${lawyerId}`).emit('chatRequest', {
        chatId: chat._id,
        user: {
          _id: user._id,
          name: user.name
        },
        timestamp: new Date()
      });
    }
    
    res.status(201).json(chat);
  } catch (err) {
    console.error("Error creating chat room:", err);
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
    const chatId = req.params.chatId;
    console.log(`Fetching chat history for chat: ${chatId}`);
    
    const chat = await ChatRoom.findById(chatId)
      .populate('userId', 'name')
      .populate('lawyerId', 'name');

    if (!chat) {
      console.log('Chat room not found');
      return res.status(404).json({ error: 'Chat room not found' });
    }
    
    // Check if requesting user is authorized to access this chat
    const requestUserId = req.user._id.toString();
    const isLawyer = req.isLawyerDirect || req.user.role === 'lawyer';
    const isAdmin = req.user.role === 'admin';
    
    if (!isAdmin && 
        requestUserId !== chat.userId.toString() && 
        (!isLawyer || requestUserId !== chat.lawyerId.toString())) {
      console.log(`Unauthorized access attempt: User ${requestUserId} tried to access chat ${chatId}`);
      return res.status(403).json({ error: 'Not authorized to access this chat' });
    }

    // Check if there's a paid appointment
    const paidAppointment = await Appointment.findOne({
      userId: chat.userId,
      lawyerId: chat.lawyerId,
      isPaid: true,
      status: { $in: ['confirmed', 'completed'] }
    });
    
    if (!paidAppointment && !isAdmin && !isLawyer) {
      console.log('No paid appointment found for this chat');
      return res.status(403).json({ 
        error: 'You must have a paid appointment with this lawyer to access this chat', 
        code: 'NO_APPOINTMENT' 
      });
    }
    
    // Check appointment status
    let appointmentActive = false;
    if (paidAppointment) {
      appointmentActive = isAppointmentActive(paidAppointment);
    }

    console.log(`Returning chat history with ${chat.messages.length} messages, appointmentActive=${appointmentActive}`);
    
    res.json({
      ...chat.toObject(),
      appointmentActive
    });
  } catch (err) {
    console.error("Error fetching chat history:", err);
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
    
    console.log(`Fetching chats for user ${userId}`);
    
    // Verify user is accessing their own chats or is admin
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      console.log(`Access denied: User ${req.user._id} attempted to access chats for user ${userId}`);
      return res.status(403).json({ error: 'Not authorized to access these chats' });
    }
    
    // Get all chats for this user regardless of appointment status
    // This is important for seeing pending chat requests too
    const allChats = await ChatRoom.find({ userId })
      .populate('lawyerId', 'name specialization profilePicture')
      .sort({ lastActivity: -1 });
    
    console.log(`Found ${allChats.length} chats for user ${userId}`);
    
    // Return empty array if no chats found
    if (allChats.length === 0) {
      console.log(`No chats found for user ${userId}, returning empty array`);
      return res.json([]);
    }
    
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
    const formattedChats = allChats.map(chat => {
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
        lastActivity: chat.lastActivity,
        status: chat.status // Include the status
      };
    });
    
    res.json(formattedChats);
  } catch (err) {
    console.error("Error getting user chats:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getLawyerChats = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    
    console.log(`Getting chats for lawyer ${lawyerId}`);
    console.log("Authenticated user:", req.user);

    // Check if the current user is allowed to access these chats
    // If direct lawyer login, the ID should match
    // If user with lawyer role, should have a profile with this ID
    let canAccess = false;
    
    if (req.isLawyerDirect) {
      canAccess = req.user._id.toString() === lawyerId;
      console.log(`Direct lawyer access check: ${canAccess}`);
    } else if (req.user.role === 'lawyer') {
      // For now, allow access for simplicity
      canAccess = true;
      console.log('User with lawyer role, allowing access');
    } else if (req.user.role === 'admin') {
      canAccess = true;
      console.log('Admin user, allowing access');
    }
    
    if (!canAccess) {
      console.log('Access denied to lawyer chats');
      return res.status(403).json({ error: 'Not authorized to access these chats' });
    }
    
    // Get all chat rooms for this lawyer
    const chatRooms = await ChatRoom.find({ lawyerId })
      .populate('userId', 'name email')
      .sort({ lastActivity: -1 });
    
    console.log(`Found ${chatRooms.length} chats for lawyer ${lawyerId}`);
    
    // If no chats found, return empty array instead of 404
    if (chatRooms.length === 0) {
      console.log(`No chats found for lawyer ${lawyerId}, returning empty array`);
      return res.json([]);
    }
    
    // Format the response
    const formattedChats = chatRooms.map(chat => ({
      _id: chat._id,
      user: chat.userId ? {
        _id: chat.userId._id,
        name: chat.userId.name,
        email: chat.userId.email
      } : { name: 'Unknown User' },
      lastMessage: chat.messages.length > 0 ? 
        chat.messages[chat.messages.length - 1] : null,
      lastActivity: chat.lastActivity,
      status: chat.status, // Include the status
      appointmentId: chat.appointmentId,
      paymentStatus: chat.paymentStatus,
      unreadCount: chat.messages.filter(m => 
        m.sender === 'user' && !m.read
      ).length
    }));
    
    res.json(formattedChats);
  } catch (err) {
    console.error("Error getting lawyer chats:", err);
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

export const handleChatRequest = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { action } = req.body; // 'accept' or 'decline'
    
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "accept" or "decline"' });
    }
    
    const chat = await ChatRoom.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat room not found' });
    }
    
    // Check if request is from the lawyer
    const requestUserId = req.user._id.toString();
    const isLawyer = req.isLawyerDirect || req.user.role === 'lawyer';
    
    if (!isLawyer || (chat.lawyerId.toString() !== requestUserId)) {
      return res.status(403).json({ error: 'Only the lawyer can handle this chat request' });
    }
    
    // Update chat status based on lawyer's decision
    chat.status = action === 'accept' ? 'accepted' : 'declined';
    chat.isChatUnlocked = action === 'accept'; // Only unlock if accepted
    
    // Add system message
    const message = {
      sender: 'system',
      text: action === 'accept' 
        ? 'The lawyer has accepted the chat request. You can now chat.' 
        : 'The lawyer has declined the chat request. You may try again later.',
      timestamp: new Date(),
      read: true
    };
    
    chat.messages.push(message);
    await chat.save();
    
    // Notify the user via socket
    if (req.io) {
      req.io.to(`user-${chat.userId}`).emit('chatRequestUpdate', {
        chatId: chat._id,
        status: chat.status,
        message: message
      });
    }
    
    res.json({
      status: chat.status,
      message: action === 'accept' 
        ? 'Chat request accepted successfully' 
        : 'Chat request declined'
    });
  } catch (err) {
    console.error("Error handling chat request:", err);
    res.status(400).json({ error: err.message });
  }
};
