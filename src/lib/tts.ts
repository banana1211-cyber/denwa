/**
 * AIVIS Speech クラウドAPI呼び出し
 *
 * ストリーミングモード（stream: true）でTTFB 250ms
 * 出力形式はMP3（WAVより軽量・転送速度有利）
 *
 * API仕様:
 * POST https://api.aivis-speech.com/v1/synthesis
 * { text, speaker_id, stream: true, format: 'mp3' }
 */

const AIVIS_API_BASE = process.env.NEXT_PUBLIC_AIVIS_API_URL || 'https://api.aivis-speech.com';
const AIVIS_API_KEY = process.env.AIVIS_API_KEY || '';

export interface TTSOptions {
  speakerId?: string;
}

/**
 * テキストをAIVIS SpeechでTTS変換し、音声データ(ArrayBuffer)を返す
 * ストリーミングAPIを使用してTTFBを250msに抑える
 */
export async function synthesizeSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<ArrayBuffer> {
  const { speakerId = 'your-speaker-id' } = options;

  const response = await fetch(`${AIVIS_API_BASE}/v1/synthesis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AIVIS_API_KEY}`,
    },
    body: JSON.stringify({
      text,
      speaker_id: speakerId,
      stream: true,
      format: 'mp3',
    }),
  });

  if (!response.ok) {
    throw new Error(`AIVIS API error: ${response.status} ${response.statusText}`);
  }

  return response.arrayBuffer();
}
