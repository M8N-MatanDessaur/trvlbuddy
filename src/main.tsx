import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { importTripFromJson } from './utils/tripShare';
import App from './App.tsx';
import './index.css';

// Handle "Open with" via the File Handling API.
// This runs before React mounts so the imported trip data is already in
// localStorage when TravelProvider initializes, avoiding Router context issues.
if ('launchQueue' in window) {
  (window as any).launchQueue.setConsumer(async (launchParams: any) => {
    if (!launchParams.files?.length) return;

    const handle = launchParams.files[0];
    const file = await handle.getFile();
    const text = await file.text();
    const bundle = importTripFromJson(text);

    if (bundle) {
      localStorage.setItem('currentTravelPlan', JSON.stringify(bundle.plan));
      localStorage.setItem('generatedActivities', JSON.stringify(bundle.activities));
      localStorage.setItem('generatedTranslations', JSON.stringify(bundle.translations));
      localStorage.setItem('emergencyContacts', JSON.stringify(bundle.emergencyContacts));
      if (bundle.savedActivities) {
        localStorage.setItem('savedActivities', JSON.stringify(bundle.savedActivities));
      }
      localStorage.setItem('hasCompletedOnboarding', 'true');
      // Reload so TravelProvider picks up the new data from localStorage
      window.location.replace('/');
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
