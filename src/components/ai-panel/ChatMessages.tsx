import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../types';
import type { ToolCallEvent } from '../../store';
import MessageBubble from './MessageBubble';
import './ChatMessages.css';

interface ChatMessagesProps {
  messages: ChatMessage[];
  toolCallEvents: ToolCallEvent[];
}

export default function ChatMessages({
  messages,
  toolCallEvents,
}: ChatMessagesProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages or tool events change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, toolCallEvents]);

  // Filter out system messages for display
  const displayMessages = messages.filter((m) => m.role !== 'system');

  return (
    <div className="chat-messages" ref={containerRef}>
      {displayMessages.length === 0 && toolCallEvents.length === 0 && (
        <p className="chat-messages__empty">
          对文件进行 AI 分析后，可以开始对话
        </p>
      )}
      {displayMessages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {/* Tool call events display */}
      {toolCallEvents.map((event, i) => (
        <ToolCallCard key={i} event={event} />
      ))}
    </div>
  );
}

/**
 * Display a tool call as a collapsible card in the chat area.
 */
function ToolCallCard({ event }: { event: ToolCallEvent }): ReactElement {
  return (
    <div className="chat-messages__tool-event">
      <span className="chat-messages__tool-event-icon">🔧</span>
      <span className="chat-messages__tool-event-text">
        正在调用 <code>{event.toolName}</code>...
      </span>
    </div>
  );
}
