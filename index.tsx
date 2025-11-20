import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.web'; 
import './index.css';

// @ts-ignore
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
