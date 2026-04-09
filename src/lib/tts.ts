/**
 * AIVIS Speech クラウドAPI呼び出し
 * ストリーミングモード / TTFB約250ms
 */

const AIVIS_API_BASE = process.env.NEXT_PUBLIC_AIVIS_API_URL || 'https://api.aivis-speech.com';
const AIVIS_API_KEY = process.env.AIVIS_API_KEY || '';

export interface TTSOptions {
  speakerId?: string;
  speed?: number;
  pitch?: number;
}

/**
 * テキストをAIVIS SpeechでTTS変換し、音声データ(ArrayBuffer)を返す
 * ストリーミングAPIを使用してTTFBを最小化
 */
export async function synthesizeSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<ArrayBuffer> {
  const { speakerId = 'jp_female_1', speed = 1.0, pitch = 0 } = options;

  const response = await fetch(`${AIVIS_API_BASE}/v1/synthesis/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AIVIS_API_KEY}`,
    },
    body: JSON.stringify({
      text,
      speaker_id: speakerId,
      speed,
      pitch,
      format: 'wav',
    }),
  });

  if (!response.ok) {
    throw new Error(`AIVIS API error: ${response.status} ${response.statusText}`);
  }

  return response.arrayBuffer();
}

/**
 * ストリーミングレスポンスとして音声データを取得（低レイテンシ版）
 */
export async function synthesizeSpeechStream(
  text: string,
  options: TTSOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const { speakerId = 'jp_female_1', speed = 1.0, pitch = 0 } = options;

  const response = await fetch(`${AIVIS_API_BASE}/v1/synthesis/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AIVIS_API_KEY}`,
    },
    body: JSON.stringify({
      text,
      speaker_id: speakerId,
      speed,
      pitch,
      format: 'wav',
      streaming: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`AIVIS API error: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  return response.body;
}
