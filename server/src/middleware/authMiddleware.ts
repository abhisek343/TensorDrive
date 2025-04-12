// server/src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// Define structure for user payload in JWT and attached to Request
interface UserPayload {
  userId: string;
  username: string;
  // Add other fields you included in the JWT payload during login
}

// Extend Express Request interface to include the user property
declare global {
    namespace Express {
        interface Request {
            user?: UserPayload; // Make user optional on Request type
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    // Get token from Authorization header (Bearer TOKEN)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract token part

    if (!token) {
        // No token provided
        res.status(401).json({ message: 'Access denied. No token provided.' });
        return;
    }

    if (!JWT_SECRET) {
         console.error("JWT_SECRET is not defined in authMiddleware!");
         res.status(500).json({ message: 'Server configuration error.' });
         return;
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;

        // Add user payload to the request object
        req.user = decoded;

        // Proceed to the next middleware or route handler
        next();
    } catch (error) {
        // Token is invalid (expired, wrong signature, etc.)
        console.error('JWT Verification Error:', error);
        if (error instanceof jwt.TokenExpiredError) {
             res.status(401).json({ message: 'Token expired.' });
        } else if (error instanceof jwt.JsonWebTokenError) {
             res.status(403).json({ message: 'Invalid token.' }); // Use 403 Forbidden for invalid token
        } else {
             res.status(403).json({ message: 'Token verification failed.' });
        }
    }
};