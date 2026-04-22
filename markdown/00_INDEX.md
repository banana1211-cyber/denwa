# 西洋星占術 LLM/DB データセット インデックス

占い師のLLMシステム向け 包括的占星術データ集

---

## データセット概要

このデータセットは、西洋星占術の占い師がLLMシステムで鑑定中に参照できるよう、複数の信頼性の高い占星術サイトからスクレイピング・収集・構造化したデータです。

---

## ファイル一覧

### Markdownドキュメント（LLM向け）

| ファイル | 内容 | レコード数 |
|---------|------|----------|
| 01_zodiac_signs.md | 12星座の詳細データ | 12件 |
| 02_planets_and_asteroids.md | 10天体・小惑星・感受点 | 17件 |
| 03_houses.md | 12ハウスの意味と解釈 | 12件 |
| 04_aspects.md | アスペクト（天体角度）解釈 | 10件 |
| 05_dignities.md | 惑星のディグニティ表 | 12件 |
| 06_elements_and_modalities.md | 元素・モダリティ | 7件 |
| 07_planet_interpretations.md | 惑星×星座・ハウス解釈 | 120件 |
| 08_transits_and_retrogrades.md | トランジット・逆行 | 14件 |
| 09_celebrity_birth_data.md | 有名人出生データ | 10件 |
| 10_glossary_and_correspondences.md | 用語集・対応表・月相・デカン | 99件 |
| 11_synastry.md | シナストリー（相性）ガイド | 10件 |

### JSONデータ（DB投入向け）

| ファイル | 内容 |
|---------|------|
| master_astrology_db.json | 全データ統合マスターDB |
| zodiac_signs.json | 12星座 |
| planets.json | 10天体 |
| asteroids_and_points.json | 小惑星・感受点 |
| houses.json | 12ハウス |
| aspects.json | アスペクト |
| dignities.json | ディグニティ |
| elements.json | 元素 |
| modalities.json | モダリティ |
| house_systems.json | ハウスシステム |
| celebrity_birth_data.json | 有名人出生データ |
| tarot_astrology_correspondences.json | タロット対応 |
| planet_in_sign_interpretations.json | 惑星×星座解釈 |
| moon_phases.json | 月相 |
| decans.json | デカン |
| arabic_parts.json | アラビック・パーツ |
| astrology_glossary.json | 用語集 |
| planet_in_house_interpretations.json | 惑星×ハウス解釈 |
| major_transits.json | 主要トランジット |
| synastry_aspects.json | シナストリー |
| retrograde_planets.json | 逆行惑星 |

### CSVデータ（スプレッドシート向け）

上記JSONファイルに対応するCSVファイルが csv/ フォルダに格納されています。

---

## データ収集元

- [Cafe Astrology](https://cafeastrology.com) - 惑星・星座・アスペクト基礎データ
- [Astro.com](https://www.astro.com) - 有名人出生データ・惑星解説
- [Labyrinthos](https://labyrinthos.co) - 惑星意味・タロット対応
- [Astro-Charts](https://astro-charts.com) - 有名人チャートデータ
- [Medieval Astrology Guide](https://www.medievalastrologyguide.com) - ディグニティ表
- [The Almanac](https://www.almanac.com) - ハウス解説

---

## LLMへの投入方法

### RAG（検索拡張生成）向け
各Markdownファイルをチャンクに分割してベクトルDBに投入することを推奨します。

### ファインチューニング向け
JSONデータを質問-回答形式に変換してファインチューニングデータセットを作成できます。

### プロンプトコンテキスト向け
鑑定中に関連するMarkdownセクションをプロンプトに挿入して使用できます。

