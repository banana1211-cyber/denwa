# 必要なもの 全まとめ

## システム全体像

```
マイク入力（ブラウザ）
    ↓ Web Speech API（STT）
テキスト
    ↓ Ollama /api/chat（ローカルLLM）
トークンストリーム
    ↓ chunkSplitter（句読点で分割）
チャンク
    ↓ TTS API（音声合成）
音声データ
    ↓ AudioQueue（シームレス再生）
スピーカー出力
```

---

## 1. ハードウェア

### LLMマシン（最低スペック）
| 項目 | 最低 | 推奨 |
|---|---|---|
| RAM | 16GB | 32GB |
| ストレージ | SSD 50GB以上 | SSD 100GB以上 |
| GPU | なくても動く | VRAM 8GB以上で快適 |
| OS | Linux / macOS / Windows(WSL2) | Linux推奨 |

### フロントエンドPC（普通のPCで可）
- ブラウザが動けばOK（Chrome推奨）
- Node.js 20以上

---

## 2. ソフトウェア

| ツール | 用途 | インストール |
|---|---|---|
| Node.js 20+ | Next.js実行 | https://nodejs.org |
| npm | パッケージ管理 | Node.jsに同梱 |
| Ollama | ローカルLLM実行 | https://ollama.com |
| Git | バージョン管理 | 導入済み |

---

## 3. APIキー

| API | 用途 | 取得先 | 課金 |
|---|---|---|---|
| **AIVIS Cloud** | 音声合成（TTS） | https://api.aivis-project.com | 従量課金 |
| HuggingFace Token | VITS2 TTS（代替） | https://huggingface.co/settings/tokens | 無料枠あり |
| Claude API | クラウドLLM（ローカル使わない場合） | https://console.anthropic.com | 従量課金 |

---

## 4. Ollamaモデル（LLMマシンで実行）

```bash
# ベースモデル（約8GB）
ollama pull gemma3:12b-it-qat

# カスタムモデル作成（シンキングモードOFF）
ollama create gemma4 -f Modelfile
```

---

## 5. 環境変数（.env.local）

```env
# Ollama（LLMマシンのIP or localhost）
NEXT_PUBLIC_OLLAMA_URL=http://192.168.1.xxx:11434
NEXT_PUBLIC_MODEL_NAME=gemma4

# Aivis Cloud TTS
AIVIS_API_KEY=your_key_here
NEXT_PUBLIC_AIVIS_MODEL_UUID=a59cb814-0083-4369-8542-f51a29e72af7
NEXT_PUBLIC_AIVIS_SPEAKER_UUID=

# HuggingFace（VITS2 TTS 使う場合）
HF_TOKEN=your_hf_token_here
```

---

## 6. ファイル構成（現状）

```
denwa/
├── app/
│   ├── layout.tsx              ← Next.js レイアウト
│   ├── page.tsx                ← チャットUI（テキスト + 音声）
│   └── api/
│       └── tts/
│           └── route.ts        ← TTS APIプロキシ
├── src/
│   ├── lib/
│   │   ├── streaming.ts        ← Ollama /api/chat ストリーミング
│   │   ├── chunkSplitter.ts    ← 句読点チャンク分割
│   │   ├── audioQueue.ts       ← 音声再生キュー
│   │   └── tts.ts              ← TTS呼び出し（/api/tts経由）
│   └── benchmark/
│       └── tts-benchmark.ts    ← TTS速度計測スクリプト
├── docs/
│   ├── index.html              ← 専用紹介ページ
│   ├── gemma4-setup.md         ← Gemma4構築手順書
│   └── requirements.md         ← このファイル
├── Modelfile                   ← Gemma4設定（シンキングモードOFF）
├── CLAUDE.md                   ← 実装仕様書
├── README.md                   ← セットアップ手順
├── .env.example                ← 環境変数テンプレート
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## 7. 未実装（今後やること）

| 項目 | 優先度 | 概要 |
|---|---|---|
| RAG実装 | 高 | 占い用語・会話履歴をベクトルDB化 |
| 会話フロー設計 | 高 | 相談カテゴリ別の分岐ロジック |
| 語彙DB | 高 | カテゴリ別の使用ワード・フレーズ |
| HuggingFace VITS2連携 | 中 | AIVIS代替TTS（速度要検証） |
| 音声認識精度改善 | 低 | Whisper等への切り替え |

---

## 8. TTS速度比較（計測結果）

```bash
# 計測方法
cp .env.example .env.local
# AIVIS_API_KEY と HF_TOKEN を設定してから:
npx tsx src/benchmark/tts-benchmark.ts
```

| TTS | 目安 | 2秒以内？ |
|---|---|---|
| AIVIS Cloud | ~250〜500ms | ✅ |
| HuggingFace VITS2（CPU） | ~2〜10秒 | ⚠️ 混雑次第 |
| HuggingFace VITS2（GPU） | ~500ms〜1秒 | ✅ |
| ローカルVITS2 | ~100〜300ms | ✅ |

> HuggingFace の無料Spaceは共有CPUのためキュー待ちが発生する場合あり。
> `HF_TOKEN` を設定しないとアクセス制限されることもある。

---

## 9. 起動手順

```bash
# 1. リポジトリクローン
git clone https://github.com/banana1211-cyber/denwa
cd denwa

# 2. 環境変数設定
cp .env.example .env.local
# .env.local を編集してAPIキーを入力

# 3. 依存関係インストール
npm install

# 4. LLMマシンでOllama起動（別PC or 同じPC）
OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS='*' ollama serve

# 5. フロントエンド起動
npm run dev
# → http://localhost:3000 を開く
```
