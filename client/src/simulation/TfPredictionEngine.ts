import { TfBrain, BrainInput, BrainOutput } from './TfBrain';

export class TfPredictionEngine {
  private tfBrain: TfBrain;
  private latestInput: BrainInput | null = null;
  private latestPrediction: BrainOutput | null = null;
  private isRunning: boolean = false;
  private predictionIntervalId: number | null = null;
  private predictionIntervalMs: number;

  constructor(tfBrain: TfBrain, predictionIntervalMs: number = 100) {
    this.tfBrain = tfBrain;
    this.predictionIntervalMs = predictionIntervalMs;
  }

  start(): void {
    if (this.isRunning || !this.tfBrain.isModelLoaded()) {
       if (!this.tfBrain.isModelLoaded()) {
         console.warn("Prediction engine cannot start: TfBrain model not loaded.");
       }
      return;
    }

    this.isRunning = true;
    this.predictLoop(); 
    console.log('TF Prediction Engine started.');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }
    this.isRunning = false;
    if (this.predictionIntervalId !== null) {
      clearTimeout(this.predictionIntervalId); 
      this.predictionIntervalId = null;
    }
    console.log('TF Prediction Engine stopped.');
  }

  private async predictLoop(): Promise<void> {
    if (!this.isRunning) {
      return; 
    }

    if (this.tfBrain.isModelLoaded() && this.latestInput) {
      try {

        const prediction = this.tfBrain.predict(this.latestInput);
        if (prediction) {
           this.latestPrediction = prediction;

        }
      } catch (error) {
        console.error('Error during prediction loop:', error);

      }
    } else {

    }

    if (this.isRunning) {
       this.predictionIntervalId = window.setTimeout(
         () => this.predictLoop(),
         this.predictionIntervalMs
       );
    }
  }

  updateInput(input: BrainInput): void {
    this.latestInput = input;
  }

  getPrediction(): BrainOutput | null {
    return this.latestPrediction;
  }

  dispose(): void {
    this.stop();
    this.tfBrain.dispose(); 
  }
}