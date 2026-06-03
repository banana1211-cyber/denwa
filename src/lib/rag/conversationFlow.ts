/**
 * 会話フロー状態管理
 */

import type { FlowState } from '@/data/ragData';
import { FLOW_NODES } from '@/data/ragData';

// ── 出生データ ────────────────────────────────────────────

export interface BirthInput {
  date?: string;   // YYYY-MM-DD
  time?: string;   // HH:MM
  place?: string;  // 都市名
}

// ── チャートデータ（Python engine が返す shape） ──────────

export interface ChartPlanet {
  name_ja: string;
  sign_ja: string;
  house: number;
  degree: number;
  retrograde: boolean;
}

export interface ChartPoint {
  name_ja: string;
  sign_ja: string;
  degree: number;
}

export interface ChartAspect {
  planet1_ja: string;
  planet2_ja: string;
  aspect_ja: string;
  orb: number;
}

export interface ChartData {
  planets: Record<string, ChartPlanet>;
  points: Record<string, ChartPoint>;
  aspects: ChartAspect[];
  interpretations: Record<string, string>;
  sun_sign_ja: string;
  moon_sign_ja: string;
  asc_sign_ja: string;
  dominant_element_ja: string;
}

// ── 会話状態 ──────────────────────────────────────────────

export interface ConversationState {
  currentNode: FlowState;
  category?: string;
  zodiacSign?: string;
  adviceDirection?: string;
  turnCount: number;
  history: { role: 'user' | 'assistant'; content: string }[];
  birthInput?: BirthInput;
  chartData?: ChartData;
}

export function createInitialState(): ConversationState {
  return {
    currentNode: 'greeting',
    turnCount: 0,
    history: [],
  };
}

// ── 出生データ検出 ────────────────────────────────────────

export function detectBirthDate(text: string): string | null {
  // "1990年3月21日" / "1990/3/21" / "1990-03-21"
  const m = text.match(/(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})日?/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  return null;
}

export function detectBirthTime(text: string): string | null {
  // "午前" / "午後"
  const ampm = text.match(/(午前|午後)(\d{1,2})時(?:(\d{1,2})分)?/);
  if (ampm) {
    let hour = parseInt(ampm[2]);
    if (ampm[1] === '午後' && hour < 12) hour += 12;
    if (ampm[1] === '午前' && hour === 12) hour = 0;
    const min = ampm[3] ? ampm[3].padStart(2, '0') : '00';
    return `${hour.toString().padStart(2, '0')}:${min}`;
  }
  // "14時30分" / "14時"
  const hm = text.match(/(\d{1,2})時(?:(\d{1,2})分)?/);
  if (hm) {
    return `${hm[1].padStart(2, '0')}:${(hm[2] ?? '00').padStart(2, '0')}`;
  }
  // "14:30"
  const colon = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (colon) {
    return `${colon[1].padStart(2, '0')}:${colon[2]}`;
  }
  return null;
}

export function detectBirthPlace(text: string): string | null {
  // "〇〇生まれ" / "〇〇出身"
  const born = text.match(/([^\s、。\n]{1,10})(?:生まれ|出身|出生)/);
  if (born) return born[1].trim();

  // 都道府県・市区町村
  const admin = text.match(/([^\s、。\n]{2,8}(?:都|道|府|県|市|区|町|村))/);
  if (admin) return admin[1].trim();

  // よく使う都市名
  const cities = [
    '東京', '大阪', '名古屋', '福岡', '札幌', '神戸', '京都', '横浜',
    '仙台', '広島', '那覇', '埼玉', '千葉', '川崎', '新潟', '静岡',
    'Tokyo', 'Osaka', 'Kyoto',
  ];
  for (const city of cities) {
    if (text.includes(city)) return city;
  }
  return null;
}

// ── カテゴリ検出 ──────────────────────────────────────────

export function detectCategory(text: string): string | null {
  const lowerText = text.toLowerCase();
  const categoryKeywords: Record<string, string[]> = {
    love: ['恋愛', '好き', '彼氏', '彼女', '結婚', '出会い', '相性', '片思い', '復縁', 'デート', '告白', '付き合'],
    work: ['仕事', '転職', '会社', '上司', 'キャリア', '副業', '起業', '職場', '評価', '昇進', '退職', '就職'],
    health: ['健康', '体調', '疲れ', 'エネルギー', '運気', 'メンタル', '気力', 'ストレス', '体', '病気'],
    money: ['お金', '財運', '収入', '投資', '貯金', '借金', '副収入', '節約', '金運', '給料', '資産'],
    relationship: ['人間関係', '友達', '友人', '家族', 'トラブル', 'ケンカ', '仲直り', '親', '兄弟', '職場の人'],
  };
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => lowerText.includes(kw))) return category;
  }
  return null;
}

export function detectZodiacSign(text: string): string | null {
  const signs = [
    '牡羊座', '牡牛座', '双子座', '蟹座', '獅子座', '乙女座',
    '天秤座', '蠍座', '射手座', '山羊座', '水瓶座', '魚座',
    'おひつじ', 'おうし', 'ふたご', 'かに', 'しし', 'おとめ',
    'てんびん', 'さそり', 'いて', 'やぎ', 'みずがめ', 'うお',
  ];
  for (const sign of signs) {
    if (text.includes(sign)) return sign;
  }
  return null;
}

// ── 状態遷移 ──────────────────────────────────────────────

export function transition(
  state: ConversationState,
  userMessage: string
): ConversationState {
  const newState: ConversationState = {
    ...state,
    turnCount: state.turnCount + 1,
    history: [...state.history, { role: 'user', content: userMessage }],
  };

  const sign = detectZodiacSign(userMessage);
  if (sign) newState.zodiacSign = sign;

  switch (state.currentNode) {
    case 'greeting':
      newState.currentNode = 'birth_input';
      break;

    case 'birth_input': {
      const bi: BirthInput = { ...(state.birthInput ?? {}) };

      const date = detectBirthDate(userMessage);
      if (date) bi.date = date;

      const time = detectBirthTime(userMessage);
      if (time) bi.time = time;

      const place = detectBirthPlace(userMessage);
      if (place) bi.place = place;

      newState.birthInput = bi;

      // 日付と場所が揃ったら次へ（時刻未入力はデフォルト12:00）
      if (bi.date && bi.place) {
        if (!bi.time) bi.time = '12:00';
        newState.currentNode = 'category_detection';
      }
      break;
    }

    case 'category_detection': {
      const category = detectCategory(userMessage);
      if (category) {
        newState.category = category;
        newState.currentNode = category as FlowState;
      }
      break;
    }

    case 'love':
    case 'work':
    case 'health':
    case 'money':
    case 'relationship':
      newState.currentNode = 'fortune_reading';
      break;

    case 'fortune_reading':
      newState.currentNode = 'advice';
      break;

    case 'advice':
      if (/ありがとう|以上|終わり|わかりました/.test(userMessage)) {
        newState.currentNode = 'closing';
      } else {
        newState.currentNode = 'followup';
      }
      break;

    case 'followup':
      newState.currentNode = 'closing';
      break;

    case 'closing':
      newState.currentNode = 'greeting';
      newState.category = undefined;
      newState.birthInput = undefined;
      newState.chartData = undefined;
      break;
  }

  return newState;
}

export function getCurrentInstruction(state: ConversationState): string {
  const node = FLOW_NODES.find((n) => n.id === state.currentNode);
  return node?.systemInstruction ?? '';
}
