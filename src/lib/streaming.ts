/**
 * Ollamaストリーミング処理のメインロジック
 *
 * 1秒未満を実現する仕組み:
 * - /api/chat エンドポイントに直結ストリーミング（API Gateway不使用）
 * - 最初の句読点でTTS生成を即開始（chunkSplitter）
 * - TTS並行生成・Fire-and-Forget（awaitしないでPromiseで投げる）
 */

import { streamingChunkSplitter } from './chunkSplitter';
import { synthesizeSpeech } from './tts';
import { AudioQueue } from './audioQueue';

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
 * Ollamaにメッセージを送信し、ストリーミング応答をTTSに流し込む
 *
 * /api/chat エンドポイント（messagesフォーマット）使用
 * 最初の句読点到達時点でTTS生成を開始し、1秒未満で初音声を再生
 */
export async function streamWithTTS(
  userMessage: string,
  audioQueue: AudioQueue,
  options: StreamingOptions = {}
): Promise<string> {
  const { onToken, onChunk, onAudioReady, onComplete, onError } = options;
  const startTime = performance.now();

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [{ role: 'user', content: userMessage }],
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const tokenStream = ollamaChatToTokenStream(response.body, onToken);

  let fullText = '';
  let chunkIndex = 0;

  try {
    for await (const chunk of streamingChunkSplitter(tokenStream)) {
      fullText += chunk;
      onChunk?.(chunk, chunkIndex);

      // Fire-and-Forget: awaitせずPromiseで投げてLLMストリームをブロックしない
      const currentIndex = chunkIndex++;
      const ttsPromise = synthesizeSpeech(chunk);
      ttsPromise
        .then((audioBuffer) => {
          audioQueue.enqueue(audioBuffer);
          onAudioReady?.(currentIndex);

          if (currentIndex === 0) {
            const elapsed = performance.now() - startTime;
            console.log(`[TTFAB] 初回音声再生開始まで: ${elapsed.toFixed(0)}ms`);
          }
        })
        .catch((err) => {
          console.error(`TTS error for chunk ${currentIndex}:`, err);
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

/**
 * OllamaのNDJSONストリーム（/api/chat形式）をトークン文字列のAsyncIterableに変換
 */
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
          // /api/chat のレスポンスは json.message.content にトークンが入る
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
