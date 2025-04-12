// server/src/routes/trainingData.ts
import express, { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware'; // Import auth middleware
import { saveTrainingDataBatch } from '../controllers/trainingDataController'; // Import controller

const router: Router = express.Router();

// POST /api/training-data - PROTECTED: Requires authentication
// Endpoint for submitting batches of training data
router.post('/', authenticateToken, saveTrainingDataBatch);

// TODO: Add other routes (e.g., GET) if needed later

export default router;