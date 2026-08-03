import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from '../components/ChatInterface';
import { api } from '../lib/api';

interface ChatResponseData {
  text: string;
  audioUrl: string | null;
  useBrowserTTS: boolean;
}

interface UseChatOptions {
  onResponse: (data: ChatResponseData) => void;
}

export const isLocalHost = () =>
  ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname);

/**
 * The chat needs the Express backend. On a static host (GitHub Pages) there
 * isn't one, so /api/chat answers 404/405 rather than failing to connect —
 * a visitor should be told that plainly, not handed a developer instruction.
 */
function chatErrorMessage(err: unknown): string {
  const status = err instanceof HttpError ? err.status : 0;
  const noBackend = status === 404 || status === 405;

  if (isLocalHost()) {
    return noBackend
      ? "The API route didn't resolve. Is the backend running on port 3001? Start everything with npm run dev."
      : "Can't reach the local server. Start it with npm run dev, then try again.";
  }

  return noBackend
    ? "My brain runs on a server that isn't part of this static site, so I can't answer here yet. Everything else on the site works — and you can always reach Arman from the contact page."
    : 'Something went wrong reaching the server. Please try again in a moment.';
}

class HttpError extends Error {
  constructor(public status: number) {
    super(`Server error: ${status}`);
    this.name = 'HttpError';
  }
}

export function useChat({ onResponse }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const response = await fetch(api('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new HttpError(response.status);
      }

      const data: ChatResponseData = await response.json();

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      onResponse(data);
    } catch (err: any) {
      if (err.name === 'AbortError') return;

      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: chatErrorMessage(err),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, onResponse]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, sendMessage, clearMessages };
}
