"""
星座・天体名の日英変換テーブル
"""

SIGN_NAMES_JA: dict[str, str] = {
    "Aries":       "牡羊座",
    "Taurus":      "牡牛座",
    "Gemini":      "双子座",
    "Cancer":      "蟹座",
    "Leo":         "獅子座",
    "Virgo":       "乙女座",
    "Libra":       "天秤座",
    "Scorpio":     "蠍座",
    "Sagittarius": "射手座",
    "Capricorn":   "山羊座",
    "Aquarius":    "水瓶座",
    "Pisces":      "魚座",
}

PLANET_NAMES_JA: dict[str, str] = {
    "sun":     "太陽",
    "moon":    "月",
    "mercury": "水星",
    "venus":   "金星",
    "mars":    "火星",
    "jupiter": "木星",
    "saturn":  "土星",
    "uranus":  "天王星",
    "neptune": "海王星",
    "pluto":   "冥王星",
    "asc":     "アセンダント",
    "mc":      "MC（中天）",
}

ASPECT_NAMES_JA: dict[str, str] = {
    "conjunction": "コンジャンクション（合）",
    "opposition":  "オポジション（対）",
    "trine":       "トライン（三角）",
    "square":      "スクエア（四角）",
    "sextile":     "セクスタイル（六角）",
}

ELEMENT_NAMES_JA: dict[str, str] = {
    "Fire":  "火",
    "Earth": "地",
    "Air":   "風",
    "Water": "水",
}

MODALITY_NAMES_JA: dict[str, str] = {
    "Cardinal": "活動宮",
    "Fixed":    "不動宮",
    "Mutable":  "柔軟宮",
}

# 天体→JSONファイル名のマッピング
PLANET_FILE_MAP: dict[str, str] = {
    "sun":     "sun",
    "moon":    "moon",
    "mercury": "mercury",
    "venus":   "venus",
    "mars":    "mars",
    "jupiter": "jupiter",
    "saturn":  "saturn",
    "uranus":  "uranus",
    "neptune": "neptune",
    "pluto":   "pluto",
}
