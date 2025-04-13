// FILE: client/src/simulation/Car.ts (Full code with updated 'update' method)
import { Controls } from './Controls';
import { Sensor } from './Sensor';
import { polysIntersect, Point, Intersection } from './helpers'; // Added Intersection type
import { NeuralNetwork } from './NeuralNetwork'; // Re-add NeuralNetwork import
import { PredictionEngine, RiskAssessment } from './PredictionEngine'; // Keep for risk assessment
// Import BrainOutput if needed for type hint
import { BrainOutput } from './TfBrain'; // <-- ADDED Import

// Define a simple counter for unique IDs if needed
let carIdCounter = 0;

export class Car {
    id: number; // Added ID for easier debugging
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number = 0;
    acceleration: number = 0.2;
    maxSpeed: number;
    friction: number = 0.05;
    angle: number = 0;
    damaged: boolean = false;
    // 'controlType' now primarily determines if it's AI (FNN initially), MANUAL, or DUMMY
    controlType: string;
    // 'useBrain' flag reflects if FNN was used for *this frame's* control decision
    useBrain: boolean;
    sensor?: Sensor;
    brain?: NeuralNetwork; // FNN brain property is back
    controls: Controls;
    predictionEngine?: PredictionEngine | null = null; // Keep for risk assessment
    riskAssessment: RiskAssessment | null = null; // Store latest risk assessment

    // Made optional as initialization might fail in non-browser env or if image missing
    img?: HTMLImageElement;
    mask?: HTMLCanvasElement;

    polygon: Point[] = [];
    // Store the last inputs used by the FNN for data capture
    lastFnnInputs: number[] | null = null;

    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        controlType: string,
        maxSpeed: number = 3,
        color: string = 'blue'
    ) {
        this.id = carIdCounter++; // Assign and increment ID
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.maxSpeed = maxSpeed;
        this.controlType = controlType;
        this.useBrain = controlType === 'AI'; // Initially true for AI cars

        // Sensor is needed for AI (FNN/TF) and potentially visualization
        if (controlType !== 'DUMMY') {
            this.sensor = new Sensor(this);
            // Instantiate the FNN if it's an AI car
            if (this.useBrain) {
                // Network structure: Sensor inputs + 1 risk input -> Hidden Layer (e.g., 6 neurons) -> 4 outputs (controls)
                // Adjust hidden layer size [6] if needed
                this.brain = new NeuralNetwork(
                     [this.sensor.rayCount + 1, 6, 4]
                );
                // Instantiate prediction engine for risk assessment input
                this.predictionEngine = new PredictionEngine(this, 30, 50, 30); // Default params
            }
        }

        // Controls are always created
        this.controls = new Controls(controlType);

        // --- Image and Mask setup (with basic environment check) ---
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            this.img = new Image();
            this.img.src = 'car.png'; // Ensure this path is correct relative to the public folder

            this.mask = document.createElement('canvas');
            this.mask.width = width;
            this.mask.height = height;

            const maskCtx = this.mask.getContext('2d');
            if (maskCtx) {
                this.img.onload = () => {
                    // Draw colored rectangle first
                    maskCtx.fillStyle = color; // Use constructor color
                    maskCtx.rect(0, 0, this.width, this.height);
                    maskCtx.fill();
                    // Then draw image using 'destination-atop' to mask it with the color
                    maskCtx.globalCompositeOperation = 'destination-atop';
                    maskCtx.drawImage(this.img!, 0, 0, this.width, this.height);
                };
                this.img.onerror = () => {
                    console.error(`[Debug Car ${this.id}] Failed to load car image from 'car.png'.`);
                    this.img = undefined; // Clear img if loading failed
                    this.mask = undefined; // Clear mask
                };
            } else {
                console.error(`[Debug Car ${this.id}] Failed to get 2D context for car mask.`);
                this.mask = undefined;
                this.img = undefined;
            }
        } else {
             console.log(`[Debug Car ${this.id}] Skipping image/mask setup (not in browser env?).`);
             // Provide fallback properties if needed for non-browser logic
             this.mask = undefined;
             this.img = undefined;
        }
    }

    // --- MODIFIED update method ---
    update(
        roadBorders: Point[][],
        traffic: Car[],
        // Optional: Pass controls directly if calculated externally (e.g., by TF.js)
        externalControls?: BrainOutput
    ) {
        if (!this.damaged) {
            this.lastFnnInputs = null; // Reset FNN inputs for this frame

            // 1. Update Sensor and Risk Assessment (always needed for input)
            if (this.sensor) {
                this.sensor.update(roadBorders, traffic);
                if (this.predictionEngine) {
                    this.riskAssessment = this.predictionEngine.assessRisk(traffic);
                } else {
                    this.riskAssessment = null;
                }
            }

            // 2. Determine Controls
            if (externalControls && this.controlType === 'AI') {
                // Use externally provided controls (from TF.js via useSimulationCore)
                this.controls.forward = externalControls.forward;
                this.controls.left = externalControls.left;
                this.controls.right = externalControls.right;
                this.controls.reverse = externalControls.reverse;
                this.useBrain = false; // Indicate FNN wasn't used for this frame's control
            } else if (this.controlType === 'AI' && this.brain && this.sensor) {
                // Fallback to FNN if no external controls provided for AI car
                this.useBrain = true; // FNN is used
                const sensorInputs = this.sensor.readings.map(s => (s == null ? 0 : 1 - s.offset));
                const riskInput = this.riskAssessment ? this.riskAssessment.highestRiskScore : 0;
                const inputs = [...sensorInputs, riskInput];
                this.lastFnnInputs = inputs; // Store FNN inputs (only when FNN is used)

                const outputs = NeuralNetwork.feedForward(inputs, this.brain);
                this.controls.forward = Boolean(outputs[0]);
                this.controls.left = Boolean(outputs[1]);
                this.controls.right = Boolean(outputs[2]);
                this.controls.reverse = Boolean(outputs[3]);
            } else if (this.controlType === 'MANUAL') {
                this.useBrain = false; // Manual control is active via Controls class listeners
            } else { // DUMMY cars or AI without brain/sensor
                this.useBrain = false;
                this.controls.forward = true; // Default dummy behavior
                this.controls.left = false;
                this.controls.right = false;
                this.controls.reverse = false;
            }

            // 3. Move based on the final state of this.controls
            this.#move();

            // 4. Update Collision Polygon and Assess Damage
            this.polygon = this.#createPolygon();
            this.damaged = this.#assessDamage(roadBorders, traffic);
        } else {
            this.speed = 0;
        }
    }
    // --- END MODIFIED update method ---

    #assessDamage(roadBorders: Point[][], traffic: Car[]): boolean {
         for (const border of roadBorders) {
             if (border.length >= 2 && this.polygon.length > 0) {
                 if (polysIntersect(this.polygon, [border[0], border[1]])) { return true; }
             }
         }
         for (const car of traffic) {
             if (car !== this && car.polygon && car.polygon.length > 0 && this.polygon.length > 0) {
                  if (polysIntersect(this.polygon, car.polygon)) { return true; }
             }
         }
         return false;
    }

    #createPolygon(): Point[] {
        const points: Point[] = [];
        // Handle cases where width/height might be 0 or undefined during initialization
        const w = this.width || 1;
        const h = this.height || 1;
        const rad = Math.hypot(w, h) / 2;
        const alpha = Math.atan2(w, h);

        // Top right
        points.push({
            x: this.x - Math.sin(this.angle - alpha) * rad,
            y: this.y - Math.cos(this.angle - alpha) * rad
        });
        // Top left
        points.push({
            x: this.x - Math.sin(this.angle + alpha) * rad,
            y: this.y - Math.cos(this.angle + alpha) * rad
        });
        // Bottom left
        points.push({
            x: this.x - Math.sin(Math.PI + this.angle - alpha) * rad,
            y: this.y - Math.cos(Math.PI + this.angle - alpha) * rad
        });
        // Bottom right
        points.push({
            x: this.x - Math.sin(Math.PI + this.angle + alpha) * rad,
            y: this.y - Math.cos(Math.PI + this.angle + alpha) * rad
        });
        return points;
    }

    #move() {
        // Apply acceleration/reverse
        if (this.controls.forward) this.speed += this.acceleration;
        if (this.controls.reverse) this.speed -= this.acceleration;

        // Apply speed limits
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2; // Max reverse speed

        // Apply friction
        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < this.friction) this.speed = 0;

        // Apply steering (only if moving)
        if (this.speed !== 0) {
            const flip = this.speed > 0 ? 1 : -1;
            if (this.controls.left) this.angle += 0.03 * flip;
            if (this.controls.right) this.angle -= 0.03 * flip;
        }

        // Update position
        this.x -= Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
    }

    draw(ctx: CanvasRenderingContext2D, drawSensor = false, drawPrediction = false) {
         // Draw prediction engine visualization if conditions met
         if (this.predictionEngine && this.riskAssessment && drawPrediction && !this.damaged) {
             this.predictionEngine.draw(ctx, this.riskAssessment);
         }

         // --- Draw car body ---
         let fillStyle = 'blue'; // Default color
         if (this.damaged) {
             fillStyle = 'gray';
         } else if (this.controlType === 'AI' && !this.useBrain) {
            fillStyle = 'cyan'; // Use cyan if TF is controlling (useBrain is false when externalControls are used)
         } else if (this.controlType === 'KEYS') {
             fillStyle = 'red'; // Example: Red for manual control
         }
         // If using an image/mask, the fillStyle is applied within the mask creation or used as fallback

         // Draw polygon first (useful for debugging)
         if (this.polygon.length > 0) {
             ctx.beginPath();
             ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
             for (let i = 1; i < this.polygon.length; i++) {
                 ctx.lineTo(this.polygon[i].x, this.polygon[i].y);
             }
             ctx.closePath();
             // Only fill if no mask/image or damaged
             if (!this.mask || this.damaged) {
                 ctx.fillStyle = fillStyle; // Use determined fill style
                 ctx.fill();
             }
         }

        // Draw image/mask if available and not damaged
        if (this.mask && this.img && !this.damaged) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(-this.angle);
            ctx.drawImage(this.mask, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        } else if (!this.mask && !this.damaged) {
             // Fallback simple rectangle if no mask/image
             ctx.save();
             ctx.translate(this.x, this.y);
             ctx.rotate(-this.angle);
             ctx.fillStyle = fillStyle; // Use determined fill style for fallback
             ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
             ctx.restore();
        }

        // --- Draw sensor ---
        if (this.sensor && drawSensor && !this.damaged) {
            this.sensor.draw(ctx);
        }
     }
}