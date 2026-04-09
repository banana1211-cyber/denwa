# denwa（電話）- ローカルLLM音声チャット 1秒未満システム

ローカルLLM（Gemma4）× AIVIS Speech クラウドTTSで、音声チャットの初回音声再生を **694ms（1秒未満）** で実現。

> 元ネタ: [Qiita @kikuziro](https://qiita.com/kikuziro/items/35f8fd0f56e63b25854f)

## デモ

```
[0ms]    ユーザー発話
[~50ms]  Ollama streaming 開始
[~180ms] 最初の句読点到達 → TTS生成キック
[~430ms] AIVIS Speech TTFB（クラウドAPI）
[694ms]  🎉 音声再生開始！
```

## 技術スタック

| レイヤー | 技術 |
|---|---|
| LLM | Gemma4 (E2P) via Ollama |
| TTS | AIVIS Speech クラウドAPI |
| フロントエンド | Next.js |

## セットアップ

### 1. Ollamaインストール＆Gemma4モデル作成

```bash
# Ollamaインストール（公式サイト参照）
ollama pull gemma3:12b-it-qat
ollama create gemma4 -f Modelfile
```

### 2. 環境変数

```bash
cp .env.example .env.local
# AIVIS_API_KEY を設定
```

### 3. 依存関係インストール＆起動

```bash
npm install
npm run dev
```

## 1秒未満を実現した5つのポイント

1. **Gemma4シンキングモードOFF** - Modelfileで `/think` タグを無効化
2. **Ollama直結ストリーミング** - Lambda/API Gateway不使用
3. **句読点ベースチャンク分割** - `chunkSplitter.ts` 最初の句読点でTTS開始
4. **TTS並行生成 Fire-and-Forget** - `streaming.ts` LLMストリームをブロックしない
5. **クラウドTTS** - ローカルCPU DockerからクラウドAPIへ切り替え（TTFB 250ms）

## ライセンス

MIT
