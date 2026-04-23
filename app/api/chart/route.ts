/**
 * チャート計算 API Route
 * Pythonサービス（FastAPI）へのプロキシ
 *
 * POST /api/chart  →  BirthData を受け取り ChartResult を返す
 * GET  /api/chart  →  Python サービスのヘルスチェック
 */

import { NextRequest, NextResponse } from 'next/server';

const CHART_API_URL = process.env.CHART_API_URL || 'http://localhost:8000';
const FETCH_TIMEOUT_MS = 15_000;

// BirthData の最低限のバリデーション
function validateBirthData(body: Record<string, unknown>): string | null {
  if (typeof body.birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.birthDate)) {
    return 'birthDate は YYYY-MM-DD 形式で入力してください';
  }
  if (typeof body.birthTime !== 'string' || !/^\d{2}:\d{2}$/.test(body.birthTime)) {
    return 'birthTime は HH:MM 形式で入力してください';
  }
  if (typeof body.birthPlace !== 'string' || body.birthPlace.trim() === '') {
    return 'birthPlace は必須です';
  }
  if (body.birthPlace.length > 100) {
    return 'birthPlace が長すぎます';
  }
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!isFinite(lat) || lat < -90 || lat > 90) {
    return 'lat が不正です（-90〜90）';
  }
  if (!isFinite(lng) || lng < -180 || lng > 180) {
    return 'lng が不正です（-180〜180）';
  }
  return null;
}

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が正しくありません' }, { status: 400 });
  }
  if (typeof rawBody !== 'object' || rawBody === null || Array.isArray(rawBody)) {
    return NextResponse.json({ error: 'リクエスト形式が正しくありません' }, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;
  const validationError = validateBirthData(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Pythonバックエンドに渡すフィールドを明示的に絞る
  const safePayload = {
    birthDate: body.birthDate,
    birthTime: body.birthTime,
    birthPlace: (body.birthPlace as string).trim(),
    lat: Number(body.lat),
    lng: Number(body.lng),
    ...(typeof body.name === 'string' ? { name: body.name.slice(0, 100) } : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${CHART_API_URL}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safePayload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.detail ?? 'チャート計算エラー' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'チャート計算がタイムアウトしました' }, { status: 504 });
    }
    return NextResponse.json(
      { error: 'チャート計算サービスに接続できません。python/main.py を起動してください' },
      { status: 503 }
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${CHART_API_URL}/health`, { signal: controller.signal });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'offline' }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
