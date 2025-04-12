// server/src/controllers/trainingDataController.ts
import { Request, Response } from 'express';
import pool from '../db'; // Import the PostgreSQL connection pool

// Define the expected structure for a single data point in the batch
interface TrainingDataPoint {
    input: number[];
    output: number[];
}

/**
 * Saves a batch of training data points for the authenticated user.
 * Expects { dataBatch: TrainingDataPoint[] } in the request body.
 */
export const saveTrainingDataBatch = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.userId; // Extracted by authMiddleware
    const { dataBatch } = req.body; // Expect an array under the key 'dataBatch'

    // Check authentication
    if (!userId) {
        // This check is technically redundant if authMiddleware is always applied first,
        // but good for clarity and robustness.
        res.status(401).json({ message: 'Authentication required.' });
        return;
    }

    // Validate input data format
    if (!Array.isArray(dataBatch) || dataBatch.length === 0) {
        res.status(400).json({ message: 'Invalid input: "dataBatch" must be a non-empty array.' });
        return;
    }

    // Further validation (optional but recommended)
    const isValidBatch = dataBatch.every(item =>
        item && Array.isArray(item.input) && Array.isArray(item.output)
        // Add checks for input/output array lengths if they are fixed
        // && item.input.length === EXPECTED_INPUT_LENGTH
        // && item.output.length === EXPECTED_OUTPUT_LENGTH
    );

    if (!isValidBatch) {
         res.status(400).json({ message: 'Invalid data format within dataBatch. Each item must have input and output arrays.' });
         return;
    }

    console.log(`Received request to save ${dataBatch.length} training data points for user ${userId}`);

    // Use a database transaction for atomicity
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // Prepare query for efficient insertion (adjust column names if needed)
        const insertQuery = `
            INSERT INTO training_data (user_id, input_data, output_data)
            VALUES ($1, $2::jsonb, $3::jsonb)
        `;

        // Execute insert for each data point in the batch
        // Consider using bulk insert methods for very large batches if performance is critical
        for (const dataPoint of dataBatch) {
            await client.query(insertQuery, [
                userId,
                JSON.stringify(dataPoint.input),  // Ensure input array is stored as JSONB
                JSON.stringify(dataPoint.output) // Ensure output array is stored as JSONB
            ]);
        }

        await client.query('COMMIT'); // Commit transaction if all inserts succeed

        console.log(`Successfully saved ${dataBatch.length} training data points for user ${userId}.`);
        res.status(201).json({ message: `Successfully saved ${dataBatch.length} training data points.` });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback transaction on any error
        console.error(`Error saving training data batch for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to save training data.' });
    } finally {
        client.release(); // Always release the client back to the pool
    }
};

// TODO: Add controllers for retrieving/managing training data if needed later
// export const getTrainingData = async (req: Request, res: Response) => { ... };
// export const deleteTrainingData = async (req: Request, res: Response) => { ... };