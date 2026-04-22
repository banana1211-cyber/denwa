# denwa: VRM連携・UI刷新 仕様書

本ドキュメントは、denwaプロジェクトにおける「ChatVRM-jpからのVRM表示機能の移植」および「神社背景デザインへのUI刷新」に関する実装仕様をまとめたものです。

---

## 1. 概要

ローカルLLM×クラウドTTSによる音声チャットシステム「denwa」に対し、3Dアバター（VRM）の表示・リップシンク・感情表現機能を組み込みました。また、アプリのUIを「星占い」のコンセプトに合わせ、神社の背景画像を用いた没入感のあるフルスクリーンデザインに刷新しました。

## 2. VRM表示機能（ChatVRM-jpからの移植）

ChatVRM-jpリポジトリから、VRMキャラクターの制御に必要な中核モジュールを移植しました。

### 2.1. 移植された主要モジュール

| モジュール | パス | 役割 |
|---|---|---|
| **VRM Viewer** | `src/features/vrmViewer/` | Three.jsキャンバスのセットアップ、カメラ制御（OrbitControls）、VRMモデルのロードと更新ループ（`requestAnimationFrame`）を管理します。 |
| **Emote Controller** | `src/features/emoteController/` | キャラクターの感情表現（Expression）、自動瞬き（AutoBlink）、カメラ方向への視線追従（AutoLookAt）を制御します。 |
| **Lip Sync** | `src/features/lipSync/` | Web Audio APIの`AnalyserNode`を用いて音声データの波形（ボリューム）を解析し、口の開き具合（`aa`シェイプキー）にリアルタイムで反映させます。 |
| **VRM Animation** | `src/lib/VRMAnimation/` | `.vrma` 形式のアニメーションファイルをロードし、キャラクターのモーションとして再生するためのローダープラグインです。 |

### 2.2. コンポーネント実装

- **`VrmViewer.tsx`**: 
  - 画面全体を覆うCanvas要素（`z-index: -10`）を提供します。
  - `ViewerContext`を通じてThree.jsのシーンと連携します。
  - ドラッグ＆ドロップによるVRMファイルの動的差し替えイベントをリッスンします。
  - *※Next.js環境下でThree.jsを安全に動作させるため、`page.tsx`側で`next/dynamic`を用いてSSR（サーバーサイドレンダリング）を無効化してインポートしています。*

## 3. UIデザインの刷新

「星の導きのもとへようこそ」というコンセプトを強化するため、UIをフルスクリーン型の没入型デザインに変更しました。

### 3.1. 背景とレイアウト

- **神社背景画像**: 
  - AI生成による夜の神社の画像（`public/shrine_bg.jpg`）を画面全体に配置しました。
  - その上に半透明の暗いオーバーレイ（`rgba(10, 5, 20, 0.45)`）を重ねることで、手前に表示されるVRMキャラクターとテキストの視認性を確保しています。
- **フルスクリーン構成**: 
  - `body`のスクロールを無効化（`overflow: 'hidden'`）し、画面全体を固定（`position: 'fixed'`）のレイヤー構造で構成しました。

### 3.2. ヘッダーとフッター

- **グラスモーフィズム**: 
  - ヘッダーとフッターの背景に `backdrop-filter: blur(12px)` を適用し、背後の神社画像がすりガラス越しに見えるようなモダンな質感を実装しました。
- **入力エリア**: 
  - テキスト入力欄（`textarea`）とボタン類を丸みを帯びたデザインに変更しました。
  - マイクボタンと送信ボタンは完全な円形（`border-radius: 50%`）とし、録音中はマイクボタンが赤く発光する（`boxShadow`）視覚的フィードバックを追加しました。

### 3.3. 会話ログパネル

- **スライド表示**: 
  - 従来の縦スクロール型チャットUIから、画面左上に「💬 会話ログ」ボタンを配置し、クリックで左側から半透明のログパネルが展開する方式に変更しました。
  - これにより、通常時はVRMキャラクターと背景のみが画面の中央に表示され、没入感が向上します。

## 4. 技術的な修正点

- **Three.jsのバージョン互換性**: 
  - 最新のThree.js（r152以降）の仕様変更に対応するため、`WebGLRenderer`のカラーエンコーディング設定を `outputEncoding = THREE.sRGBEncoding` から `outputColorSpace = THREE.SRGBColorSpace` に修正しました。
- **TypeScriptコンパイル設定**: 
  - `tsconfig.json` に `downlevelIteration: true` を追加し、VRMライブラリ内の `Map` イテレータに関するコンパイルエラーを解消しました。
  - Three.jsのJSM（JavaScript Modules）の型定義を正しく解決するため、`paths` に `"three/examples/jsm/*": ["./node_modules/@types/three/examples/jsm/*"]` のエイリアスを追加しました。

## 5. 今後のステップ（未実装項目）

- **VRMアバターの組み込み**: 
  - 現在はVRMファイルが読み込まれていないため、キャラクターは表示されていません。
  - VRMファイル（および必要に応じてアニメーションファイル）が準備でき次第、Git LFS（Large File Storage）を設定し、リポジトリに追加します。
  - `VrmViewer.tsx` 内のコメントアウトされている `viewer.loadVrm()` のパスを、追加したVRMファイルに合わせて有効化します。
- **TTSとリップシンクの接続**: 
  - AIVIS Speechから取得した音声バイナリ（ArrayBuffer）を、`model.speak(buffer, screenplay)` メソッドに渡す処理を、既存の `audioQueue.ts` または `streaming.ts` のパイプラインに統合します。
