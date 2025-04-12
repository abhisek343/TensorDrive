// client/src/components/AIControlPanel.tsx
import React from 'react';

// Define the possible types for the active brain
type ActiveBrain = 'FNN' | 'TensorFlow.js' | 'MANUAL' | 'UNKNOWN';
// Define possible statuses for the TF model/engine
type TFStatus = 'None Loaded' | 'Loading...' | 'Loaded/Ready' | 'Not Ready' | 'N/A';
type EngineStatus = 'Running' | 'Stopped' | 'N/A';

// Define the props for the AIControlPanel component
interface AIControlPanelProps {
  activeBrainType: ActiveBrain;
  trainingBufferSize: number;
  maxBufferSize: number;
  isTrainingTFModel: boolean;
  tfModelStatus: TFStatus;
  tfEngineStatus: EngineStatus;
  // Add other relevant props as needed, e.g., current generation, best FNN score, TF model loss
}

/**
 * Displays the current status of the AI system, including active brain,
 * training buffer size, and TF model training state.
 */
const AIControlPanel: React.FC<AIControlPanelProps> = ({
  activeBrainType,
  trainingBufferSize,
  maxBufferSize,
  isTrainingTFModel,
  tfModelStatus,
  tfEngineStatus,
}) => {

  // Basic inline styles (consider moving to CSS or using a library)
  const panelStyle: React.CSSProperties = {
    borderTop: '1px solid #666',
    marginTop: '10px',
    paddingTop: '10px',
    fontSize: '0.9em', // Slightly larger than the other status text perhaps
    color: '#e0e0e0', // Lighter text color
  };

  const statusLineStyle: React.CSSProperties = {
    marginBottom: '4px',
  };

   const trainingStatusStyle: React.CSSProperties = {
       color: isTrainingTFModel ? 'yellow' : '#e0e0e0', // Highlight when training
       fontWeight: isTrainingTFModel ? 'bold' : 'normal',
   };

   const activeBrainStyle: React.CSSProperties = {
       fontWeight: 'bold',
       color: activeBrainType === 'TensorFlow.js' ? '#00bcd4' : (activeBrainType === 'FNN' ? '#ffeb3b' : '#e0e0e0'),
   };

  return (
    <div style={panelStyle}>
      <h4 style={{ margin: '0 0 5px 0', borderBottom: '1px solid #555', paddingBottom: '3px' }}>AI Status</h4>
      <p style={statusLineStyle}>
        Active Brain: <span style={activeBrainStyle}>{activeBrainType}</span>
      </p>
      <p style={statusLineStyle}>
        Training Buffer: {trainingBufferSize} / {maxBufferSize} samples
      </p>
      <p style={{...statusLineStyle, ...trainingStatusStyle}}>
        TF Training: {isTrainingTFModel ? 'In Progress...' : 'Idle'}
      </p>
      <p style={statusLineStyle}>
        TF Model: {tfModelStatus}
      </p>
       <p style={statusLineStyle}>
        TF Engine: {tfEngineStatus}
      </p>
       {/* Add more status lines here as needed */}
       {/* e.g., <p>Current FNN Generation: {currentGeneration}</p> */}
       {/* e.g., <p>Best FNN Score: {bestFnnScore}</p> */}
       {/* e.g., <p>Last TF Loss: {lastTfLoss}</p> */}
    </div>
  );
};

export default AIControlPanel;