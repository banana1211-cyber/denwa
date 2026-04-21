'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioQueue } from '@/lib/audioQueue';
import { streamWithTTS } from '@/lib/streaming';
import {
  createInitialState,
  transition,
  type ConversationState,
} from '@/lib/rag/conversationFlow';

type Role = 'user' | 'assistant';
type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Message {
  id: string;
  role: Role;
  content: string;
}

const FLOW_LABELS: Record<string, string> = {
  greeting: '挨拶',
  category_detection: 'カテゴリ判定',
  love: '恋愛相談',
  work: '仕事相談',
  health: '健康相談',
  money: '財運相談',
  relationship: '人間関係相談',
  fortune_reading: '占い中',
  advice: 'アドバイス',
  followup: '深掘り',
  closing: '締め',
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [convState, setConvState] = useState<ConversationState>(createInitialState());

  const audioQueueRef = useRef<AudioQueue | null>(null);
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status !== 'idle') return;

      setInput('');

      // 会話フロー状態を更新
      const nextState = transition(convState, trimmed);
      setConvState(nextState);

      setStatus('thinking');
      addMessage('user', trimmed);
      addMessage('assistant', '');

      if (!audioQueueRef.current) {
        audioQueueRef.current = new AudioQueue();
      }

      try {
        await streamWithTTS(trimmed, audioQueueRef.current, nextState, {
          onToken: (token) => appendToLastAssistant(token),
          onAudioReady: (index) => {
            if (index === 0) setStatus('speaking');
          },
          onComplete: (fullText) => {
            // アシスタントの返答を履歴に追加
            setConvState((prev) => ({
              ...prev,
              history: [...prev.history, { role: 'assistant', content: fullText }],
            }));
            setStatus('idle');
          },
          onError: (err) => {
            console.error(err);
            setStatus('idle');
          },
        });
      } catch (err) {
        console.error(err);
        setStatus('idle');
      }
    },
    [status, convState]
  );

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setStatus('idle');
      return;
    }

    const SR =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

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
    recognition.onerror = () => { setIsRecording(false); setStatus('idle'); };
    recognition.onend = () => { setIsRecording(false); };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setStatus('listening');
  };

  const resetConversation = () => {
    setMessages([]);
    setConvState(createInitialState());
    audioQueueRef.current?.clear();
    setStatus('idle');
  };

  const statusConfig: Record<Status, { label: string; color: string }> = {
    idle: { label: '', color: 'transparent' },
    listening: { label: '聞いています...', color: '#f78166' },
    thinking: { label: '考えています...', color: '#e3b341' },
    speaking: { label: '話しています...', color: '#3fb950' },
  };
  const { label: statusLabel, color: statusColor } = statusConfig[status];
  const isBusy = status !== 'idle';

  return (
    <div style={styles.root}>
      {/* ヘッダー */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>⭐ 星占い</span>
          {/* 現在のフローステート */}
          <span style={styles.flowBadge}>
            {FLOW_LABELS[convState.currentNode] ?? convState.currentNode}
          </span>
          {convState.zodiacSign && (
            <span style={styles.zodiacBadge}>{convState.zodiacSign}</span>
          )}
        </div>
        <div style={styles.headerRight}>
          {statusLabel && (
            <span style={{ ...styles.statusBadge, borderColor: statusColor, color: statusColor }}>
              <span style={{ ...styles.dot, background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
              {statusLabel}
            </span>
          )}
          <button onClick={resetConversation} style={styles.resetBtn} title="会話をリセット">
            ↺
          </button>
        </div>
      </header>

      {/* メッセージリスト */}
      <main style={styles.main}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔮</p>
            <p style={{ color: '#8b949e', marginBottom: '0.5rem' }}>星の導きのもとへようこそ</p>
            <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>
              マイクか文字でお悩みをお聞かせください
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{ ...styles.bubbleWrap, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
          >
            {msg.role === 'assistant' && <div style={styles.avatar}>🔮</div>}
            <div style={{ ...styles.bubble, ...(msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant) }}>
              {msg.content || (
                <span style={{ color: '#8b949e', fontStyle: 'italic' }}>読み解いています...</span>
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="お悩みをお聞かせください（Enterで送信）"
            rows={1}
            disabled={isBusy}
            style={{ ...styles.textarea, opacity: isBusy ? 0.5 : 1, cursor: isBusy ? 'not-allowed' : 'text' }}
          />
          <button
            onClick={toggleRecording}
            disabled={status === 'thinking' || status === 'speaking'}
            style={{ ...styles.iconBtn, background: isRecording ? '#f78166' : '#21262d', color: isRecording ? '#fff' : '#8b949e' }}
            title={isRecording ? '録音停止' : '音声入力'}
          >
            🎙️
          </button>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isBusy}
            style={{ ...styles.sendBtn, opacity: !input.trim() || isBusy ? 0.4 : 1, cursor: !input.trim() || isBusy ? 'not-allowed' : 'pointer' }}
          >
            送信
          </button>
        </div>
        <p style={styles.hint}>Shift+Enter で改行　|　↺ で会話リセット</p>
      </footer>
    </div>
  );
}

const styles = {
  root: { display: 'flex', flexDirection: 'column' as const, height: '100dvh', maxWidth: '800px', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', borderBottom: '1px solid #30363d', background: '#161b22', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  logo: { fontWeight: 700, fontSize: '1.05rem', color: '#e6edf3' },
  flowBadge: { fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: '#1f2e45', border: '1px solid #58a6ff', borderRadius: '12px', color: '#58a6ff' },
  zodiacBadge: { fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: '#2a1f0a', border: '1px solid #e3b341', borderRadius: '12px', color: '#e3b341' },
  statusBadge: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', padding: '0.2rem 0.7rem', border: '1px solid', borderRadius: '20px' },
  dot: { width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block' },
  resetBtn: { background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem' },
  main: { flex: 1, overflowY: 'auto' as const, padding: '1.25rem', display: 'flex', flexDirection: 'column' as const, gap: '1rem' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', textAlign: 'center' as const, padding: '3rem' },
  bubbleWrap: { display: 'flex', alignItems: 'flex-end', gap: '0.5rem' },
  avatar: { width: '32px', height: '32px', borderRadius: '50%', background: '#21262d', border: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 },
  bubble: { maxWidth: '72%', padding: '0.65rem 1rem', borderRadius: '12px', fontSize: '0.95rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const },
  bubbleUser: { background: '#1f6feb', color: '#fff', borderBottomRightRadius: '4px' },
  bubbleAssistant: { background: '#161b22', border: '1px solid #30363d', color: '#e6edf3', borderBottomLeftRadius: '4px' },
  footer: { padding: '0.75rem 1rem 1rem', borderTop: '1px solid #30363d', background: '#0d1117', flexShrink: 0 },
  inputWrap: { display: 'flex', gap: '0.5rem', alignItems: 'flex-end' },
  textarea: { flex: 1, background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', color: '#e6edf3', padding: '0.65rem 0.9rem', fontSize: '0.95rem', resize: 'none' as const, outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: '150px', overflowY: 'auto' as const },
  iconBtn: { width: '40px', height: '40px', border: '1px solid #30363d', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtn: { padding: '0 1.1rem', height: '40px', background: '#1f6feb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', flexShrink: 0 },
  hint: { marginTop: '0.4rem', fontSize: '0.75rem', color: '#8b949e', paddingLeft: '0.25rem' },
} satisfies Record<string, React.CSSProperties | Record<string, React.CSSProperties>>;
