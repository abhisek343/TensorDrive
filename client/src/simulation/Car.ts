// client/src/simulation/Car.ts
import { Controls } from './Controls';
import { Sensor } from './Sensor';
import { polysIntersect, Point } from './helpers';
import { NeuralNetwork } from './NeuralNetwork'; // Ensure this import is correct
import { PredictionEngine, RiskAssessment } from './PredictionEngine';

// Counter for simple unique IDs (if not adding UUIDs)
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
    controlType: string;
    useBrain: boolean; // Determines if FNN is used (initially)

    sensor?: Sensor;
    // Ensure brain property holds an actual NeuralNetwork instance or compatible structure
    brain?: NeuralNetwork;
    controls: Controls;
    predictionEngine?: PredictionEngine | null = null;
    riskAssessment: RiskAssessment | null = null;

    img?: HTMLImageElement; // Made optional if loading fails
    mask?: HTMLCanvasElement; // Made optional

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
        color: string = 'blue' // Color not explicitly used in provided draw, but kept
    ) {
        this.id = carIdCounter++; // Assign and increment ID
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.maxSpeed = maxSpeed;
        this.controlType = controlType;
        this.useBrain = controlType === 'AI';

        console.log(`[Debug Car ${this.id}] Created. Type: ${controlType}, MaxSpeed: ${maxSpeed}, UseBrain: ${this.useBrain}`);

        if (controlType !== 'DUMMY') {
            this.sensor = new Sensor(this);
            console.log(`[Debug Car ${this.id}] Sensor initialized.`);

            if (this.useBrain) {
                // Example FNN structure: Sensor inputs + 1 risk input -> 6 hidden -> 4 outputs
                const inputNodes = this.sensor.rayCount + 1; // +1 for risk score
                const hiddenNodes = 6;
                const outputNodes = 4;
                this.brain = new NeuralNetwork([inputNodes, hiddenNodes, outputNodes]);
                console.log(`[Debug Car ${this.id}] FNN Brain initialized (${inputNodes} -> ${hiddenNodes} -> ${outputNodes}).`);

                // Initialize PredictionEngine only if using AI brain
                this.predictionEngine = new PredictionEngine(this, 30, 50, 30); // Default params
                console.log(`[Debug Car ${this.id}] PredictionEngine initialized.`);
            }
        } else {
             console.log(`[Debug Car ${this.id}] No sensor/brain/prediction for DUMMY type.`);
        }

        this.controls = new Controls(controlType);

        // Image setup - check if in a browser environment
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            this.img = new Image();
            this.img.src = 'car.png'; // Ensure this path is correct relative to the public folder

            this.mask = document.createElement('canvas');
            this.mask.width = width;
            this.mask.height = height;

            const maskCtx = this.mask.getContext('2d');
            if (maskCtx) {
                this.img.onload = () => {
                    maskCtx.fillStyle = color; // Use constructor color
                    maskCtx.rect(0, 0, this.width, this.height);
                    maskCtx.fill();
                    maskCtx.globalCompositeOperation = 'destination-atop';
                    maskCtx.drawImage(this.img!, 0, 0, this.width, this.height);
                    // console.log(`[Debug Car ${this.id}] Image loaded and mask created.`);
                };
                this.img.onerror = () => {
                    console.error(`[Debug Car ${this.id}] Failed to load car image from 'car.png'.`);
                    this.img = undefined; // Clear img if loading failed
                    this.mask = undefined; // Clear mask
                };
            } else {
                console.error(`[Debug Car ${this.id}] Failed to get 2D context for car mask canvas.`);
                this.mask = undefined;
            }
        } else {
             console.log(`[Debug Car ${this.id}] Skipping image/mask setup (not in browser env?).`);
        }
    }


    update(roadBorders: Point[][], traffic: Car[]) {
        // console.log(`[Debug Car ${this.id}] Update start. Damaged: ${this.damaged}`);
        if (!this.damaged) {
            this.lastFnnInputs = null; // Reset last inputs for this frame

            // 1. Update Sensor and Risk Assessment
            if (this.sensor) {
                this.sensor.update(roadBorders, traffic);
                // const sensorReadings = this.sensor.readings.map(r => r ? r.offset.toFixed(2) : 'null');
                // console.log(`[Debug Car ${this.id}] Sensor readings: [${sensorReadings.join(', ')}]`);

                if (this.predictionEngine) {
                    this.riskAssessment = this.predictionEngine.assessRisk(traffic);
                    // console.log(`[Debug Car ${this.id}] Risk assessed: ${this.riskAssessment?.highestRiskScore.toFixed(3)}`);
                } else {
                    this.riskAssessment = null;
                }

                // 2. **FNN Control Logic (if applicable)**
                if (this.useBrain && this.brain && typeof NeuralNetwork?.feedForward === 'function') {
                    const sensorInputs = this.sensor.readings.map(s => (s == null ? 0 : 1 - s.offset));
                    const riskInput = this.riskAssessment ? this.riskAssessment.highestRiskScore : 0;
                    const inputs = [...sensorInputs, riskInput];
                    this.lastFnnInputs = inputs; // Store the inputs used for this frame
                    // console.log(`[Debug Car ${this.id}] FNN Inputs: [${inputs.map(i => i.toFixed(2)).join(', ')}]`);

                    // Get outputs from the FNN
                    const outputs = NeuralNetwork.feedForward(inputs, this.brain);
                    // console.log(`[Debug Car ${this.id}] FNN Raw Outputs: [${outputs.join(', ')}]`);

                    // Apply FNN outputs to controls object
                    this.controls.forward = Boolean(outputs[0]);
                    this.controls.left = Boolean(outputs[1]);
                    this.controls.right = Boolean(outputs[2]);
                    this.controls.reverse = Boolean(outputs[3]);
                }
                // If controlType is MANUAL, keyboard inputs are already in this.controls via Controls class listeners
            } else {
                 // console.log(`[Debug Car ${this.id}] No sensor/brain logic to run.`);
            }

             // Log final controls before moving
             // console.log(`[Debug Car ${this.id}] Controls before move: F:${this.controls.forward}, L:${this.controls.left}, R:${this.controls.right}, B:${this.controls.reverse}`);

            // 3. Move based on the final state of this.controls
            this.#move();

            // 4. Update Collision Polygon and Assess Damage
            this.polygon = this.#createPolygon();
            this.damaged = this.#assessDamage(roadBorders, traffic);
            // if (this.damaged) {
            //     console.warn(`[Debug Car ${this.id}] Assessed as DAMAGED.`);
            // }
        } else {
            this.speed = 0; // Stop if damaged
        }
         // console.log(`[Debug Car ${this.id}] Update end. Pos: (${this.x.toFixed(1)}, ${this.y.toFixed(1)}), Speed: ${this.speed.toFixed(2)}, Angle: ${this.angle.toFixed(2)}`);
    }

    #assessDamage(roadBorders: Point[][], traffic: Car[]): boolean {
        for (const border of roadBorders) {
             if (border.length >= 2 && this.polygon.length > 0) {
                 // Assuming borders are simple line segments
                 if (polysIntersect(this.polygon, [border[0], border[1]])) {
                     // console.log(`[Debug Car ${this.id}] Damaged by road border.`);
                     return true;
                 }
             }
         }
         for (const car of traffic) {
             // Check collision only with other existing cars that have a polygon
             if (car !== this && car.polygon && car.polygon.length > 0 && this.polygon.length > 0) {
                  if (polysIntersect(this.polygon, car.polygon)) {
                      // console.log(`[Debug Car ${this.id}] Damaged by traffic car.`);
                      return true;
                  }
             }
         }
         return false;
    }

    #createPolygon(): Point[] {
        const points: Point[] = [];
        const rad = Math.hypot(this.width, this.height) / 2;
        const alpha = Math.atan2(this.width, this.height);

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
        // console.log(`[Debug Car ${this.id}] Polygon created with ${points.length} points.`);
        return points;
    }

    #move() {
        // Store previous state for logging
        // const prevSpeed = this.speed;
        // const prevAngle = this.angle;

        // Apply acceleration/reverse
        if (this.controls.forward) this.speed += this.acceleration;
        if (this.controls.reverse) this.speed -= this.acceleration;

        // Apply speed limits
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2; // Max reverse speed

        // Apply friction
        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < this.friction) this.speed = 0; // Stop if speed is below friction

        // Apply steering (only if moving)
        if (this.speed !== 0) {
            const flip = this.speed > 0 ? 1 : -1; // Reverse steering direction when moving backward
            if (this.controls.left) this.angle += 0.03 * flip;
            if (this.controls.right) this.angle -= 0.03 * flip;
        }

        // Update position based on speed and angle
        this.x -= Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;

        // Log movement changes
        // if (this.speed !== prevSpeed || this.angle !== prevAngle) {
        //     console.log(`[Debug Car ${this.id}] Moved. Speed: ${prevSpeed.toFixed(2)}->${this.speed.toFixed(2)}, Angle: ${prevAngle.toFixed(3)}->${this.angle.toFixed(3)}`);
        // }
    }

    draw(ctx: CanvasRenderingContext2D, drawSensor = false, drawPrediction = false) {
        // console.log(`[Debug Car ${this.id}] Draw called. Pos: (${this.x.toFixed(1)}, ${this.y.toFixed(1)}), Damaged: ${this.damaged}`);

        // --- Draw prediction engine visualization ---
        if (this.predictionEngine && this.riskAssessment && drawPrediction && !this.damaged) {
            // console.log(`[Debug Car ${this.id}] Drawing PredictionEngine visualization.`);
            this.predictionEngine.draw(ctx, this.riskAssessment);
        }

        // --- Draw car body ---
        if (this.damaged) {
            ctx.fillStyle = 'gray';
        } else {
            // Use a default color if image/mask failed to load
            ctx.fillStyle = 'blue'; // Default color
        }

        // Draw polygon (useful for debugging collisions)
        if (this.polygon.length > 0) {
             ctx.beginPath();
             ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
             for (let i = 1; i < this.polygon.length; i++) {
                 ctx.lineTo(this.polygon[i].x, this.polygon[i].y);
             }
             ctx.closePath(); // Close the path
             // Apply fill only if not using image/mask or if damaged
             if (!this.mask || this.damaged) {
                 ctx.fill();
             }
        } else {
             console.warn(`[Debug Car ${this.id}] Cannot draw polygon, not created yet.`);
        }

        // Draw image/mask if available and not damaged
        if (this.mask && this.img && !this.damaged) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(-this.angle);
            // Draw the masked image centered
            ctx.drawImage(this.mask, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        } else if (!this.mask && !this.damaged) {
             // Fallback simple rectangle if no mask/image
             ctx.save();
             ctx.translate(this.x, this.y);
             ctx.rotate(-this.angle);
             ctx.fillStyle = 'blue'; // Fallback color
             ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
             ctx.restore();
        }


        // --- Draw sensor ---
        if (this.sensor && drawSensor && !this.damaged) {
            // console.log(`[Debug Car ${this.id}] Drawing Sensor visualization.`);
            this.sensor.draw(ctx);
        }
     }
}