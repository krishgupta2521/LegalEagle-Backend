import mongoose from 'mongoose';

const lawyerSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  name: String,
  email: String,
  specialization: String,
  experience: Number,
  pricePerSession: Number,
  bio: {
    type: String,
    default: ''
  },
  education: {
    type: String,
    default: ''
  },
  profilePicture: {
    type: String,
    default: ''
  },
  availability: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    startTime: String,
    endTime: String
  }],
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  }
});

const Lawyer = mongoose.model('Lawyer', lawyerSchema);
export default Lawyer;
