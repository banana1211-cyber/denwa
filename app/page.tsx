'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AudioQueue } from '@/lib/audioQueue';
import { streamWithTTS } from '@/lib/streaming';
import {
  createInitialState,
  transition,
  type ConversationState,
} from '@/lib/rag/conversationFlow';
import { ViewerContext } from '@/features/vrmViewer/viewerContext';

// VRMViewerはSSR無効（Three.jsはブラウザのみ）
const VrmViewer = dynamic(() => import('@/components/VrmViewer'), { ssr: false });

type Role = 'user' | 'assistant';
type Status = 'idle' | 'thinking' | 'speaking';

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

// ViewerContextのProviderをクライアント側で初期化
import { Viewer } from '@/features/vrmViewer/viewer';
const viewer = typeof window !== 'undefined' ? new Viewer() : ({} as Viewer);

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [convState, setConvState] = useState<ConversationState>(createInitialState());
  const [showLog, setShowLog] = useState(false);

  const audioQueueRef = useRef<AudioQueue | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: Role, content: string) => {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, role, content }]);
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
      const nextState = transition(convState, trimmed);
      setConvState(nextState);
      setStatus('thinking');
      addMessage('user', trimmed);
      addMessage('assistant', '');

      if (!audioQueueRef.current) {
        audioQueueRef.current = new AudioQueue(() => viewer.model ?? undefined);
      }

      try {
        await streamWithTTS(trimmed, audioQueueRef.current, nextState, {
          onToken: (token) => appendToLastAssistant(token),
          onAudioReady: (index) => {
            if (index === 0) setStatus('speaking');
          },
          onComplete: (fullText) => {
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

  const resetConversation = () => {
    setMessages([]);
    setConvState(createInitialState());
    audioQueueRef.current?.clear();
    setStatus('idle');
  };

  const statusConfig: Record<Status, { label: string; color: string }> = {
    idle:     { label: '',          color: 'transparent' },
    thinking: { label: '考えています...', color: '#fbbf24' },
    speaking: { label: '話しています...', color: '#34d399' },
  };
  const { label: statusLabel, color: statusColor } = statusConfig[status];
  const isBusy = status !== 'idle';

  return (
    <ViewerContext.Provider value={{ viewer }}>
      {/* 神社背景 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: 'url(/shrine_bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
        }}
      />
      {/* 背景オーバーレイ */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 5, 20, 0.45)',
          zIndex: 1,
        }}
      />

      {/* VRMキャラクター */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 2 }}>
        <VrmViewer />
      </div>

      {/* UIレイヤー */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
        }}
      >
        {/* ヘッダー */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.6rem 1.2rem',
            background: 'rgba(15, 8, 30, 0.7)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <button
              onClick={() => setShowLog(!showLog)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '20px',
                color: '#e2d9f3',
                padding: '0.3rem 0.8rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              💬 会話ログ
            </button>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '0.2rem 0.65rem',
                background: 'rgba(139, 92, 246, 0.25)',
                border: '1px solid rgba(139, 92, 246, 0.6)',
                borderRadius: '12px',
                color: '#c4b5fd',
              }}
            >
              {FLOW_LABELS[convState.currentNode] ?? convState.currentNode}
            </span>
            {convState.zodiacSign && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.65rem',
                  background: 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid rgba(251, 191, 36, 0.5)',
                  borderRadius: '12px',
                  color: '#fde68a',
                }}
              >
                {convState.zodiacSign}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {statusLabel && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.75rem',
                  border: `1px solid ${statusColor}`,
                  borderRadius: '20px',
                  color: statusColor,
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: statusColor,
                    boxShadow: `0 0 6px ${statusColor}`,
                    display: 'inline-block',
                  }}
                />
                {statusLabel}
              </span>
            )}
            <button
              onClick={resetConversation}
              title="会話をリセット"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#a78bfa',
                borderRadius: '6px',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ↺
            </button>
          </div>
        </header>

        {/* 会話ログパネル（左スライド） */}
        {showLog && (
          <div
            style={{
              position: 'absolute',
              top: '52px',
              left: 0,
              width: '320px',
              maxHeight: 'calc(100dvh - 130px)',
              overflowY: 'auto',
              background: 'rgba(15, 8, 30, 0.85)',
              backdropFilter: 'blur(16px)',
              borderRight: '1px solid rgba(255,255,255,0.1)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              zIndex: 20,
            }}
          >
            {messages.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>
                まだ会話がありません
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '90%',
                      padding: '0.55rem 0.85rem',
                      borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      fontSize: '0.85rem',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      background: msg.role === 'user'
                        ? 'rgba(139, 92, 246, 0.4)'
                        : 'rgba(255,255,255,0.08)',
                      border: msg.role === 'user'
                        ? '1px solid rgba(139, 92, 246, 0.6)'
                        : '1px solid rgba(255,255,255,0.12)',
                      color: '#f0ebff',
                    }}
                  >
                    {msg.content || <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>読み解いています...</span>}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        <main style={{ flex: 1 }} />

        {/* 入力フッター */}
        <footer
          style={{
            padding: '0.75rem 1.2rem 1rem',
            background: 'rgba(15, 8, 30, 0.7)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', maxWidth: '700px', margin: '0 auto' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="聞きたいことをいれてね"
              rows={1}
              disabled={isBusy}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '22px',
                color: '#f0ebff',
                padding: '0.65rem 1.1rem',
                fontSize: '0.95rem',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                maxHeight: '120px',
                overflowY: 'auto',
                opacity: isBusy ? 0.5 : 1,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isBusy}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: 'none',
                background: !input.trim() || isBusy
                  ? 'rgba(139, 92, 246, 0.2)'
                  : 'rgba(139, 92, 246, 0.8)',
                color: '#fff',
                fontSize: '1.1rem',
                cursor: !input.trim() || isBusy ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ▶
            </button>
          </div>
          <p
            style={{
              marginTop: '0.4rem',
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.3)',
              textAlign: 'center',
            }}
          >
            Shift+Enter で改行　|　↺ で会話リセット
          </p>
        </footer>
      </div>
    </ViewerContext.Provider>
  );
}
