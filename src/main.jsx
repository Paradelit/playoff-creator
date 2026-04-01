import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import CoachesApp from './shell/CoachesApp';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CoachesApp />
  </StrictMode>,
);
