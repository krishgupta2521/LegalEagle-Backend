import mongoose from 'mongoose';

const lawyerSchema = new mongoose.Schema({
  name: String,
  email: String,
  specialization: String,
  experience: Number,
  pricePerSession: Number,
});

const Lawyer = mongoose.model('Lawyer', lawyerSchema);
export default Lawyer;
