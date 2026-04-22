/**
 * Claude API ストリーミング + TTS Fire-and-Forget
 *
 * 流れ:
 * 1. /api/llm (サーバーサイドプロキシ) に会話状態を送信
 * 2. SSEストリームでトークンを受け取る
 * 3. 句読点チャンクごとにTTSを並行生成（Fire-and-Forget）
 * 4. AudioQueue でシームレス再生
 *
 * ※ RAGは後でローカルLLM移行時に追加予定
 */

import { streamingChunkSplitter } from './chunkSplitter';
import { synthesizeSpeech } from './tts';
import { AudioQueue } from './audioQueue';
import type { ConversationState } from './rag/conversationFlow';

export interface StreamingOptions {
  onToken?: (token: string) => void;
  onChunk?: (chunk: string, index: number) => void;
  onAudioReady?: (chunkIndex: number) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export async function streamWithTTS(
  userMessage: string,
  audioQueue: AudioQueue,
  state: ConversationState,
  options: StreamingOptions = {}
): Promise<string> {
  const { onToken, onChunk, onAudioReady, onComplete, onError } = options;
  const startTime = performance.now();

  const response = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userMessage,
      history: state.history,
      currentNode: state.currentNode,
      zodiacSign: state.zodiacSign,
      category: state.category,
    }),
  });

  if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
  if (!response.body) throw new Error('Response body is null');

  const tokenStream = sseToTokenStream(response.body, onToken);

  let fullText = '';
  let chunkIndex = 0;

  try {
    for await (const chunk of streamingChunkSplitter(tokenStream)) {
      fullText += chunk;
      onChunk?.(chunk, chunkIndex);

      const currentIndex = chunkIndex++;
      const ttsPromise = synthesizeSpeech(chunk);
      ttsPromise
        .then((audioBuffer) => {
          audioQueue.enqueue(audioBuffer);
          onAudioReady?.(currentIndex);
          if (currentIndex === 0) {
            console.log(`[TTFAB] ${(performance.now() - startTime).toFixed(0)}ms`);
          }
        })
        .catch((err) => {
          console.error(`TTS chunk ${currentIndex} error:`, err);
          onError?.(err instanceof Error ? err : new Error(String(err)));
        });
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    onError?.(error);
    throw error;
  }

  onComplete?.(fullText);
  return fullText;
}

async function* sseToTokenStream(
  body: ReadableStream<Uint8Array>,
  onToken?: (token: string) => void
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;

        let json: { token?: string; error?: string };
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }

        if (json.error) throw new Error(json.error);
        if (json.token) {
          onToken?.(json.token);
          yield json.token;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
