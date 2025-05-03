import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const lawyerSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: false
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  licenseNumber: {
    type: String,
    required: true
  },
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
  },
  sessions: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 24 * 60 * 60
    }
  }]
});

// Hash password before saving
lawyerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

lawyerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

lawyerSchema.methods.generateSessionToken = function() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2);
  const token = `${timestamp}-${random}`;
  this.sessions.push({ token });
  return token;
};

lawyerSchema.methods.removeSession = function(token) {
  this.sessions = this.sessions.filter(session => session.token !== token);
};

const Lawyer = mongoose.model('Lawyer', lawyerSchema);
export default Lawyer;
