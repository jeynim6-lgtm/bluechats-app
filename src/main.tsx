import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initTheme } from './lib/theme';
import { getLanguage } from './lib/i18n';
import './index.css';

initTheme();
document.documentElement.lang = getLanguage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
