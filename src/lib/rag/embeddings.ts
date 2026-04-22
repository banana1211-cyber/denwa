/**
 * Ollama Embedding API
 * nomic-embed-text モデルでテキストをベクトル化する
 *
 * モデルのインストール: ollama pull nomic-embed-text
 */

const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434';

/**
 * テキストを768次元のベクトルに変換
 */
export async function embed(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding error: ${response.status}. ollama pull nomic-embed-text を実行してください`);
  }

  const data = await response.json();
  return data.embedding as number[];
}

/**
 * 複数テキストをバッチでベクトル化
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embed(text));
    await sleep(50); // レート制限回避
  }
  return results;
}

/**
 * コサイン類似度（-1〜1、高いほど類似）
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
