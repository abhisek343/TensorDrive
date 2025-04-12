// client/src/simulation/Visualizer.ts
import * as tf from '@tensorflow/tfjs';
import { lerp, getRGBA } from './helpers';

// Minimal types for FNN structure
interface Level { inputs: number[]; outputs: number[]; weights: number[][]; biases: number[]; }
interface NeuralNetwork { levels: Level[]; }

export class Visualizer {
    // drawNetwork and drawLevel remain the same...
    static drawNetwork(ctx: CanvasRenderingContext2D, network: NeuralNetwork): void { /* ... implementation ... */ }
    static drawLevel( ctx: CanvasRenderingContext2D, level: Level, left: number, top: number, width: number, height: number, outputLabels: string[] ): void { /* ... implementation ... */ }

    static #getNodeX(nodes: number[], index: number, left: number, right: number): number {
        // --- FIX: Ensure return statement is present ---
        return lerp( left, right, nodes.length === 1 ? 0.5 : index / (nodes.length - 1) );
        // --- End FIX ---
    }

    // --- Updated drawTfNetwork Method ---
    static drawTfNetwork(ctx: CanvasRenderingContext2D, model: tf.LayersModel): void {
        const margin = 30; const top = margin;
        const width = ctx.canvas.width - margin * 2; const height = ctx.canvas.height - margin * 2;
        // Ensure model.layers exists and has length before dividing
        const layerHeight = model.layers?.length ? Math.min(80, height / model.layers.length) : 80;
        const layerWidth = width * 0.8; const layerLeft = ctx.canvas.width / 2 - layerWidth / 2;

        ctx.font = '11px Arial'; ctx.fillStyle = 'white'; ctx.strokeStyle = '#888'; ctx.lineWidth = 1;

        for (let i = 0; i < (model.layers?.length || 0); i++) {
            const layer = model.layers[i];
            const layerTop = top + height - (i + 1) * layerHeight + (layerHeight * 0.1);
            const layerBottom = layerTop + layerHeight * 0.8;
            let config: any = {}; try { config = layer.getConfig(); } catch(e) {}

            const layerType = layer.getClassName();
            const units = config?.units || '?';
            const activation = config?.activation || 'linear';

            // --- FIX: Use getConfig().batchInputShape / inputSpec ---
            const batchInputShape = config?.batchInputShape || layer.inputSpec?.[0]?.shape;
            const inputShape = JSON.stringify(batchInputShape ? batchInputShape.slice(1) : '?');
            // --- End FIX ---
            const outputShape = JSON.stringify(layer.outputShape || '?');

            // Drawing logic...
            ctx.beginPath(); ctx.rect(layerLeft, layerTop, layerWidth, layerHeight * 0.8); ctx.fillStyle = 'rgba(100, 100, 100, 0.5)'; ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const centerX = layerLeft + layerWidth / 2; const lineSpacing = 14; let textY = layerTop + lineSpacing;
            ctx.font = 'bold 12px Arial'; ctx.fillText(`${layerType}`, centerX, textY); textY += lineSpacing;
            ctx.font = '11px Arial';
            if (config?.units !== undefined) { ctx.fillText(`Units: ${units}`, centerX, textY); textY += lineSpacing; }
            if (config?.activation) { ctx.fillText(`Act: ${activation}`, centerX, textY); textY += lineSpacing; }
            ctx.font = '10px Arial'; ctx.fillText(`In: ${inputShape}`, centerX, textY); textY += lineSpacing;
            ctx.fillText(`Out: ${outputShape}`, centerX, textY);
            if (i > 0) { /* ... draw connections ... */ }
        }
        ctx.fillStyle = 'cyan'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
        ctx.fillText('TF Model Active', ctx.canvas.width / 2, top - 15);
    }
}