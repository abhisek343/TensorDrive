import express, { Router } from 'express';
import uploadMiddleware from '../middleware/upload';
import { authenticateToken } from '../middleware/authMiddleware';
import { uploadModel, listModels } from '../controllers/modelController';

const router: Router = express.Router();

// POST /api/models/upload - PROTECTED: Requires authentication
router.post(
  '/upload',
  authenticateToken, // First: verify JWT
  uploadMiddleware.fields([
    { name: 'modelJson', maxCount: 1 },
    { name: 'modelWeights', maxCount: 10 }
  ]),
  uploadModel // Last: handle model file logic
);

// GET /api/models - PUBLIC: anyone can view model list
router.get('/', listModels);

export default router;
