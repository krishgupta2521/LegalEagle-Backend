import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  recipientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Lawyer',
    required: false
  },
  type: {
    type: String,
    enum: ['deposit', 'payment', 'refund'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  description: {
    type: String,
    default: ''
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add indexes to improve query performance
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ recipientId: 1, createdAt: -1 });
transactionSchema.index({ appointmentId: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
