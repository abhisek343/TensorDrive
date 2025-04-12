// server/src/controllers/modelController.ts
import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import pool from '../db';

// Define the ModelMetadata type directly on the server side
// Ensure this matches the structure expected/sent by the client/listModels endpoint
interface ModelMetadata {
  name: string;
  description?: string;
  urlPath: string;
  inputShape: number[];
  outputNodes: number;
  timestamp?: string;
}

const MODELS_DIR = path.resolve(__dirname, '../../public/models');

// uploadModel function remains the same as the last version...
export const uploadModel = async (req: Request, res: Response): Promise<void> => {
    console.log('Executing uploadModel controller (finalized)...');
    console.log('Files potentially uploaded:', req.files);
    console.log('Body data:', req.body);

    const modelName = req.body.modelName;
    const description = req.body.description || null;

    if (!modelName || typeof modelName !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(modelName)) {
         res.status(400).json({ message: 'Invalid or missing modelName in request body. Use alphanumeric characters, underscores, or hyphens.'});
         return;
    }

    const modelDir = path.join(MODELS_DIR, modelName);
    const modelJsonPath = path.join(modelDir, 'model.json');
    const urlPath = `/models/${modelName}/model.json`;

    try {
        let inputShape: number[] = [];
        let outputNodes: number = 0;

        try {
            const modelJsonContent = await fs.readFile(modelJsonPath, 'utf-8');
            const modelJson = JSON.parse(modelJsonContent);
            inputShape = modelJson?.modelTopology?.config?.layers?.[0]?.batch_input_shape?.slice(1) || [];
            const outputLayer = modelJson?.modelTopology?.config?.layers?.slice(-1)[0];
            outputNodes = outputLayer?.config?.units || 0;

            if (inputShape.length === 0 || outputNodes === 0) {
                console.warn(`Could not reliably determine inputShape (${inputShape}) or outputNodes (${outputNodes}) from ${modelJsonPath}`);
            }
        } catch (parseError) {
            console.error(`Error reading or parsing ${modelJsonPath}:`, parseError);
            res.status(400).json({ message: `Failed to read or parse uploaded model.json for ${modelName}.` });
            return;
        }

        const result = await pool.query(
            `INSERT INTO models (name, description, url_path, input_shape, output_nodes)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (name) DO UPDATE SET
                description = EXCLUDED.description,
                url_path = EXCLUDED.url_path,
                input_shape = EXCLUDED.input_shape,
                output_nodes = EXCLUDED.output_nodes,
                timestamp = CURRENT_TIMESTAMP
             RETURNING *`,
            [modelName, description, urlPath, JSON.stringify(inputShape), outputNodes]
        );

        console.log(`Metadata for model '${modelName}' saved/updated successfully:`, result.rows[0]);
        res.status(201).json({
             message: `Model '${modelName}' uploaded and metadata saved.`,
             model: result.rows[0]
        });

    } catch (error) {
        console.error(`Error processing model upload for '${modelName}':`, error);
        res.status(500).json({ message: 'Failed to process model upload and save metadata.' });
    }
};

// listModels function remains the same as the last version...
export const listModels = async (req: Request, res: Response): Promise<void> => {
    console.log('Executing listModels controller (using database)...');
    try {
        const result = await pool.query(
            'SELECT name, description, url_path, input_shape::jsonb, output_nodes, timestamp FROM models ORDER BY timestamp DESC'
        );
        const modelsMetadata: ModelMetadata[] = result.rows.map(row => ({
            name: row.name,
            description: row.description,
            urlPath: row.url_path,
            inputShape: Array.isArray(row.input_shape) ? row.input_shape : [],
            outputNodes: row.output_nodes,
            timestamp: row.timestamp.toISOString(),
        }));
        res.status(200).json(modelsMetadata);
    } catch (error) {
        console.error('Error fetching models from database:', error);
        res.status(500).json({ message: 'Failed to list models from database.' });
    }
};