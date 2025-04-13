// server/src/controllers/sessionController.ts
import { Request, Response } from 'express';
import pool from '../db'; // Import the PostgreSQL connection pool

/**
 * Saves a user-specific simulation session result to the database.
 */
export const saveSession = async (req: Request, res: Response): Promise<void> => {
    console.log('Executing saveSession controller for user:', req.user?.userId); // Log user ID
    try {
        // Extract userId from the authenticated request (added by authMiddleware)
        const userId = req.user?.userId;
        if (!userId) {
             // This should technically not happen if middleware is applied correctly
             res.status(401).json({ message: 'Authentication required.' });
             return;
        }

        const { score, path, model_used } = req.body;

        // Validate input types first
        if (typeof score !== 'number' || !path || typeof model_used !== 'string') {
            res.status(400).json({ message: 'Invalid session data. Required fields: score (number), path (json), model_used (string).' });
            return;
        }

        // --- FIX START ---
        // Round the score to the nearest integer before database insertion
        const roundedScore = Math.round(score);
        // --- FIX END ---

        const pathJsonb = typeof path === 'string' ? path : JSON.stringify(path);

        // Include user_id and use roundedScore in the INSERT statement
        const newSession = await pool.query(
            'INSERT INTO sessions (score, path, model_used, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [roundedScore, pathJsonb, model_used, userId] // Use roundedScore here
        );

        console.log('Session saved successfully:', newSession.rows[0]);
        res.status(201).json(newSession.rows[0]);

    } catch (error) {
        console.error('Error saving session:', error);
        // Check if the error is a database error and potentially provide more specific info
        if (error instanceof Error && 'code' in error) {
             console.error(`Database error code: ${error.code}`);
             // You could potentially check for specific DB error codes here
        }
        res.status(500).json({ message: 'Failed to save session data.' });
    }
};

/**
 * Retrieves a summary list of sessions belonging to the authenticated user.
 */
export const getAllSessions = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    console.log(`Executing getAllSessions controller for user: ${userId}`);
    if (!userId) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
    }

    try {
        // Filter sessions by the authenticated user's ID
        const allSessions = await pool.query(
            'SELECT id, score, timestamp, model_used FROM sessions WHERE user_id = $1 ORDER BY timestamp DESC',
            [userId] // Filter by user ID
        );
        res.status(200).json(allSessions.rows);

    } catch (error) {
        console.error(`Error retrieving sessions for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve session data.' });
    }
};

/**
 * Retrieves detailed data for a specific session by ID, ensuring it belongs to the authenticated user.
 */
export const getSessionById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId;
    console.log(`Executing getSessionById controller for ID: ${id}, User: ${userId}`);

    if (!userId) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
    }

    try {
        const sessionId = parseInt(id, 10);
        if (isNaN(sessionId)) {
            res.status(400).json({ message: 'Invalid session ID provided.' });
            return;
        }

        // Select session only if ID and user_id match
        const session = await pool.query(
            'SELECT * FROM sessions WHERE id = $1 AND user_id = $2',
            [sessionId, userId] // Check both session ID and user ID
        );

        if (session.rows.length === 0) {
            // Return 404 whether session doesn't exist OR belongs to another user
            res.status(404).json({ message: `Session with ID ${sessionId} not found for this user.` });
        } else {
            res.status(200).json(session.rows[0]);
        }

    } catch (error) {
        console.error(`Error retrieving session ID ${id} for user ${userId}:`, error);
        res.status(500).json({ message: `Failed to retrieve session data for ID ${id}.` });
    }
};