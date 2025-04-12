// client/src/simulation/TfBrain.ts
import * as tf from '@tensorflow/tfjs';
// Removed: import { Point } from './helpers'; (Marked as unused previously)

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
            this.inputShape = [1, inputShape.reduce((a, b) => a + b, 0)]; // Store as [1, totalFeatures]
            this.outputNodes = outputNodes;
            console.log(`TensorFlow.js model loaded successfully from ${url}`);
        } catch (error) {
            console.error(`Failed to load TensorFlow.js model from ${url}:`, error);
            this.model = null;
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
        this.inputShape = [1, inputShape.reduce((a, b) => a + b, 0)]; // Store as [1, totalFeatures]
        this.outputNodes = outputNodes;
        console.log("Trained TensorFlow.js model set directly in TfBrain.");
    }


    /**
     * Performs prediction using the loaded TensorFlow.js model.
     * @param inputs The BrainInput object containing sensor readings and other data.
     * @returns A BrainOutput object with control decisions, or null if the model isn't loaded.
     */
    predict(inputs: BrainInput): BrainOutput | null {
        if (!this.model || !this.inputShape) {
            // console.warn('TF Prediction attempted before model was loaded/set.');
            return null; // Or return default controls
        }

        const processedInputs: number[] = this.preprocessInputs(inputs);

        // Double check input length matches expected feature count
        if (processedInputs.length !== this.inputShape[1]) {
             console.error(`TF Predict Error: Input data length (${processedInputs.length}) does not match model's expected input size (${this.inputShape[1]})`);
             return null;
        }

        const outputTensor = tf.tidy(() => {
            // Ensure input tensor shape matches [1, numFeatures]
            const inputTensor = tf.tensor2d([processedInputs], [1, this.inputShape![1]]);
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
        // Map sensor readings: null -> 0, intersection -> 1 - offset
        const sensorValues = inputs.sensorReadings.map(readingOffset =>
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
            console.log('TensorFlow.js model disposed.');
        }
    }

    /**
     * Checks if a model is currently loaded.
     * @returns True if a model is loaded, false otherwise.
     */
    isModelLoaded(): boolean {
        return this.model !== null;
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