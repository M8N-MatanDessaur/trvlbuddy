import React from 'react';

interface TextFieldProps {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  helperText?: string;
  fullWidth?: boolean;
  type?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
}

const MUITextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  fullWidth = true,
  type = 'text',
  disabled = false,
}) => {
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && <label className="block text-sm font-medium text-text-secondary mb-2">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-4 rounded-xl border border-outline bg-surface-container text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all disabled:opacity-50"
      />
      {helperText && <p className="text-sm text-text-secondary mt-2">{helperText}</p>}
    </div>
  );
};

export default MUITextField;
