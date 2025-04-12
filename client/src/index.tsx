import React from 'react';
import ReactDOM from 'react-dom/client';
import * as tf from '@tensorflow/tfjs'; 
import App from './App';
import './style.css';

tf.setBackend('webgl').then(() => {
  console.log('TensorFlow.js backend set to WebGL.');

  renderApp();
}).catch(err => {
  console.warn('WebGL backend not available or failed to set, using default TF backend.', err);

  renderApp();
});

const renderApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Failed to find the root element");
    return;
  }
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode> {}
      <App />
    </React.StrictMode>
  );
};