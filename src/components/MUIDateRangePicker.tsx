import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MUIDateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  minDate?: string;
}

const CalendarHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '24px',
  padding: '0 8px',
  
  '@media (max-width: 768px)': {
    marginBottom: '20px',
  },
});

const CalendarGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '8px',
  marginBottom: '20px',
  
  '@media (max-width: 768px)': {
    gap: '6px',
  },
  
  '@media (max-width: 480px)': {
    gap: '4px',
  },
});

const DayHeader = styled(Box)({
  padding: '16px 8px',
  textAlign: 'center',
  fontSize: '14px',
  fontWeight: '600',
  color: 'var(--text-secondary)',
  
  '@media (max-width: 768px)': {
    padding: '12px 4px',
    fontSize: '12px',
  },
  
  '@media (max-width: 480px)': {
    padding: '10px 2px',
    fontSize: '11px',
  },
});

const DayButton = styled('button')<{ 
  isSelected?: boolean; 
  isToday?: boolean; 
  isInRange?: boolean;
  isDisabled?: boolean;
}>(({ isSelected, isToday, isInRange, isDisabled }) => ({
  width: '48px',
  height: '48px',
  minWidth: '48px',
  minHeight: '48px',
  maxWidth: '48px',
  maxHeight: '48px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: isSelected 
    ? 'var(--primary)' 
    : isInRange 
    ? 'var(--primary-container)' 
    : 'transparent',
  color: isSelected 
    ? 'var(--on-primary)' 
    : isInRange 
    ? 'var(--on-primary-container)'
    : isDisabled 
    ? 'var(--text-secondary)' 
    : 'var(--text-primary)',
  cursor: isDisabled ? 'not-allowed' : 'pointer',
  fontSize: '16px',
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  opacity: isDisabled ? 0.5 : 1,
  outline: isToday ? '2px solid var(--primary)' : 'none',
  outlineOffset: isToday ? '3px' : '0',
  padding: '8px !important',
  margin: '0 !important',
  boxSizing: 'border-box',
  aspectRatio: '1 / 1',
  
  '&:hover': {
    backgroundColor: isDisabled 
      ? 'transparent' 
      : isSelected 
      ? 'var(--primary)' 
      : 'var(--surface-container-high)',
    transform: isDisabled ? 'none' : 'scale(1.1)',
  },
  
  '&:active': {
    transform: isDisabled ? 'none' : 'scale(0.95)',
  },
  
  '@media (max-width: 768px)': {
    width: '36px !important',
    height: '36px !important',
    minWidth: '36px !important',
    minHeight: '36px !important',
    maxWidth: '36px !important',
    maxHeight: '36px !important',
    fontSize: '14px !important',
    fontWeight: '600 !important',
    borderRadius: '50% !important',
    padding: '6px !important',
    margin: '0 !important',
    lineHeight: '1 !important',
    aspectRatio: '1 / 1 !important',
    flexShrink: '0 !important',
    flexGrow: '0 !important',
    outlineOffset: isToday ? '2px' : '0',
  },
  
  '@media (max-width: 480px)': {
    width: '32px !important',
    height: '32px !important',
    minWidth: '32px !important',
    minHeight: '32px !important',
    maxWidth: '32px !important',
    maxHeight: '32px !important',
    fontSize: '13px !important',
    fontWeight: '600 !important',
    borderRadius: '50% !important',
    padding: '4px !important',
    margin: '0 !important',
    lineHeight: '1 !important',
    aspectRatio: '1 / 1 !important',
    flexShrink: '0 !important',
    flexGrow: '0 !important',
    outlineOffset: isToday ? '2px' : '0',
  },
  
  '@media (max-width: 360px)': {
    width: '28px !important',
    height: '28px !important',
    minWidth: '28px !important',
    minHeight: '28px !important',
    maxWidth: '28px !important',
    maxHeight: '28px !important',
    fontSize: '12px !important',
    fontWeight: '600 !important',
    padding: '3px !important',
  },
}));

const NavigationButton = styled('button')({
  width: '44px',
  height: '44px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  padding: '8px',
  
  '&:hover': {
    backgroundColor: 'var(--surface-container-high)',
    transform: 'scale(1.1)',
  },
  
  '&:active': {
    transform: 'scale(0.95)',
  },
  
  '@media (max-width: 768px)': {
    width: '36px',
    height: '36px',
    padding: '6px',
  },
});

// CRITICAL FIX: Proper date parsing that matches exactly what the user selects
const parseDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  try {
    // Parse YYYY-MM-DD format directly without timezone conversion
    const [year, month, day] = dateString.split('-').map(Number);
    
    // Validate the parsed values
    if (isNaN(year) || isNaN(month) || isNaN(day) || 
        month < 1 || month > 12 || day < 1 || day > 31) {
      console.error('Invalid date components:', { year, month, day, original: dateString });
      return null;
    }
    
    // Create date object with local timezone (month is 0-indexed)
    // This ensures the date is exactly what the user selected
    return new Date(year, month - 1, day);
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return null;
  }
};

// CRITICAL FIX: Proper date formatting that preserves the exact date
const formatDate = (date: Date): string => {
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date:', date, error);
    return '';
  }
};

const MUIDateRangePicker: React.FC<MUIDateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  minDate
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectionMode, setSelectionMode] = useState<'start' | 'end'>('start');
  
  const today = new Date();
  const minimumDate = minDate ? parseDate(minDate) : today;
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };
  
  const isDateInRange = (date: Date) => {
    if (!startDate || !endDate) return false;
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) return false;
    
    // CRITICAL FIX: Use date-only comparison to avoid timezone issues
    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    
    return checkDate >= startDateOnly && checkDate <= endDateOnly;
  };
  
  const isDateSelected = (date: Date) => {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
    // CRITICAL FIX: Compare dates using date-only comparison
    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const isStartSelected = start && 
      checkDate.getTime() === new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const isEndSelected = end && 
      checkDate.getTime() === new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    
    return isStartSelected || isEndSelected;
  };
  
  const isDateDisabled = (date: Date) => {
    if (!minimumDate) return false;
    
    // CRITICAL FIX: Use date-only comparison for minimum date check
    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const minDateOnly = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate());
    
    return checkDate < minDateOnly;
  };
  
  const isToday = (date: Date) => {
    // CRITICAL FIX: Use date-only comparison for today check
    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return checkDate.getTime() === todayOnly.getTime();
  };
  
  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;
    
    const dateString = formatDate(date);
    
    if (selectionMode === 'start') {
      onStartDateChange(dateString);
      // If end date is before new start date, clear it
      if (endDate && date > parseDate(endDate)!) {
        onEndDateChange('');
      }
      setSelectionMode('end');
    } else {
      // If selecting end date and it's before start date, swap them
      if (startDate && date < parseDate(startDate)!) {
        onEndDateChange(startDate);
        onStartDateChange(dateString);
      } else {
        onEndDateChange(dateString);
      }
      setSelectionMode('start');
    }
  };
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };
  
  const getTripDuration = () => {
    if (startDate && endDate) {
      const start = parseDate(startDate);
      const end = parseDate(endDate);
      if (start && end) {
        // CRITICAL FIX: Calculate duration using date-only comparison
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const diffTime = endDateOnly.getTime() - startDateOnly.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days
        return Math.max(diffDays, 1);
      }
    }
    return 0;
  };
  
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = parseDate(dateString);
    if (!date) return '';
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };
  
  const days = getDaysInMonth(currentMonth);
  const duration = getTripDuration();
  
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 3,
      maxWidth: '600px',
      margin: 'auto'
    }}>
      {/* Calendar Header */}
      <CalendarHeader>
        <NavigationButton onClick={() => navigateMonth('prev')}>
          <ChevronLeft size={22} />
        </NavigationButton>
        
        <Typography variant="h6" sx={{ 
          fontWeight: 600, 
          color: 'var(--text-primary)',
          minWidth: '200px',
          textAlign: 'center',
          fontSize: { xs: '18px', md: '22px' },
          padding: '8px 16px'
        }}>
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Typography>
        
        <NavigationButton onClick={() => navigateMonth('next')}>
          <ChevronRight size={22} />
        </NavigationButton>
      </CalendarHeader>
      
      {/* Day Headers */}
      <CalendarGrid>
        {dayNames.map(day => (
          <DayHeader key={day}>{day}</DayHeader>
        ))}
      </CalendarGrid>
      
      {/* Calendar Days */}
      <CalendarGrid>
        {days.map((date, index) => (
          <Box key={index} sx={{ 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: { xs: '32px', sm: '36px', md: '48px' },
            padding: '4px'
          }}>
            {date ? (
              <DayButton
                isSelected={isDateSelected(date)}
                isToday={isToday(date)}
                isInRange={isDateInRange(date)}
                isDisabled={isDateDisabled(date)}
                onClick={() => handleDateClick(date)}
              >
                {date.getDate()}
              </DayButton>
            ) : (
              <Box sx={{ 
                width: { xs: '32px', sm: '36px', md: '48px' },
                height: { xs: '32px', sm: '36px', md: '48px' },
                flexShrink: 0
              }} />
            )}
          </Box>
        ))}
      </CalendarGrid>
      
      {/* Date Range Display */}
      {startDate && endDate && (
        <Box sx={{ 
          textAlign: 'center',
          padding: 0,
          backgroundColor: 'transparent',
          border: 'none'
        }}>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: { xs: '16px', md: '18px' },
              mb: 1
            }}
          >
            {formatDateForDisplay(startDate)} → {formatDateForDisplay(endDate)}
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'var(--text-secondary)',
              fontWeight: 500,
              fontSize: { xs: '14px', md: '16px' }
            }}
          >
            {duration} {duration === 1 ? 'day' : 'days'} trip
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default MUIDateRangePicker;