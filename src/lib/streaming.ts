/**
 * Ollamaストリーミング処理のメインロジック
 *
 * 1秒未満を実現する仕組み:
 * - Ollamaへ直結ストリーミング（API Gateway不使用）
 * - 最初の句読点でTTS生成を即開始
 * - TTS並行生成・Fire-and-Forget（LLMストリームをブロックしない）
 */

import { streamingChunkSplitter } from './chunkSplitter';
import { synthesizeSpeech } from './tts';
import { AudioQueue } from './audioQueue';

const OLLAMA_BASE_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434';
const MODEL_NAME = process.env.NEXT_PUBLIC_MODEL_NAME || 'gemma4';

export interface StreamingOptions {
  onToken?: (token: string) => void;
  onChunk?: (chunk: string) => void;
  onAudioReady?: (chunkIndex: number) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Ollamaにプロンプトを送信し、ストリーミング応答をTTSに流し込む
 * 最初の句読点到達時点でTTS生成を開始し、694ms以内に初音声を再生
 */
export async function streamWithTTS(
  prompt: string,
  audioQueue: AudioQueue,
  options: StreamingOptions = {}
): Promise<string> {
  const { onToken, onChunk, onAudioReady, onComplete, onError } = options;
  const startTime = performance.now();

  let fullText = '';
  let chunkIndex = 0;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      prompt,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const tokenStream = ollamaResponseToTokenStream(response.body);

  try {
    for await (const chunk of streamingChunkSplitter(tokenStream)) {
      fullText += chunk;
      onChunk?.(chunk);

      // Fire-and-Forget: TTS生成をブロックせずキューに積む
      const currentIndex = chunkIndex++;
      synthesizeSpeech(chunk)
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
          onError?.(err);
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
 * OllamaのNDJSONストリームをトークン文字列のAsyncIterableに変換
 */
async function* ollamaResponseToTokenStream(
  body: ReadableStream<Uint8Array>
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
          if (json.response) {
            yield json.response;
          }
        } catch {
          // ignore malformed JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
