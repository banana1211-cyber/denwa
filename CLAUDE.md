# このプロジェクトについて

## 概要
ローカルLLM（Gemma4）× AIVIS Speech（クラウドTTS API）を組み合わせて、
音声チャットの初回音声再生を「694ms（1秒未満）」で実現するシステムです。

元ネタはQiitaの記事（@kikuziro）を自分用にコード化・Git管理したものです。
記事URL: https://qiita.com/kikuziro/items/35f8fd0f56e63b25854f

## 技術スタック
- LLM: Gemma4（E2Pモデル）をOllamaでローカル実行
- TTS: AIVIS Speech のクラウドAPI（ストリーミングモード、TTFB約250ms）
- フロントエンド: Next.js（ブラウザからOllama・AIVIS APIに直接接続）

## 1秒未満を実現した5つのポイント
1. Gemma4のシンキングモードをOFF（Modelfileで設定）
2. Ollamaへ直結ストリーミング（Lambda/API Gateway不使用）
3. 句読点ベースのチャンク分割（最初の句読点でTTS生成を即開始）
4. TTS並行生成・Fire-and-Forget（LLMストリームをブロックしない）
5. ローカルCPU DockerからクラウドAPIストリーミングへ切り替え

## ファイル構成
```
src/lib/streaming.ts      → Ollamaストリーミング処理のメインロジック
src/lib/chunkSplitter.ts  → 句読点ベースのチャンク分割
src/lib/audioQueue.ts     → 音声再生キュー管理（シームレス再生）
src/lib/tts.ts            → AIVIS Speech API呼び出し
docs/index.html           → プロジェクト専用紹介ページ（GitHub Pages想定）
Modelfile                 → Ollama用Gemma4設定（シンキングモードOFF）
CLAUDE.md                 → このファイル（Claude Code向け仕様書）
```

## ブランチ戦略
| ブランチ名 | 用途 |
|---|---|
| main | 安定版・公開用 |
| feature/voice-chat-sub-second | メイン実装 |
| feature/ollama-streaming | Ollamaストリーミング部分 |
| feature/tts-optimization | TTSチューニング専用 |
| docs/landing-page | 専用ページ管理 |

## 今後やりたいこと（方針）
- 各機能をfeatureブランチで開発・管理する
- docs/index.html はGitHub Pagesで公開する予定
- コマンドは使わず、Claude Codeに直接指示して進める

## 環境変数
`.env.local` に以下を設定：
```
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
NEXT_PUBLIC_MODEL_NAME=gemma4
NEXT_PUBLIC_AIVIS_API_URL=https://api.aivis-speech.com
AIVIS_API_KEY=your_api_key_here
```
