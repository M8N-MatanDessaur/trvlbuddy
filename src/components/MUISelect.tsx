import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, SelectProps, FormHelperText } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledFormControl = styled(FormControl)({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: 'var(--surface-container)',
    '& fieldset': {
      borderColor: 'var(--outline)',
    },
    '&:hover fieldset': {
      borderColor: 'var(--primary)',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'var(--primary)',
      borderWidth: '2px',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'var(--text-secondary) !important',
    '&.Mui-focused': {
      color: 'var(--primary) !important',
    },
  },
  '& .MuiSelect-select': {
    color: 'var(--text-primary) !important',
    padding: '16px 14px',
  },
  '& .MuiFormHelperText-root': {
    color: 'var(--text-secondary) !important',
    marginLeft: 0,
    marginTop: '8px',
  },
  '& .MuiSvgIcon-root': {
    color: 'var(--text-secondary) !important',
  },
});

const StyledMenuItem = styled(MenuItem)({
  color: 'var(--text-primary) !important',
  backgroundColor: 'var(--surface-container) !important',
  '&:hover': {
    backgroundColor: 'var(--surface-container-high) !important',
  },
  '&.Mui-selected': {
    backgroundColor: 'var(--primary-container) !important',
    color: 'var(--on-primary-container) !important',
    '&:hover': {
      backgroundColor: 'var(--primary-container) !important',
    },
  },
});

interface MUISelectProps extends Omit<SelectProps, 'variant'> {
  label: string;
  options: { value: string | number; label: string }[];
  helperText?: string;
  variant?: 'outlined' | 'filled' | 'standard';
}

const MUISelect: React.FC<MUISelectProps> = ({
  label,
  options,
  helperText,
  variant = 'outlined',
  fullWidth = true,
  ...props
}) => {
  return (
    <StyledFormControl variant={variant} fullWidth={fullWidth}>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        MenuProps={{
          PaperProps: {
            sx: {
              backgroundColor: 'var(--surface-container)',
              border: '1px solid var(--outline)',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          },
        }}
        {...props}
      >
        {options.map((option) => (
          <StyledMenuItem key={option.value} value={option.value}>
            {option.label}
          </StyledMenuItem>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </StyledFormControl>
  );
};

export default MUISelect;