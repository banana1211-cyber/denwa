/**
 * RAG検索 メインロジック
 * ユーザーの発言をベクトル化 → 関連データを取得 → プロンプト構築
 */

import { embed } from './embeddings';
import { getVectorStore } from './vectorStore';
import { buildSystemPrompt, buildMessages } from './promptBuilder';
import { detectCategory } from './conversationFlow';
import type { ConversationState } from './conversationFlow';
import type { SearchResult } from './vectorStore';

/**
 * ユーザー発言に関連するRAGコンテキストを取得する
 */
export async function retrieveContext(
  userMessage: string,
  state: ConversationState,
  topK = 5
): Promise<SearchResult[]> {
  const store = await getVectorStore();

  if (store.size === 0) {
    console.warn('[RAG] ベクトルストアが空です。seedRag.ts を実行してください');
    return [];
  }

  try {
    const queryVector = await embed(userMessage);
    const category = state.category ?? detectCategory(userMessage) ?? undefined;

    if (category) {
      // カテゴリが確定している場合はカテゴリ絞り込み検索
      const categoryResults = store.searchByCategory(queryVector, category, 3);
      const generalResults = store.search(queryVector, 2);
      return [...categoryResults, ...generalResults].slice(0, topK);
    } else {
      return store.search(queryVector, topK);
    }
  } catch (err) {
    console.warn('[RAG] 埋め込み生成失敗（Ollamaが起動していない可能性）:', err);
    return [];
  }
}

/**
 * RAGありのプロンプトを構築して返す
 * streaming.ts から呼び出す
 */
export async function buildRagPrompt(
  userMessage: string,
  state: ConversationState
): Promise<{
  messages: { role: string; content: string }[];
  systemPrompt: string;
}> {
  const ragResults = await retrieveContext(userMessage, state);
  const systemPrompt = buildSystemPrompt(state, ragResults);
  const messages = buildMessages(state, userMessage, systemPrompt);

  return { messages, systemPrompt };
}
