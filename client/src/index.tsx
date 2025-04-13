import React from 'react';
import ReactDOM from 'react-dom/client';
import * as tf from '@tensorflow/tfjs';
import App from './App';
import './style.css';

// ✅ CONSOLE LOG ONCE PATCH (safe placement + TS fix)
type ConsoleMethod = (...args: any[]) => void;

const seenConsoleMessages = new Set<string>();

(['log', 'warn', 'error'] as const).forEach((method) => {
  const original = console[method] as ConsoleMethod;

  (console[method] as ConsoleMethod) = (...args: any[]) => {
    const messageKey = args.map(arg => JSON.stringify(arg)).join('');
    if (!seenConsoleMessages.has(messageKey)) {
      seenConsoleMessages.add(messageKey);
      original(...args);
    }
  };
});

tf.setBackend('webgl').then(() => {
  console.log('TensorFlow.js backend set to WebGL.');
  renderApp();
}).catch(err => {
  console.warn('WebGL backend not available, using fallback.', err);
  renderApp();
});

const renderApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Root element not found!");
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};
