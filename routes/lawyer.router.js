import express from 'express';
import { getAllLawyers, createLawyerProfile } from '../controllers/lawyer.js';

const router = express.Router();

router.get('/', getAllLawyers);

router.post('/', createLawyerProfile);

export default router;
