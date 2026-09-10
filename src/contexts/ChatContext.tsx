import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  locations?: { name: string; address: string; type: string }[];
}

interface ChatContextType {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  clearChat: () => void;
}

interface Store {
  threads: Record<string, ChatMessage[]>;
  set: (key: string, msgs: ChatMessage[]) => void;
  add: (key: string, msg: ChatMessage) => void;
  clear: (key: string) => void;
}

const ChatContext = createContext<Store | undefined>(undefined);

/**
 * One conversation per place you are having it.
 *
 * Chat exists twice over: at /chat it is about where you are standing, and at
 * /trip/<id>/chat it is about that trip. They were one array, so asking about
 * dinner near you and asking about the trip appended to the same thread, and
 * whichever screen you opened showed the other one's history. A thread is
 * keyed by whatever the caller says it belongs to.
 *
 * Held in memory only, as before: a conversation is a session, not a record.
 */
export const useChat = (threadKey = 'local'): ChatContextType => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');

  const { threads, set, add, clear } = ctx;
  const messages = useMemo(() => threads[threadKey] ?? [], [threads, threadKey]);

  return useMemo(
    () => ({
      messages,
      addMessage: (msg: ChatMessage) => add(threadKey, msg),
      setMessages: (msgs: ChatMessage[]) => set(threadKey, msgs),
      clearChat: () => clear(threadKey),
    }),
    [messages, threadKey, add, set, clear],
  );
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({});

  const set = useCallback((key: string, msgs: ChatMessage[]) => {
    setThreads((prev) => ({ ...prev, [key]: msgs }));
  }, []);

  const add = useCallback((key: string, msg: ChatMessage) => {
    setThreads((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), msg] }));
  }, []);

  const clear = useCallback((key: string) => {
    setThreads((prev) => ({ ...prev, [key]: [] }));
  }, []);

  const value = useMemo(() => ({ threads, set, add, clear }), [threads, set, add, clear]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
