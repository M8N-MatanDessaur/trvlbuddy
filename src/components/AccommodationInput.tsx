import React from 'react';
import { Plus, Trash2, MapPin, AlertCircle } from 'lucide-react';
import { Box, Typography, IconButton, Button, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Accommodation } from '../types/TravelData';
import PlacesAutocomplete from './PlacesAutocomplete';
import MUIDateRangePicker from './MUIDateRangePicker';
import MUITextField from './MUITextField';

interface AccommodationInputProps {
  accommodations: Accommodation[];
  onAccommodationsChange: (accommodations: Accommodation[]) => void;
  hideStayDuration?: boolean;
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: 0,
  borderRadius: 0,
  backgroundColor: 'transparent',
  border: 'none',
  boxShadow: 'none',
  marginBottom: theme.spacing(3),
}));

const AddButton = styled(Button)({
  borderRadius: '16px',
  padding: '24px',
  border: '2px dashed var(--outline)',
  backgroundColor: 'transparent',
  color: 'var(--text-secondary)',
  textTransform: 'none',
  fontSize: '16px',
  fontWeight: 500,
  '&:hover': {
    borderColor: 'var(--primary)',
    backgroundColor: 'var(--primary)',
    color: 'var(--on-primary)',
    '& .MuiSvgIcon-root': {
      backgroundColor: 'var(--primary)',
    },
  },
});

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {accommodations.map((acc, index) => (
        <StyledPaper key={acc.id} elevation={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  backgroundColor: 'var(--primary)',
                  color: 'var(--on-primary)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                {index + 1}
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Accommodation {index + 1}
              </Typography>
            </Box>
            {accommodations.length > 1 && (
              <IconButton
                onClick={() => removeAccommodation(index)}
                sx={{
                  color: 'var(--error)',
                  '&:hover': {
                    backgroundColor: 'var(--error)',
                    color: 'white',
                  },
                }}
              >
                <Trash2 size={20} />
              </IconButton>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <MUITextField
              label="Hotel/Accommodation Name"
              value={acc.name}
              onChange={(e) => updateAccommodation(index, 'name', e.target.value)}
              placeholder="e.g., Hotel Splendido, Airbnb Downtown"
            />
            
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: 'var(--text-primary)' }}>
                Address
              </Typography>
              <PlacesAutocomplete
                onPlaceSelect={(place) => handleAddressSelect(index, place)}
                placeholder="Search for hotel address..."
                value={acc.address}
                className="w-full"
                types={['establishment', 'geocode']}
                apiKey="AIzaSyB-QqGGN0wHjSHwpI2zh1FP9iq3Ex7UPF8"
              />
              {acc.coordinates && (
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MapPin size={12} color="green" />
                  <Typography variant="caption" sx={{ color: 'green' }}>
                    Location confirmed with coordinates
                  </Typography>
                </Box>
              )}
              {acc.address && !acc.coordinates && (
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AlertCircle size={12} color="orange" />
                  <Typography variant="caption" sx={{ color: 'orange' }}>
                    Manual address entry - location services unavailable
                  </Typography>
                </Box>
              )}
            </Box>
            
            {!hideStayDuration && (
              <Box>
                <Typography variant="body2" sx={{ mb: 2, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Stay Duration
                </Typography>
                <MUIDateRangePicker
                  startDate={acc.checkIn}
                  endDate={acc.checkOut}
                  onStartDateChange={(date) => handleDateRangeChange(index, date, acc.checkOut)}
                  onEndDateChange={(date) => handleDateRangeChange(index, acc.checkIn, date)}
                  minDate={new Date().toISOString().split('T')[0]}
                />
              </Box>
            )}
          </Box>
        </StyledPaper>
      ))}
      
      <AddButton
        onClick={addAccommodation}
        fullWidth
        variant="outlined"
        startIcon={
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '2px solid currentColor',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={20} />
          </Box>
        }
      >
        Add A Accommodation
      </AddButton>
    </Box>
  );
};

export default AccommodationInput;