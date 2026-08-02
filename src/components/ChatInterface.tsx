import { useState, useRef, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isSpeaking: boolean;
  onSendMessage: (text: string) => void;
  onVoiceInput: () => void;
  isRecording: boolean;
  /** fired when the user focuses the input — used to gate the language notice */
  onInputFocus?: () => void;
}

const QUICK_QUESTIONS = [
  "Who are you?",
  "Your projects?",
  "Tech stack?",
  "Achievements?",
  "Your goals?",
];

export function ChatInterface({
  messages,
  isLoading,
  isSpeaking,
  onSendMessage,
  onVoiceInput,
  isRecording,
  onInputFocus,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    onSendMessage(text);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  };

  return (
    <>
      <div className="chat-header">
        <div className="chat-header-avatar">A</div>
        <div className="chat-header-info">
          <h3>Arman's AI Twin</h3>
          <p>{isSpeaking ? 'Speaking...' : isLoading ? 'Thinking...' : 'Online'}</p>
        </div>
      </div>

      {messages.length === 0 && (
        <div className="quick-actions">
          {QUICK_QUESTIONS.map((q) => (
            <button key={q} className="quick-action" onClick={() => onSendMessage(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="typing-indicator">
            <span /><span /><span />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <button
            className={`btn btn-mic ${isRecording ? 'recording' : ''}`}
            onClick={onVoiceInput}
            aria-label={isRecording ? 'Stop recording' : 'Speak your question'}
          >
            {isRecording ? (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="7" y="7" width="10" height="10" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            )}
          </button>
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Ask me anything... (English)"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={onInputFocus}
            rows={1}
            disabled={isLoading}
          />
          <button
            className="btn btn-send"
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M12 20V4M5 11l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
