import { NextRequest, NextResponse } from 'next/server';

/**
 * TTSプロキシ API Route
 * AIVIS_API_KEY をサーバー側に隠しつつ、クライアントからTTS生成を呼べるようにする
 *
 * POST /api/tts
 * Body: { text: string, speakerUuid?: string, speakingRate?: number }
 * Response: audio/mpeg
 */
export async function POST(req: NextRequest) {
  const { text, speakerUuid, speakingRate = 1.0 } = await req.json();

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text は必須です' }, { status: 400 });
  }

  const apiKey = process.env.AIVIS_API_KEY;
  const modelUuid = process.env.NEXT_PUBLIC_AIVIS_MODEL_UUID;

  if (!apiKey) {
    return NextResponse.json({ error: 'AIVIS_API_KEY が未設定です' }, { status: 500 });
  }
  if (!modelUuid) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_AIVIS_MODEL_UUID が未設定です' }, { status: 500 });
  }

  const resolvedSpeakerUuid = speakerUuid || process.env.NEXT_PUBLIC_AIVIS_SPEAKER_UUID;

  const body: Record<string, unknown> = {
    model_uuid: modelUuid,
    text,
    output_format: 'mp3',
    leading_silence_seconds: 0.0,
    trailing_silence_seconds: 0.1,
    use_ssml: false,
    speaking_rate: speakingRate,
  };

  if (resolvedSpeakerUuid) {
    body.speaker_uuid = resolvedSpeakerUuid;
  }

  const response = await fetch('https://api.aivis-project.com/v1/tts/synthesize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const status = response.status;
    const messages: Record<number, string> = {
      402: 'クレジット残高不足',
      404: 'model_uuid が見つかりません',
      429: 'レート制限到達',
    };
    return NextResponse.json(
      { error: messages[status] ?? `AIVIS API error: ${status}` },
      { status }
    );
  }

  const audioData = await response.arrayBuffer();
  return new NextResponse(audioData, {
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}
