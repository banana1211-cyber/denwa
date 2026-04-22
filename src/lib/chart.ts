/**
 * チャート計算クライアント
 * /api/chart を呼び出してネイタルチャートデータを取得する
 */

export interface BirthData {
  name?: string;
  year: number;
  month: number;
  day: number;
  hour?: number;    // 不明なら12（正午）
  minute?: number;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  tzStr?: string;
  houseSystem?: 'P' | 'W'; // P=プラシーダス, W=ホールサイン
}

export interface PlanetPosition {
  name_en: string;
  name_ja: string;
  sign_en: string;
  sign_ja: string;
  house: number;
  degree: number;
  absolute_degree: number;
  retrograde: boolean;
}

export interface PointPosition {
  name_ja: string;
  sign_en: string;
  sign_ja: string;
  degree: number;
}

export interface AspectResult {
  planet1_en: string;
  planet1_ja: string;
  planet2_en: string;
  planet2_ja: string;
  aspect_en: string;
  aspect_ja: string;
  orb: number;
}

export interface ChartData {
  name: string;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour: number;
  birth_minute: number;
  birth_city: string;
  birth_lat: number;
  birth_lng: number;
  birth_tz: string;
  planets: Record<string, PlanetPosition>;
  points: Record<string, PointPosition>;
  aspects: AspectResult[];
  interpretations: Record<string, string>;
  sun_sign_ja: string;
  moon_sign_ja: string;
  asc_sign_ja: string;
  dominant_element_ja: string;
}

/**
 * 出生データからネイタルチャートを計算する
 */
export async function calculateChart(data: BirthData): Promise<ChartData> {
  const response = await fetch('/api/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name ?? 'ゲスト',
      year: data.year,
      month: data.month,
      day: data.day,
      hour: data.hour ?? 12,
      minute: data.minute ?? 0,
      city: data.city,
      country: data.country ?? 'JP',
      lat: data.lat,
      lng: data.lng,
      tz_str: data.tzStr,
      house_system: data.houseSystem ?? 'P',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? 'チャート計算に失敗しました');
  }

  const result = await response.json();
  return result.chart as ChartData;
}

/**
 * チャートデータをRAGプロンプト用の文字列にフォーマット
 */
export function formatChartForPrompt(chart: ChartData): string {
  const lines: string[] = [
    `【ネイタルチャート】${chart.name}さん（${chart.birth_year}年${chart.birth_month}月${chart.birth_day}日 ${chart.birth_city}生まれ）`,
    '',
    `太陽: ${chart.planets.sun?.sign_ja} 第${chart.planets.sun?.house}ハウス`,
    `月: ${chart.planets.moon?.sign_ja} 第${chart.planets.moon?.house}ハウス`,
    `アセンダント: ${chart.asc_sign_ja}`,
    `支配元素: ${chart.dominant_element_ja}`,
    '',
  ];

  // 主要天体一覧
  lines.push('【天体配置】');
  for (const [key, planet] of Object.entries(chart.planets)) {
    const retro = planet.retrograde ? '（逆行中）' : '';
    lines.push(`${planet.name_ja}: ${planet.sign_ja} 第${planet.house}ハウス ${retro}`);
  }

  // 解釈文（重要なもの上位5件）
  const interpEntries = Object.entries(chart.interpretations).slice(0, 5);
  if (interpEntries.length > 0) {
    lines.push('', '【星の解釈】');
    for (const [, text] of interpEntries) {
      if (text.length > 200) {
        lines.push(`・${text.slice(0, 200)}…`);
      } else {
        lines.push(`・${text}`);
      }
    }
  }

  return lines.join('\n');
}
