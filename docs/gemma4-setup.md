# Gemma4 セットアップ仕様書

このドキュメントは、別PCでOllama + Gemma4を構築する際の手順書です。

---

## 前提

- OS: Linux / macOS / Windows（WSL2推奨）
- GPU: なくてもCPUで動く（GPUがあれば高速）
- RAM: 16GB以上推奨（モデルが約8GB）

---

## 1. Ollamaインストール

```bash
# Linux / macOS
curl -fsSL https://ollama.com/install.sh | sh

# Windows: https://ollama.com/download から .exe をダウンロード
```

インストール確認:

```bash
ollama --version
```

---

## 2. ベースモデルのダウンロード

```bash
ollama pull gemma3:12b-it-qat
```

- サイズ: 約8GB
- E2P（Efficient-to-Powerful）モデル。CPU環境でも動作する

---

## 3. カスタムモデル作成（シンキングモードOFF）

プロジェクトの `Modelfile` を使ってカスタムモデルを登録する。

```bash
# プロジェクトルートで実行
ollama create gemma4 -f Modelfile
```

### Modelfile の内容と意図

```
FROM gemma3:12b-it-qat

PARAMETER num_ctx 4096

SYSTEM """
あなたは親切な日本語アシスタントです。
簡潔に、自然な話し言葉で回答してください。
"""

TEMPLATE """..."""
```

**なぜシンキングモードをOFFにするか？**

Gemma4はデフォルトで内部Chain-of-Thought（`/think`タグ）が有効。
音声チャットでは深い推論より「素早く返ってくること」が重要なため、
TEMPLATEから `/think` タグを除去して最初のトークンを高速化している。

シンキングモードOFF: 最初のトークンまで ~50ms
シンキングモードON:  最初のトークンまで ~2000ms+（最大で数秒）

---

## 4. 動作確認

```bash
# テスト送信
ollama run gemma4 "こんにちは、調子はどうですか？"
```

APIとして確認:

```bash
curl http://localhost:11434/api/chat \
  -d '{
    "model": "gemma4",
    "messages": [{"role": "user", "content": "こんにちは"}],
    "stream": false
  }'
```

レスポンスの `message.content` にテキストが入っていれば成功。

---

## 5. 別PCからのネットワークアクセス設定

フロントエンドと別PCでOllamaを動かす場合、外部からのアクセスを許可する必要がある。

### 方法A: 環境変数で起動（推奨）

```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

### 方法B: systemd の場合（Linux）

```bash
sudo systemctl edit ollama
```

以下を追記:

```
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

```bash
sudo systemctl restart ollama
```

### フロントエンド側の .env.local 設定

```env
NEXT_PUBLIC_OLLAMA_URL=http://<OllamaのIPアドレス>:11434
```

例:

```env
NEXT_PUBLIC_OLLAMA_URL=http://192.168.1.100:11434
```

---

## 6. CORS 対応

ブラウザから直接 Ollama API に接続する場合、CORSが問題になることがある。

```bash
OLLAMA_ORIGINS=http://localhost:3000,http://192.168.1.*:3000 ollama serve
```

開発中はワイルドカードで開ける（本番では絞ること）:

```bash
OLLAMA_ORIGINS='*' ollama serve
```

---

## 7. パラメータ調整（任意）

Modelfile の `PARAMETER` セクションで調整可能:

| パラメータ | デフォルト | 説明 |
|---|---|---|
| `num_ctx` | 4096 | コンテキスト長（長くするとRAM消費増） |
| `temperature` | 0.8 | 生成のランダム性（低いと安定、高いと多様） |
| `top_p` | 0.9 | 確率カットオフ |
| `num_predict` | -1 | 最大生成トークン数（-1=無制限） |

音声チャット向けには `temperature: 0.7` 程度が自然な会話になりやすい。

---

## 8. トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| 最初のトークンが遅い | シンキングモードONのまま | `ollama list` でモデル名を確認。`gemma4`（カスタム）か確認 |
| `Connection refused` | Ollamaが起動していない | `ollama serve` を実行 |
| 別PCから接続できない | OLLAMA_HOST が localhost のまま | 手順5を参照 |
| CORS エラー | Origins未設定 | 手順6を参照 |
| メモリ不足 | RAM不足 | `num_ctx` を2048に下げる |
