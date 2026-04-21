/**
 * Ollamaストリーミング + RAG + TTS Fire-and-Forget
 *
 * 流れ:
 * 1. buildRagPrompt で会話状態 + RAG文脈からプロンプト構築
 * 2. Ollama /api/chat にストリーミングリクエスト
 * 3. 句読点チャンクごとにTTSを並行生成（Fire-and-Forget）
 * 4. AudioQueue でシームレス再生
 */

import { streamingChunkSplitter } from './chunkSplitter';
import { synthesizeSpeech } from './tts';
import { AudioQueue } from './audioQueue';
import { buildRagPrompt } from './rag/retriever';
import type { ConversationState } from './rag/conversationFlow';

const OLLAMA_BASE_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434';
const MODEL_NAME = process.env.NEXT_PUBLIC_MODEL_NAME || 'gemma4';

export interface StreamingOptions {
  onToken?: (token: string) => void;
  onChunk?: (chunk: string, index: number) => void;
  onAudioReady?: (chunkIndex: number) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * RAGありのストリーミング音声チャット
 * 会話状態からプロンプトを構築し、Ollamaに送信してTTSまで繋げる
 */
export async function streamWithTTS(
  userMessage: string,
  audioQueue: AudioQueue,
  state: ConversationState,
  options: StreamingOptions = {}
): Promise<string> {
  const { onToken, onChunk, onAudioReady, onComplete, onError } = options;
  const startTime = performance.now();

  // RAGプロンプト構築
  const { messages } = await buildRagPrompt(userMessage, state);

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }
  if (!response.body) throw new Error('Response body is null');

  const tokenStream = ollamaChatToTokenStream(response.body, onToken);

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

async function* ollamaChatToTokenStream(
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
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const token = json.message?.content;
          if (token) {
            onToken?.(token);
            yield token;
          }
        } catch {
          // malformed JSON は無視
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
