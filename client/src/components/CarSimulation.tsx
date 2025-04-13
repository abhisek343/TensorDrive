// client/src/components/CarSimulation.tsx (Corrected Code for Continual Learning)
import React, { useEffect, useCallback, useState, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';

// Import Simulation classes & helpers
// (No direct Car import needed here if accessed via bestCarRef)

// Import TF, UI, Utils, Context, Hook
import { TfBrain } from '../simulation/TfBrain';
import { TfPredictionEngine } from '../simulation/TfPredictionEngine'; // Keep if TfPredictionEngine logic is reinstated
import BrainToggle, { ControlMode } from './BrainToggle';
import AIControlPanel from './AIControlPanel';
import { ModelMetadata, fetchAvailableModels, uploadTrainedModel } from '../utils/modelLoader'; // Added uploadTrainedModel
import { authenticatedFetch } from '../utils/apiClient'; // Use authenticatedFetch
import { startTraining } from '../utils/trainTfModel';
import { useSimulationCore } from '../hooks/useSimulationCore';

// --- Interfaces ---
interface TrainingData { input: number[]; output: number[]; }
interface SimulationConfig { numCars: number; mutationRate?: number; }
interface CarSimulationProps { config: SimulationConfig; }

// Define status types (matching AIControlPanel.tsx definitions)
type TFStatus = 'None Loaded' | 'Loading...' | 'Loaded/Ready' | 'Not Ready' | 'N/A';
type ActiveBrain = 'FNN' | 'TensorFlow.js' | 'MANUAL' | 'UNKNOWN';
type EngineStatus = 'Running' | 'Stopped' | 'N/A'; // Keep if TfPredictionEngine logic is reinstated

// --- Constants ---
// These likely need to match trainTfModel.ts and Car.ts sensor setup
const INPUT_NODES = 6; // e.g., 5 sensors + 1 risk score
const OUTPUT_NODES = 4; // forward, left, right, reverse
// Training/Upload constants
const MIN_BUFFER_FOR_TRAINING = 500;
const TRAIN_CHECK_INTERVAL = 100; // Check every N frames
const MAX_BUFFER_SIZE = 5000;
const UPLOAD_BATCH_SIZE = 500;
const UPLOAD_CHECK_INTERVAL = 200; // Check every N frames

// --- Main Component ---
const CarSimulation: React.FC<CarSimulationProps> = ({ config }) => {
    console.log("[Debug Simu Log] CarSimulation Component Mounted/Rendered. Config received:", config);

    // --- State ---
    const [controlMode, setControlMode] = useState<ControlMode>('AI');
    const [isTfReady, setIsTfReady] = useState(false); // TF Backend ready status
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [availableModels, setAvailableModels] = useState<ModelMetadata[]>([]);
    const [selectedModelMeta, setSelectedModelMeta] = useState<ModelMetadata | null>(null);
    const [trainingBuffer, setTrainingBuffer] = useState<TrainingData[]>([]);
    const [tfModelReady, setTfModelReady] = useState<boolean>(false); // Trained/Loaded TF Model ready status
    const [isTrainingTfModel, setIsTrainingTfModel] = useState(false);
    const [isSendingData, setIsSendingData] = useState(false); // State for tracking data uploads
    const [isTFActive, setIsTFActive] = useState<boolean>(false); // Is TF actually controlling?
    const authChecked = true; // Placeholder - Replace with actual auth context value

    // --- Refs ---
    const tfBrainRef = useRef<TfBrain | null>(null);
    // If using TfPredictionEngine, uncomment its ref and related logic
    // const tfPredictionEngineRef = useRef<TfPredictionEngine | null>(null);
    const frameCounterRef = useRef<number>(0);

    // --- Simulation Core Hook ---
    const handleDataCapture = useCallback((data: TrainingData) => {
         setTrainingBuffer(prev => {
             const buffer = [...prev, data];
             if (buffer.length % 100 === 0 && buffer.length > 0) console.log(`[Debug Simu Log State] Training buffer size: ${buffer.length}`);
             return buffer.length > MAX_BUFFER_SIZE ? buffer.slice(-MAX_BUFFER_SIZE) : buffer;
         });
    }, []);

    // Pass correct props including the added tfBrainRef
    const { carCanvasRef, networkCanvasRef, bestCarRef } = useSimulationCore({
         config,
         controlMode,
         isTFActive, // Pass the state variable
         tfBrainModel: tfBrainRef.current?.getModel() || null,
         onDataCapture: handleDataCapture,
         tfBrainRef: tfBrainRef // Pass the ref
    });

    // --- TF Model & Training Handlers ---

    const handleTrainingComplete = useCallback((
        trainedModel: tf.LayersModel | null, // Changed type to tf.LayersModel for compatibility
        reachedTargetLoss: boolean
    ) => {
        console.log(`[Debug Simu Log] handleTrainingComplete called. Model Trained: ${!!trainedModel}, Reached Target Loss: ${reachedTargetLoss}`);
        setIsTrainingTfModel(false); // Mark training as finished regardless of outcome

        if (trainedModel && reachedTargetLoss && tfBrainRef.current) {
            // Training was successful and met the target loss threshold
            console.log("[Debug Simu Log] Training successful and target loss reached.");
            try {
                 // Extract model input shape and output nodes
                 const modelInputLayer = trainedModel.layers[0]?.batchInputShape;
                 const modelOutputLayer = trainedModel.layers[trainedModel.layers.length - 1];

                 // Safely get output units using getConfig()
                 let outputNodes = OUTPUT_NODES; // Default fallback
                 if (modelOutputLayer && typeof (modelOutputLayer as any).getConfig === 'function') {
                     const outputLayerConfig = (modelOutputLayer as any).getConfig();
                     outputNodes = outputLayerConfig?.units ?? OUTPUT_NODES;
                 } else {
                    console.warn("[Debug Simu Log] Could not get config for output layer, using default OUTPUT_NODES.");
                 }

                 // Safely get input shape
                 const inputShapeMaybeNull = modelInputLayer?.slice(1) || [INPUT_NODES]; // Use constant as fallback
                 const inputShape = inputShapeMaybeNull.filter((dim): dim is number => typeof dim === 'number');

                // Validate extracted shapes before setting the model
                if (inputShape.length > 0 && outputNodes > 0) {
                    console.log(`[Debug Simu Log] Setting trained model in TfBrain. InputShape: [${inputShape.join(', ')}], OutputNodes: ${outputNodes}`);
                    // Set the newly trained model in the TfBrain instance
                    tfBrainRef.current.setModel(trainedModel, inputShape, outputNodes);
                    setTfModelReady(true); // Mark the TF brain as ready for use
                    console.log("[Debug Simu Log State] TfModelReady set to true.");

                    // Auto-switch to TF control if in AI mode
                    const autoSwitch = true; // Or make this configurable
                    if (autoSwitch && controlMode === 'AI') {
                        setIsTFActive(true); // Activate TF control
                        console.log("[Debug Simu Log State] Auto-switched to trained TF model control.");
                    }

                    // Clear the training buffer now that the model is updated
                    console.log("[Debug Simu Log] Clearing training buffer.");
                    setTrainingBuffer([]);

                    // Automatically upload the successfully trained model
                    const modelName = `auto-trained-${new Date().toISOString().replace(/[:.]/g, '-')}`;
                    console.log(`[Debug Simu Log] Attempting to upload trained model as: ${modelName}`);
                    uploadTrainedModel(trainedModel, modelName, 'Auto-trained model via browser')
                       .then(response => {
                           console.log(`[Debug Simu Log] Upload API Response status: ${response.status}`);
                           // Refresh available models list after successful upload
                           // Ensure fetchAvailableModels is imported if used here directly
                           // or call a function passed via props/context
                           fetchAvailableModels().then(setAvailableModels);
                       })
                       .catch(err => console.error("[Debug Simu Log] Error uploading trained model:", err));

                } else {
                    // If shapes couldn't be determined, log error and dispose model
                    console.error("[Debug Simu Log] Could not determine valid shape/nodes from trained model. Disposing model.");
                    trainedModel.dispose();
                }
            } catch(error) {
                 // Catch any errors during setModel or other operations
                 console.error("[Debug Simu Log] Error processing successful training result:", error);
                 if (trainedModel) trainedModel.dispose(); // Dispose model if processing failed
            }
        } else if (trainedModel) {
            // Training completed but target loss not met OR TfBrain ref missing
            console.log("[Debug Simu Log] Training completed but target loss not met or TfBrain ref missing. Disposing trained model.");
            trainedModel.dispose(); // Dispose the model as it won't be used
        } else {
            // Training failed entirely (no model returned from startTraining)
            console.log("[Debug Simu Log] Training failed (no model returned).");
        }
    }, [controlMode, setAvailableModels]); // Dependencies: controlMode for auto-switch logic, setAvailableModels for refresh after upload. Add others as needed (e.g., setTfModelReady, setIsTFActive, setTrainingBuffer).

    const handleTriggerTfTraining = useCallback(() => {
        console.log("[Debug Simu Log] handleTriggerTfTraining called.");
        if (isTrainingTfModel || trainingBuffer.length < MIN_BUFFER_FOR_TRAINING) {
             if (isTrainingTfModel) console.log("[Debug Simu Log] Training already in progress.");
             if (trainingBuffer.length < MIN_BUFFER_FOR_TRAINING) console.log(`[Debug Simu Log] Buffer size ${trainingBuffer.length} < ${MIN_BUFFER_FOR_TRAINING}`);
             return;
        }

        // --- Get the CURRENT model instance from TfBrain ---
        const currentTfModel = tfBrainRef.current ? tfBrainRef.current.getModel() : null;

        if (currentTfModel) {
            console.log("[Debug Simu Log] Passing existing TF model to startTraining.");
        } else {
            console.log("[Debug Simu Log] No existing TF model found, startTraining will create one.");
        }

        setIsTrainingTfModel(true);
        console.log("[Debug Simu Log State] isTrainingTfModel set to true.");
        // Pass the current model (or null) as the second argument
        startTraining(
            [...trainingBuffer], // Pass a copy of the buffer
            currentTfModel,      // Pass the potentially existing model
            handleTrainingComplete
        );
    }, [trainingBuffer, isTrainingTfModel, handleTrainingComplete]); // tfBrainRef is stable


    // --- Data Upload Handler ---
     const sendTrainingDataBatch = useCallback(async (batch: TrainingData[]) => {
         if (isSendingData) return; // Prevent concurrent sends
         console.log(`[Debug Simu Log] Attempting to send ${batch.length} training data points.`);
         setIsSendingData(true);
         try {
             const response = await authenticatedFetch('/api/training-data', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' }, // Ensure JSON header
                 body: JSON.stringify({ dataBatch: batch })
             });
             if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ message: response.statusText }));
                 throw new Error(`Failed to send training data: ${errorData.message || response.status}`);
             }
             const result = await response.json();
             console.log(`[Debug Simu Log] Successfully sent batch: ${result.message}`);
             // Remove the sent batch from the main buffer
             setTrainingBuffer(prev => prev.slice(batch.length));
         } catch (error) {
             console.error("[Debug Simu Log] Error sending training data batch:", error);
             // Handle error appropriately (e.g., retry logic, user notification)
         } finally {
             setIsSendingData(false);
         }
     }, [isSendingData]); // Depends on isSendingData state

     // --- UI Handlers ---
     const handleSaveSession = async () => {
         console.log("[Debug Simu Log] handleSaveSession called");
         if (!bestCarRef.current) {
             console.warn("[Debug Simu Log] Cannot save session, bestCarRef is null.");
             return;
         }
         const sessionData = {
             score: bestCarRef.current.y * -1, // Example score based on distance
             path: [], // Placeholder for actual path data
             model_used: isTFActive ? (selectedModelMeta?.name || 'auto-trained-tf') : 'fnn',
         };
         console.log("[Debug Simu Log] Saving session data:", sessionData);
         try {
             const response = await authenticatedFetch('/api/sessions', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(sessionData),
             });
             if (!response.ok) throw new Error('Failed to save session');
             const savedSession = await response.json();
             console.log("[Debug Simu Log] Session saved successfully:", savedSession);
             // Add user feedback (e.g., toast notification)
         } catch (error) {
             console.error("[Debug Simu Log] Error saving session:", error);
             // Add user feedback
         }
     };

     const handleDisplaySessions = async () => {
         console.log("[Debug Simu Log] handleDisplaySessions called (TODO: Implement display)");
         // Example: Fetch and log sessions
         try {
             const response = await authenticatedFetch('/api/sessions');
             if (!response.ok) throw new Error('Failed to fetch sessions');
             const sessions = await response.json();
             console.log("[Debug Simu Log] Fetched sessions:", sessions);
             // TODO: Display sessions in UI (e.g., modal)
         } catch (error) {
             console.error("[Debug Simu Log] Error fetching sessions:", error);
         }
     };

     const handleReset = () => {
         console.log("[Debug Simu Log] handleReset called - Reloading page.");
         // Simple way to reset - consider more sophisticated state reset if needed
         window.location.reload();
     };

     const handleModeToggle = useCallback((newMode: ControlMode) => {
         console.log(`[Debug Simu Log] handleModeToggle called with newMode: ${newMode}`);
         setControlMode(newMode);
         if (newMode === 'MANUAL') {
             setIsTFActive(false);
             console.log("[Debug Simu Log State] Switched to MANUAL control.");
         } else { // Switching to AI mode
             const canActivateTF = tfModelReady && tfBrainRef.current?.isModelLoaded() === true;
             setIsTFActive(canActivateTF);
             console.log(`[Debug Simu Log State] Switched to AI control. TF Active: ${canActivateTF}`);
         }
     }, [tfModelReady]); // Depends on tfModelReady state

     const handleModelChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
         const selectedPath = event.target.value;
         console.log(`[Debug Simu Log] handleModelChange called. Selected path: ${selectedPath}`);
         const model = availableModels.find(m => m.urlPath === selectedPath) || null;
         setSelectedModelMeta(model);

         if (model && tfBrainRef.current) {
             setIsModelLoading(true);
             setIsTFActive(false);
             setTfModelReady(false);
             console.log(`[Debug Simu Log] Attempting to load model '${model.name}'...`);
             try {
                 // Construct absolute URL if urlPath is relative
                 const modelUrl = model.urlPath.startsWith('http') ? model.urlPath : `${window.location.origin}${model.urlPath}`;
                 console.log(`[Debug Simu Log] Full model URL: ${modelUrl}`);

                 const inputShape = model.inputShape.filter((dim): dim is number => typeof dim === 'number');
                 if (inputShape.length === 0 || model.outputNodes === 0) {
                    throw new Error(`Invalid shape metadata for model ${model.name}: Input=[${inputShape.join(', ')}], Output=${model.outputNodes}`);
                 }

                 await tfBrainRef.current.loadModel(modelUrl, inputShape, model.outputNodes);

                 if (tfBrainRef.current.isModelLoaded()) {
                     setTfModelReady(true);
                     setIsTFActive(controlMode === 'AI'); // Activate only if AI mode is selected
                     console.log(`[Debug Simu Log] Model '${model.name}' confirmed loaded. TF Active: ${controlMode === 'AI'}`);
                 } else {
                     throw new Error("Model load reported success, but TfBrain is not ready.");
                 }
             } catch (error) {
                 console.error(`[Debug Simu Log] Error loading model ${model?.name}:`, error);
                 setTfModelReady(false);
                 setIsTFActive(false);
                 alert(`Failed to load model: ${model?.name}\nError: ${error instanceof Error ? error.message : String(error)}`); // User feedback
             } finally {
                 setIsModelLoading(false);
             }
         } else if (!model) {
             console.log("[Debug Simu Log] Model deselected.");
             // Optionally dispose current model if user selects "-- Select Model --"
             tfBrainRef.current?.dispose();
             setTfModelReady(false);
             setIsTFActive(false);
             setSelectedModelMeta(null);
         }
     };


     // --- Effects ---

    // Effect for TF Ready and Initial Model Fetch
     useEffect(() => {
         console.log("[Debug Simu Log Effect] Initializing TF Backend & Fetching Models...");
         let isMounted = true;
         tfBrainRef.current = new TfBrain(); // Instantiate TfBrain
         const initialize = async () => {
             try {
                 await tf.ready();
                 if (!isMounted) return;
                 setIsTfReady(true);
                 console.log("[Debug Simu Log Effect] TensorFlow.js backend ready.");

                 const models = await fetchAvailableModels();
                 if (!isMounted) return;
                 setAvailableModels(models);
                 // Do not automatically select/load the first model on mount anymore
                 // if (models[0]) setSelectedModelMeta(models[0]);
                 console.log("[Debug Simu Log Effect] Fetched available models:", models);

             } catch (error) {
                 console.error("Component Init Error:", error);
                 // Handle TF initialization error (e.g., show error message)
             }
         };
         initialize();
         return () => {
             isMounted = false;
             console.log("[Debug Simu Log Effect] Cleaning up CarSimulation - Disposing TfBrain.");
             tfBrainRef.current?.dispose();
             // Dispose prediction engine if used
             // tfPredictionEngineRef.current?.dispose();
         };
     }, []); // Run only once on mount


     // Effect to Periodically Trigger Training/Upload Checks
     useEffect(() => {
         // Only run checks when FNN is active (AI mode, TF not ready/active)
         if (controlMode !== 'AI' || isTFActive) {
             console.log(`[Debug Simu Log Effect] Periodic checks paused (Mode: ${controlMode}, TFActive: ${isTFActive}).`);
             return;
         }

         console.log(`[Debug Simu Log Effect] Starting periodic checks (Mode: ${controlMode}, TFActive: ${isTFActive}).`);
         const intervalId = setInterval(() => {
             frameCounterRef.current++;

             // Trigger Training Check
             if (frameCounterRef.current % TRAIN_CHECK_INTERVAL === 0) {
                 // console.log(`[Debug Simu Log Effect] Check Training Trigger: Buffer=${trainingBuffer.length}, Training=${isTrainingTfModel}`);
                 if (!isTrainingTfModel && trainingBuffer.length >= MIN_BUFFER_FOR_TRAINING) {
                     console.log(`[Debug Simu Log Effect] Triggering TF training (Buffer: ${trainingBuffer.length}).`);
                     handleTriggerTfTraining();
                 }
             }

             // Trigger Upload Check
             if (frameCounterRef.current % UPLOAD_CHECK_INTERVAL === 0) {
                 // console.log(`[Debug Simu Log Effect] Check Upload Trigger: Buffer=${trainingBuffer.length}, Sending=${isSendingData}`);
                 if (!isSendingData && trainingBuffer.length >= UPLOAD_BATCH_SIZE) {
                     console.log(`[Debug Simu Log Effect] Triggering data upload (Buffer: ${trainingBuffer.length}).`);
                     const batchToSend = trainingBuffer.slice(0, UPLOAD_BATCH_SIZE);
                     sendTrainingDataBatch(batchToSend);
                 }
             }
         }, 100); // Check roughly 10 times per second

         return () => {
             console.log("[Debug Simu Log Effect] Clearing periodic checks interval.");
             clearInterval(intervalId);
         };
     }, [controlMode, isTFActive, trainingBuffer, isTrainingTfModel, isSendingData, handleTriggerTfTraining, sendTrainingDataBatch]);

     // State change logging effects (for debugging)
     useEffect(() => { console.log(`[Debug Simu Log State] controlMode changed to: ${controlMode}`); }, [controlMode]);
     useEffect(() => { console.log(`[Debug Simu Log State] isTFActive changed to: ${isTFActive}`); }, [isTFActive]);
     useEffect(() => { console.log(`[Debug Simu Log State] tfModelReady changed to: ${tfModelReady}`); }, [tfModelReady]);
     useEffect(() => { console.log(`[Debug Simu Log State] isTrainingTfModel changed to: ${isTrainingTfModel}`); }, [isTrainingTfModel]);
     useEffect(() => { console.log(`[Debug Simu Log State] isModelLoading changed to: ${isModelLoading}`); }, [isModelLoading]);
     useEffect(() => { console.log(`[Debug Simu Log State] isSendingData changed to: ${isSendingData}`); }, [isSendingData]);

     // --- Auth check effect (Placeholder) ---
     useEffect(() => { /* Assuming handled in App.tsx or context */ }, []);
     if (!authChecked) {
         console.log("[Debug Simu Log] Auth check failed (placeholder), returning Loading...");
         return <div>Loading...</div>;
     }

     // --- Helper functions for AIControlPanel props ---
     const getTfModelStatus = (): TFStatus => {
         if (!isTfReady) return 'N/A'; // Backend not ready
         if (isModelLoading) return 'Loading...';
         if (tfBrainRef.current?.isModelLoaded() && tfModelReady) return 'Loaded/Ready';
         if (tfBrainRef.current?.isModelLoaded() && !tfModelReady) return 'Not Ready'; // e.g., loaded but training failed target
         return 'None Loaded';
     }
     const getActiveBrainType = (): ActiveBrain => {
         if (controlMode === 'MANUAL') return 'MANUAL';
         if (controlMode === 'AI') return isTFActive ? 'TensorFlow.js' : 'FNN';
         return 'UNKNOWN';
     }
     const getTfEngineStatus = (): EngineStatus => {
         // Update this if TfPredictionEngine is reintroduced
         return 'N/A';
     }

     // --- Render JSX ---
     return (
         <div style={{ display: 'flex', height: '100vh', background: '#333', color: 'white' }}>
             <canvas ref={carCanvasRef} id="carCanvas" style={{ background: 'lightgray' }} height={window.innerHeight} width={200} />
             <div id="controlPanel" style={{ display: 'flex', flexDirection: 'column', margin: '10px', padding: '10px', background: '#444', borderRadius: '5px', gap: '10px', minWidth: '220px' }} >
                 <BrainToggle
                     currentMode={controlMode}
                     onToggle={handleModeToggle}
                     // Disable toggle if a model is loading OR if TF backend isn't ready
                     disabled={isModelLoading || !isTfReady}
                 />
                 <div style={{ borderTop: '1px solid #666', paddingTop: '10px'}}>
                     <label htmlFor="modelSelect" style={{ display:'block', marginBottom:'3px', fontWeight:'bold' }}>Load Saved TF Model:</label>
                     <select
                         id="modelSelect"
                         value={selectedModelMeta?.urlPath || ''}
                         onChange={handleModelChange}
                         disabled={isModelLoading || availableModels.length === 0 || !isTfReady} // Disable if TF backend not ready
                         style={{ padding: '5px', width: '100%', marginBottom: '5px' }}
                     >
                          <option value="" disabled>
                              {!isTfReady ? "TF Backend Loading..." : (isModelLoading ? "Loading..." : (availableModels.length === 0 ? "No saved models" : "-- Select Model --"))}
                          </option>
                          {availableModels.map(model => (
                              <option key={model.urlPath} value={model.urlPath}>{model.name} ({new Date(model.timestamp || 0).toLocaleDateString()})</option>
                          ))}
                     </select>
                     {selectedModelMeta && <div style={{fontSize: '0.8em', color: '#ccc'}}>Desc: {selectedModelMeta.description || 'N/A'}</div>}
                 </div>
                 <button
                     onClick={handleTriggerTfTraining}
                     title="Manually trigger TF training cycle using buffer"
                     disabled={isTrainingTfModel || trainingBuffer.length < MIN_BUFFER_FOR_TRAINING || !isTfReady} // Disable if TF not ready
                 >
                     {isTrainingTfModel ? 'Training TF...' : `Train TF (${trainingBuffer.length})`}
                 </button>
                 <hr style={{width: '100%', border: 'none', borderTop: '1px solid #666'}}/>
                 <button onClick={handleSaveSession} title="Save Current Session Data (Placeholder - Requires Auth)" disabled={!bestCarRef.current}>💾 Save Session</button>
                 <button onClick={handleDisplaySessions} title="Display Session History (Placeholder - Requires Auth)">📊 Show Sessions</button>
                 <button onClick={handleReset} title="Reset Simulation">🔄 Reset</button>
                  <AIControlPanel
                      activeBrainType={getActiveBrainType()}
                      trainingBufferSize={trainingBuffer.length}
                      maxBufferSize={MAX_BUFFER_SIZE}
                      isTrainingTFModel={isTrainingTfModel}
                      tfModelStatus={getTfModelStatus()}
                      tfEngineStatus={getTfEngineStatus()} // Keep if TfPredictionEngine is used
                  />
             </div>
             <canvas ref={networkCanvasRef} id="networkCanvas" style={{ background: '#222' }} height={window.innerHeight} width={300} />
         </div>
     );
};

export default CarSimulation;