// client/src/utils/trainTfModel.ts
import * as tf from '@tensorflow/tfjs';

// Define the structure for training data points
interface TrainingData {
    input: number[];  // Input features (e.g., sensor readings + risk score)
    output: number[]; // Corresponding desired output controls (e.g., [1, 0, 0, 0] for forward)
}

// Define training parameters (adjust these based on experimentation)
const LEARNING_RATE = 0.001;
const EPOCHS = 5; // Number of training iterations over the buffer data
const BATCH_SIZE = 32;
const INPUT_NODES = 6; // Must match the size of the input array in TrainingData (e.g., 5 sensors + 1 risk)
const HIDDEN_NODES = 8; // Example: Number of neurons in the hidden layer (tune this)
const OUTPUT_NODES = 4; // Must match the size of the output array (forward, left, right, reverse)
const MIN_BUFFER_FOR_TRAINING = 100; // Minimum samples needed before training starts
const TARGET_LOSS = 0.1; // Example target loss threshold to consider the model "ready"

let currentModel: tf.Sequential | null = null; // Keep model instance between training calls
let isTraining = false; // Prevent concurrent training loops

/**
 * Defines the TensorFlow.js model architecture.
 * Should be similar in structure/complexity to the FNN it's learning from.
 * @returns A tf.Sequential model instance.
 */
function createTfModel(): tf.Sequential {
    const model = tf.sequential();

    // Input layer (shape excluding batch size)
    model.add(tf.layers.dense({
        inputShape: [INPUT_NODES],
        units: HIDDEN_NODES,
        activation: 'relu' // Rectified Linear Unit activation for hidden layer
    }));

    // Optional: Add more hidden layers if needed
    // model.add(tf.layers.dense({ units: ANOTHER_HIDDEN_SIZE, activation: 'relu' }));

    // Output layer (4 units for controls, sigmoid for independent probabilities 0-1)
    model.add(tf.layers.dense({
        units: OUTPUT_NODES,
        activation: 'sigmoid' // Sigmoid gives output between 0 and 1 for each control
    }));

    // Compile the model with optimizer and loss function
    model.compile({
        optimizer: tf.train.adam(LEARNING_RATE),
        // Use binaryCrossentropy for independent sigmoid outputs, or meanSquaredError if preferred
        loss: 'binaryCrossentropy', // Suitable for multi-label classification (each control is independent)
        // loss: 'meanSquaredError', // Alternative if treating outputs as regression targets
        // metrics: ['accuracy'], // Optional: track accuracy during training
    });

    console.log("TF.js training model created:");
    model.summary(); // Log model structure
    return model;
}

/**
 * Trains the TensorFlow.js model asynchronously using data from the buffer.
 *
 * @param trainingBuffer Array of collected TrainingData samples.
 * @param onTrainingComplete Callback function executed when training finishes.
 * Receives the trained model and a boolean indicating if target loss was met.
 * `(model: tf.Sequential | null, reachedTargetLoss: boolean) => void`
 */
export const startTraining = async (
    trainingBuffer: TrainingData[],
    onTrainingComplete: (model: tf.Sequential | null, reachedTargetLoss: boolean) => void
): Promise<void> => {

    if (isTraining) {
        console.log("Training already in progress. Skipping.");
        return;
    }
    if (trainingBuffer.length < MIN_BUFFER_FOR_TRAINING) {
        console.log(`Training buffer size (${trainingBuffer.length}) is less than minimum (${MIN_BUFFER_FOR_TRAINING}). Waiting for more data.`);
        return;
    }

    isTraining = true;
    console.log(`Starting TF.js training with ${trainingBuffer.length} samples...`);

    try {
        // Ensure model exists, create if not
        if (!currentModel) {
            currentModel = createTfModel();
        }

        // 1. Prepare Data: Convert buffer to Tensors
        const { xs, ys } = tf.tidy(() => { // Use tidy to auto-dispose intermediate tensors
            // Shuffle data for better training
            tf.util.shuffle(trainingBuffer);

            const inputs = trainingBuffer.map(d => d.input);
            const outputs = trainingBuffer.map(d => d.output);

            // Convert arrays to 2D tensors [numSamples, numFeatures]
            const inputTensor = tf.tensor2d(inputs, [inputs.length, INPUT_NODES]);
            const outputTensor = tf.tensor2d(outputs, [outputs.length, OUTPUT_NODES]);

            return { xs: inputTensor, ys: outputTensor };
        });

        // 2. Train the Model
        const history = await currentModel.fit(xs, ys, {
            epochs: EPOCHS,
            batchSize: BATCH_SIZE,
            shuffle: true, // Shuffle data within epochs as well
            validationSplit: 0.1, // Optional: use 10% of data for validation during training
            callbacks: { // Optional: log progress
                onEpochEnd: (epoch, logs) => {
                    if (logs) {
                       console.log(`Epoch ${epoch + 1}/${EPOCHS} - loss: ${logs.loss.toFixed(4)}, val_loss: ${logs.val_loss?.toFixed(4)}`);
                    }
                }
            }
        });

        // Dispose tensors after training
        tf.dispose([xs, ys]);

        // 3. Check if target loss was met
        const finalLoss = history.history.loss[history.history.loss.length - 1] as number;
        const reachedTarget = finalLoss <= TARGET_LOSS;
        console.log(`Training complete. Final loss: ${finalLoss.toFixed(4)}. Reached target loss (${TARGET_LOSS}): ${reachedTarget}`);

        // 4. Call the callback function
        onTrainingComplete(currentModel, reachedTarget);

    } catch (error) {
        console.error("Error during TF.js training:", error);
        onTrainingComplete(null, false); // Indicate failure
    } finally {
        isTraining = false; // Allow next training cycle
    }
};

/**
 * Optional: Function to potentially save the trained model (e.g., to IndexedDB)
 */
export const saveTrainedModel = async (model: tf.Sequential, modelName: string = 'user-tf-model'): Promise<void> => {
     if (!model) return;
     try {
         const saveResult = await model.save(`indexeddb://${modelName}`);
         console.log(`TF.js model saved to IndexedDB as '${modelName}'. Result:`, saveResult);
     } catch (error) {
         console.error(`Failed to save model to IndexedDB '${modelName}':`, error);
     }
};

/**
 * Optional: Function to load a previously saved model (e.g., from IndexedDB)
 */
export const loadTrainedModel = async (modelName: string = 'user-tf-model'): Promise<tf.Sequential | null> => {
    try {
        console.log(`Attempting to load TF.js model from IndexedDB: '${modelName}'`);
        const model = await tf.loadLayersModel(`indexeddb://${modelName}`) as tf.Sequential;
        console.log(`TF.js model '${modelName}' loaded successfully from IndexedDB.`);
        currentModel = model; // Update current model instance
        return model;
    } catch (error) {
        console.log(`Model '${modelName}' not found in IndexedDB or failed to load:`, error);
        return null;
    }
};