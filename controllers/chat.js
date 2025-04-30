import ChatRoom from '../models/ChatRoom.js';

export const createChatRoom = async (req, res) => {
  try {
    const chat = new ChatRoom(req.body);
    await chat.save();
    res.status(201).json(chat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const unlockChat = async (req, res) => {
  try {
    const chat = await ChatRoom.findById(req.params.chatId);
    chat.isChatUnlocked = true;
    await chat.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
