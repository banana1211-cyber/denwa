/**
 * TTS速度計測スクリプト
 *
 * 実行: npx ts-node src/benchmark/tts-benchmark.ts
 * または: npx tsx src/benchmark/tts-benchmark.ts
 */

const TEST_TEXT = 'あなたの運命の星が、今まさに輝きを放っています。';

// ── AIVIS Cloud API ─────────────────────────────────────

async function benchmarkAivis(): Promise<void> {
  const apiKey = process.env.AIVIS_API_KEY;
  const modelUuid = process.env.NEXT_PUBLIC_AIVIS_MODEL_UUID;

  if (!apiKey || !modelUuid) {
    console.log('[AIVIS] スキップ: AIVIS_API_KEY または NEXT_PUBLIC_AIVIS_MODEL_UUID が未設定');
    return;
  }

  console.log('\n── AIVIS Cloud API ──────────────────────');
  const results: number[] = [];

  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const res = await fetch('https://api.aivis-project.com/v1/tts/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model_uuid: modelUuid,
        text: TEST_TEXT,
        output_format: 'mp3',
        leading_silence_seconds: 0.0,
        trailing_silence_seconds: 0.1,
      }),
    });

    if (!res.ok) {
      console.log(`  試行${i + 1}: エラー ${res.status}`);
      continue;
    }

    const buf = await res.arrayBuffer();
    const elapsed = performance.now() - start;
    const sizeKB = (buf.byteLength / 1024).toFixed(1);

    console.log(`  試行${i + 1}: ${elapsed.toFixed(0)}ms  (${sizeKB}KB)`);
    results.push(elapsed);

    await sleep(500);
  }

  if (results.length > 0) {
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    console.log(`  平均: ${avg.toFixed(0)}ms`);
    judge(avg, 'AIVIS');
  }
}

// ── HuggingFace VITS2 TTS ───────────────────────────────
// Space: https://huggingface.co/spaces/kawai321/Umamusume-DeBERTa-VITS2-TTS-JP
// Gradio API エンドポイント（要ログインの場合はtokenが必要）

async function benchmarkHuggingFace(): Promise<void> {
  const HF_TOKEN = process.env.HF_TOKEN; // HuggingFace API Token（任意）
  const SPACE_URL = 'https://kawai321-umamusume-deberta-vits2-tts-jp.hf.space';

  console.log('\n── HuggingFace VITS2 (kawai321) ─────────');
  console.log(`  Space URL: ${SPACE_URL}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (HF_TOKEN) {
    headers['Authorization'] = `Bearer ${HF_TOKEN}`;
    console.log('  HF_TOKEN: あり（認証付き）');
  } else {
    console.log('  HF_TOKEN: なし（パブリックアクセス）');
  }

  // Gradio API の /api/predict エンドポイント
  // パラメータはSpaceの仕様に依存（実際のUIから確認が必要）
  const payload = {
    data: [
      TEST_TEXT,  // テキスト
      0,          // speaker_id（0番目の話者）
      1.0,        // speed
    ],
  };

  const results: number[] = [];

  for (let i = 0; i < 3; i++) {
    const start = performance.now();

    try {
      const res = await fetch(`${SPACE_URL}/api/predict`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.log(`  試行${i + 1}: エラー ${res.status} ${text.slice(0, 100)}`);
        console.log('  → HuggingFace Tokenが必要な場合: HF_TOKEN=xxx を .env.local に追加');
        break;
      }

      const json = await res.json();
      const elapsed = performance.now() - start;
      console.log(`  試行${i + 1}: ${elapsed.toFixed(0)}ms`);
      console.log(`  レスポンス構造: ${JSON.stringify(Object.keys(json))}`);
      results.push(elapsed);

    } catch (err) {
      console.log(`  試行${i + 1}: 接続エラー - ${err}`);
      break;
    }

    await sleep(500);
  }

  if (results.length > 0) {
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    console.log(`  平均: ${avg.toFixed(0)}ms`);
    judge(avg, 'HuggingFace VITS2');
  }
}

// ── ユーティリティ ──────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function judge(ms: number, name: string): void {
  if (ms < 700)       console.log(`  判定 [${name}]: ✅ 優秀（694ms以内）`);
  else if (ms < 1500) console.log(`  判定 [${name}]: 🟡 許容範囲（2秒未満）`);
  else if (ms < 2000) console.log(`  判定 [${name}]: ⚠️  ギリギリ（2秒前後）`);
  else                console.log(`  判定 [${name}]: ❌ 遅い（2秒超え）`);
}

// ── 実行 ────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== TTS 速度ベンチマーク ===');
  console.log(`テストテキスト: "${TEST_TEXT}"`);
  console.log(`文字数: ${TEST_TEXT.length}文字`);

  await benchmarkAivis();
  await benchmarkHuggingFace();

  console.log('\n=== 完了 ===');
}

main().catch(console.error);
