import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { importTripFromJson } from './utils/tripShare';
import App from './App.tsx';
import './index.css';

// Shared helper: write a TripBundle into localStorage so TravelProvider picks it up
function applyBundle(bundle: any) {
  localStorage.setItem('currentTravelPlan', JSON.stringify(bundle.plan));
  localStorage.setItem('generatedActivities', JSON.stringify(bundle.activities));
  localStorage.setItem('generatedTranslations', JSON.stringify(bundle.translations));
  localStorage.setItem('emergencyContacts', JSON.stringify(bundle.emergencyContacts));
  if (bundle.savedActivities) {
    localStorage.setItem('savedActivities', JSON.stringify(bundle.savedActivities));
  }
  localStorage.setItem('hasCompletedOnboarding', 'true');
}

// Handle "Open with" via the File Handling API (desktop).
if ('launchQueue' in window) {
  (window as any).launchQueue.setConsumer(async (launchParams: any) => {
    if (!launchParams.files?.length) return;
    const handle = launchParams.files[0];
    const file = await handle.getFile();
    const text = await file.text();
    const bundle = importTripFromJson(text);
    if (bundle) {
      applyBundle(bundle);
      window.location.replace('/');
    }
  });
}

// Handle Share Target (mobile). The service worker stores the shared file in
// IndexedDB and redirects here with ?import=shared. Read it, apply, clean up.
if (new URLSearchParams(window.location.search).get('import') === 'shared') {
  const req = indexedDB.open('trvlbuddy-share', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('pending');
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction('pending', 'readwrite');
    const store = tx.objectStore('pending');
    const get = store.get('shared-trip');
    get.onsuccess = () => {
      if (get.result) {
        const bundle = importTripFromJson(get.result);
        if (bundle) applyBundle(bundle);
        store.delete('shared-trip');
      }
      window.history.replaceState({}, '', '/');
    };
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
