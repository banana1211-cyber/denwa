/**
 * システムプロンプト構築
 * 会話状態 + RAG取得データ → Gemma4へのプロンプトを組み立てる
 */

import type { ConversationState } from './conversationFlow';
import { getCurrentInstruction } from './conversationFlow';
import { VOCABULARY_SETS, ADVICE_PATTERNS, ZODIAC_SIGNS } from '@/data/ragData';
import type { SearchResult } from './vectorStore';

/**
 * RAG結果 + 会話状態からシステムプロンプトを生成
 */
export function buildSystemPrompt(
  state: ConversationState,
  ragResults: SearchResult[] = []
): string {
  const parts: string[] = [];

  // ① ペルソナ定義
  parts.push(`あなたは西洋星占術の占い師です。
神秘的で温かみのある口調で話し、相談者を優しく導いてください。
回答は短く、会話のテンポを大切にしてください（2〜4文程度）。
難しい占い用語は使いすぎず、自然な話し言葉で伝えてください。`);

  // ② 現在の会話フロー指示
  const instruction = getCurrentInstruction(state);
  if (instruction) {
    parts.push(`\n【現在の対応フェーズ】\n${instruction}`);
  }

  // ③ ユーザーの星座情報
  if (state.zodiacSign) {
    const sign = ZODIAC_SIGNS.find(
      (s) => s.nameJa === state.zodiacSign || state.zodiacSign?.includes(s.nameJa)
    );
    if (sign) {
      parts.push(`\n【相談者の星座情報】
星座: ${sign.nameJa}（${sign.element}のサイン、支配星: ${sign.rulingPlanet}）
性格: ${sign.traits}
恋愛スタイル: ${sign.loveStyle}
仕事スタイル: ${sign.workStyle}
ラッキーカラー: ${sign.luckyColor}
ラッキーアイテム: ${sign.luckyItem}`);
    }
  }

  // ④ カテゴリ別の使用語彙
  if (state.category) {
    const vocabSet = VOCABULARY_SETS.find((v) => v.category === state.category);
    const commonVocab = VOCABULARY_SETS.find((v) => v.category === 'common');

    const words = [
      ...(commonVocab?.words ?? []),
      ...(vocabSet?.words ?? []),
    ].slice(0, 12);

    if (words.length > 0) {
      parts.push(`\n【使うとよい言葉・表現】\n${words.join('、')}`);
    }

    if (vocabSet?.openingPhrases?.length) {
      parts.push(`\n【導入フレーズ例】\n${vocabSet.openingPhrases.join('\n')}`);
    }
  }

  // ⑤ RAG取得コンテキスト（類似ドキュメント）
  if (ragResults.length > 0) {
    const ragTexts = ragResults
      .filter((r) => r.score > 0.6)
      .map((r) => `・${r.entry.text}`)
      .join('\n');

    if (ragTexts) {
      parts.push(`\n【参考知識（星占い）】\n${ragTexts}`);
    }
  }

  // ⑥ アドバイス方向性
  const advicePattern = ADVICE_PATTERNS.find(
    (a) => a.id === state.adviceDirection
  );
  if (advicePattern) {
    parts.push(`\n【アドバイスの方向性: ${advicePattern.direction}】
条件: ${advicePattern.condition}
フレーズ例:\n${advicePattern.phrases.map((p) => `・${p}`).join('\n')}`);
  }

  // ⑦ 締めフレーズ（closingステートの場合）
  if (state.currentNode === 'closing') {
    const closing = VOCABULARY_SETS.find((v) => v.category === 'common');
    if (closing?.closingPhrases?.length) {
      parts.push(`\n【締めのフレーズ例】\n${closing.closingPhrases.join('\n')}`);
    }
  }

  return parts.join('\n');
}

/**
 * Ollama /api/chat 用のメッセージ配列を構築
 */
export function buildMessages(
  state: ConversationState,
  userMessage: string,
  systemPrompt: string
): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  // 直近の会話履歴（最大6ターン）
  const recentHistory = state.history.slice(-6);
  messages.push(...recentHistory);

  // 今回のユーザー発言
  messages.push({ role: 'user', content: userMessage });

  return messages;
}
