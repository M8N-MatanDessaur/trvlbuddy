import React, { useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface Props {
  onFile: (file: File) => Promise<{ ok: boolean; error?: string | null }>;
  uploading?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
  ariaLabel?: string;
}

const UploadPhotoButton: React.FC<Props> = ({
  onFile,
  uploading,
  disabled,
  className,
  style,
  size = 18,
  ariaLabel = 'Upload photo',
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast('Sign in to share photos', 'info');
      return;
    }
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { ok, error } = await onFile(file);
    if (!ok) toast(error || 'Upload failed', 'error');
    else toast('Photo uploaded. +1 Influence', 'success');
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || uploading}
        className={className}
        style={{ ...style, opacity: disabled || uploading ? 0.6 : style?.opacity ?? 1 }}
        aria-label={ariaLabel}
      >
        {uploading ? <Loader2 size={size} className="animate-spin" /> : <Camera size={size} />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
};

export default UploadPhotoButton;
