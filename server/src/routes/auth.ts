// server/src/routes/auth.ts
import express, { Router } from 'express';
import { register, login } from '../controllers/authController'; // Use .js extension here

const router: Router = express.Router();

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

export default router;