import React from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledTextField = styled(TextField)({
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
  '& .MuiInputBase-input': {
    color: 'var(--text-primary) !important',
    padding: '16px 14px',
    '&::placeholder': {
      color: 'var(--text-secondary) !important',
      opacity: 1,
    },
  },
  '& .MuiFormHelperText-root': {
    color: 'var(--text-secondary) !important',
    marginLeft: 0,
    marginTop: '8px',
  },
});

interface MUITextFieldProps extends Omit<TextFieldProps, 'variant'> {
  variant?: 'outlined' | 'filled' | 'standard';
}

const MUITextField: React.FC<MUITextFieldProps> = ({ 
  variant = 'outlined',
  fullWidth = true,
  ...props 
}) => {
  return (
    <StyledTextField
      variant={variant}
      fullWidth={fullWidth}
      {...props}
    />
  );
};

export default MUITextField;