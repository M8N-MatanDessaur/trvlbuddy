import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  minDate?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  minDate
}) => {
  const today = new Date().toISOString().split('T')[0];
  const minimumDate = minDate || today;

  const handleStartDateChange = (date: string) => {
    onStartDateChange(date);
    // If end date is before new start date, update it
    if (endDate && date > endDate) {
      onEndDateChange(date);
    }
  };

  const getTripDuration = () => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    }
    return 0;
  };

  const duration = getTripDuration();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <label className="block text-sm font-medium mb-2">Start Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              min={minimumDate}
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-outline bg-surface-container text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        
        <div className="relative">
          <label className="block text-sm font-medium mb-2">End Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              min={startDate || minimumDate}
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-outline bg-surface-container text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>
      
      {duration > 0 && (
        <div className="text-center p-3 bg-primary-container rounded-xl">
          <span className="text-on-primary-container font-medium">
            Trip duration: {duration} {duration === 1 ? 'day' : 'days'}
          </span>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;