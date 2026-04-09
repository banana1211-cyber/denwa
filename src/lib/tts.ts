/**
 * Aivis Cloud API 音声合成
 *
 * ベースURL: https://api.aivis-project.com/v1
 * エンドポイント: POST /v1/tts/synthesize
 * 認証: Authorization: Bearer {API_KEY}
 *
 * ストリーミング向け推奨設定:
 * - output_format: "mp3"（軽量・転送速度有利）
 * - leading_silence_seconds: 0.0（先頭の無音をなくしてTTFB短縮）
 * - trailing_silence_seconds: 0.1
 */

const AIVIS_API_BASE = process.env.NEXT_PUBLIC_AIVIS_API_URL || 'https://api.aivis-project.com';
const AIVIS_API_KEY = process.env.AIVIS_API_KEY || '';

export interface TTSOptions {
  modelUuid?: string;
  speakerUuid?: string;
  speakingRate?: number;
}

/**
 * テキストをAivis Cloud TTSで音声変換し、ArrayBufferを返す
 *
 * model_uuid は必須（AivisHubで取得）
 * speaker_uuid は複数話者モデルのみ必要
 */
export async function synthesizeSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<ArrayBuffer> {
  const {
    modelUuid = process.env.NEXT_PUBLIC_AIVIS_MODEL_UUID || '',
    speakerUuid = process.env.NEXT_PUBLIC_AIVIS_SPEAKER_UUID,
    speakingRate = 1.0,
  } = options;

  if (!modelUuid) {
    throw new Error('NEXT_PUBLIC_AIVIS_MODEL_UUID が設定されていません');
  }

  const body: Record<string, unknown> = {
    model_uuid: modelUuid,
    text,
    output_format: 'mp3',
    leading_silence_seconds: 0.0,
    trailing_silence_seconds: 0.1,
    use_ssml: false,
    speaking_rate: speakingRate,
  };

  // 複数話者モデルの場合のみ speaker_uuid を追加
  if (speakerUuid) {
    body.speaker_uuid = speakerUuid;
  }

  const response = await fetch(`${AIVIS_API_BASE}/v1/tts/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AIVIS_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 402) throw new Error('Aivis API: クレジット残高不足');
    if (status === 404) throw new Error('Aivis API: model_uuid が見つかりません');
    if (status === 429) throw new Error('Aivis API: レート制限到達');
    throw new Error(`Aivis API error: ${status} ${response.statusText}`);
  }

  return response.arrayBuffer();
}
