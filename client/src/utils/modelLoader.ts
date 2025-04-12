// client/src/utils/modelLoader.ts
import * as tf from '@tensorflow/tfjs'; // <-- Added missing import
import { authenticatedFetch } from './apiClient'; // Keep for potential future use

// --- Constants ---
const API_BASE_URL = 'http://localhost:5000'; // <-- Added missing constant
export const MODELS_BASE_PATH = '/models';

// --- Interface ---
export interface ModelMetadata { // <-- Added export
  name: string;
  description?: string;
  urlPath: string;
  inputShape: number[];
  outputNodes: number;
  timestamp?: string;
}

/**
 * Fetches a list of available models from the backend API (/api/models).
 * (Added export, restored body)
 */
export async function fetchAvailableModels(): Promise<ModelMetadata[]> { // <-- Added export
  const apiUrl = `${API_BASE_URL}/api/models`;
  console.log(`Workspaceing available models from: ${apiUrl}`);
  try {
     const response = await fetch(apiUrl);
     if (!response.ok) throw new Error(`Failed fetch models: ${response.status} ${response.statusText}`);
     const models: ModelMetadata[] = await response.json();
     if (!Array.isArray(models)) throw new Error('Invalid model list format.');
     console.log(`Workspaceed ${models.length} models.`);
     return models;
  } catch (error) {
    console.error("Error fetching models:", error); return [];
  }
}

/**
 * Constructs the full URL for a given model name.
 * (Restored body)
 */
export function getModelUrl(modelName: string): string { // <-- Added export
  const cleanModelName = modelName.replace(/^\/+|\/+$/g, '');
  return `${MODELS_BASE_PATH}/${cleanModelName}/model.json`;
}


/**
 * Saves a trained TFJS model by processing artifacts within a save handler
 * and uploading them along with metadata to the backend endpoint.
 * (Corrected save handler logic)
 */
export const uploadTrainedModel = async (
    model: tf.LayersModel | tf.Sequential,
    modelName: string,
    description: string = ''
): Promise<Response> => {
    console.log(`Preparing upload for '${modelName}'...`);

    try {
        // Call model.save with a handler that performs the upload internally
        const saveResult = await model.save(tf.io.withSaveHandler(
            // Explicitly type artifacts
            async (artifacts: tf.io.ModelArtifacts): Promise<tf.io.SaveResult> => {
                console.log("Inside save handler: Processing artifacts...");

                if (!artifacts?.modelTopology || !artifacts?.weightData) {
                    throw new Error("Handler: Invalid artifacts received.");
                }

                // Construct FormData
                const formData = new FormData();
                const topologyBlob = new Blob([JSON.stringify(artifacts.modelTopology)], { type: 'application/json' });
                formData.append('modelJson', topologyBlob, 'model.json');
                // Assert ArrayBuffer type for Blob constructor
                const weightsBlob = new Blob([artifacts.weightData as ArrayBuffer], { type: 'application/octet-stream' });
                formData.append('modelWeights', weightsBlob, 'model.weights.bin');
                formData.append('modelName', modelName);
                if (description) formData.append('description', description);

                console.log(`Handler: Uploading FormData for model '${modelName}'...`);

                // POST FormData
                const token = localStorage.getItem('authToken');
                const headers = new Headers();
                if (token) headers.append('Authorization', `Bearer ${token}`);
                const uploadUrl = `${API_BASE_URL}/api/models/upload`;

                const response = await fetch(uploadUrl, { method: 'POST', headers: headers, body: formData });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: response.statusText }));
                    throw new Error(errorData.message || `Upload failed: ${response.status}`);
                }
                console.log(`Handler: Model '${modelName}' uploaded successfully.`);
                await response.json(); // Consume response body

                // Return minimal required SaveResult structure
                const modelArtifactsInfo: tf.io.ModelArtifactsInfo = {
                    dateSaved: new Date(), modelTopologyType: 'JSON',
                };
                return { modelArtifactsInfo };

            } // End of handler
        )); // End of withSaveHandler call

        console.log(`Model '${modelName}' processed/uploaded via handler. SaveResult:`, saveResult);
        // Return a mock success response
        return new Response(JSON.stringify({ message: `Model '${modelName}' upload processed.`}), { status: 200 });

    } catch (error) {
        console.error(`Error during uploadTrainedModel for '${modelName}':`, error);
        throw error; // Re-throw
    }
};