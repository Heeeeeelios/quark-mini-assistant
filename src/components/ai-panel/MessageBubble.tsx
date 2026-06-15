import type { ReactElement } from 'react';
import type { ChatMessage } from '../../types';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * Parse citation markers like [引用: 文件名] in AI responses.
 * Returns an array of text segments with citation info.
 */
function parseCitations(text: string): Array<{ text: string; isCitation?: boolean }> {
  const parts: Array<{ text: string; isCitation?: boolean }> = [];
  const regex = /(\[引用:\s*([^\]]+)\])/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index) });
    }
    parts.push({ text: `[引用: ${match[2]}]`, isCitation: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ text }];
}

export default function MessageBubble({
  message,
}: MessageBubbleProps): ReactElement {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return <></>; // Don't render system messages
  }

  return (
    <div className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--assistant'}`}>
      <div className="message-bubble__content">
        {isUser ? (
          <p className="message-bubble__text">{message.content}</p>
        ) : (
          <div className="message-bubble__text">
            {message.status === 'error' ? (
              <span className="message-bubble__error">
                {message.content || '对话失败，请重试'}
              </span>
            ) : (
              parseCitations(message.content).map((part, i) =>
                part.isCitation ? (
                  <mark key={i} className="message-bubble__citation">
                    {part.text}
                  </mark>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )
            )}
            {message.status === 'streaming' && (
              <span className="message-bubble__cursor" />
            )}
          </div>
        )}
      </div>
      <div className="message-bubble__time">
        {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}
