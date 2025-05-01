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
      sender: {
        type: String,
        enum: ['user', 'lawyer'],
        required: true
      },
      text: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      read: {
        type: Boolean,
        default: false
      }
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Add indexes to improve query performance
chatRoomSchema.index({ userId: 1, lawyerId: 1 }, { unique: true });
chatRoomSchema.index({ userId: 1 });
chatRoomSchema.index({ lawyerId: 1 });
chatRoomSchema.index({ lastActivity: -1 });

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);
export default ChatRoom;
