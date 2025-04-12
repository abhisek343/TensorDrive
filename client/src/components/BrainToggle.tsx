// client/src/components/BrainToggle.tsx
import React from 'react';

// Define the possible control modes
export type ControlMode = 'MANUAL' | 'AI';

// Define the props for the BrainToggle component
interface BrainToggleProps {
  currentMode: ControlMode;
  onToggle: (newMode: ControlMode) => void;
  disabled?: boolean; // Optional prop to disable the toggle
}

/**
 * A simple UI component to toggle between Manual and AI control modes.
 */
const BrainToggle: React.FC<BrainToggleProps> = ({
  currentMode,
  onToggle,
  disabled = false,
}) => {
  const handleToggle = () => {
    // Switch to the other mode
    const newMode: ControlMode = currentMode === 'MANUAL' ? 'AI' : 'MANUAL';
    onToggle(newMode);
  };

  // Basic styling (consider moving to a CSS file or using styled-components/Tailwind)
  const buttonStyle: React.CSSProperties = {
    padding: '10px 15px',
    fontSize: '1em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: '5px',
    border: '1px solid #ccc',
    backgroundColor: disabled ? '#eee' : '#fff',
    color: disabled ? '#aaa' : '#333',
    minWidth: '120px', // Ensure button has some width
    textAlign: 'center',
  };

  return (
    <div style={{ margin: '10px 0' }}>
      <button
        onClick={handleToggle}
        disabled={disabled}
        style={buttonStyle}
        title={`Switch to ${currentMode === 'MANUAL' ? 'AI' : 'MANUAL'} Control`}
      >
        Mode: {currentMode}
      </button>
      {/* You could replace the button with a more visually appealing toggle switch */}
    </div>
  );
};

export default BrainToggle;