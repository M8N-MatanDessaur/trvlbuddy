import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  label?: string;
  placeholder?: string;
}

const parseDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day);
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MUIDatePicker: React.FC<DatePickerProps> = ({ value, onChange, minDate, label }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const [year, month] = value.split('-').map(Number);
      if (!isNaN(year) && !isNaN(month)) return new Date(year, month - 1, 1);
    }
    return new Date();
  });

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

  const isDateSelected = (date: Date) => {
    if (!value) return false;
    const selected = parseDate(value);
    return selected ? dateOnly(date).getTime() === dateOnly(selected).getTime() : false;
  };

  const isDateDisabled = (date: Date) => minimumDate ? dateOnly(date) < dateOnly(minimumDate) : false;
  const isToday = (date: Date) => dateOnly(date).getTime() === dateOnly(today).getTime();

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const m = new Date(prev);
      m.setMonth(prev.getMonth() + (direction === 'prev' ? -1 : 1));
      return m;
    });
  };

  const formatDisplay = (dateString: string) => {
    const date = parseDate(dateString);
    if (!date) return '';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="flex flex-col gap-6 max-w-[600px] mx-auto">
      {label && <p className="text-sm font-medium text-text-primary mb-1">{label}</p>}

      <div className="flex items-center justify-between px-2 mb-2">
        <button onClick={() => navigateMonth('prev')} className="w-11 h-11 rounded-full flex items-center justify-center text-text-primary hover:bg-surface-container-high transition-all active:scale-95">
          <ChevronLeft size={22} />
        </button>
        <span className="text-lg md:text-xl font-semibold text-text-primary min-w-[200px] text-center">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </span>
        <button onClick={() => navigateMonth('next')} className="w-11 h-11 rounded-full flex items-center justify-center text-text-primary hover:bg-surface-container-high transition-all active:scale-95">
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
        {dayNames.map(day => (
          <div key={day} className="py-2 text-center text-xs sm:text-sm font-semibold text-text-secondary">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((date, i) => (
          <div key={i} className="flex justify-center items-center min-h-[32px] sm:min-h-[40px] md:min-h-[48px]">
            {date ? (
              <button
                onClick={() => !isDateDisabled(date) && onChange(formatDate(date))}
                disabled={isDateDisabled(date)}
                className={`
                  w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full text-sm sm:text-base font-semibold
                  flex items-center justify-center transition-all
                  ${isDateSelected(date) ? 'bg-[var(--primary)] text-[var(--on-primary)]' : ''}
                  ${!isDateSelected(date) && !isDateDisabled(date) ? 'text-text-primary hover:bg-surface-container-high hover:scale-110 cursor-pointer' : ''}
                  ${isDateDisabled(date) ? 'text-text-secondary opacity-50 cursor-not-allowed' : ''}
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

      {value && (
        <div className="text-center">
          <p className="text-base md:text-lg font-semibold text-text-primary">Selected: {formatDisplay(value)}</p>
        </div>
      )}
    </div>
  );
};

export default MUIDatePicker;
