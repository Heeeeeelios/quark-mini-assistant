import type { ReactElement } from 'react';
import { useState, useRef, useCallback } from 'react';
import './ChatInput.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  disabled: boolean;
}

export default function ChatInput({
  onSend,
  isLoading,
  disabled,
}: ChatInputProps): ReactElement {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, isLoading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="chat-input">
      <textarea
        ref={textareaRef}
        className="chat-input__textarea"
        placeholder="关于这个文件，你想问什么？"
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        disabled={disabled || isLoading}
        rows={1}
      />
      <button
        className="chat-input__send-btn"
        onClick={handleSend}
        disabled={!text.trim() || disabled || isLoading}
        title="发送 (Enter)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 8L14 2L8 14L7 8.5L2 8Z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
