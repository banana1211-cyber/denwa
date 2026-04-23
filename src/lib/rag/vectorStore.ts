/**
 * インメモリ ベクトルストア
 * JSONファイルに永続化。外部DBなしでRAGを実現する。
 *
 * 保存先: data/vectors.json（seedRag.ts で生成）
 */

import { cosineSimilarity } from './embeddings';

export type EntryType = 'flow' | 'zodiac' | 'advice' | 'vocabulary' | 'planet' | 'house';

export interface VectorEntry {
  id: string;
  text: string;
  vector: number[];
  metadata: {
    type: EntryType;
    category?: string;
    [key: string]: unknown;
  };
}

export interface SearchResult {
  entry: VectorEntry;
  score: number;
}

export class VectorStore {
  private entries: VectorEntry[] = [];

  add(entry: VectorEntry): void {
    this.entries.push(entry);
  }

  addMany(entries: VectorEntry[]): void {
    this.entries.push(...entries);
  }

  /**
   * クエリベクトルに最も近いエントリをtopK件返す
   */
  search(queryVector: number[], topK = 5, filterType?: EntryType): SearchResult[] {
    const candidates = filterType
      ? this.entries.filter((e) => e.metadata.type === filterType)
      : this.entries;

    return candidates
      .map((entry) => ({
        entry,
        score: cosineSimilarity(queryVector, entry.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * カテゴリ絞り込み検索
   */
  searchByCategory(
    queryVector: number[],
    category: string,
    topK = 3
  ): SearchResult[] {
    return this.entries
      .filter((e) => e.metadata.category === category)
      .map((entry) => ({ entry, score: cosineSimilarity(queryVector, entry.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  toJSON(): VectorEntry[] {
    return this.entries;
  }

  loadFromJSON(data: VectorEntry[]): void {
    this.entries = data;
  }

  get size(): number {
    return this.entries.length;
  }
}

// ── サーバー側シングルトン ──────────────────────────────

let globalStore: VectorStore | null = null;

export async function getVectorStore(): Promise<VectorStore> {
  if (globalStore) return globalStore;

  globalStore = new VectorStore();

  // Next.js のサーバー側でファイル読み込み
  if (typeof window === 'undefined') {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'data', 'vectors.json');
      const raw = await fs.readFile(filePath, 'utf-8');
      const entries = JSON.parse(raw) as VectorEntry[];
      globalStore.loadFromJSON(entries);
      console.log(`[VectorStore] ${entries.length} エントリ読み込み完了`);
    } catch {
      console.warn('[VectorStore] data/vectors.json が見つかりません。seedRag.ts を実行してください');
    }
  }

  return globalStore;
}
