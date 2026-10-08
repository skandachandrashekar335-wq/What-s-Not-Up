import React from 'react';
import { createRoot } from 'react-dom/client';
import Options from './Options';
import './options.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
