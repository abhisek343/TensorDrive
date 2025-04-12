import { lerp } from './helpers';

export class NeuralNetwork {
  levels: Level[];

  constructor(neuronCounts: number[]) {
    this.levels = [];
    for (let i = 0; i < neuronCounts.length - 1; i++) {
      this.levels.push(new Level(neuronCounts[i], neuronCounts[i + 1]));
    }
  }

  static feedForward(givenInputs: number[], network: NeuralNetwork): number[] {
    let outputs = Level.feedForward(givenInputs, network.levels[0]);
    for (let i = 1; i < network.levels.length; i++) {
      outputs = Level.feedForward(outputs, network.levels[i]);
    }
    return outputs;
  }

  static mutate(network: NeuralNetwork, amount: number = 1): void {
    for (const level of network.levels) {
      for (let i = 0; i < level.biases.length; i++) {
        level.biases[i] = lerp(level.biases[i], Math.random() * 2 - 1, amount);
      }
      for (let i = 0; i < level.weights.length; i++) {
        for (let j = 0; j < level.weights[i].length; j++) {
          level.weights[i][j] = lerp(level.weights[i][j], Math.random() * 2 - 1, amount);
        }
      }
    }
  }
}

export class Level {
  inputs: number[];
  outputs: number[];
  biases: number[];
  weights: number[][];

  constructor(inputCount: number, outputCount: number) {
    this.inputs = new Array(inputCount).fill(0);
    this.outputs = new Array(outputCount).fill(0);
    this.biases = new Array(outputCount).fill(0);

    this.weights = [];
    for (let i = 0; i < inputCount; i++) {
      this.weights[i] = new Array(outputCount).fill(0);
    }

    Level.#randomize(this);
  }

  static #randomize(level: Level): void {
    for (let i = 0; i < level.inputs.length; i++) {
      for (let j = 0; j < level.outputs.length; j++) {
        level.weights[i][j] = Math.random() * 2 - 1;
      }
    }

    for (let i = 0; i < level.biases.length; i++) {
      level.biases[i] = Math.random() * 2 - 1;
    }
  }

  static feedForward(givenInputs: number[], level: Level): number[] {
    for (let i = 0; i < level.inputs.length; i++) {
      level.inputs[i] = givenInputs[i];
    }

    for (let i = 0; i < level.outputs.length; i++) {
      let sum = 0;
      for (let j = 0; j < level.inputs.length; j++) {
        sum += level.inputs[j] * level.weights[j][i];
      }

      level.outputs[i] = sum > level.biases[i] ? 1 : 0;
    }

    return level.outputs;
  }
}
