/**
 * RAG ベクトルDB シードスクリプト
 *
 * 実行方法:
 *   npx tsx scripts/seedRag.ts
 *
 * 前提:
 *   - Ollama が起動していること
 *   - ollama pull nomic-embed-text が完了していること
 */

import fs from 'fs/promises';
import path from 'path';
import { embed } from '../src/lib/rag/embeddings';
import {
  FLOW_NODES,
  ZODIAC_SIGNS,
  ADVICE_PATTERNS,
  VOCABULARY_SETS,
} from '../src/data/ragData';
import type { VectorEntry } from '../src/lib/rag/vectorStore';

const OUTPUT_PATH = path.join(process.cwd(), 'data', 'vectors.json');

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function embedWithLog(text: string, label: string): Promise<number[]> {
  process.stdout.write(`  埋め込み中: ${label}...`);
  const vector = await embed(text);
  console.log(' ✅');
  await sleep(100);
  return vector;
}

async function main() {
  console.log('=== RAG シード開始 ===\n');

  const entries: VectorEntry[] = [];

  // ── 1. 会話フローノード ──────────────────────────────
  console.log('【会話フローノード】');
  for (const node of FLOW_NODES) {
    const text = `${node.description}: ${node.systemInstruction}`;
    const vector = await embedWithLog(text, node.id);
    entries.push({
      id: `flow_${node.id}`,
      text,
      vector,
      metadata: { type: 'flow', nodeId: node.id },
    });
  }

  // ── 2. 12星座データ ──────────────────────────────────
  console.log('\n【12星座データ】');
  for (const sign of ZODIAC_SIGNS) {
    const text = `${sign.nameJa}（${sign.element}、支配星:${sign.rulingPlanet}）: ${sign.traits} 恋愛:${sign.loveStyle} 仕事:${sign.workStyle}`;
    const vector = await embedWithLog(text, sign.nameJa);
    entries.push({
      id: `zodiac_${sign.id}`,
      text,
      vector,
      metadata: {
        type: 'zodiac',
        category: 'zodiac',
        signId: sign.id,
        nameJa: sign.nameJa,
      },
    });
  }

  // ── 3. アドバイスパターン ─────────────────────────────
  console.log('\n【アドバイスパターン】');
  for (const pattern of ADVICE_PATTERNS) {
    const text = `${pattern.direction}: ${pattern.condition} ${pattern.phrases.join(' ')}`;
    const vector = await embedWithLog(text, pattern.direction);
    entries.push({
      id: `advice_${pattern.id}`,
      text,
      vector,
      metadata: { type: 'advice', adviceId: pattern.id, direction: pattern.direction },
    });
  }

  // ── 4. カテゴリ別語彙 ────────────────────────────────
  console.log('\n【カテゴリ別語彙】');
  for (const vocab of VOCABULARY_SETS) {
    const text = `${vocab.category}カテゴリの占い用語: ${vocab.words.join('、')}`;
    const vector = await embedWithLog(text, `語彙_${vocab.category}`);
    entries.push({
      id: `vocab_${vocab.category}`,
      text,
      vector,
      metadata: { type: 'vocabulary', category: vocab.category },
    });

    // フレーズもそれぞれ登録
    for (const phrase of [...vocab.openingPhrases, ...vocab.closingPhrases]) {
      const pVector = await embedWithLog(phrase, phrase.slice(0, 15));
      entries.push({
        id: `phrase_${vocab.category}_${entries.length}`,
        text: phrase,
        vector: pVector,
        metadata: { type: 'vocabulary', category: vocab.category },
      });
    }
  }

  // ── 保存 ─────────────────────────────────────────────
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(entries, null, 2), 'utf-8');

  console.log(`\n=== 完了 ===`);
  console.log(`✅ ${entries.length} エントリを ${OUTPUT_PATH} に保存しました`);
}

main().catch((err) => {
  console.error('シード失敗:', err.message);
  process.exit(1);
});
