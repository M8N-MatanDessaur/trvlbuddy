import React from 'react';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  label: string;
  options: SelectOption[];
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  helperText?: string;
  fullWidth?: boolean;
}

const MUISelect: React.FC<SelectProps> = ({ label, options, value, onChange, helperText, fullWidth = true }) => {
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      <label className="block text-sm font-medium text-text-secondary mb-2">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full px-4 py-4 rounded-xl border border-outline bg-surface-container text-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all appearance-none cursor-pointer"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {helperText && <p className="text-sm text-text-secondary mt-2">{helperText}</p>}
    </div>
  );
};

export default MUISelect;
