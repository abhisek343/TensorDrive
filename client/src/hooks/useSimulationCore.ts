// client/src/hooks/useSimulationCore.ts (Fixes Applied)
import { useRef, useEffect, useCallback, RefObject } from 'react';
import * as tf from '@tensorflow/tfjs';

import { Car } from '../simulation/Car';
import { Road } from '../simulation/Road';
import { getRandomColor } from '../simulation/helpers';
import { NeuralNetwork, Level } from '../simulation/NeuralNetwork';
import { Visualizer } from '../simulation/Visualizer';
import { ControlMode } from '../components/BrainToggle';
// --- FIX: Added imports ---
import { TfBrain, BrainInput, BrainOutput } from '../simulation/TfBrain';

// Interfaces
interface SimulationConfig { numCars: number; mutationRate?: number; }
interface TrainingData { input: number[]; output: number[]; }

interface UseSimulationCoreProps {
  config: SimulationConfig;
  controlMode: ControlMode;
  isTFActive: boolean;
  tfBrainModel: tf.LayersModel | null;
  onDataCapture: (data: TrainingData) => void;
  tfBrainRef: RefObject<TfBrain | null>; // Prop already present in user-provided file
}

// Return type
interface SimulationCoreHandles {
  carCanvasRef: RefObject<HTMLCanvasElement | null>;
  networkCanvasRef: RefObject<HTMLCanvasElement | null>;
  bestCarRef: RefObject<Car | null>;
}

// Helper function
function isNeuralNetworkStructure(brain: any): brain is NeuralNetwork {
    return brain && Array.isArray(brain.levels) && brain.levels.length > 0;
}

export const useSimulationCore = ({
  config,
  controlMode,
  isTFActive,
  tfBrainModel,
  onDataCapture,
  tfBrainRef
}: UseSimulationCoreProps): SimulationCoreHandles => {

  // --- Refs ---
  const carCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const networkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const carsRef = useRef<Car[]>([]);
  const bestCarRef = useRef<Car | null>(null);
  const trafficRef = useRef<Car[]>([]);
  const roadRef = useRef<Road | null>(null);
  const animationFrameIdRef = useRef<number>(0);
  const lastBestCarY = useRef<number>(Infinity);

  // --- Car & Traffic Generation ---
  const generateCars = useCallback((N: number, road: Road): Car[] => {
    // (Implementation from user file - logs included)
    console.log(`[Debug] Hook: Generating ${N} AI cars...`);
    const carsArr: Car[] = [];
    const startX = road.getLaneCenter(1);
    const bestBrainData = localStorage.getItem("bestBrain_fnn");
    let loadedBrain: NeuralNetwork | null = null;
    if (bestBrainData) {
        try { const parsed = JSON.parse(bestBrainData); if (isNeuralNetworkStructure(parsed)) loadedBrain = parsed as NeuralNetwork; }
        catch (e) { console.error("[Debug] Hook: Failed to parse best FNN brain JSON.", e); }
    }
    for (let i = 0; i < N; i++) {
        const car = new Car(startX, 100, 30, 50, 'AI', 3);
        if (car.brain && isNeuralNetworkStructure(car.brain)) {
            if (i === 0 && loadedBrain && isNeuralNetworkStructure(loadedBrain)) {
                car.brain.levels = JSON.parse(JSON.stringify(loadedBrain.levels));
            } else if (i !== 0) {
                 if (typeof NeuralNetwork.mutate === 'function') NeuralNetwork.mutate(car.brain, config.mutationRate || 0.1);
            }
        }
        carsArr.push(car);
    }
    return carsArr;
  }, [config.mutationRate, config.numCars]);

  const generateTraffic = useCallback((road: Road): void => {
    // (Implementation from user file - logs included)
    const newTraffic: Car[] = []; const numTrafficCars = 50;
    for (let i = 0; i < numTrafficCars; i++) {
        const laneIndex = Math.floor(Math.random() * road.laneCount); const y = -i * 150 - 100;
        newTraffic.push(new Car(road.getLaneCenter(laneIndex), y, 30, 50, "DUMMY", 2, getRandomColor()));
    }
    trafficRef.current = newTraffic;
    console.log(`[Debug] Hook: Generated ${trafficRef.current.length} traffic cars.`);
  }, []);


  // --- Animation Loop ---
  const startAnimationLoop = useCallback(() => {
    // (Implementation from user file - includes TF control logic)
    const carCanvas = carCanvasRef.current; const networkCanvas = networkCanvasRef.current; const road = roadRef.current;
    if (!carCanvas || !networkCanvas || !road) return;
    const carCtx = carCanvas.getContext("2d"); const networkCtx = networkCanvas.getContext("2d");
    if (!carCtx || !networkCtx) return;
    let lastTime = 0;

    const animate = (time: number) => {
        const deltaTime = time - lastTime; lastTime = time;
        const currentTraffic = trafficRef.current; const currentCars = carsRef.current; const currentRoad = roadRef.current;
        if (!carCtx || !networkCtx || !currentRoad) return;

        currentTraffic.forEach((t) => t.update(currentRoad.borders, []));

        let frameBestCar: Car | null = null; let minY = Infinity;
        currentCars.forEach((car) => {
            let tfControls: BrainOutput | null = null;
            // --- Check if TF should predict for this car ---
            if (car.controlType === 'AI' && isTFActive && tfBrainRef.current?.isModelLoaded()) {
                if (car.sensor) {
                    // --- FIX: Add check for valid sensor readings before predicting ---
                    // Check if readings is an array and has the expected length (5 sensors for 6 inputs total)
                    const expectedSensorLength = 5; // Adjust if your INPUT_NODES (e.g., 6) - 1 is different
                    if (Array.isArray(car.sensor.readings) && car.sensor.readings.length === expectedSensorLength) {
                        // --- Prediction logic moved inside the check ---
                        const riskInput = car.riskAssessment ? car.riskAssessment.highestRiskScore : 0;
                        const brainInput: BrainInput = {
                            sensorReadings: car.sensor.readings.map(s => s?.offset ?? null),
                            riskScore: riskInput
                        };
                        tfControls = tfBrainRef.current.predict(brainInput); // Call predict only if readings are valid
                        // --- End of moved prediction logic ---
                    } else {
                         // Log if sensor readings are invalid when prediction is expected
                         console.warn(`[Debug Hook] Skipping TF prediction for car ID ${car.id} this frame - invalid sensor readings length: ${car.sensor.readings?.length}, expected: ${expectedSensorLength}`);
                    }
                    // --- END FIX ---
                } else {
                    // Log if TF is active but the car has no sensor object
                    console.warn(`[Debug Hook] TF active for car ID ${car.id}, but sensor is missing.`);
                }
           }
           // Pass TF controls (or null/undefined if not generated) to car.update
           // This line remains *after* the prediction block
           car.update(currentRoad.borders, currentTraffic, tfControls ?? undefined);
            car.update(currentRoad.borders, currentTraffic, tfControls ?? undefined); // Pass TF controls or undefined
            if (car.controlType === 'AI' && !car.damaged && car.y < minY) { minY = car.y; frameBestCar = car; }
        });

        const newBestCar = frameBestCar || currentCars.find(c => c.controlType === 'AI' && !c.damaged) || null;
        if (newBestCar && newBestCar !== bestCarRef.current) {
            bestCarRef.current = newBestCar;
             if (bestCarRef.current?.brain && !isTFActive && isNeuralNetworkStructure(bestCarRef.current.brain)) {
                 localStorage.setItem("bestBrain_fnn", JSON.stringify(bestCarRef.current.brain));
             }
        }
        if (bestCarRef.current && Math.abs(bestCarRef.current.y - lastBestCarY.current) > 1) lastBestCarY.current = bestCarRef.current.y;

        if (bestCarRef.current?.controlType === 'AI' && !isTFActive && bestCarRef.current.lastFnnInputs) {
             const inputs = bestCarRef.current.lastFnnInputs;
             const controls = bestCarRef.current.controls;
             const outputs = [ controls.forward?1:0, controls.left?1:0, controls.right?1:0, controls.reverse?1:0 ];
             onDataCapture({ input: inputs, output: outputs });
        }

        carCanvas.height = window.innerHeight; networkCanvas.height = window.innerHeight;
        carCtx.save();
        const carToFollow = (controlMode === 'MANUAL' && carsRef.current.length > 0) ? carsRef.current[0] : bestCarRef.current;
        if (carToFollow) carCtx.translate(0, -carToFollow.y + carCanvas.height * 0.7);
        currentRoad.draw(carCtx); currentTraffic.forEach((car) => car.draw(carCtx));
        carCtx.globalAlpha = 0.2; currentCars.forEach((car) => { if (car !== carToFollow) car.draw(carCtx, false, false); });
        carCtx.globalAlpha = 1; if (carToFollow) carToFollow.draw(carCtx, true, true);
        carCtx.restore();

        networkCtx.clearRect(0, 0, networkCanvas.width, networkCanvas.height);
        const brainToVisualize = bestCarRef.current;
        if (brainToVisualize) {
             if (isTFActive && tfBrainModel) Visualizer.drawTfNetwork(networkCtx, tfBrainModel);
             else if (brainToVisualize.brain && isNeuralNetworkStructure(brainToVisualize.brain)) Visualizer.drawNetwork(networkCtx, brainToVisualize.brain);
             else { networkCtx.fillStyle = 'yellow'; networkCtx.font = '12px Arial'; networkCtx.textAlign = 'center'; networkCtx.fillText(`No Brain or Viz Disabled`, networkCanvas.width / 2, 20); }
        }

        animationFrameIdRef.current = requestAnimationFrame(animate);
    };
    cancelAnimationFrame(animationFrameIdRef.current);
    animationFrameIdRef.current = requestAnimationFrame(animate);

  }, [controlMode, isTFActive, tfBrainModel, onDataCapture, tfBrainRef]); // Dependencies from user file


  // --- Initialization Effect ---
  useEffect(() => {
    // (Implementation from user file - logs included)
    let isMounted = true;
    const carCanvas = carCanvasRef.current; const networkCanvas = networkCanvasRef.current;
    if (!carCanvas || !networkCanvas) return;
    carCanvas.width = 200; networkCanvas.width = 300;
    const carCtx = carCanvas.getContext("2d"); const networkCtx = networkCanvas.getContext("2d");
    if (!carCtx || !networkCtx) return;
    const road = new Road(carCanvas.width / 2, carCanvas.width * 0.9); roadRef.current = road;
    console.log("[Debug] Hook Init: Road created.");
    carsRef.current = generateCars(config.numCars || 100, road);
    bestCarRef.current = carsRef.current.length > 0 ? carsRef.current[0] : null;
    if (bestCarRef.current?.brain && !localStorage.getItem("bestBrain_fnn") && isNeuralNetworkStructure(bestCarRef.current.brain)) {
        localStorage.setItem("bestBrain_fnn", JSON.stringify(bestCarRef.current.brain));
    }
    generateTraffic(road);
    startAnimationLoop();
    return () => { isMounted = false; cancelAnimationFrame(animationFrameIdRef.current); };
  }, [config.numCars, generateCars, generateTraffic, startAnimationLoop]); // Dependencies from user file

  // Return refs
  return { carCanvasRef, networkCanvasRef, bestCarRef };
};