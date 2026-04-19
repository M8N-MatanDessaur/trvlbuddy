import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Link as LinkIcon, Share2 } from 'lucide-react';
import { supabase, type Trip } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tripId: string | null;
}

function buildInviteUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/trip/join/${token}`;
}

const ShareTripModal: React.FC<Props> = ({ isOpen, onClose, tripId }) => {
  const { toast } = useToast();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !tripId) return;
    setLoading(true);
    setCopied(false);
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

  const inviteUrl = trip?.share_token ? buildInviteUrl(trip.share_token) : '';

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast('Invite link copied', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Could not copy', 'error');
    }
  };

  const handleShare = async () => {
    if (!inviteUrl || !trip) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: trip.title,
          text: `Join my trip on TrvlBuddy: ${trip.title}`,
          url: inviteUrl,
        });
      } catch {
        // cancelled
      }
    } else {
      handleCopy();
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
                  style={{ background: 'var(--accent)', color: 'white' }}
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
                Anyone with this link can join the trip. They'll show up in the crew and can
                add activities, translations, and emergency contacts alongside you.
              </p>

              <div
                className="flex items-center gap-2 rounded-2xl p-3"
                style={{
                  background: 'var(--surface-container-high)',
                  border: '1px solid var(--outline)',
                }}
              >
                <LinkIcon size={14} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
                <span
                  className="flex-1 text-[12px] truncate font-mono"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {loading ? 'Generating...' : inviteUrl || 'No trip selected'}
                </span>
                <button
                  onClick={handleCopy}
                  disabled={!inviteUrl}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition active:scale-95 disabled:opacity-60"
                  style={{
                    background: copied ? 'var(--accent)' : 'var(--accent-container)',
                    color: copied ? 'white' : 'var(--accent)',
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <button
                onClick={handleShare}
                disabled={!inviteUrl}
                className="w-full py-3.5 rounded-2xl text-[14px] font-bold transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                <Share2 size={16} />
                Share link
              </button>

              <p className="text-[11px] text-center" style={{ color: 'var(--text-tertiary)' }}>
                The link works as long as the trip exists. Remove the trip to revoke access.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareTripModal;
