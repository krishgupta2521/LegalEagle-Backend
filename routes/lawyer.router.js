import express from 'express';
import { 
  getAllLawyers, 
  createLawyerProfile, 
  getLawyerProfile, 
  getLawyerProfileByUserId,
  updateLawyerProfile,
  updateLawyerAvailability,
  registerLawyer,
  loginLawyer
} from '../controllers/lawyer.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', getAllLawyers);
router.post('/', authMiddleware, createLawyerProfile);
router.post('/register', registerLawyer);
router.post('/login', loginLawyer);
router.get('/:lawyerId', getLawyerProfile);
router.get('/user/:userId', authMiddleware, getLawyerProfileByUserId);
router.patch('/:lawyerId', authMiddleware, updateLawyerProfile);
router.patch('/:lawyerId/availability', authMiddleware, updateLawyerAvailability);

export default router;
