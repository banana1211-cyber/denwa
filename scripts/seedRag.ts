/**
 * RAG ベクトルDB シードスクリプト（v2）
 *
 * markdown/ フォルダ内の全Markdownファイルを H2セクション単位でチャンク化し、
 * Ollama nomic-embed-text でベクトル化して data/vectors.json に保存する。
 *
 * 実行方法:
 *   npx tsx scripts/seedRag.ts
 *
 * 前提:
 *   - Ollama が起動していること（NEXT_PUBLIC_OLLAMA_URL で向き先を変更可能）
 *   - ollama pull nomic-embed-text が完了していること
 */

import fs from 'fs/promises';
import path from 'path';
import { embed } from '../src/lib/rag/embeddings';
import { FLOW_NODES, ADVICE_PATTERNS, VOCABULARY_SETS } from '../src/data/ragData';
import type { VectorEntry } from '../src/lib/rag/vectorStore';

const OUTPUT_PATH = path.join(process.cwd(), 'data', 'vectors.json');
const MARKDOWN_DIR = path.join(process.cwd(), 'markdown');

// ── ファイル→カテゴリのマッピング ─────────────────────────

const FILE_CATEGORY_MAP: Record<string, string> = {
  '01_zodiac_signs': 'zodiac',
  '02_planets_and_asteroids': 'planet',
  '03_houses': 'house',
  '04_aspects': 'aspect',
  '05_dignities': 'general',
  '06_elements_and_modalities': 'general',
  '07_planet_interpretations': 'planet',
  '08_transits_and_retrogrades': 'transit',
  '09_celebrity_birth_data': 'celebrity',
  '10_glossary_and_correspondences': 'glossary',
  '11_synastry': 'synastry',
  '12_sun_in_signs': 'love',
  '13_moon_in_signs': 'health',
  '14_asc_in_signs': 'zodiac',
  '15_mercury_in_signs': 'general',
  '16_venus_in_signs': 'love',
  '17_mars_in_signs': 'work',
  '18_jupiter_in_signs': 'money',
  '19_saturn_in_signs': 'work',
  '20_uranus_in_signs': 'general',
  '21_neptune_in_signs': 'health',
  '22_pluto_in_signs': 'general',
  '23_sun_in_houses': 'work',
  '24_moon_in_houses': 'health',
  '25_venus_in_houses': 'love',
  '26_mars_in_houses': 'work',
  '27_jupiter_in_houses': 'money',
  '28_saturn_in_houses': 'work',
  '29_mercury_in_houses': 'general',
  '30_uranus_in_houses': 'general',
  '31_neptune_in_houses': 'health',
  '32_pluto_in_houses': 'general',
  '33_asc_in_signs': 'zodiac',
  '34_mc_in_signs': 'work',
};

// ── Markdownをセクション（H2）単位で分割 ───────────────────

interface MarkdownChunk {
  title: string;
  content: string;
  fileKey: string;
  category: string;
}

function splitMarkdownByH2(content: string, fileKey: string): MarkdownChunk[] {
  const category = FILE_CATEGORY_MAP[fileKey] ?? 'general';
  const chunks: MarkdownChunk[] = [];

  // H2（##）で分割
  const sections = content.split(/\n(?=## )/);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    if (lines.length === 0) continue;

    // H1はスキップ（ファイル全体のタイトル）
    if (lines[0].startsWith('# ') && !lines[0].startsWith('## ')) continue;

    const title = lines[0].replace(/^#+\s*/, '').trim();
    const body = lines.slice(1).join('\n').trim();

    // 短すぎるセクションはスキップ（30文字未満）
    if (body.length < 30) continue;

    // 長すぎる場合は500文字で分割
    if (body.length > 600) {
      const subChunks = splitLongText(body, 500);
      subChunks.forEach((sub, i) => {
        chunks.push({
          title: i === 0 ? title : `${title}（続き${i}）`,
          content: `${title}\n${sub}`,
          fileKey,
          category,
        });
      });
    } else {
      chunks.push({
        title,
        content: `${title}\n${body}`,
        fileKey,
        category,
      });
    }
  }

  return chunks;
}

function splitLongText(text: string, maxLen: number): string[] {
  const result: string[] = [];
  let current = '';

  for (const line of text.split('\n')) {
    if ((current + line).length > maxLen && current.length > 0) {
      result.push(current.trim());
      current = '';
    }
    current += line + '\n';
  }
  if (current.trim()) result.push(current.trim());

  return result;
}

// ── メイン ──────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let embedCount = 0;

async function embedWithLog(text: string, label: string): Promise<number[]> {
  embedCount++;
  process.stdout.write(`  [${embedCount}] ${label.slice(0, 40).padEnd(40)} ...`);
  const vector = await embed(text);
  console.log('✅');
  await sleep(80);
  return vector;
}

async function main() {
  console.log('=== RAG シード開始（v2: Markdownベース） ===\n');

  const entries: VectorEntry[] = [];

  // ── 1. Markdownファイルを読み込んでチャンク化 ──────────────
  console.log('【Markdownファイル読み込み】');
  const mdFiles = await fs.readdir(MARKDOWN_DIR);
  const targetMdFiles = mdFiles
    .filter((f) => f.endsWith('.md') && !f.startsWith('00_')); // INDEXは除外

  let totalChunks = 0;

  for (const filename of targetMdFiles) {
    const fileKey = filename.replace('.md', '');
    const filePath = path.join(MARKDOWN_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const chunks = splitMarkdownByH2(content, fileKey);

    console.log(`\n  📄 ${filename} → ${chunks.length}チャンク`);

    for (const chunk of chunks) {
      const vector = await embedWithLog(chunk.content, chunk.title);
      entries.push({
        id: `md_${fileKey}_${totalChunks}`,
        text: chunk.content,
        vector,
        metadata: {
          type: 'zodiac',
          category: chunk.category,
          source: filename,
          title: chunk.title,
        },
      });
      totalChunks++;
    }
  }

  // ── 2. 会話フローノード（ragData.ts から） ─────────────────
  console.log('\n\n【会話フローノード】');
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

  // ── 3. アドバイスパターン ─────────────────────────────────
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

  // ── 4. カテゴリ別語彙フレーズ ─────────────────────────────
  console.log('\n【語彙フレーズ】');
  for (const vocab of VOCABULARY_SETS) {
    for (const phrase of [...vocab.openingPhrases, ...vocab.closingPhrases]) {
      const vector = await embedWithLog(phrase, phrase.slice(0, 30));
      entries.push({
        id: `phrase_${vocab.category}_${entries.length}`,
        text: phrase,
        vector,
        metadata: { type: 'vocabulary', category: vocab.category },
      });
    }
  }

  // ── 保存 ──────────────────────────────────────────────────
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(entries, null, 2), 'utf-8');

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ 完了: ${entries.length} エントリ保存`);
  console.log(`   - Markdownチャンク: ${totalChunks}`);
  console.log(`   - フローノード: ${FLOW_NODES.length}`);
  console.log(`   - アドバイスパターン: ${ADVICE_PATTERNS.length}`);
  console.log(`   保存先: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('\n❌ シード失敗:', err.message);
  console.error('  → Ollamaが起動しているか確認してください');
  console.error('  → ollama pull nomic-embed-text が必要です');
  process.exit(1);
});
