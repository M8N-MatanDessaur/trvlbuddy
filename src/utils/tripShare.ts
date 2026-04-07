import { TravelPlan, GeneratedActivity, Translation, EmergencyContact } from '../types/TravelData';

export interface TripBundle {
  version: 1;
  exportedAt: string;
  plan: TravelPlan;
  activities: GeneratedActivity[];
  translations: Translation[];
  emergencyContacts: EmergencyContact[];
  savedActivities: string[];
}

export function exportTrip(
  plan: TravelPlan,
  activities: GeneratedActivity[],
  translations: Translation[],
  emergencyContacts: EmergencyContact[],
  savedActivities: string[]
): TripBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    plan,
    activities,
    translations,
    emergencyContacts,
    savedActivities,
  };
}

export async function shareTrip(bundle: TripBundle): Promise<boolean> {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `${bundle.plan.title?.replace(/[^a-zA-Z0-9]/g, '-') || 'trip'}.trvlbuddy`;
  const file = new File([blob], filename, { type: 'application/json' });

  // Try Web Share API first (native share sheet on mobile)
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: bundle.plan.title || 'My Trip',
        text: `Check out my trip plan for ${bundle.plan.title}!`,
        files: [file],
      });
      return true;
    } catch (e: any) {
      if (e.name === 'AbortError') return false; // User cancelled
    }
  }

  // Fallback: download the file
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export function validateTripBundle(data: any): data is TripBundle {
  return (
    data &&
    data.version === 1 &&
    data.plan &&
    data.plan.id &&
    data.plan.title &&
    Array.isArray(data.activities) &&
    Array.isArray(data.translations) &&
    Array.isArray(data.emergencyContacts)
  );
}

export function importTripFromJson(json: string): TripBundle | null {
  try {
    const data = JSON.parse(json);
    if (validateTripBundle(data)) return data;
    return null;
  } catch {
    return null;
  }
}
