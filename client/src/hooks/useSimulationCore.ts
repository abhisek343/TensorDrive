// client/src/hooks/useSimulationCore.ts
import { useRef, useEffect, useCallback, RefObject } from 'react';
import * as tf from '@tensorflow/tfjs'; // For tf.LayersModel type

import { Car } from '../simulation/Car';
import { Road } from '../simulation/Road';
import { getRandomColor } from '../simulation/helpers';
// Assuming NeuralNetwork class/type definition is available or adapted
import { NeuralNetwork, Level } from '../simulation/NeuralNetwork'; // Keep if FNN logic is used, import Level if needed for type guards
import { Visualizer } from '../simulation/Visualizer';
import { ControlMode } from '../components/BrainToggle';

// Interfaces
interface SimulationConfig { numCars: number; mutationRate?: number; }
interface TrainingData { input: number[]; output: number[]; }

// Prop types
interface UseSimulationCoreProps {
  config: SimulationConfig;
  controlMode: ControlMode;
  isTFActive: boolean;
  tfBrainModel: tf.LayersModel | null;
  onDataCapture: (data: TrainingData) => void;
}

// Return type - Allow null refs
interface SimulationCoreHandles {
  carCanvasRef: RefObject<HTMLCanvasElement | null>; // Allow null
  networkCanvasRef: RefObject<HTMLCanvasElement | null>; // Allow null
  bestCarRef: RefObject<Car | null>;
}

// Helper function to check if an object looks like a NeuralNetwork structure
// You might need to adjust this based on your actual NeuralNetwork class/interface
function isNeuralNetworkStructure(brain: any): brain is NeuralNetwork {
    return brain && Array.isArray(brain.levels) && brain.levels.length > 0;
}


export const useSimulationCore = ({
  config,
  controlMode,
  isTFActive,
  tfBrainModel,
  onDataCapture
}: UseSimulationCoreProps): SimulationCoreHandles => {

  // --- Refs ---
  const carCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const networkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const carsRef = useRef<Car[]>([]);
  const bestCarRef = useRef<Car | null>(null);
  const trafficRef = useRef<Car[]>([]);
  const roadRef = useRef<Road | null>(null);
  const animationFrameIdRef = useRef<number>(0);
  const lastBestCarY = useRef<number>(Infinity); // Track changes in best car by Y position

  // --- Car & Traffic Generation ---
  const generateCars = useCallback((N: number, road: Road): Car[] => {
    console.log(`[Debug] Hook: Generating ${N} AI cars...`);
    const carsArr: Car[] = [];
    const startX = road.getLaneCenter(1);
    const bestBrainData = localStorage.getItem("bestBrain_fnn");
    let loadedBrain: NeuralNetwork | null = null;

    // Try parsing the saved brain structure first
    if (bestBrainData) {
        try {
            const parsed = JSON.parse(bestBrainData);
            // Basic structural check (adapt if needed)
            if (isNeuralNetworkStructure(parsed)) {
                loadedBrain = parsed as NeuralNetwork; // Cast if it matches the structure
                // console.log("[Debug] Hook: Parsed saved best FNN brain data.");
            } else {
                //  console.warn("[Debug] Hook: Parsed FNN brain data has unexpected structure.");
            }
        } catch (e) {
            console.error("[Debug] Hook: Failed to parse best FNN brain JSON.", e);
        }
    }

    for (let i = 0; i < N; i++) {
        const car = new Car(startX, 100, 30, 50, 'AI', 3);
        // Ensure car.brain is actually a NeuralNetwork instance or structure expected by NeuralNetwork.mutate
        if (car.brain && isNeuralNetworkStructure(car.brain)) {
            if (i === 0 && loadedBrain && isNeuralNetworkStructure(loadedBrain)) {
                // Copy structure from parsed data IF it exists and is valid
                // NOTE: This assumes NeuralNetwork has a method to copy levels correctly.
                // If NeuralNetwork instances are needed, you might need to instantiate and then copy.
                // A simple deep copy might work if levels are just data:
                car.brain.levels = JSON.parse(JSON.stringify(loadedBrain.levels));
                // console.log("[Debug] Hook: Applied saved best FNN brain structure to car 0.");
                // Don't mutate the first car if loading the best brain
            } else if (i !== 0) {
                 // Mutate other cars using the static method
                 if (typeof NeuralNetwork.mutate === 'function') {
                     NeuralNetwork.mutate(car.brain, config.mutationRate || 0.1);
                 } else {
                    //  console.warn("[Debug] Hook: NeuralNetwork.mutate static method not found.");
                 }
            }
        } else {
            //  console.warn(`[Debug] Hook: Car ${i} generated without a valid FNN brain structure.`);
        }
        carsArr.push(car);
    }
    // console.log(`[Debug] Hook: ${carsArr.length} cars generated.`);
    return carsArr;
  }, [config.mutationRate, config.numCars]);

  const generateTraffic = useCallback((road: Road): void => {
    // console.log("[Debug] Hook: Generating traffic...");
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
    // console.log("[Debug] Hook: Attempting to start animation loop...");
    const carCanvas = carCanvasRef.current;
    const networkCanvas = networkCanvasRef.current;
    const road = roadRef.current;
    if (!carCanvas || !networkCanvas || !road) {
        // console.error(`[Debug] Hook: Cannot start animation - refs missing. CarCanvas: ${!!carCanvas}, NetworkCanvas: ${!!networkCanvas}, Road: ${!!road}`);
        return; }
    const carCtx = carCanvas.getContext("2d");
    const networkCtx = networkCanvas.getContext("2d");
    if (!carCtx || !networkCtx) {
        console.error(`[Debug] Hook: Cannot start animation - contexts missing. CarCtx: ${!!carCtx}, NetworkCtx: ${!!networkCtx}`);
        return; }

    // console.log("[Debug] Hook: Animation loop successfully started.");

    let lastTime = 0; // For FPS calculation/logging

    const animate = (time: number) => {
        const deltaTime = time - lastTime;
        // const fps = 1000 / deltaTime;
        // console.log(`[Debug] Animate frame. Time: ${time.toFixed(0)}, Delta: ${deltaTime.toFixed(1)}, FPS: ${fps.toFixed(1)}`); // Log FPS
        lastTime = time;

        const currentTraffic = trafficRef.current;
        const currentCars = carsRef.current;
        const currentRoad = roadRef.current; // Get current value inside loop

        // --- Null Checks ---
        if (!carCtx || !networkCtx) {
             console.error("[Debug] Animate: Context lost during animation!");
             animationFrameIdRef.current = requestAnimationFrame(animate); // Still request next frame
             return;
        }
        if (!currentRoad) {
            console.error("[Debug] Animate: Road became null during animation loop!");
            animationFrameIdRef.current = requestAnimationFrame(animate);
            return;
        }
        // --- End Null Checks ---

        // 1. Update Traffic
        currentTraffic.forEach((t) => t.update(currentRoad.borders, []));

        // 2. Update AI/Player Cars & Find Best
        let frameBestCar: Car | null = null; let minY = Infinity;
        currentCars.forEach((car) => {
             car.update(currentRoad.borders, currentTraffic);
             if (car.controlType === 'AI' && !car.damaged && car.y < minY) {
                 minY = car.y;
                 frameBestCar = car;
             }
        });

        const newBestCar = frameBestCar || currentCars.find(c => c.controlType === 'AI' && !c.damaged) || null;
        if (newBestCar && newBestCar !== bestCarRef.current) {
            console.log(`[Debug] Animate: New best car selected. Y: ${newBestCar.y.toFixed(0)}`); // Removed ID reference
            bestCarRef.current = newBestCar; // Update the ref immediately
             if (bestCarRef.current?.brain && !isTFActive && isNeuralNetworkStructure(bestCarRef.current.brain)) { // Only save FNN brain if TF isn't active
                 localStorage.setItem("bestBrain_fnn", JSON.stringify(bestCarRef.current.brain));
                 // console.log("[Debug] Animate: Saved best FNN brain to localStorage.");
             }
        }
        // --- Log if best car Y position changes significantly ---
        if (bestCarRef.current && Math.abs(bestCarRef.current.y - lastBestCarY.current) > 1) { // Log if Y changes by more than 1 pixel
            //  console.log(`[Debug] Animate: Current best car Y: ${bestCarRef.current.y.toFixed(1)}`); // Removed ID reference
             lastBestCarY.current = bestCarRef.current.y;
        }

        // 3. Capture Training Data (Now relies on data prepared in Car.update)
        if (bestCarRef.current?.controlType === 'AI' && !isTFActive && bestCarRef.current.lastFnnInputs) {
             const inputs = bestCarRef.current.lastFnnInputs;
             const controls = bestCarRef.current.controls;
             const outputs = [ controls.forward?1:0, controls.left?1:0, controls.right?1:0, controls.reverse?1:0 ];
             // console.log("[Debug] Animate: Capturing FNN data:", { input: inputs, output: outputs }); // Log captured data
             onDataCapture({ input: inputs, output: outputs });
        }

        // 4. Drawing
        // console.log("[Debug] Animate: Preparing to draw...");
        carCanvas.height = window.innerHeight; // This clears the canvas
        networkCanvas.height = window.innerHeight; // This clears the canvas

        carCtx.save();
        const carToFollow = (controlMode === 'MANUAL' && carsRef.current.length > 0) ? carsRef.current[0] : bestCarRef.current;
        // console.log(`[Debug] Animate: Car to follow determined.`); // Simplified log

        if (carToFollow) {
            const translateY = -carToFollow.y + carCanvas.height * 0.7;
            // console.log(`[Debug] Animate: Translating canvas by Y: ${translateY.toFixed(1)} (CarY: ${carToFollow.y.toFixed(1)}, CanvasH: ${carCanvas.height})`);
            carCtx.translate(0, translateY);
        } else {
            // console.log("[Debug] Animate: No car to follow, not translating canvas.");
        }

        // console.log("[Debug] Animate: Drawing road...");
        currentRoad.draw(carCtx);

        // console.log(`[Debug] Animate: Drawing ${currentTraffic.length} traffic cars...`);
        currentTraffic.forEach((car) => car.draw(carCtx));

        // console.log(`[Debug] Animate: Drawing ${currentCars.length} non-followed cars (transparent)...`);
        carCtx.globalAlpha = 0.2;
        currentCars.forEach((car) => { if (car !== carToFollow) car.draw(carCtx, false, false); });
        carCtx.globalAlpha = 1;

        if (carToFollow) {
             // console.log(`[Debug] Animate: Drawing followed car (opaque)...`); // Simplified log
             carToFollow.draw(carCtx, true, true); // Draw sensor and prediction for followed car
        }

        carCtx.restore();
        // console.log("[Debug] Animate: Drawing complete for car canvas.");

        // 5. Network Visualization
        networkCtx.clearRect(0, 0, networkCanvas.width, networkCanvas.height); // Explicit clear just in case
        const brainToVisualize = bestCarRef.current;
        if (brainToVisualize) {
             if (isTFActive && tfBrainModel) {
                 // console.log("[Debug] Animate: Visualizing TF Model.");
                 Visualizer.drawTfNetwork(networkCtx, tfBrainModel);
             } else if (brainToVisualize.brain && isNeuralNetworkStructure(brainToVisualize.brain)) { // Check if FNN brain structure exists
                 // console.log("[Debug] Animate: Visualizing FNN Model.");
                 // Pass the structure to drawNetwork. Ensure Visualizer.drawNetwork handles this.
                 Visualizer.drawNetwork(networkCtx, brainToVisualize.brain);
             } else {
                 // console.log("[Debug] Animate: No valid brain structure to visualize or Visualizer method missing.");
                 networkCtx.fillStyle = 'yellow'; networkCtx.font = '12px Arial'; networkCtx.textAlign = 'center';
                 networkCtx.fillText(`No Brain or Viz Disabled`, networkCanvas.width / 2, 20);
             }
        } else {
            // console.log("[Debug] Animate: No best car to visualize brain for.");
        }
        // console.log("[Debug] Animate: Network visualization complete.");

        // 6. Loop
        animationFrameIdRef.current = requestAnimationFrame(animate);
    };
    cancelAnimationFrame(animationFrameIdRef.current);
    animationFrameIdRef.current = requestAnimationFrame(animate);

  }, [controlMode, isTFActive, tfBrainModel, onDataCapture]); // Added onDataCapture


  // --- Initialization Effect ---
  useEffect(() => {
    let isMounted = true;
    // console.log("[Debug] Hook: Initializing simulation core...");
    // console.log("[Debug] Hook Init: Config:", config);
    const carCanvas = carCanvasRef.current;
    const networkCanvas = networkCanvasRef.current;
    if (!carCanvas || !networkCanvas) {
        // console.error(`[Debug] Hook Init: Canvas refs not ready on mount. CarCanvas: ${!!carCanvas}, NetworkCanvas: ${!!networkCanvas}`);
        return;
    }
    // console.log("[Debug] Hook Init: Canvas refs found.");
    carCanvas.width = 200;
    networkCanvas.width = 300;
    const carCtx = carCanvas.getContext("2d");
    const networkCtx = networkCanvas.getContext("2d");
    if (!carCtx || !networkCtx) {
         console.error(`[Debug] Hook Init: Canvas contexts could not be obtained. CarCtx: ${!!carCtx}, NetworkCtx: ${!!networkCtx}`);
         return;
    }
    // console.log("[Debug] Hook Init: Canvas contexts obtained.");

    const road = new Road(carCanvas.width / 2, carCanvas.width * 0.9);
    roadRef.current = road;
    console.log("[Debug] Hook Init: Road created.");

    // Use the generation functions referenced by useCallback
    carsRef.current = generateCars(config.numCars || 100, road);
    bestCarRef.current = carsRef.current.length > 0 ? carsRef.current[0] : null;
    if (bestCarRef.current?.brain && !localStorage.getItem("bestBrain_fnn") && isNeuralNetworkStructure(bestCarRef.current.brain)) {
        localStorage.setItem("bestBrain_fnn", JSON.stringify(bestCarRef.current.brain));
        // console.log("[Debug] Hook Init: Initial best FNN brain saved to localStorage.");
    }
    generateTraffic(road);
    // console.log("[Debug] Hook Init: Initialization complete. Starting animation loop...");
    startAnimationLoop();

    return () => {
        isMounted = false;
        // console.log("[Debug] Hook: Cleaning up simulation core...");
        cancelAnimationFrame(animationFrameIdRef.current);
        // console.log("[Debug] Hook Cleanup: Animation frame cancelled.");
    };
    // Ensure all dependencies that could trigger re-initialization are included
  }, [config.numCars, generateCars, generateTraffic, startAnimationLoop]);

  // Return refs matching the updated interface
  return { carCanvasRef, networkCanvasRef, bestCarRef };
};

// Removed the conflicting namespace NeuralNetwork block.
// Ensure the actual NeuralNetwork class/type is imported correctly from '../simulation/NeuralNetwork'