import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lawyer' },
  date: String,
  time: String,
  isPaid: Boolean,
  status: String,
});

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
