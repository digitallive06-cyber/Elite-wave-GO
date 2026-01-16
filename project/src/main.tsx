import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { IPTVProvider } from './contexts/IPTVContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IPTVProvider>
      <App />
    </IPTVProvider>
  </StrictMode>
);
