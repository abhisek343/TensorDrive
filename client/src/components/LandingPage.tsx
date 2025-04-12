import React, { useState } from 'react';
import './LandingPage.css'; 

interface SimulationConfig {
  numCars: number;
  mutationRate: number;

}

interface LandingPageProps {
  onStartSimulation: (config: SimulationConfig) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartSimulation }) => {

  const [config, setConfig] = useState<SimulationConfig>({
    numCars: 100,      
    mutationRate: 0.1, 
  });

const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = event.target; 

    let processedValue: string | number = value;
    if (name === 'mutationRate' || name === 'numCars' || type === 'number') {

        processedValue = parseFloat(value);

        if (isNaN(processedValue)) {
            processedValue = 0; 
        }
    }

    setConfig(prevConfig => ({
      ...prevConfig,
      [name]: processedValue,
    }));
  };
  const handleStartClick = () => {

    onStartSimulation(config);
  };

  return (
    <div className="landing-container">
      <header className="landing-header">
        <h1>Self-Driving Car Simulation</h1>
        <p className="tagline">Watch neural networks learn to navigate traffic!</p>
      </header>

      {}
      <section className="description-section">
        <div className="animation-placeholder">
          {}
          🚗💨 Neural Network Learning... 🧠
          <div className="pulsing-node"></div>
        </div>
        <p>
          This simulation uses a genetic algorithm and neural networks
          to train virtual cars to drive autonomously on a simulated road.
          Sensors help the cars perceive their environment, and a prediction
          engine assesses risks. Adjust the parameters below and see how they learn!
        </p>
      </section>

      {}
      <section className="config-section">
        <h2>Configuration</h2>
        <div className="config-item">
          <label htmlFor="numCars">Number of AI Cars:</label>
          <input
            type="number"
            id="numCars"
            name="numCars"
            min="1"
            max="500"
            value={config.numCars}
            onChange={handleInputChange}
          />
        </div>
        <div className="config-item">
          <label htmlFor="mutationRate">AI Mutation Rate (0 to 1):</label>
          <input
            type="range" 
            id="mutationRate"
            name="mutationRate"
            min="0"
            max="1"
            step="0.05"
            value={config.mutationRate}
            onChange={handleInputChange}
          />
          <span>{config.mutationRate.toFixed(2)}</span>
        </div>
        {}
        {}
        {}
      </section>

      {}
      <button className="start-button" onClick={handleStartClick}>
        Start Simulation
      </button>
    </div>
  );
};

export default LandingPage;