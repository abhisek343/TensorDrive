// client/src/simulation/TfBrain.ts
import * as tf from '@tensorflow/tfjs';

export interface BrainInput {
    sensorReadings: (number | null)[]; // Use offset (0-1) or null
    riskScore?: number;
}

export interface BrainOutput {
    forward: boolean;
    left: boolean;
    right: boolean;
    reverse: boolean;
}

// Define expected input size based on your constants (e.g., from trainTfModel.ts)
const EXPECTED_INPUT_NODES = 6; // Or import this constant

export class TfBrain {
    private model: tf.LayersModel | null = null; // Can be LayersModel or Sequential
    private inputShape: number[] | null = null; // Expected shape like [1, numFeatures]
    private outputNodes: number = 4;

    /**
     * Loads a pre-trained TensorFlow.js LayersModel from a specified URL.
     * @param url The URL path to the model.json file (e.g., '/models/my-model/model.json').
     * @param inputShape The expected shape of the input tensor (excluding batch size, e.g. [6]).
     * @param outputNodes The number of output nodes (controls).
     * @returns Promise that resolves when the model is loaded.
     */
    async loadModel(url: string, inputShape: number[], outputNodes: number = 4): Promise<void> {
        try {
            // Dispose previous model if any
            this.dispose();
            const loadedModel = await tf.loadLayersModel(url);
            this.model = loadedModel; // Assign the loaded model
            // Ensure inputShape passed is valid before reducing
             const totalFeatures = Array.isArray(inputShape) ? inputShape.reduce((a, b) => a + (b || 0), 0) : EXPECTED_INPUT_NODES; // Use constant as fallback
            this.inputShape = [1, totalFeatures];
            this.outputNodes = outputNodes;
            console.log(`TensorFlow.js model loaded successfully from ${url}. Expected input features: ${totalFeatures}`);
        } catch (error) {
            console.error(`Failed to load TensorFlow.js model from ${url}:`, error);
            this.model = null;
            this.inputShape = null; // Reset shape on failure
        }
    }

    /**
     * Sets an already trained/loaded model directly.
     * Useful for loading models trained in memory or from IndexedDB.
     * @param trainedModel The tf.Sequential or tf.LayersModel object.
     * @param inputShape The expected shape of the input tensor (excluding batch size, e.g. [6]).
     * @param outputNodes The number of output nodes (controls).
     */
    setModel(trainedModel: tf.LayersModel | tf.Sequential, inputShape: number[], outputNodes: number): void {
        if (!trainedModel || typeof trainedModel.predict !== 'function') {
            console.error("setModel error: Provided object is not a valid TensorFlow model.");
            return;
        }
        // Dispose previous model if any
        this.dispose();
        this.model = trainedModel as tf.LayersModel; // Cast to LayersModel for consistency if needed
         // Ensure inputShape passed is valid before reducing
         const totalFeatures = Array.isArray(inputShape) ? inputShape.reduce((a, b) => a + (b || 0), 0) : EXPECTED_INPUT_NODES; // Use constant as fallback
        this.inputShape = [1, totalFeatures]; // Store as [1, totalFeatures]
        this.outputNodes = outputNodes;
        console.log(`Trained TensorFlow.js model set directly in TfBrain. Expected input features: ${totalFeatures}`);
    }


    /**
     * Performs prediction using the loaded TensorFlow.js model.
     * @param inputs The BrainInput object containing sensor readings and other data.
     * @returns A BrainOutput object with control decisions, or null if the model isn't loaded.
     */
    predict(inputs: BrainInput): BrainOutput | null {
        if (!this.model || !this.inputShape) {
            console.warn('TF Prediction attempted before model was loaded/set or inputShape is missing.');
            return null; // Or return default controls
        }

        // --- LOGGING START ---
        console.log(`[Debug TfBrain Predict] Received inputs: sensorReadings length=${inputs?.sensorReadings?.length}, riskScore=${inputs?.riskScore}`);
        // --- LOGGING END ---

        const processedInputs: number[] = this.preprocessInputs(inputs);

        // --- LOGGING START ---
        console.log(`[Debug TfBrain Predict] Processed inputs length=${processedInputs.length}, Expected shape=${JSON.stringify(this.inputShape)} (expecting ${this.inputShape ? this.inputShape[1] : 'N/A'} features)`);
        // --- LOGGING END ---


        // Double check input length matches expected feature count
        // Use a guard against null this.inputShape just in case
        const expectedFeatures = this.inputShape ? this.inputShape[1] : EXPECTED_INPUT_NODES;
        if (processedInputs.length !== expectedFeatures) {
             console.error(`TF Predict Error: Input data length (${processedInputs.length}) does not match model's expected input size (${expectedFeatures})`);
             // Return default controls to potentially prevent downstream errors, or null
             return { forward: false, left: false, right: false, reverse: false };
        }

        const outputTensor = tf.tidy(() => {
            // Ensure input tensor shape matches [1, numFeatures]
            const inputTensor = tf.tensor2d([processedInputs], [1, expectedFeatures]);
            return this.model!.predict(inputTensor) as tf.Tensor;
        });

        const outputs = outputTensor.dataSync();
        tf.dispose(outputTensor); // Dispose the tensor to free memory

        return this.postprocessOutputs(outputs);
    }

    /**
     * Preprocesses the BrainInput object into a flat number array.
     * Converts sensor readings (offset or null) to values between 0 and 1.
     * Includes risk score if available. Order must match training.
     * @param inputs The BrainInput object.
     * @returns A flat array of numbers.
     */
    private preprocessInputs(inputs: BrainInput): number[] {
         // --- LOGGING START ---
         console.log(`[Debug TfBrain Preprocess] Preprocessing inputs: sensorReadings length=${inputs?.sensorReadings?.length}, riskScore=${inputs?.riskScore}`);
         // --- LOGGING END ---

         // --- DEFENSIVE CHECK START ---
         // Ensure sensorReadings is an array before mapping
         const sensorReadingsArray = Array.isArray(inputs?.sensorReadings) ? inputs.sensorReadings : [];
         const expectedSensorLength = (this.inputShape ? this.inputShape[1] : EXPECTED_INPUT_NODES) - 1; // Expecting INPUT_NODES - 1 sensor values

         if (sensorReadingsArray.length !== expectedSensorLength) {
             console.warn(`[Debug TfBrain Preprocess] Sensor readings length (${sensorReadingsArray.length}) !== expected (${expectedSensorLength}). Returning default zero array.`);
             // Return a default array of the *total expected length* to avoid crashing prediction
             return Array(expectedSensorLength + 1).fill(0);
         }
         // --- DEFENSIVE CHECK END ---

         // Map sensor readings: null -> 0, intersection -> 1 - offset
         const sensorValues = sensorReadingsArray.map(readingOffset =>
             readingOffset === null ? 0 : 1 - readingOffset
         );

         // Combine sensor values with other inputs (ensure order matches training)
         const combinedInputs = [
             ...sensorValues,
             inputs.riskScore !== undefined ? inputs.riskScore : 0, // Add risk score, default to 0
         ];

         return combinedInputs;
    }

    /**
     * Converts the raw numerical output of the TensorFlow model into a BrainOutput object.
     * Assumes sigmoid activation on the output layer and uses a 0.5 threshold.
     * @param rawOutputs The numerical array from the model's prediction.
     * @returns A BrainOutput object.
     */
    private postprocessOutputs(rawOutputs: Float32Array | Int32Array | Uint8Array): BrainOutput {
        if (rawOutputs.length !== this.outputNodes) {
            console.error(`TF Postprocess Error: Model output size (${rawOutputs.length}) does not match expected size (${this.outputNodes})`);
            return { forward: false, left: false, right: false, reverse: false }; // Return default
        }

        const threshold = 0.5; // Threshold for sigmoid activation
        return {
            forward: rawOutputs[0] > threshold,
            left:    rawOutputs[1] > threshold,
            right:   rawOutputs[2] > threshold,
            reverse: rawOutputs[3] > threshold,
        };
    }

    /**
     * Disposes of the TensorFlow.js model to free up GPU memory.
     */
    dispose(): void {
        if (this.model) {
            this.model.dispose();
            this.model = null;
            this.inputShape = null; // Also clear shape info on dispose
            console.log('TensorFlow.js model disposed.');
        }
    }

    /**
     * Checks if a model is currently loaded.
     * @returns True if a model is loaded, false otherwise.
     */
    isModelLoaded(): boolean {
        // Check both model existence and if inputShape has been set
        return this.model !== null && this.inputShape !== null;
    }

    /**
    * Gets the currently loaded model instance (read-only).
    * Be careful when using this externally.
    * @returns The tf.LayersModel or null.
    */
    getModel(): tf.LayersModel | null {
        return this.model;
    }
}