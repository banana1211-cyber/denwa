/**
 * チャート計算 API Route
 * Pythonサービス（FastAPI）へのプロキシ
 *
 * POST /api/chart
 * Body: BirthData
 * Response: ChartResult
 */

import { NextRequest, NextResponse } from 'next/server';

const CHART_API_URL = process.env.CHART_API_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const response = await fetch(`${CHART_API_URL}/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.detail ?? `チャート計算エラー: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'チャート計算サービスに接続できません。python/main.py を起動してください' },
      { status: 503 }
    );
  }
}

export async function GET() {
  try {
    const res = await fetch(`${CHART_API_URL}/health`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'offline' }, { status: 503 });
  }
}
