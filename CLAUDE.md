# このプロジェクトについて（Claude Code向け仕様書）

## 概要
ローカルLLM（Gemma4）× AIVIS Speech（クラウドTTS API）を組み合わせて、
音声チャットの初回音声再生を「694ms（1秒未満）」で実現するシステムです。

元ネタ: Qiita @kikuziro
https://qiita.com/kikuziro/items/35f8fd0f56e63b25854f

---

## 技術スタック
- LLM: Gemma4（E2Pモデル）をOllamaでローカル実行
- TTS: AIVIS Speech クラウドAPI（ストリーミングモード、TTFB約250ms）
- フロントエンド: Next.js（ブラウザからOllama・AIVIS APIに直接接続）

---

## 実装仕様（必ず守ること）

### 1. Ollama API エンドポイント
`/api/generate` ではなく **`/api/chat`** を使う。

```ts
fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    model: 'gemma4',
    messages: [{ role: 'user', content: userMessage }],
    stream: true,
  }),
});
// レスポンスのトークンは json.message.content に入る（json.response ではない）
```

### 2. チャンク分割戦略（chunkSplitter.ts）
初回と2回目以降で挙動を変える。

```
初回チャンク  → 句読点（。！？、）が来た瞬間に即送信（応答速度最優先）
2回目以降    → 50〜200文字でまとめてから送信（チャンク数を抑制）
```

句読点パターン: `/[。！？、]/`

### 3. TTS API（tts.ts）
Aivis Cloud API のエンドポイントとパラメータ:

```ts
// ベースURL: https://api.aivis-project.com/v1
POST /v1/tts/synthesize
Authorization: Bearer {AIVIS_API_KEY}

{
  model_uuid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  // AivisHub のモデルUUID（必須）
  text: chunk,
  speaker_uuid: 'xxxx...',       // 複数話者モデルのみ必要
  output_format: 'mp3',          // mp3 / opus / flac / wav
  leading_silence_seconds: 0.0,  // 先頭無音をゼロにしてTTFB短縮
  trailing_silence_seconds: 0.1,
  speaking_rate: 1.0,
  use_ssml: false,
}
```

- `stream` パラメータは存在しない（POSTするとそのまま音声バイナリが返る）
- `speaker_id` ではなく `speaker_uuid`（UUID形式）
- `format` ではなく `output_format`

### 4. Fire-and-Forget（streaming.ts）
TTS生成は **awaitしない**。Promiseで投げてLLMストリームをブロックしない。

```ts
// ❌ NG: LLMストリームが止まる
const audio = await synthesizeSpeech(chunk);

// ✅ OK: 並行で動かす
const ttsPromise = synthesizeSpeech(chunk);
ttsPromise.then(audio => audioQueue.enqueue(audio)).catch(console.error);
```

### 5. Modelfile（Gemma4シンキングモードOFF）
シンキングモードをOFFにしないと最初のトークンが大幅に遅れる。
`/think` タグを除去したTEMPLATEを設定する。

---

## ファイル構成と責務
```
src/lib/streaming.ts      → Ollama /api/chat ストリーミング + TTS Fire-and-Forget
src/lib/chunkSplitter.ts  → 初回即送信・2回目以降50〜200文字のチャンク分割
src/lib/audioQueue.ts     → シームレス音声再生キュー（順番保証）
src/lib/tts.ts            → AIVIS Speech API（MP3・ストリーミング）
docs/index.html           → GitHub Pages専用紹介ページ
Modelfile                 → Ollama Gemma4設定（シンキングモードOFF）
```

---

## 環境変数（.env.local）
```
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
NEXT_PUBLIC_MODEL_NAME=gemma4

# Aivis Cloud API（ベースURLは変更不要）
AIVIS_API_KEY=your_api_key_here
NEXT_PUBLIC_AIVIS_MODEL_UUID=a59cb814-0083-4369-8542-f51a29e72af7  # AivisHubで確認
NEXT_PUBLIC_AIVIS_SPEAKER_UUID=  # 複数話者モデルのみ設定（単一話者なら空欄）
```

---

## ブランチ戦略
| ブランチ名 | 用途 |
|---|---|
| main | 安定版・公開用 |
| feature/voice-chat-sub-second | メイン実装 |
| feature/ollama-streaming | Ollamaストリーミング部分 |
| feature/tts-optimization | TTSチューニング専用 |
| docs/landing-page | 専用ページ管理 |

---

## 今後やりたいこと
- Next.jsのUIページ（マイク入力 → 音声再生）を実装する
- NEXT_PUBLIC_AIVIS_SPEAKER_ID を使って話者IDを切り替えられるようにする
- docs/index.html をGitHub Pagesで公開する
- コマンドは使わず、Claude Codeに直接指示して進める
