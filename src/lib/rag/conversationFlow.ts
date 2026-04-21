/**
 * 会話フロー状態管理
 * マインドマップの通りに会話を進める状態機械
 */

import type { FlowState } from '@/data/ragData';
import { FLOW_NODES } from '@/data/ragData';

export interface ConversationState {
  currentNode: FlowState;
  category?: string;        // 判定されたカテゴリ
  zodiacSign?: string;      // ユーザーの星座
  adviceDirection?: string; // アドバイス方向性
  turnCount: number;        // 会話のターン数
  history: { role: 'user' | 'assistant'; content: string }[];
}

export function createInitialState(): ConversationState {
  return {
    currentNode: 'greeting',
    turnCount: 0,
    history: [],
  };
}

/**
 * ユーザーの発言からカテゴリを判定（キーワードマッチ）
 */
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
    if (keywords.some((kw) => lowerText.includes(kw))) {
      return category;
    }
  }
  return null;
}

/**
 * ユーザーの発言から星座を抽出
 */
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

/**
 * 現在の状態とユーザー発言から次の状態へ遷移
 */
export function transition(
  state: ConversationState,
  userMessage: string
): ConversationState {
  const newState = { ...state, turnCount: state.turnCount + 1 };

  // 星座を検出したら記録
  const sign = detectZodiacSign(userMessage);
  if (sign) newState.zodiacSign = sign;

  switch (state.currentNode) {
    case 'greeting':
      newState.currentNode = 'category_detection';
      break;

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
      // ありがとう・以上 → 締め
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
      // 別の相談があれば最初から
      newState.currentNode = 'greeting';
      newState.category = undefined;
      break;
  }

  // 履歴に追加
  newState.history = [
    ...state.history,
    { role: 'user', content: userMessage },
  ];

  return newState;
}

/**
 * 現在のノードの指示を取得
 */
export function getCurrentInstruction(state: ConversationState): string {
  const node = FLOW_NODES.find((n) => n.id === state.currentNode);
  return node?.systemInstruction ?? '';
}
