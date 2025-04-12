import express, { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
  saveSession,
  getAllSessions,
  getSessionById,
} from '../controllers/sessionController';

const router: Router = express.Router();

// Protect all /api/sessions routes with JWT
router.use(authenticateToken);

// POST /api/sessions - Save a session for the authenticated user
router.post('/', saveSession);

// GET /api/sessions - Get all sessions for the authenticated user
router.get('/', getAllSessions);

// GET /api/sessions/:id - Get a specific session (by session ID) for the authenticated user
router.get('/:id', getSessionById);

export default router;
