// server/src/controllers/authController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid'; // UUID generator
import pool from '../db';

const SALT_ROUNDS = 10; // Cost factor for bcrypt hashing
const JWT_SECRET = process.env.JWT_SECRET; // Load secret from environment variables

if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET environment variable is not set.");
    process.exit(1); // Exit if JWT secret is missing
}

/**
 * Handles user registration.
 */
export const register = async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
        res.status(400).json({ message: 'Username and password are required.' });
        return;
    }
    if (password.length < 6) { // Example minimum length
        res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        return;
    }

    try {
        // Check if username already exists
        const userCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) {
            res.status(409).json({ message: 'Username already exists.' }); // 409 Conflict
            return;
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const userId = uuidv4(); // Generate a new UUID for the user

        // Insert new user into the database
        const newUser = await pool.query(
            'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username, created_at',
            [userId, username, passwordHash]
        );

        console.log(`User registered: ${username} (ID: ${userId})`);
        res.status(201).json({ message: 'User registered successfully.', user: newUser.rows[0] });

    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

/**
 * Handles user login.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ message: 'Username and password are required.' });
        return;
    }

    try {
        // Find user by username
        const userResult = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);

        if (userResult.rows.length === 0) {
            res.status(401).json({ message: 'Invalid credentials.' }); // User not found
            return;
        }

        const user = userResult.rows[0];

        // Compare provided password with the stored hash
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials.' }); // Password doesn't match
            return;
        }

        // Passwords match, create JWT payload
        const payload = {
            userId: user.id,
            username: user.username
            // Add other relevant claims if needed (e.g., roles)
        };

        // Sign the JWT
        const token = jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '1d' } // Example: Token expires in 1 day
        );

        console.log(`User logged in: ${username}`);
        // Send the token back to the client
        res.status(200).json({
            message: 'Login successful.',
            token: token, // The client needs to store this token
            user: { id: user.id, username: user.username } // Send back basic user info
        });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};