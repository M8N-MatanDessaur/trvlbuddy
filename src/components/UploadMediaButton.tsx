import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Plus, Video as VideoIcon, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import VideoTrimmer from './VideoTrimmer';
import type { TrimResult } from '../lib/videoProcess';

interface Props {
  onPhotoFile: (file: File) => Promise<{ ok: boolean; error?: string | null }>;
  onVideoResult: (result: TrimResult) => Promise<{ ok: boolean; error?: string | null }>;
  uploading?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
  ariaLabel?: string;
}

// Drop-in replacement for UploadPhotoButton that also handles 7-second
// video uploads. On touch devices the chooser offers: camera (photo or
// video, decided in the native camera UI), photo library, and video
// library. Any video — recorded or picked — goes through VideoTrimmer →
// ffmpeg trim/downscale → caller.

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-m4v';
// iOS Safari falls back to the Photo Library when `capture` is paired with an
// explicit MIME list — only the wildcard form ("image/*,video/*") triggers the
// native camera with a Photo/Video toggle.
const CAMERA_ACCEPT = 'image/*,video/*';

const UploadMediaButton: React.FC<Props> = ({
  onPhotoFile,
  onVideoResult,
  uploading,
  disabled,
  className,
  style,
  size = 18,
  ariaLabel = 'Add photo or video',
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);

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
      toast('Sign in to share photos and videos', 'info');
      return;
    }
    setChooserOpen(true);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setChooserOpen(false);
    if (!file) return;
    const { ok, error } = await onPhotoFile(file);
    if (!ok) toast(error || 'Upload failed', 'error');
    else toast('Photo uploaded', 'success');
  };

  const handleVideoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setChooserOpen(false);
    if (!file) return;
    // Hand off to the trimmer modal. It decides the final 7s window,
    // runs ffmpeg, and returns the transcoded file + poster.
    setPendingVideo(file);
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setChooserOpen(false);
    if (!file) return;
    // The camera input accepts both photos and videos; route by MIME.
    if (file.type.startsWith('video/')) {
      setPendingVideo(file);
      return;
    }
    const { ok, error } = await onPhotoFile(file);
    if (!ok) toast(error || 'Upload failed', 'error');
    else toast('Photo uploaded', 'success');
  };

  const handleTrimConfirm = async (result: TrimResult) => {
    setPendingVideo(null);
    const { ok, error } = await onVideoResult(result);
    if (!ok) toast(error || 'Video upload failed', 'error');
    else toast('Video uploaded', 'success');
  };

  const chooserButton = (icon: React.ReactNode, label: string, onClick: () => void, primary = false) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex flex-col items-center gap-2 px-4 py-5 rounded-2xl transition-transform active:scale-[0.97]"
      style={{
        background: primary ? 'var(--accent)' : 'var(--surface-container-high)',
        color: primary ? 'var(--on-accent)' : 'var(--text-primary)',
        border: 'none',
        minHeight: 0,
      }}
    >
      {icon}
      <span className="text-[12.5px] font-extrabold text-center">{label}</span>
    </button>
  );

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

      <input
        ref={cameraInputRef}
        type="file"
        accept={CAMERA_ACCEPT}
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={handlePhotoChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        onChange={handleVideoPick}
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
              paddingBottom: 'max(22px, env(safe-area-inset-bottom))',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-3 rounded-full"
              style={{ width: 36, height: 4, background: 'var(--outline)' }}
              aria-hidden="true"
            />
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-[15px] font-extrabold tracking-tight">Add a photo or video</h3>
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

            <div className="grid grid-cols-3 gap-2">
              {isTouch && chooserButton(
                <Camera size={20} />,
                'Camera',
                () => cameraInputRef.current?.click(),
                true,
              )}
              {chooserButton(
                <ImagePlus size={20} />,
                isTouch ? 'Photo library' : 'Choose photo',
                () => galleryInputRef.current?.click(),
              )}
              {chooserButton(
                <VideoIcon size={20} />,
                'Video (7s)',
                () => videoInputRef.current?.click(),
              )}
            </div>
            <p className="text-[11px] mt-3 text-center" style={{ color: 'var(--text-tertiary)' }}>
              Videos are trimmed to 7 seconds on device — no upload until you confirm.
            </p>
          </div>
        </div>
      )}

      {pendingVideo && (
        <VideoTrimmer
          source={pendingVideo}
          onCancel={() => setPendingVideo(null)}
          onConfirm={(result) => { void handleTrimConfirm(result); }}
        />
      )}
    </>
  );
};

export default UploadMediaButton;
