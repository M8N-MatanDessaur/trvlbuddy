import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AtSign,
  Award,
  Bell,
  BellRing,
  ChevronLeft,
  Heart,
  Loader2,
  MessageCircle,
  Reply,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNotifications } from '../hooks/useNotifications';
import { ensurePushSubscription, isPushSupported } from '../lib/webPush';
import type { Notification, NotificationType } from '../services/notificationsService';

function timeAgo(value: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(value).toLocaleDateString();
}

function iconFor(type: NotificationType | 'comment_mentioned') {
  switch (type) {
    case 'image_liked': return Heart;
    case 'image_commented': return MessageCircle;
    case 'comment_replied': return Reply;
    case 'comment_mentioned': return AtSign;
    case 'influence_milestone': return Award;
    default: return Bell;
  }
}

function actorLabel(notification: Notification): string {
  if (notification.actor?.display_name) return notification.actor.display_name;
  if (notification.type === 'influence_milestone') return 'Influence';
  return 'Someone';
}

function bodyFor(notification: Notification): string {
  const who = actorLabel(notification);
  const data = notification.data || {};
  switch (notification.type) {
    case 'image_liked':
      return `${who} liked your photo`;
    case 'image_commented': {
      const preview = typeof data.preview === 'string' ? data.preview : '';
      return preview ? `${who} commented: "${preview}"` : `${who} commented on your photo`;
    }
    case 'comment_replied': {
      const preview = typeof data.preview === 'string' ? data.preview : '';
      return preview ? `${who} replied: "${preview}"` : `${who} replied to your comment`;
    }
    case 'comment_mentioned' as NotificationType: {
      const preview = typeof data.preview === 'string' ? data.preview : '';
      return preview ? `${who} mentioned you: "${preview}"` : `${who} mentioned you`;
    }
    case 'influence_milestone': {
      const threshold = typeof data.threshold === 'number' ? data.threshold : null;
      return threshold ? `You hit ${threshold} Influence` : 'Influence milestone reached';
    }
    default:
      return `New notification`;
  }
}

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { items, unread, loading, markRead, markAllRead } = useNotifications();
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [enablingPush, setEnablingPush] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const showPushPrompt = isPushSupported() && pushPermission === 'default' && items.length > 0;

  const enablePush = async () => {
    if (!user) return;
    setEnablingPush(true);
    const result = await ensurePushSubscription(user.id);
    setEnablingPush(false);
    setPushPermission(result.permission);
    if (result.ok) {
      toast('Push notifications enabled', 'success');
    } else if (result.permission === 'denied') {
      toast('Push blocked — enable in browser settings', 'info');
    } else if (result.error) {
      toast(result.error, 'error');
    }
  };

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleRowClick = async (n: Notification) => {
    if (!n.read_at) void markRead(n.id);
    // Light-weight routing: image-related notifications → media viewer via
    // the profile page. Lands on /profile for now and lets the user find
    // their photo. A deep-link to the specific image would need extra state
    // plumbing in ProfileMediaViewer.
    if (n.type === 'image_liked' || n.type === 'image_commented' || n.type === 'comment_replied') {
      navigate('/profile');
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: 'calc(3.25rem + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          background: 'var(--bg-primary)',
          borderBottom: '0.33px solid var(--outline)',
        }}
      >
        <button
          onClick={goBack}
          className="flex items-center gap-1 px-2 py-1 -ml-2 rounded-lg"
          style={{ color: 'var(--text-primary)' }}
          aria-label="Back"
        >
          <ChevronLeft size={20} />
          <span className="text-[14px] font-semibold">Back</span>
        </button>
        <span className="text-[15px] font-extrabold tracking-tight">Notifications</span>
        <button
          onClick={() => void markAllRead()}
          disabled={unread === 0}
          className="text-[12px] font-bold disabled:opacity-40"
          style={{ color: 'var(--accent)', background: 'transparent', border: 'none', padding: 0, minHeight: 0, minWidth: 0 }}
        >
          Mark all read
        </button>
      </header>

      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: 'calc(4rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="max-w-xl mx-auto px-5 space-y-3">
          {showPushPrompt && (
            <div
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{
                background: 'color-mix(in srgb, var(--accent) 8%, var(--surface-container))',
                border: '0.5px solid color-mix(in srgb, var(--accent) 25%, var(--outline))',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                <BellRing size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold">Turn on push notifications</p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Get notified when someone likes, comments on, or mentions you — even when
                  the app is closed.
                </p>
                <button
                  onClick={enablePush}
                  disabled={enablingPush}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold disabled:opacity-60"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', minHeight: 0, minWidth: 0 }}
                >
                  {enablingPush && <Loader2 size={12} className="animate-spin" />}
                  {enablingPush ? 'Enabling' : 'Enable notifications'}
                </button>
              </div>
            </div>
          )}
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface-container)' }}>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: 'var(--surface-container-high)', color: 'var(--text-tertiary)' }}
              >
                <Bell size={20} />
              </div>
              <p className="text-[14px] font-bold">Nothing yet</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                When someone likes or comments on your photos, it'll show up here.
              </p>
            </div>
          ) : (
            <ul className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-container)' }}>
              {items.map((n, i) => {
                const Icon = iconFor(n.type);
                const isUnread = !n.read_at;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => void handleRowClick(n)}
                      className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors"
                      style={{
                        borderBottom: i < items.length - 1 ? '0.33px solid var(--outline)' : 'none',
                        background: isUnread ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'transparent',
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: 'var(--accent-container)',
                          color: 'var(--accent)',
                        }}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                          {bodyFor(n)}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                      {isUnread && (
                        <span
                          aria-hidden="true"
                          className="flex-shrink-0 rounded-full mt-2"
                          style={{ width: '8px', height: '8px', background: 'var(--accent)' }}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
};

export default NotificationsPage;
