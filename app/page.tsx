'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioQueue } from '@/lib/audioQueue';
import { streamWithTTS } from '@/lib/streaming';

// ── 型定義 ──────────────────────────────────────────────

type Role = 'user' | 'assistant';
type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Message {
  id: string;
  role: Role;
  content: string;
}

// ── メインコンポーネント ──────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [isRecording, setIsRecording] = useState(false);

  const audioQueueRef = useRef<AudioQueue | null>(null);
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // メッセージが追加されたら最下部にスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── メッセージ操作ヘルパー ──

  const addMessage = (role: Role, content: string): string => {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, role, content }]);
    return id;
  };

  const appendToLastAssistant = (token: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === 'assistant') {
        updated[updated.length - 1] = { ...last, content: last.content + token };
      }
      return updated;
    });
  };

  // ── 送信処理 ──

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status !== 'idle') return;

      setInput('');
      setStatus('thinking');
      addMessage('user', trimmed);
      addMessage('assistant', ''); // ストリーミング中にappendで埋める

      // AudioContext はユーザー操作後に初期化（ブラウザ制約）
      if (!audioQueueRef.current) {
        audioQueueRef.current = new AudioQueue();
      }

      try {
        await streamWithTTS(trimmed, audioQueueRef.current, {
          onToken: (token) => {
            appendToLastAssistant(token);
          },
          onAudioReady: (index) => {
            if (index === 0) setStatus('speaking');
          },
          onComplete: () => {
            setStatus('idle');
          },
          onError: (err) => {
            console.error('Stream error:', err);
            setStatus('idle');
          },
        });
      } catch (err) {
        console.error(err);
        setStatus('idle');
      }
    },
    [status]
  );

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── 音声入力 ──

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setStatus('idle');
      return;
    }

    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SR) {
      alert('このブラウザは音声認識に対応していません（Chrome推奨）');
      return;
    }

    const recognition = new SR();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      sendMessage(transcript);
    };

    recognition.onerror = () => {
      setIsRecording(false);
      setStatus('idle');
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setStatus('listening');
  };

  // ── ステータス表示 ──

  const statusConfig: Record<Status, { label: string; color: string }> = {
    idle: { label: '', color: 'transparent' },
    listening: { label: '聞いています...', color: '#f78166' },
    thinking: { label: '考えています...', color: '#e3b341' },
    speaking: { label: '話しています...', color: '#3fb950' },
  };

  const { label: statusLabel, color: statusColor } = statusConfig[status];

  const isBusy = status !== 'idle';

  // ── レンダリング ──

  return (
    <div style={styles.root}>
      {/* ヘッダー */}
      <header style={styles.header}>
        <span style={styles.logo}>📞 denwa</span>
        {statusLabel && (
          <span style={{ ...styles.statusBadge, borderColor: statusColor, color: statusColor }}>
            <span
              style={{
                ...styles.dot,
                background: statusColor,
                boxShadow: `0 0 6px ${statusColor}`,
              }}
            />
            {statusLabel}
          </span>
        )}
      </header>

      {/* メッセージリスト */}
      <main style={styles.main}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎙️</p>
            <p style={{ color: '#8b949e' }}>テキストを入力するか、マイクボタンで話しかけてください</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.bubbleWrap,
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.role === 'assistant' && <div style={styles.avatar}>AI</div>}
            <div
              style={{
                ...styles.bubble,
                ...(msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant),
              }}
            >
              {msg.content || (
                <span style={{ color: '#8b949e', fontStyle: 'italic' }}>生成中...</span>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </main>

      {/* 入力エリア */}
      <footer style={styles.footer}>
        <div style={styles.inputWrap}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力（Enterで送信）"
            rows={1}
            disabled={isBusy}
            style={{
              ...styles.textarea,
              opacity: isBusy ? 0.5 : 1,
              cursor: isBusy ? 'not-allowed' : 'text',
            }}
          />

          {/* マイクボタン */}
          <button
            onClick={toggleRecording}
            disabled={status === 'thinking' || status === 'speaking'}
            style={{
              ...styles.iconBtn,
              background: isRecording ? '#f78166' : '#21262d',
              color: isRecording ? '#fff' : '#8b949e',
            }}
            title={isRecording ? '録音停止' : '音声入力'}
          >
            🎙️
          </button>

          {/* 送信ボタン */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isBusy}
            style={{
              ...styles.sendBtn,
              opacity: !input.trim() || isBusy ? 0.4 : 1,
              cursor: !input.trim() || isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            送信
          </button>
        </div>
        <p style={styles.hint}>Shift+Enter で改行</p>
      </footer>
    </div>
  );
}

// ── スタイル ──────────────────────────────────────────────

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100dvh',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.75rem 1.25rem',
    borderBottom: '1px solid #30363d',
    background: '#161b22',
    flexShrink: 0,
  },

  logo: {
    fontWeight: 700,
    fontSize: '1.1rem',
    color: '#e6edf3',
  },

  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.8rem',
    padding: '0.2rem 0.7rem',
    border: '1px solid',
    borderRadius: '20px',
  },

  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    display: 'inline-block',
  },

  main: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },

  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    color: '#8b949e',
    padding: '3rem',
  },

  bubbleWrap: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.5rem',
  },

  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#21262d',
    border: '1px solid #30363d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    color: '#8b949e',
    flexShrink: 0,
  },

  bubble: {
    maxWidth: '70%',
    padding: '0.65rem 1rem',
    borderRadius: '12px',
    fontSize: '0.95rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },

  bubbleUser: {
    background: '#1f6feb',
    color: '#fff',
    borderBottomRightRadius: '4px',
  },

  bubbleAssistant: {
    background: '#161b22',
    border: '1px solid #30363d',
    color: '#e6edf3',
    borderBottomLeftRadius: '4px',
  },

  footer: {
    padding: '0.75rem 1rem 1rem',
    borderTop: '1px solid #30363d',
    background: '#0d1117',
    flexShrink: 0,
  },

  inputWrap: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'flex-end',
  },

  textarea: {
    flex: 1,
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '8px',
    color: '#e6edf3',
    padding: '0.65rem 0.9rem',
    fontSize: '0.95rem',
    resize: 'none' as const,
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    maxHeight: '150px',
    overflowY: 'auto' as const,
  },

  iconBtn: {
    width: '40px',
    height: '40px',
    border: '1px solid #30363d',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1.1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
    flexShrink: 0,
  },

  sendBtn: {
    padding: '0 1.1rem',
    height: '40px',
    background: '#1f6feb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.9rem',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },

  hint: {
    marginTop: '0.4rem',
    fontSize: '0.75rem',
    color: '#8b949e',
    paddingLeft: '0.25rem',
  },
} satisfies Record<string, React.CSSProperties | Record<string, React.CSSProperties>>;
