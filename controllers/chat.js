import ChatRoom from '../models/ChatRoom.js';
import User from '../models/User.js';
import Lawyer from '../models/LawyerProfile.js';

export const createChatRoom = async (req, res) => {
  try {
    const { userId, lawyerId } = req.body;

    const existingRoom = await ChatRoom.findOne({ userId, lawyerId });
    if (existingRoom) {
      return res.status(200).json(existingRoom);
    }

    const user = await User.findById(userId);
    const lawyer = await Lawyer.findById(lawyerId);

    if (!user || !lawyer) {
      return res.status(404).json({ error: 'User or lawyer not found' });
    }

    const chat = new ChatRoom({
      userId,
      lawyerId,
      messages: []
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

    res.json(chat);
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
