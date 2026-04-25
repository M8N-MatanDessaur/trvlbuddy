import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Mic, SendHorizontal, Square, Sparkles, Loader2, X } from 'lucide-react';
import { transcribeAudio } from '../../services/aiService';
import { useToast } from '../../contexts/ToastContext';

export interface NearbyPromptBarHandle {
  focus: () => void;
}

const PLACEHOLDER_SUGGESTIONS = [
  'What do you feel like?',
  'Where do you want to go?',
  'A nice walk near the river',
  'Outdoor market',
  'Cozy cafe with wifi',
  'Photo-worthy views',
  'Rooftop for sunset',
  'Hidden gem for dinner',
  'Live music tonight',
  'Something trendy on TikTok',
  'Family-friendly afternoon',
  'Quiet park to read',
  'Brunch spot nearby',
  'Art gallery or exhibition',
  'Late-night dessert',
  'Pet-friendly patio',
  'Good for a rainy day',
  'Best tacos around',
  'Bar with craft beer',
  'Bookstore vibes',
  'Something romantic',
  'Local farmers market',
  'Scenic bike ride',
  'Jazz lounge',
  'Vegan-friendly lunch',
];

const PLACEHOLDER_INTERVAL_MS = 3500;

interface Props {
  activePrompt: string | null;
  loading: boolean;
  onSubmit: (prompt: string) => void;
  onClear: () => void;
}

const NearbyPromptBar = forwardRef<NearbyPromptBarHandle, Props>(function NearbyPromptBar(
  { activePrompt, loading, onSubmit, onClear },
  ref,
) {
  const [value, setValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  }));

  useEffect(() => {
    if (value || isRecording || isTranscribing || loading) return;
    const id = window.setInterval(() => {
      setPlaceholderIndex(i => (i + 1) % PLACEHOLDER_SUGGESTIONS.length);
    }, PLACEHOLDER_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [value, isRecording, isTranscribing, loading]);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
  };

  const pickSupportedMimeType = (): string => {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (const c of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  };

  const startRecording = async () => {
    if (isRecording || isTranscribing || loading) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast('Voice input is not supported in this browser.', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = pickSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        stopMediaStream();
        if (blob.size === 0) {
          setIsTranscribing(false);
          return;
        }
        setIsTranscribing(true);
        try {
          const ext = (recorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
          const text = await transcribeAudio(blob, `voice.${ext}`);
          if (text) {
            setValue(text);
            onSubmit(text);
          } else {
            toast("Couldn't hear that. Try again.", 'error');
          }
        } catch (err) {
          console.error('Whisper error', err);
          toast('Voice transcription failed.', 'error');
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Mic access failed', err);
      stopMediaStream();
      toast('Microphone permission denied.', 'error');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') recorder.stop();
    setIsRecording(false);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

  if (activePrompt) {
    return (
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <div
          className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-[12px] font-semibold"
          style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
        >
          <Sparkles size={12} />
          <span className="max-w-[220px] truncate" title={activePrompt}>
            {activePrompt}
          </span>
          <button
            onClick={onClear}
            aria-label="Clear AI filter"
            className="flex items-center justify-center rounded-full"
            style={{
              width: '20px',
              height: '20px',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
            }}
          >
            <X size={11} strokeWidth={2.6} />
          </button>
        </div>
        {loading && (
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            <Loader2 size={11} className="animate-spin" />
            Finding matches
          </span>
        )}
      </div>
    );
  }

  const rightBusy = isTranscribing || loading;
  const sendDisabled = !value.trim() || rightBusy;

  return (
    <form onSubmit={handleSubmit} className="mb-3">
      <div
        className="flex items-center gap-1.5 pl-3.5 pr-1 py-1 rounded-full"
        style={{ background: 'var(--surface-container)' }}
      >
        <Sparkles
          size={16}
          className="flex-shrink-0"
          style={{ color: 'var(--accent)' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={isRecording || isTranscribing || loading}
          placeholder={
            isRecording
              ? 'Listening...'
              : isTranscribing
              ? 'Transcribing...'
              : PLACEHOLDER_SUGGESTIONS[placeholderIndex]
          }
          className="flex-1 bg-transparent outline-none text-[13px] py-1.5"
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing || loading}
          aria-label={isRecording ? 'Stop recording' : 'Record voice prompt'}
          className="flex items-center justify-center rounded-full transition-all flex-shrink-0"
          style={{
            width: '36px',
            height: '36px',
            background: isRecording ? '#ef4444' : 'transparent',
            color: isRecording ? 'white' : 'var(--text-secondary)',
          }}
        >
          {isTranscribing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isRecording ? (
            <Square size={16} fill="currentColor" />
          ) : (
            <Mic size={18} />
          )}
        </button>
        <button
          type="submit"
          disabled={sendDisabled}
          aria-label="Apply prompt"
          className="flex items-center justify-center rounded-full transition-all flex-shrink-0"
          style={{
            width: '36px',
            height: '36px',
            background: sendDisabled ? 'var(--surface-container-high)' : 'var(--accent)',
            color: sendDisabled ? 'var(--text-tertiary)' : 'var(--on-accent)',
            opacity: sendDisabled ? 0.6 : 1,
          }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={17} />}
        </button>
      </div>
    </form>
  );
});

export default NearbyPromptBar;
