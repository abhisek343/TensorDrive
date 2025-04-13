// client/src/utils/trainTfModel.ts
import * as tf from '@tensorflow/tfjs';

// Define the structure for training data points
interface TrainingData {
    input: number[];
    output: number[];
}

// Define training parameters (adjust these based on experimentation)
const LEARNING_RATE = 0.010;
const EPOCHS = 40;
const BATCH_SIZE = 32;
const INPUT_NODES = 6;
const HIDDEN_NODES = 16;
const OUTPUT_NODES = 4;
const MIN_BUFFER_FOR_TRAINING = 100;
const TARGET_LOSS = 0.2;

// REMOVE the global model variable:
// let currentModel: tf.Sequential | null = null; // <<< REMOVE THIS LINE

let isTraining = false;

// createTfModel function remains the same...
function createTfModel(): tf.Sequential {
    const model = tf.sequential();
    model.add(tf.layers.dense({
        inputShape: [INPUT_NODES],
        units: HIDDEN_NODES,
        activation: 'relu'
    }));
    model.add(tf.layers.dense({
        units: OUTPUT_NODES,
        activation: 'sigmoid'
    }));
    model.compile({
        optimizer: tf.train.adam(LEARNING_RATE),
        loss: 'binaryCrossentropy',
    });
    console.log("TF.js training model created:");
    model.summary();
    return model;
}


/**
 * Trains the TensorFlow.js model asynchronously using data from the buffer.
 * Builds upon an existing model if provided.
 *
 * @param trainingBuffer Array of collected TrainingData samples.
 * @param existingModel The current model instance from TfBrain (or null if none exists).
 * @param onTrainingComplete Callback function executed when training finishes.
 * Receives the trained model and a boolean indicating if target loss was met.
 * `(model: tf.LayersModel | null, reachedTargetLoss: boolean) => void` // tf.LayersModel is compatible
 */
export const startTraining = async (
    trainingBuffer: TrainingData[],
    existingModel: tf.LayersModel | null, // <<< ADD parameter for existing model
    onTrainingComplete: (model: tf.LayersModel | null, reachedTargetLoss: boolean) => void
): Promise<void> => {

    if (isTraining) {
        console.log("Training already in progress. Skipping.");
        return;
    }
    if (trainingBuffer.length < MIN_BUFFER_FOR_TRAINING) {
        console.log(`Training buffer size (${trainingBuffer.length}) is less than minimum (${MIN_BUFFER_FOR_TRAINING}). Waiting for more data.`);
        // Optionally call onTrainingComplete(existingModel, false) if you want to signify no training occurred
        return;
    }

    isTraining = true;
    console.log(`Starting TF.js training with ${trainingBuffer.length} samples...`);

    let modelToTrain: tf.LayersModel | null = null; // Use tf.LayersModel type

    try {
        // Use the existing model if provided and valid, otherwise create a new one
        modelToTrain = existingModel;
        if (!modelToTrain) {
            console.log("No existing model provided, creating a new one.");
            modelToTrain = createTfModel(); // createTfModel returns tf.Sequential, which is compatible
        } else {
            // IMPORTANT: Double-check the existing model isn't disposed *before* training
            // This check might be overly cautious if TfBrain manages disposal well, but safer
            try {
                 // Attempt a simple operation to see if layers are disposed
                 if (modelToTrain.layers.length > 0) {
                     // Example: try getting weights (might throw if disposed)
                     modelToTrain.layers[0].getWeights();
                 }
                 console.log("Continuing training with existing model.");
            } catch (e: any) {
                 if (e.message.includes('disposed')) {
                    console.warn("Existing model appears disposed. Creating a new one instead.");
                    modelToTrain = createTfModel();
                 } else {
                     throw e; // Re-throw unexpected errors
                 }
            }
        }

        // 1. Prepare Data (remains the same)
        const { xs, ys } = tf.tidy(() => {
             tf.util.shuffle(trainingBuffer);
             const inputs = trainingBuffer.map(d => d.input);
             const outputs = trainingBuffer.map(d => d.output);
             const inputTensor = tf.tensor2d(inputs, [inputs.length, INPUT_NODES]);
             const outputTensor = tf.tensor2d(outputs, [outputs.length, OUTPUT_NODES]);
             return { xs: inputTensor, ys: outputTensor };
        });

        // 2. Train the Model (use modelToTrain)
        const history = await modelToTrain.fit(xs, ys, {
            epochs: EPOCHS,
            batchSize: BATCH_SIZE,
            shuffle: true,
            validationSplit: 0.1,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    if (logs) {
                        console.log(`Epoch ${epoch + 1}/${EPOCHS} - loss: ${logs.loss.toFixed(4)}, val_loss: ${logs.val_loss?.toFixed(4)}`);
                    }
                }
            }
        });

        // Dispose tensors after training
        tf.dispose([xs, ys]);

        // 3. Check if target loss was met (remains the same)
        const finalLoss = history.history.loss[history.history.loss.length - 1] as number;
        const reachedTarget = finalLoss <= TARGET_LOSS;
        console.log(`Training complete. Final loss: ${finalLoss.toFixed(4)}. Reached target loss (${TARGET_LOSS}): ${reachedTarget}`);

        // 4. Call the callback function with the trained model
        onTrainingComplete(modelToTrain, reachedTarget); // Pass back the model that was actually trained

    } catch (error) {
        console.error("Error during TF.js training:", error);
        // If an error occurred, pass back null or the original model depending on desired behavior
        onTrainingComplete(null, false); // Indicate failure
    } finally {
        isTraining = false;
    }
};

// ... (saveTrainedModel, loadTrainedModel if kept)