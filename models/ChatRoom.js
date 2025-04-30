import mongoose from 'mongoose';

const chatRoomSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lawyer' },
  isChatUnlocked: {
    type: Boolean,
    default: false,
  },
  messages: [
    {
      sender: String,
      text: String,
      timestamp: Date,
    },
  ],
});

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);
export default ChatRoom;
