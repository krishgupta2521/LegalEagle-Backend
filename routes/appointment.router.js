import express from 'express';
import { 
  bookAppointment, 
  getLawyerAppointments,
  getUserAppointments,
  updateAppointment,
  getAppointmentDetails
} from '../controllers/appointment.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authMiddleware, bookAppointment);
router.get('/lawyer/:lawyerId', authMiddleware, getLawyerAppointments);
router.get('/user/:userId', authMiddleware, getUserAppointments);
router.get('/:appointmentId', authMiddleware, getAppointmentDetails);
router.patch('/:appointmentId', authMiddleware, updateAppointment);

export default router;
