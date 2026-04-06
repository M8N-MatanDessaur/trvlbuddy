import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  minDate?: string;
}

const parseDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MUIDateRangePicker: React.FC<DateRangePickerProps> = ({
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

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let day = 1; day <= lastDay.getDate(); day++) days.push(new Date(year, month, day));
    return days;
  };

  const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const isDateInRange = (date: Date) => {
    if (!startDate || !endDate) return false;
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) return false;
    const d = dateOnly(date);
    return d >= dateOnly(start) && d <= dateOnly(end);
  };

  const isDateSelected = (date: Date) => {
    const d = dateOnly(date);
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    return (start && d.getTime() === dateOnly(start).getTime()) || (end && d.getTime() === dateOnly(end).getTime()) || false;
  };

  const isDateDisabled = (date: Date) => {
    if (!minimumDate) return false;
    return dateOnly(date) < dateOnly(minimumDate);
  };

  const isToday = (date: Date) => dateOnly(date).getTime() === dateOnly(today).getTime();

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;
    const dateString = formatDate(date);
    if (selectionMode === 'start') {
      onStartDateChange(dateString);
      if (endDate && date > parseDate(endDate)!) onEndDateChange('');
      setSelectionMode('end');
    } else {
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
      const m = new Date(prev);
      m.setMonth(prev.getMonth() + (direction === 'prev' ? -1 : 1));
      return m;
    });
  };

  const getTripDuration = () => {
    if (!startDate || !endDate) return 0;
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) return 0;
    const diff = dateOnly(end).getTime() - dateOnly(start).getTime();
    return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1, 1);
  };

  const formatDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = parseDate(dateString);
    if (!date) return '';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const days = getDaysInMonth(currentMonth);
  const duration = getTripDuration();

  return (
    <div className="flex flex-col gap-6 max-w-[600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <button
          onClick={() => navigateMonth('prev')}
          className="w-11 h-11 rounded-full flex items-center justify-center text-text-primary hover:bg-surface-container-high transition-all active:scale-95"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="text-lg md:text-xl font-semibold text-text-primary min-w-[200px] text-center">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </span>
        <button
          onClick={() => navigateMonth('next')}
          className="w-11 h-11 rounded-full flex items-center justify-center text-text-primary hover:bg-surface-container-high transition-all active:scale-95"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
        {dayNames.map(day => (
          <div key={day} className="py-2 text-center text-xs sm:text-sm font-semibold text-text-secondary">{day}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((date, i) => (
          <div key={i} className="flex justify-center items-center min-h-[32px] sm:min-h-[40px] md:min-h-[48px]">
            {date ? (
              <button
                onClick={() => handleDateClick(date)}
                disabled={isDateDisabled(date)}
                className={`
                  w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full text-sm sm:text-base font-semibold
                  flex items-center justify-center transition-all
                  ${isDateSelected(date) ? 'bg-[var(--primary)] text-[var(--on-primary)]' : ''}
                  ${isDateInRange(date) && !isDateSelected(date) ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)]' : ''}
                  ${!isDateSelected(date) && !isDateInRange(date) && !isDateDisabled(date) ? 'text-text-primary hover:bg-surface-container-high hover:scale-110' : ''}
                  ${isDateDisabled(date) ? 'text-text-secondary opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  ${isToday(date) ? 'ring-2 ring-[var(--primary)] ring-offset-2' : ''}
                `}
              >
                {date.getDate()}
              </button>
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" />
            )}
          </div>
        ))}
      </div>

      {/* Selection display */}
      {startDate && endDate && (
        <div className="text-center">
          <p className="text-base md:text-lg font-semibold text-text-primary mb-1">
            {formatDisplay(startDate)} &rarr; {formatDisplay(endDate)}
          </p>
          <p className="text-sm md:text-base text-text-secondary font-medium">
            {duration} {duration === 1 ? 'day' : 'days'} trip
          </p>
        </div>
      )}
    </div>
  );
};

export default MUIDateRangePicker;
