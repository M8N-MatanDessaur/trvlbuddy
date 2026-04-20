import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Plus, X } from 'lucide-react';
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [chooserOpen, setChooserOpen] = useState(false);

  // Detect a coarse pointer (phone / tablet) so we only show the
  // Camera/Library chooser where it actually adds value. On desktop we
  // skip the popover and open the gallery picker directly.
  const isTouch = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    if (!chooserOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChooserOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chooserOpen]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast('Sign in to share photos', 'info');
      return;
    }
    if (isTouch) {
      setChooserOpen(true);
    } else {
      // Desktop: just open the file picker (no camera).
      galleryInputRef.current?.click();
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setChooserOpen(false);
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
        {uploading ? <Loader2 size={size} className="animate-spin" /> : <Plus size={size} />}
      </button>

      {/* Camera input: triggers the OS camera UI on mobile. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />

      {/* Gallery input: opens the device's photo library / file picker. */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={handleChange}
      />

      {chooserOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setChooserOpen(false)}
        >
          <div
            className="w-full max-w-md"
            style={{
              background: 'var(--surface-container)',
              borderRadius: '24px 24px 0 0',
              padding: '12px 16px 22px',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-3 rounded-full"
              style={{ width: 36, height: 4, background: 'var(--outline)' }}
              aria-hidden="true"
            />
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-[15px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Add a photo
              </h3>
              <button
                onClick={() => setChooserOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--surface-container-high)',
                  color: 'var(--text-secondary)',
                  border: 'none',
                  minHeight: 0,
                  minWidth: 0,
                }}
                aria-label="Close picker"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setChooserOpen(false);
                  cameraInputRef.current?.click();
                }}
                className="flex flex-col items-center gap-2 px-4 py-5 rounded-2xl transition-transform active:scale-[0.97]"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
                  border: 'none',
                  minHeight: 0,
                }}
              >
                <Camera size={22} />
                <span className="text-[13px] font-extrabold">Take a photo</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setChooserOpen(false);
                  galleryInputRef.current?.click();
                }}
                className="flex flex-col items-center gap-2 px-4 py-5 rounded-2xl transition-transform active:scale-[0.97]"
                style={{
                  background: 'var(--surface-container-high)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  minHeight: 0,
                }}
              >
                <ImagePlus size={22} />
                <span className="text-[13px] font-extrabold">From library</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UploadPhotoButton;
