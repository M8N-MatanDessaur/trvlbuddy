import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, KeyRound, Share2 } from 'lucide-react';
import { supabase, type Trip } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tripId: string | null;
}

function buildShareText(title: string, code: string): string {
  return [
    `Join my trip "${title}" on TrvlBuddy.`,
    '',
    'Open TrvlBuddy, tap the + tab, choose "Join a friend\'s trip", and paste this code:',
    '',
    code,
  ].join('\n');
}

const ShareTripModal: React.FC<Props> = ({ isOpen, onClose, tripId }) => {
  const { toast } = useToast();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [copied, setCopied] = useState<'code' | 'text' | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !tripId) return;
    setLoading(true);
    setCopied(null);
    supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .maybeSingle()
      .then(({ data }) => {
        setTrip(data);
        setLoading(false);
      });
  }, [isOpen, tripId]);

  const code = trip?.share_token ?? '';
  const shareText = trip ? buildShareText(trip.title, code) : '';

  const copy = async (kind: 'code' | 'text', value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast(kind === 'code' ? 'Code copied' : 'Invite text copied', 'success');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast('Could not copy', 'error');
    }
  };

  const handleShare = async () => {
    if (!shareText || !trip) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: trip.title,
          text: shareText,
        });
      } catch {
        // cancelled
      }
    } else {
      copy('text', shareText);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-end justify-center"
          style={{
            background: 'rgba(0,0,0,0.4)',
            position: 'fixed',
            inset: 0,
            zIndex: 70,
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="w-full max-w-lg"
            style={{
              background: 'var(--surface-container)',
              borderRadius: '24px 24px 0 0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'var(--outline)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  <Share2 size={16} />
                </div>
                <h3 className="text-[17px] font-extrabold tracking-tight">Share trip</h3>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'var(--surface-container-high)', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Send this code to a friend. They'll open TrvlBuddy, tap the
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}> + </span>
                tab, choose
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}> Join a friend's trip</span>,
                and paste the code to join.
              </p>

              {/* Big readable code */}
              <div
                className="rounded-2xl p-4 flex flex-col items-center gap-2.5"
                style={{
                  background: 'var(--accent-container)',
                  border: '1px solid var(--accent)',
                }}
              >
                <div
                  className="text-[10.5px] font-extrabold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--accent)' }}
                >
                  Trip code
                </div>
                <div
                  className="font-mono text-[20px] font-extrabold break-all text-center"
                  style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}
                >
                  {loading ? 'Generating...' : code || '—'}
                </div>
                <button
                  onClick={() => copy('code', code)}
                  disabled={!code}
                  className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition active:scale-95 disabled:opacity-60"
                  style={{
                    background: copied === 'code' ? 'var(--accent)' : 'rgba(0,0,0,0.0)',
                    color: copied === 'code' ? 'var(--on-accent)' : 'var(--accent)',
                    border: copied === 'code' ? 'none' : '1.5px solid var(--accent)',
                    minHeight: 0,
                    minWidth: 0,
                  }}
                >
                  {copied === 'code' ? <Check size={13} /> : <Copy size={13} />}
                  {copied === 'code' ? 'Copied' : 'Copy code'}
                </button>
              </div>

              {/* Share-as-text button */}
              <button
                onClick={handleShare}
                disabled={!code}
                className="w-full py-3.5 rounded-2xl text-[14px] font-bold transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                <Share2 size={16} />
                Share code with instructions
              </button>

              <button
                onClick={() => copy('text', shareText)}
                disabled={!code}
                className="w-full py-3 rounded-2xl text-[13px] font-semibold transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: 'var(--surface-container-high)',
                  color: 'var(--text-primary)',
                }}
              >
                {copied === 'text' ? <Check size={14} /> : <KeyRound size={14} />}
                {copied === 'text' ? 'Copied' : 'Copy invite text'}
              </button>

              <p className="text-[11px] text-center" style={{ color: 'var(--text-tertiary)' }}>
                The code keeps working as long as the trip exists. Delete the trip to revoke access.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareTripModal;
