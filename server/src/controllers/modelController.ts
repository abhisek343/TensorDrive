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

/**
 * Handles the upload of model files (model.json, model.weights.bin) and saving metadata.
 */
export const uploadModel = async (req: Request, res: Response): Promise<void> => {
    console.log('Executing uploadModel controller (finalized)...');
    console.log('Files potentially uploaded:', req.files); // Log details about uploaded files
    console.log('Body data:', req.body); // Log associated form data

    const modelName = req.body.modelName;
    const description = req.body.description || null; // Optional description

    // Validate modelName
    if (!modelName || typeof modelName !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(modelName)) {
         res.status(400).json({ message: 'Invalid or missing modelName in request body. Use alphanumeric characters, underscores, or hyphens.'});
         // TODO: Consider cleaning up potentially created directory or uploaded files if validation fails early
         return;
    }

    // Construct paths
    const modelDir = path.join(MODELS_DIR, modelName);
    const modelJsonPath = path.join(modelDir, 'model.json'); // Standard name saved by TFJS
    // Check if required files were actually uploaded by Multer
    // req.files is an object like { modelJson: [File], modelWeights: [File] }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || !files.modelJson || !files.modelJson[0] || !files.modelWeights || !files.modelWeights[0]) {
        console.error(`[Debug Model Ctrl] Missing model.json or model.weights.bin in upload for ${modelName}`);
        res.status(400).json({ message: 'Missing required model files (model.json, model.weights.bin).' });
        // TODO: Clean up potentially created directory or partial uploads
        return;
    }

    // URL path client will use to fetch the model
    const urlPath = `/models/${modelName}/model.json`;

    try {
        // --- Parse model.json to extract metadata ---
        let inputShape: number[] = [];
        let outputNodes: number = 0;

        try {
            const modelJsonContent = await fs.readFile(modelJsonPath, 'utf-8');
            const modelJson = JSON.parse(modelJsonContent);

            // --- Add Detailed Log ---
            console.log("------------------------------------------");
            console.log("[Debug Model Ctrl] Parsed model.json content:");
            // Log only the first 1000 chars to avoid flooding console if huge
            console.log(JSON.stringify(modelJson, null, 2).substring(0, 1000) + "...");
            console.log("------------------------------------------");
            // --- End Detailed Log ---

            // Try common paths for TFJS LayersModel JSON topology
            // TFJS save format can vary slightly
            const topology = modelJson?.modelTopology || modelJson?.topology; // Check common top-level keys
            const modelConfig = topology?.config || modelJson?.model_config?.config; // Check nested config paths
            const layers = modelConfig?.layers; // Get layers array from config

            if (layers && Array.isArray(layers) && layers.length > 0) {
                // Input shape often in the first layer's batch_input_shape or config
                const firstLayerConfig = layers[0]?.config || layers[0]; // Get first layer's config object
                const batchInputShape = firstLayerConfig?.batch_input_shape;

                if (Array.isArray(batchInputShape) && batchInputShape.length > 1) {
                     inputShape = batchInputShape.slice(1); // Remove the batch dimension (null)
                     console.log(`[Debug Model Ctrl] Parsed batch_input_shape: [${batchInputShape.join(', ')}] -> Input Shape: [${inputShape.join(', ')}]`);
                } else {
                    console.warn(`[Debug Model Ctrl] Could not find valid batch_input_shape in first layer config.`);
                    inputShape = []; // Reset if not found
                }

                // Output nodes often in the last layer's config.units
                const lastLayerConfig = layers[layers.length - 1]?.config || layers[layers.length - 1];
                // Ensure units exists and is a number
                if (typeof lastLayerConfig?.units === 'number') {
                     outputNodes = lastLayerConfig.units;
                     console.log(`[Debug Model Ctrl] Parsed output nodes from last layer config: ${outputNodes}`);
                } else {
                    console.warn(`[Debug Model Ctrl] Could not find valid units in last layer config.`);
                    outputNodes = 0; // Reset if not found
                }

                 // Filter out null/undefined potentially introduced by batch_input_shape slice
                 inputShape = inputShape.filter((dim): dim is number => typeof dim === 'number' && dim !== null);

            } else {
                console.warn("[Debug Model Ctrl] Could not find layers array in model JSON topology/config.");
            }

            // Final check if parsing failed
            if (inputShape.length === 0 || outputNodes === 0) {
                 console.warn(`[Debug Model Ctrl] Failed to reliably determine inputShape or outputNodes from ${modelJsonPath}. Saving defaults ([], 0).`);
                 inputShape = []; // Ensure it's an empty array
                 outputNodes = 0; // Ensure it's zero
             }

        } catch (parseError) {
            console.error(`Error reading or parsing ${modelJsonPath}:`, parseError);
            // Attempt cleanup of uploaded files/directory if JSON parsing fails
             await fs.rm(modelDir, { recursive: true, force: true }).catch(rmErr => console.error(`Failed to clean up directory ${modelDir} after parse error:`, rmErr));
             res.status(400).json({ message: `Failed to read or parse uploaded model.json for ${modelName}. Upload cancelled.` });
            return; // Stop execution
        }

        // --- Save metadata to database ---
        // Use ON CONFLICT to handle cases where a model with the same name is re-uploaded
        const result = await pool.query(
             `INSERT INTO models (name, description, url_path, input_shape, output_nodes)
              VALUES ($1, $2, $3, $4::jsonb, $5) -- Ensure input_shape is treated as JSONB
              ON CONFLICT (name) DO UPDATE SET
                 description = EXCLUDED.description,
                 url_path = EXCLUDED.url_path,
                 input_shape = EXCLUDED.input_shape,
                 output_nodes = EXCLUDED.output_nodes,
                 timestamp = CURRENT_TIMESTAMP -- Update timestamp on conflict
              RETURNING *`,
             // Ensure we pass valid data even if parsing failed
             [modelName, description, urlPath, JSON.stringify(inputShape), outputNodes]
         );

        console.log(`Metadata for model '${modelName}' saved/updated successfully:`, result.rows[0]);
        res.status(201).json({
             message: `Model '${modelName}' uploaded and metadata saved.`,
             model: result.rows[0] // Send back the saved/updated metadata
        });

    } catch (error) {
        // Catch errors from database query or other potential issues
        console.error(`Error processing model upload DB insert/update for '${modelName}':`, error);
        // Attempt to clean up uploaded files/directory if DB operation failed
        await fs.rm(modelDir, { recursive: true, force: true }).catch(rmErr => console.error(`Failed to clean up directory ${modelDir} after DB error:`, rmErr));
        res.status(500).json({ message: 'Failed to process model upload and save metadata.' });
    }
};

/**
 * Lists available models from the database.
 */
export const listModels = async (req: Request, res: Response): Promise<void> => {
    console.log('Executing listModels controller (using database)...');
    try {
        // Select necessary columns and cast input_shape back to JSON (though query returns it parsed)
        const result = await pool.query(
            'SELECT name, description, url_path, input_shape::jsonb, output_nodes, timestamp FROM models ORDER BY timestamp DESC'
        );

        // Map database rows to the expected ModelMetadata structure
        const modelsMetadata: ModelMetadata[] = result.rows.map(row => ({
            name: row.name,
            description: row.description,
            urlPath: row.url_path,
            // Ensure input_shape is always an array, even if null/invalid in DB
            inputShape: Array.isArray(row.input_shape) ? row.input_shape : [],
            outputNodes: row.output_nodes || 0, // Default to 0 if null/invalid in DB
            timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : undefined, // Format timestamp
        }));

        res.status(200).json(modelsMetadata);
    } catch (error) {
        console.error('Error fetching models from database:', error);
        res.status(500).json({ message: 'Failed to list models from database.' });
    }
};