import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  walletBalance: {
    type: Number,
    default: 0,
  },
  role: {
    type: String,
    enum: ['user', 'lawyer'],
    default: 'user',
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

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateSessionToken = function() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2);
  const token = `${timestamp}-${random}`;
  this.sessions.push({ token });
  return token;
};

userSchema.methods.removeSession = function(token) {
  this.sessions = this.sessions.filter(session => session.token !== token);
};

const User = mongoose.model('User', userSchema);
export default User;
