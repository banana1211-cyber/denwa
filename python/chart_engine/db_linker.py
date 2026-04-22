"""
計算結果 → JSONデータベース 紐付けモジュール

天体名 × 星座名 × ハウス番号 をキーにして
json/ フォルダの解釈データを引き出す
"""

import json
import os
from pathlib import Path
from typing import Any

# json/ フォルダのパス（python/ の親ディレクトリ）
JSON_DIR = Path(__file__).parent.parent.parent / "json"


def _load_json(filename: str) -> list[dict]:
    path = JSON_DIR / filename
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def get_planet_in_sign(planet: str, sign_en: str) -> dict[str, Any] | None:
    """
    天体×星座の解釈を取得
    例: get_planet_in_sign("sun", "Cancer")
    """
    filename = f"{planet}_in_signs.json"
    data = _load_json(filename)
    for entry in data:
        if entry.get("sign_en") == sign_en or entry.get("sign") == sign_en:
            return entry
    return None


def get_planet_in_house(planet: str, house: int) -> dict[str, Any] | None:
    """
    天体×ハウスの解釈を取得
    例: get_planet_in_house("sun", 10)
    """
    filename = f"{planet}_in_houses.json"
    data = _load_json(filename)
    for entry in data:
        if entry.get("house") == house or entry.get("house_number") == house:
            return entry
    return None


def get_asc_in_sign(sign_en: str) -> dict[str, Any] | None:
    """上昇星座（ASC）の解釈を取得"""
    data = _load_json("asc_in_signs.json")
    for entry in data:
        if entry.get("sign_en") == sign_en or entry.get("sign") == sign_en:
            return entry
    return None


def get_aspect_interpretation(planet1: str, planet2: str, aspect_type: str) -> dict[str, Any] | None:
    """アスペクト解釈を取得"""
    data = _load_json("aspects.json")
    for entry in data:
        p1 = entry.get("planet1", "").lower()
        p2 = entry.get("planet2", "").lower()
        aspect = entry.get("aspect", "").lower()
        if (
            (p1 == planet1.lower() and p2 == planet2.lower())
            or (p1 == planet2.lower() and p2 == planet1.lower())
        ) and aspect == aspect_type.lower():
            return entry
    return None


def build_interpretations(planet_positions: dict) -> dict[str, Any]:
    """
    全天体の解釈をまとめて取得する

    planet_positions: {
      "sun": {"sign_en": "Cancer", "house": 10, ...},
      "moon": {"sign_en": "Aries", "house": 7, ...},
      ...
    }
    """
    interpretations: dict[str, Any] = {}

    for planet, pos in planet_positions.items():
        sign_en = pos.get("sign_en") or pos.get("sign", "")
        house = pos.get("house")

        # 天体×星座
        sign_interp = get_planet_in_sign(planet, sign_en)
        if sign_interp:
            interp_text = (
                sign_interp.get("interpretation_ja")
                or sign_interp.get("description_ja")
                or sign_interp.get("meaning_ja")
                or ""
            )
            if interp_text:
                interpretations[f"{planet}_in_{sign_en.lower()}"] = interp_text

        # 天体×ハウス
        if house:
            house_interp = get_planet_in_house(planet, int(house))
            if house_interp:
                interp_text = (
                    house_interp.get("interpretation_ja")
                    or house_interp.get("description_ja")
                    or house_interp.get("meaning_ja")
                    or ""
                )
                if interp_text:
                    interpretations[f"{planet}_in_house_{house}"] = interp_text

    return interpretations
