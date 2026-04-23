/**
 * RAGベクトルDB生成スクリプト
 *
 * 実行: npm run seed:rag
 * 前提: .env.local に OPENAI_API_KEY が設定されていること
 *
 * ragData.ts の全データを OpenAI text-embedding-3-small でベクトル化し、
 * data/vectors.json に保存する。
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import OpenAI from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  ZODIAC_SIGNS,
  ADVICE_PATTERNS,
  VOCABULARY_SETS,
  PLANET_MEANINGS,
  HOUSE_MEANINGS,
} from '../src/data/ragData';
import type { VectorEntry, EntryType } from '../src/lib/rag/vectorStore';

const openai = new OpenAI();

// ─── テキストエントリ定義 ─────────────────────────────────

function buildEntries(): Omit<VectorEntry, 'vector'>[] {
  const entries: Omit<VectorEntry, 'vector'>[] = [];

  // 12星座
  for (const sign of ZODIAC_SIGNS) {
    const text = [
      `【${sign.nameJa}（${sign.nameEn}）】`,
      `期間: ${sign.period}　エレメント: ${sign.element}　支配星: ${sign.rulingPlanet}`,
      `特徴: ${sign.traits}`,
      `恋愛スタイル: ${sign.loveStyle}`,
      `仕事スタイル: ${sign.workStyle}`,
      `キーワード: ${sign.keywords.join('・')}`,
      `ラッキーカラー: ${sign.luckyColor}　ラッキーアイテム: ${sign.luckyItem}`,
    ].join('\n');

    entries.push({
      id: `zodiac_${sign.id}`,
      text,
      metadata: {
        type: 'zodiac' as EntryType,
        category: sign.nameJa,
        nameJa: sign.nameJa,
        element: sign.element,
        rulingPlanet: sign.rulingPlanet,
      },
    });
  }

  // 惑星の意味
  for (const planet of PLANET_MEANINGS) {
    const text = [
      `【${planet.name}（${planet.nameEn}）の意味】`,
      planet.meaning,
      `恋愛への影響: ${planet.loveInfluence}`,
      `仕事への影響: ${planet.workInfluence}`,
      `キーワード: ${planet.keywords.join('・')}`,
    ].join('\n');

    entries.push({
      id: `planet_${planet.id}`,
      text,
      metadata: { type: 'planet' as EntryType, category: planet.name },
    });
  }

  // 12ハウスの意味
  for (const house of HOUSE_MEANINGS) {
    const text = [
      `【第${house.number}ハウス：${house.theme}】`,
      house.meaning,
      `占いでの読み方: ${house.fortuneTelling}`,
      `キーワード: ${house.keywords.join('・')}`,
    ].join('\n');

    entries.push({
      id: `house_${house.number}`,
      text,
      metadata: { type: 'house' as EntryType, category: `${house.number}ハウス` },
    });
  }

  // アドバイスパターン
  for (const advice of ADVICE_PATTERNS) {
    const text = [
      `【${advice.direction}のアドバイス】`,
      `条件: ${advice.condition}`,
      `フレーズ例:\n${advice.phrases.map((p) => `・${p}`).join('\n')}`,
      `キーワード: ${advice.keywords.join('・')}`,
    ].join('\n');

    entries.push({
      id: `advice_${advice.id}`,
      text,
      metadata: { type: 'advice' as EntryType, category: advice.id },
    });
  }

  // カテゴリ別語彙（common以外）
  for (const vocab of VOCABULARY_SETS) {
    if (vocab.category === 'common') continue;
    const text = [
      `【${vocab.category}の占い語彙・フレーズ】`,
      `キーワード: ${vocab.words.join('・')}`,
      `導入フレーズ: ${vocab.openingPhrases.join('　')}`,
      `締めフレーズ: ${vocab.closingPhrases.join('　')}`,
    ].join('\n');

    entries.push({
      id: `vocab_${vocab.category}`,
      text,
      metadata: { type: 'vocabulary' as EntryType, category: vocab.category },
    });
  }

  return entries;
}

// ─── バッチ埋め込み ───────────────────────────────────────

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}

// ─── メイン ──────────────────────────────────────────────

async function seed() {
  console.log('🌟 RAGベクトルDB生成を開始します...\n');

  const baseEntries = buildEntries();
  console.log(`📝 エントリ数: ${baseEntries.length} 件\n`);

  const BATCH = 20;
  const allVectors: number[][] = [];

  for (let i = 0; i < baseEntries.length; i += BATCH) {
    const batch = baseEntries.slice(i, i + BATCH);
    const from = i + 1;
    const to = Math.min(i + BATCH, baseEntries.length);
    process.stdout.write(`  埋め込み中 ${from}〜${to} / ${baseEntries.length} ...`);

    const vectors = await embedBatch(batch.map((e) => e.text));
    allVectors.push(...vectors);
    console.log(' ✓');

    if (i + BATCH < baseEntries.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const entries: VectorEntry[] = baseEntries.map((e, i) => ({
    ...e,
    vector: allVectors[i],
  }));

  const dataDir = join(process.cwd(), 'data');
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    join(dataDir, 'vectors.json'),
    JSON.stringify(entries, null, 2),
    'utf-8'
  );

  console.log(`\n✅ 完了: ${entries.length} エントリを data/vectors.json に保存しました`);
  console.log('\n内訳:');
  const counts: Record<string, number> = {};
  for (const e of entries) {
    counts[e.metadata.type] = (counts[e.metadata.type] ?? 0) + 1;
  }
  for (const [type, count] of Object.entries(counts)) {
    console.log(`  ${type}: ${count} 件`);
  }
}

seed().catch((err) => {
  console.error('\n❌ エラー:', err.message);
  process.exit(1);
});
