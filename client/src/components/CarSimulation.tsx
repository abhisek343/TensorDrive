// client/src/components/CarSimulation.tsx
import React, { useEffect, useCallback, useState, useRef } from 'react'; // Added useRef
import * as tf from '@tensorflow/tfjs';

// Import Simulation classes & helpers needed here or passed to hook
import { Car } from '../simulation/Car'; // Needed for bestCarRef type
// import { Road } from '../simulation/Road'; // Not directly needed here anymore
// import { getRandomColor } from '../simulation/helpers'; // Not directly needed here anymore
// import { NeuralNetwork } from '../simulation/NeuralNetwork'; // Not needed here
// import { Visualizer } from '../simulation/Visualizer'; // Not needed here

// Import TF, UI, Utils, Context, Hook
import { TfBrain, BrainInput } from '../simulation/TfBrain';
import { TfPredictionEngine } from '../simulation/TfPredictionEngine';
import BrainToggle, { ControlMode } from './BrainToggle';
import AIControlPanel from './AIControlPanel';
import { ModelMetadata, fetchAvailableModels } from '../utils/modelLoader';
import { authenticatedFetch } from '../utils/apiClient';
import { startTraining } from '../utils/trainTfModel';
import { useSimulationCore } from '../hooks/useSimulationCore'; // <-- Import the new hook

// --- Interfaces (remain the same) ---
interface TrainingData { input: number[]; output: number[]; }
interface SimulationConfig { numCars: number; mutationRate?: number; }
interface CarSimulationProps { config: SimulationConfig; }
interface User { id: string; username: string; }

// --- Constants (remain the same) ---
const MIN_BUFFER_FOR_TRAINING = 500;
const TRAIN_CHECK_INTERVAL = 100;
const MAX_BUFFER_SIZE = 5000;
const UPLOAD_BATCH_SIZE = 500;
const UPLOAD_CHECK_INTERVAL = 200;

// --- Main Component ---
const CarSimulation: React.FC<CarSimulationProps> = ({ config }) => {
    // --- State (Keep state related to TF, Training, UI, Auth) ---
    const [controlMode, setControlMode] = useState<ControlMode>('AI');
    const [isTfReady, setIsTfReady] = useState(false);
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [isEngineRunning, setIsEngineRunning] = useState(false);
    const [availableModels, setAvailableModels] = useState<ModelMetadata[]>([]);
    const [selectedModelMeta, setSelectedModelMeta] = useState<ModelMetadata | null>(null);
    const [trainingBuffer, setTrainingBuffer] = useState<TrainingData[]>([]);
    const [tfModelReady, setTfModelReady] = useState<boolean>(false);
    const [isTrainingTfModel, setIsTrainingTfModel] = useState(false);
    const [isSendingData, setIsSendingData] = useState(false);
    // --- Auth State placeholder ---
    const authChecked = true;

    // --- Refs (Keep refs related to TF model/engine) ---
    const tfBrainRef = useRef<TfBrain | null>(null);
    const tfPredictionEngineRef = useRef<TfPredictionEngine | null>(null);
    // Frame counter moved here as it relates to triggering uploads/training
    const frameCounterRef = useRef<number>(0);

    // --- Instantiate the Core Simulation Hook ---
    const isTFActive = tfModelReady && controlMode === 'AI'; // Determine if TF is controlling

    // Callback for the hook to send captured data up to the component's state
    const handleDataCapture = useCallback((data: TrainingData) => {
         setTrainingBuffer(prev => {
             const buffer = [...prev, data];
             return buffer.length > MAX_BUFFER_SIZE ? buffer.slice(-MAX_BUFFER_SIZE) : buffer;
         });
    }, []); // Empty dependency array, setTrainingBuffer is stable

    const { carCanvasRef, networkCanvasRef, bestCarRef } = useSimulationCore({
        config,
        controlMode,
        isTFActive,
        tfBrainModel: tfBrainRef.current?.getModel() || null, // Pass current TF model for viz
        onDataCapture: handleDataCapture,
    });
    // --- End Hook Instantiation ---

    // --- Handlers (Keep handlers related to UI, TF, Auth, Sessions) ---
    const handleSaveSession = async () => { /* ... same logic using bestCarRef ... */ };
    const handleDisplaySessions = async () => { /* ... */ };
    const handleReset = () => { /* ... */ };
    const handleUploadModel = async () => { /* ... */ };

    // --- Send Training Data Batch (Stays here, depends on trainingBuffer state) ---
    const sendTrainingDataBatch = useCallback(async (batch: TrainingData[]) => { /* ... same logic ... */ }, [isSendingData]);

    // --- TF Training Trigger & Completion Handling (Stays here) ---
    const handleTrainingComplete = useCallback((trainedModel: tf.Sequential | null, reachedTargetLoss: boolean) => { /* ... same logic ... */ }, []); // Need empty array? Check dependencies if state is used inside
    const handleTriggerTfTraining = useCallback(() => { /* ... same logic ... */ }, [trainingBuffer, isTrainingTfModel, handleTrainingComplete]);

    // --- Mode Toggle & Model Change Handlers (Stay here) ---
    const handleModeToggle = (newMode: ControlMode) => { /* ... same logic ... */ };
    const handleModelChange = async (event: React.ChangeEvent<HTMLSelectElement>) => { /* ... same logic ... */ };


    // --- Effect for TF Ready and Initial Model Fetch (Stays here) ---
    useEffect(() => {
        let isMounted = true;
        console.log("Component: Initializing TF & Fetching Models...");
        tfBrainRef.current = new TfBrain(); // Init TF Brain wrapper here

        const initialize = async () => {
            try {
                await tf.ready(); if (!isMounted) return; setIsTfReady(true);
                const models = await fetchAvailableModels(); if (!isMounted) return; setAvailableModels(models);
                if(models[0]) setSelectedModelMeta(models[0]);
            } catch (error) { console.error("Component Init Error:", error); }
        };
        initialize();
        return () => { isMounted = false; tfBrainRef.current?.dispose(); }; // Dispose TfBrain on unmount
    }, []); // Run once

    // --- Effect to Periodically Trigger Training/Upload (Moved here from animate) ---
    useEffect(() => {
         // This effect runs whenever the component re-renders, which might be too often.
         // A better approach might use requestAnimationFrame or a timer *outside* the core hook,
         // or pass the frame count up from the hook.
         // For now, let's just use a simple interval timer.

         if (controlMode !== 'AI' || isTFActive) return; // Only trigger FNN related actions

         const intervalId = setInterval(() => {
              // Increment a counter outside React state to avoid re-renders
              frameCounterRef.current++;

               // Check Training Trigger
               if (frameCounterRef.current % TRAIN_CHECK_INTERVAL === 0) { handleTriggerTfTraining(); }
               // Check Upload Trigger
               if (frameCounterRef.current % UPLOAD_CHECK_INTERVAL === 0) {
                    // Access buffer via state directly here
                    if (trainingBuffer.length >= UPLOAD_BATCH_SIZE && !isSendingData) {
                         const batchToSend = trainingBuffer.slice(0, UPLOAD_BATCH_SIZE);
                         sendTrainingDataBatch(batchToSend);
                    }
               }
         }, 100); // Check roughly every 100ms

         return () => clearInterval(intervalId); // Cleanup interval

    }, [controlMode, isTFActive, trainingBuffer, isSendingData, handleTriggerTfTraining, sendTrainingDataBatch]);


    // --- Auth check effect --- (Placeholder)
    useEffect(() => { /* Assuming handled in App.tsx or context */ }, []);
    if (!authChecked) { return <div>Loading...</div>; }

     // --- Helper functions for AIControlPanel props (Stay here) ---
     const getTfModelStatus = (): 'None Loaded' | 'Loading...' | 'Loaded/Ready' | 'Not Ready' => { /* ... same ... */ return 'None Loaded'; }
     const getActiveBrainType = (): 'FNN' | 'TensorFlow.js' | 'MANUAL' | 'UNKNOWN' => { /* ... same ... */ return 'UNKNOWN'; }
     const getTfEngineStatus = (): 'Running' | 'Stopped' | 'N/A' => { /* ... same ... */ return 'N/A'; }

    // --- Render JSX ---
    return (
        <div style={{ display: 'flex', height: '100vh', background: '#333', color: 'white' }}>
             {/* Canvas refs are now provided by the hook */}
             <canvas ref={carCanvasRef} id="carCanvas" style={{ background: 'lightgray' }} height={window.innerHeight} width={200} />
             <div id="controlPanel" style={{ display: 'flex', flexDirection: 'column', margin: '10px', padding: '10px', background: '#444', borderRadius: '5px', gap: '10px', minWidth: '220px' }} >
                 {/* UI Elements remain the same, using component state */}
                 <BrainToggle currentMode={controlMode} onToggle={handleModeToggle} disabled={isModelLoading || !isTfReady} />
                 <div style={{ borderTop: '1px solid #666', paddingTop: '10px'}}>
                     <label htmlFor="modelSelect" style={{ display:'block', marginBottom:'3px', fontWeight:'bold' }}>Load Saved TF Model:</label>
                     <select id="modelSelect" value={selectedModelMeta?.urlPath || ''} onChange={handleModelChange} disabled={isModelLoading || availableModels.length === 0} style={{ padding: '5px', width: '100%', marginBottom: '5px' }} >
                          <option value="" disabled> {isModelLoading ? "Loading..." : (availableModels.length === 0 ? "No saved models" : "-- Select Model --")} </option>
                          {availableModels.map(model => (<option key={model.urlPath} value={model.urlPath}>{model.name}</option>))}
                     </select>
                     {selectedModelMeta && <div style={{fontSize: '0.8em', color: '#ccc'}}>Desc: {selectedModelMeta.description || 'N/A'}</div>}
                 </div>
                 <button onClick={handleTriggerTfTraining} title="Manually trigger TF training cycle using buffer" disabled={isTrainingTfModel || trainingBuffer.length < MIN_BUFFER_FOR_TRAINING}>
                      {isTrainingTfModel ? 'Training TF...' : `Train TF (${trainingBuffer.length})`}
                 </button>
                 <hr style={{width: '100%', border: 'none', borderTop: '1px solid #666'}}/>
                 {/* Pass bestCarRef.current to disabled check if needed */}
                 <button onClick={handleSaveSession} title="Save Current Session Data" disabled={!bestCarRef.current}>💾 Save Session</button>
                 <button onClick={handleDisplaySessions} title="Display Session History (TODO)">📊 Show Sessions</button>
                 <button onClick={handleReset} title="Reset Simulation">🔄 Reset</button>
                  <AIControlPanel
                      activeBrainType={getActiveBrainType()}
                      trainingBufferSize={trainingBuffer.length}
                      maxBufferSize={MAX_BUFFER_SIZE}
                      isTrainingTFModel={isTrainingTfModel}
                      tfModelStatus={getTfModelStatus()}
                      tfEngineStatus={getTfEngineStatus()}
                  />
              </div>
             {/* Canvas refs are now provided by the hook */}
             <canvas ref={networkCanvasRef} id="networkCanvas" style={{ background: '#222' }} height={window.innerHeight} width={300} />
        </div>
    );
};

export default CarSimulation;