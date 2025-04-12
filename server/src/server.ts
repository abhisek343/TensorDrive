// server/src/server.ts
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import pool from './db';

// Import routers (add .js if needed)
import modelsRouter from './routes/models';
import sessionsRouter from './routes/sessions';
import authRouter from './routes/auth';
import trainingDataRouter from './routes/trainingData'; // <-- Import the new training data router

const app = express();
const PORT = process.env.PORT || 5000;

// === Middleware ===
app.use(cors());
app.use(express.json({ limit: '5mb' })); // Increase JSON body limit for potentially large batches
app.use(express.urlencoded({ extended: true, limit: '5mb' })); // Increase URL-encoded limit if needed

// --- Static File Serving ---
const modelsDirPath = path.resolve(__dirname, '../public/models');
console.log(`Serving static model files from: ${modelsDirPath}`);
app.use('/models', express.static(modelsDirPath));

// === API Routes ===
app.use('/api/auth', authRouter);
app.use('/api/models', modelsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/training-data', trainingDataRouter); // <-- Mount the training data router

// === Basic Root/Health Check Route ===
app.get('/', (req: Request, res: Response) => {
  res.send('Self-driving car simulation server is running.');
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});