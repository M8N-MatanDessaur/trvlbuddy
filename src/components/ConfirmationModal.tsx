import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-error',
          confirmButton: 'bg-red-600 hover:bg-red-700 text-white'
        };
      case 'info':
        return {
          icon: 'text-primary',
          confirmButton: 'bg-primary hover:bg-primary/90'
        };
      case 'warning':
      default:
        return {
          icon: 'text-yellow-500',
          confirmButton: 'bg-yellow-500 hover:bg-yellow-600 text-white'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
      <div className="modal-content rounded-3xl shadow-2xl w-full max-w-md transform transition-all overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline bg-surface-container-high">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`h-6 w-6 ${styles.icon}`} />
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-full hover:bg-surface-container transition-colors text-text-secondary hover:text-text-primary"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Modal Content */}
        <div className="p-6">
          <p className="text-text-secondary leading-relaxed mb-6">
            {message}
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-2xl border-2 border-outline text-text-primary hover:bg-surface-container-high transition-all font-medium"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-6 py-3 rounded-2xl transition-all font-medium shadow-md ${styles.confirmButton}`}
              style={type === 'danger' ? {
                backgroundColor: '#DC3545',
                borderColor: '#DC3545',
                color: 'white'
              } : type === 'info' ? {
                backgroundColor: 'var(--primary)',
                borderColor: 'var(--primary)',
                color: 'var(--on-primary)'
              } : undefined}
              onMouseEnter={(e) => {
                if (type === 'danger') {
                  e.currentTarget.style.backgroundColor = '#C82333';
                  e.currentTarget.style.borderColor = '#C82333';
                } else if (type === 'info') {
                  e.currentTarget.style.backgroundColor = 'var(--primary)';
                  e.currentTarget.style.opacity = '0.9';
                }
              }}
              onMouseLeave={(e) => {
                if (type === 'danger') {
                  e.currentTarget.style.backgroundColor = '#DC3545';
                  e.currentTarget.style.borderColor = '#DC3545';
                } else if (type === 'info') {
                  e.currentTarget.style.backgroundColor = 'var(--primary)';
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;