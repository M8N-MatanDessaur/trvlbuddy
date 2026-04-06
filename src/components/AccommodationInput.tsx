import React from 'react';
import { Plus, Trash2, MapPin, AlertCircle } from 'lucide-react';
import { Accommodation } from '../types/TravelData';
import PlacesAutocomplete from './PlacesAutocomplete';
import MUIDateRangePicker from './MUIDateRangePicker';
import MUITextField from './MUITextField';

interface AccommodationInputProps {
  accommodations: Accommodation[];
  onAccommodationsChange: (accommodations: Accommodation[]) => void;
  hideStayDuration?: boolean;
}

const AccommodationInput: React.FC<AccommodationInputProps> = ({
  accommodations,
  onAccommodationsChange,
  hideStayDuration = false
}) => {
  const addAccommodation = () => {
    const newAccommodation: Accommodation = {
      id: `acc_${Date.now()}`,
      name: '',
      address: '',
      checkIn: '',
      checkOut: ''
    };
    onAccommodationsChange([...accommodations, newAccommodation]);
  };

  const removeAccommodation = (index: number) => {
    if (accommodations.length > 1) {
      onAccommodationsChange(accommodations.filter((_, i) => i !== index));
    }
  };

  const updateAccommodation = (index: number, field: keyof Accommodation, value: string) => {
    const updated = [...accommodations];
    updated[index] = { ...updated[index], [field]: value };
    onAccommodationsChange(updated);
  };

  const handleAddressSelect = (index: number, place: any) => {
    const updated = [...accommodations];
    updated[index] = {
      ...updated[index],
      address: place.formatted_address || place.name,
      coordinates: place.coordinates
    };
    onAccommodationsChange(updated);
  };

  const handleDateRangeChange = (index: number, startDate: string, endDate: string) => {
    const updated = [...accommodations];
    updated[index] = {
      ...updated[index],
      checkIn: startDate,
      checkOut: endDate
    };
    onAccommodationsChange(updated);
  };

  return (
    <div className="flex flex-col gap-6">
      {accommodations.map((acc, index) => (
        <div key={acc.id} className="mb-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[var(--primary)] text-[var(--on-primary)] rounded-full flex items-center justify-center text-sm font-bold">
                {index + 1}
              </div>
              <h4 className="font-semibold text-text-primary">Accommodation {index + 1}</h4>
            </div>
            {accommodations.length > 1 && (
              <button
                onClick={() => removeAccommodation(index)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--error)] hover:bg-[var(--error)] hover:text-white transition-colors"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <MUITextField
              label="Hotel/Accommodation Name"
              value={acc.name}
              onChange={(e) => updateAccommodation(index, 'name', e.target.value)}
              placeholder="e.g., Hotel Splendido, Airbnb Downtown"
            />

            <div>
              <p className="text-sm font-medium text-text-primary mb-2">Address</p>
              <PlacesAutocomplete
                onPlaceSelect={(place) => handleAddressSelect(index, place)}
                placeholder="Search for hotel address..."
                value={acc.address}
                className="w-full"
                types={['establishment', 'geocode']}
                apiKey={import.meta.env.VITE_GOOGLE_PLACES_API_KEY || ''}
              />
              {acc.coordinates && (
                <div className="mt-2 flex items-center gap-1">
                  <MapPin size={12} className="text-green-500" />
                  <span className="text-xs text-green-500">Location confirmed with coordinates</span>
                </div>
              )}
              {acc.address && !acc.coordinates && (
                <div className="mt-2 flex items-center gap-1">
                  <AlertCircle size={12} className="text-orange-400" />
                  <span className="text-xs text-orange-400">Manual address entry - location services unavailable</span>
                </div>
              )}
            </div>

            {!hideStayDuration && (
              <div>
                <p className="text-sm font-medium text-text-primary mb-4">Stay Duration</p>
                <MUIDateRangePicker
                  startDate={acc.checkIn}
                  endDate={acc.checkOut}
                  onStartDateChange={(date) => handleDateRangeChange(index, date, acc.checkOut)}
                  onEndDateChange={(date) => handleDateRangeChange(index, acc.checkIn, date)}
                  minDate={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={addAccommodation}
        className="w-full py-6 rounded-2xl border-2 border-dashed border-outline text-text-secondary text-base font-medium flex items-center justify-center gap-3 hover:border-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--on-primary)] transition-all"
      >
        <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center">
          <Plus size={20} />
        </div>
        Add Accommodation
      </button>
    </div>
  );
};

export default AccommodationInput;
