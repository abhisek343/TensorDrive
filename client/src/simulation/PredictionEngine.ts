// src/simulation/PredictionEngine.ts
// (Make sure imports are complete as in the previous version)
import { Car } from './Car';
import { Point, polysIntersect, lerp } from './helpers';

interface PredictedState {
  x: number;
  y: number;
  angle: number;
  polygon: Point[];
}

export interface RiskAssessment {
  highestRiskScore: number;
  predictedAiState: PredictedState;
  predictedTrafficStates: PredictedState[];
  // Optional: add details like the car posing the highest risk
  // highestRiskSource?: Car;
}

export class PredictionEngine {
  private aiCar: Car;
  predictionTime: number;
  riskDistanceThreshold: number;
  riskTimeHorizon: number; // Simulation steps for prediction

  // --- Static method moved from previous example ---
  private static createPredictedPolygon(state: { x: number; y: number; angle: number; width: number; height: number }): Point[] {
      const points: Point[] = [];
      const rad = Math.hypot(state.width, state.height) / 2;
      const alpha = Math.atan2(state.width, state.height);

      points.push({
          x: state.x - Math.sin(state.angle - alpha) * rad,
          y: state.y - Math.cos(state.angle - alpha) * rad
      });
      points.push({
          x: state.x - Math.sin(state.angle + alpha) * rad,
          y: state.y - Math.cos(state.angle + alpha) * rad
      });
      points.push({
          x: state.x - Math.sin(Math.PI + state.angle - alpha) * rad,
          y: state.y - Math.cos(Math.PI + state.angle - alpha) * rad
      });
      points.push({
          x: state.x - Math.sin(Math.PI + state.angle + alpha) * rad,
          y: state.y - Math.cos(Math.PI + state.angle + alpha) * rad
      });
      return points;
  }
  // --- End static method ---


  constructor(aiCar: Car, predictionTimeSteps = 30, riskDistanceThreshold = 60, riskTimeHorizon = 30) {
    this.aiCar = aiCar;
    this.predictionTime = predictionTimeSteps; // Keep name consistent if used elsewhere, represents steps now
    this.riskDistanceThreshold = riskDistanceThreshold;
    this.riskTimeHorizon = riskTimeHorizon;
  }

  private predictCarState(car: Car, timeSteps: number): PredictedState {
    const distance = car.speed * timeSteps; // Using speed over N steps assumes constant speed
    const futureX = car.x - Math.sin(car.angle) * distance;
    const futureY = car.y - Math.cos(car.angle) * distance;
    const futureAngle = car.angle;

    const predictedStateBase = {
        x: futureX,
        y: futureY,
        angle: futureAngle,
        width: car.width,
        height: car.height,
    }

    return {
        ...predictedStateBase,
        polygon: PredictionEngine.createPredictedPolygon(predictedStateBase)
    };
  }

  /**
   * Assesses the risk based on predicted future states and relative velocities.
   * @param traffic Array of nearby traffic cars.
   * @returns RiskAssessment object.
   */
  public assessRisk(traffic: Car[]): RiskAssessment {
    const predictedAiState = this.predictCarState(this.aiCar, this.riskTimeHorizon);
    const relevantTraffic = traffic.filter(t => !t.damaged); // Ignore damaged cars

    let highestRiskScore = 0;
    // let highestRiskSource: Car | undefined = undefined; // Optional: track which car is riskiest

    const predictedTrafficStates: PredictedState[] = relevantTraffic.map(t =>
        this.predictCarState(t, this.riskTimeHorizon)
    );

    // Calculate AI car's current velocity components
    const aiVx = -Math.sin(this.aiCar.angle) * this.aiCar.speed;
    const aiVy = -Math.cos(this.aiCar.angle) * this.aiCar.speed;

    relevantTraffic.forEach((trafficCar, index) => {
        const trafficState = predictedTrafficStates[index];
        let currentRisk = 0;

        // 1. Check for predicted collision
        if (polysIntersect(predictedAiState.polygon, trafficState.polygon)) {
            currentRisk = 1; // Maximum risk if collision is predicted
        } else {
            // 2. Calculate risk based on proximity
            let minDistance = Infinity;
            for (const p1 of predictedAiState.polygon) {
                for (const p2 of trafficState.polygon) {
                    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                    minDistance = Math.min(minDistance, dist);
                }
            }

            let proximityRisk = 0;
            if (minDistance < this.riskDistanceThreshold) {
                // Risk increases as distance decreases below the threshold
                proximityRisk = 1 - lerp(0, 1, Math.max(0, minDistance / this.riskDistanceThreshold));
            }
            currentRisk = proximityRisk; // Start with proximity risk

            // 3. Factor in relative velocity if there's some proximity risk
            if (proximityRisk > 0) {
                // Calculate traffic car's velocity components
                const trafficVx = -Math.sin(trafficCar.angle) * trafficCar.speed;
                const trafficVy = -Math.cos(trafficCar.angle) * trafficCar.speed;

                // Calculate relative velocity components
                const relVx = trafficVx - aiVx;
                const relVy = trafficVy - aiVy;

                // Calculate vector from AI car to traffic car (current positions)
                const deltaX = trafficCar.x - this.aiCar.x;
                const deltaY = trafficCar.y - this.aiCar.y;

                // Dot product: positive if moving away, negative if moving towards
                const dotProduct = deltaX * relVx + deltaY * relVy;
                const isClosing = dotProduct < 0;

                if (isClosing) {
                    const relativeSpeed = Math.hypot(relVx, relVy);
                    // Max expected relative speed is roughly 2 * maxSpeed (head-on)
                    const maxPossibleRelativeSpeed = this.aiCar.maxSpeed + Math.max(...relevantTraffic.map(t => t.maxSpeed), this.aiCar.maxSpeed); // Consider traffic max speed too
                    // Velocity factor (0 to 1): how fast are they closing relative to max possible closing speed?
                    const velocityFactor = Math.min(1, Math.max(0, relativeSpeed / (maxPossibleRelativeSpeed + 0.01))); // Add epsilon to avoid div by zero

                    // Boost risk based on closing speed. Interpolate towards max risk (1) based on velocityFactor.
                    // If velocityFactor is 1 (max closing speed), risk becomes 1.
                    // If velocityFactor is 0 (not closing or closing slowly), risk is just proximityRisk.
                    currentRisk = lerp(proximityRisk, 1, velocityFactor);
                }
            }
        }

        // Update highest risk score found so far
        if (currentRisk > highestRiskScore) {
            highestRiskScore = currentRisk;
            // highestRiskSource = trafficCar; // Optional
        }
    });

    // Clamp the final risk score between 0 and 1
    highestRiskScore = Math.max(0, Math.min(1, highestRiskScore));

    return {
      highestRiskScore,
      predictedAiState,
      predictedTrafficStates,
      // highestRiskSource // Optional
    };
  }

   // --- draw and drawGhost methods remain the same as the previous version ---
   public draw(ctx: CanvasRenderingContext2D, assessment: RiskAssessment): void {
     // Draw AI car's predicted position
     this.drawGhost(ctx, assessment.predictedAiState, 'rgba(0, 100, 255, 0.3)');

     // Draw traffic cars' predicted positions
     assessment.predictedTrafficStates.forEach(state => {
         this.drawGhost(ctx, state, 'rgba(255, 0, 0, 0.3)');
     });

     // Visualize the highestRiskScore
     ctx.fillStyle = "white";
     ctx.font = "16px Arial";
     // Position text relative to the car's current position for visibility
     ctx.textAlign = "center";
     ctx.fillText(`Predicted Risk: ${assessment.highestRiskScore.toFixed(2)}`, this.aiCar.x, this.aiCar.y - this.aiCar.height / 2 - 15);
     ctx.textAlign = "start"; // Reset alignment
   }

   private drawGhost(ctx: CanvasRenderingContext2D, state: PredictedState, color: string): void {
     ctx.save();
     // Adjust points relative to the predicted state's center for rotation/translation
     const relativePolygon = state.polygon.map(p => ({ x: p.x - state.x, y: p.y - state.y }));

     ctx.translate(state.x, state.y);
     ctx.rotate(-state.angle);

     ctx.beginPath();
     ctx.moveTo(relativePolygon[0].x, relativePolygon[0].y);
     for (let i = 1; i < relativePolygon.length; i++) {
          ctx.lineTo(relativePolygon[i].x, relativePolygon[i].y);
     }
     ctx.closePath();

     ctx.strokeStyle = color;
     ctx.lineWidth = 1; // Make ghosts slightly less prominent
     ctx.setLineDash([3, 3]); // Dashed line for ghost effect
     ctx.stroke();
     ctx.setLineDash([]); // Reset line dash

     ctx.restore();
   }
   // --- End draw/drawGhost ---
}