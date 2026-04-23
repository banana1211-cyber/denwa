import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

const MAX_TEXT_LENGTH = 500;
const SPEAKING_RATE_MIN = 0.5;
const SPEAKING_RATE_MAX = 2.0;
const FETCH_TIMEOUT_MS = 15_000;
// 有料APIなので1分あたり20件に制限
const RATE_LIMIT = { limit: 20, windowMs: 60_000 };

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(`tts:${ip}`, RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  if (!allowed) {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。しばらく待ってください' },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が正しくありません' }, { status: 400 });
  }
  if (typeof rawBody !== 'object' || rawBody === null) {
    return NextResponse.json({ error: 'リクエスト形式が正しくありません' }, { status: 400 });
  }

  const b = rawBody as Record<string, unknown>;

  // text
  if (typeof b.text !== 'string' || b.text.trim() === '') {
    return NextResponse.json({ error: 'text は必須です' }, { status: 400 });
  }
  if (b.text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `text は${MAX_TEXT_LENGTH}文字以内にしてください` },
      { status: 400 }
    );
  }
  const text = b.text.trim();

  // speakingRate — 範囲外はクランプして受け入れる
  let speakingRate = 1.0;
  if (b.speakingRate !== undefined) {
    const r = Number(b.speakingRate);
    speakingRate = isFinite(r)
      ? Math.max(SPEAKING_RATE_MIN, Math.min(SPEAKING_RATE_MAX, r))
      : 1.0;
  }

  // speakerUuid — 任意、UUID形式のみ許可
  const UUID_RE = /^[0-9a-f-]{32,36}$/i;
  const speakerUuid =
    typeof b.speakerUuid === 'string' && UUID_RE.test(b.speakerUuid)
      ? b.speakerUuid
      : undefined;

  const apiKey = process.env.AIVIS_API_KEY;
  const modelUuid = process.env.NEXT_PUBLIC_AIVIS_MODEL_UUID;
  if (!apiKey || !modelUuid) {
    return NextResponse.json({ error: 'TTS サービスが設定されていません' }, { status: 500 });
  }

  const resolvedSpeakerUuid =
    speakerUuid ?? (process.env.NEXT_PUBLIC_AIVIS_SPEAKER_UUID || undefined);

  const payload: Record<string, unknown> = {
    model_uuid: modelUuid,
    text,
    output_format: 'mp3',
    leading_silence_seconds: 0.0,
    trailing_silence_seconds: 0.1,
    use_ssml: false,
    speaking_rate: speakingRate,
  };
  if (resolvedSpeakerUuid) payload.speaker_uuid = resolvedSpeakerUuid;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.aivis-project.com/v1/tts/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errors: Record<number, string> = {
        402: 'クレジット残高不足',
        404: 'モデルが見つかりません',
        429: 'TTSレート制限に達しました',
      };
      return NextResponse.json(
        { error: errors[response.status] ?? '音声合成に失敗しました' },
        { status: response.status }
      );
    }

    const audioData = await response.arrayBuffer();
    return new NextResponse(audioData, {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: '音声合成がタイムアウトしました' }, { status: 504 });
    }
    return NextResponse.json({ error: '音声合成に失敗しました' }, { status: 500 });
  } finally {
    clearTimeout(timer);
  }
}
