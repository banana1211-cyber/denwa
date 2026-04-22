/**
 * Aivis Cloud TTS 呼び出し（クライアント側）
 *
 * APIキーはサーバー側に隠すため、Next.js API Route (/api/tts) 経由で呼び出す。
 * サーバー側の実装: app/api/tts/route.ts
 */

export interface TTSOptions {
  speakerUuid?: string;
  speakingRate?: number;
}

/**
 * テキストをTTS変換し、ArrayBufferを返す
 * /api/tts → Aivis Cloud API の順で呼び出される
 */
export async function synthesizeSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<ArrayBuffer> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...options }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? `TTS error: ${response.status}`);
  }

  return response.arrayBuffer();
}
