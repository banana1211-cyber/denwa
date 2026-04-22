"""
Kerykeion 5.x ラッパー：出生データ → チャート計算
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any
from kerykeion import AstrologicalSubject, NatalAspects
from .constants import SIGN_NAMES_JA, PLANET_NAMES_JA, ASPECT_NAMES_JA
from .db_linker import build_interpretations, get_asc_in_sign

# ── Kerykeion 5.x 変換テーブル ────────────────────────────

# 3文字略称 → フルネーム（英語）
SIGN_ABBR_TO_FULL: dict[str, str] = {
    "Ari": "Aries", "Tau": "Taurus", "Gem": "Gemini",
    "Can": "Cancer", "Leo": "Leo", "Vir": "Virgo",
    "Lib": "Libra", "Sco": "Scorpio", "Sag": "Sagittarius",
    "Cap": "Capricorn", "Aqu": "Aquarius", "Pis": "Pisces",
}

# "Tenth_House" → 10
HOUSE_STR_TO_INT: dict[str, int] = {
    "First_House": 1, "Second_House": 2, "Third_House": 3,
    "Fourth_House": 4, "Fifth_House": 5, "Sixth_House": 6,
    "Seventh_House": 7, "Eighth_House": 8, "Ninth_House": 9,
    "Tenth_House": 10, "Eleventh_House": 11, "Twelfth_House": 12,
}


def _sign_en(abbr: str) -> str:
    return SIGN_ABBR_TO_FULL.get(abbr, abbr)


def _house_int(house_str: str | int) -> int:
    if isinstance(house_str, int):
        return house_str
    return HOUSE_STR_TO_INT.get(str(house_str), 0)


# ── データクラス ──────────────────────────────────────────

@dataclass
class ChartResult:
    name: str
    birth_year: int
    birth_month: int
    birth_day: int
    birth_hour: int
    birth_minute: int
    birth_city: str
    birth_lat: float
    birth_lng: float
    birth_tz: str
    planets: dict[str, dict]
    points: dict[str, dict]
    aspects: list[dict]
    interpretations: dict[str, str]
    sun_sign_ja: str
    moon_sign_ja: str
    asc_sign_ja: str
    dominant_element_ja: str


PLANET_ATTRS = [
    ("sun",     "太陽"),
    ("moon",    "月"),
    ("mercury", "水星"),
    ("venus",   "金星"),
    ("mars",    "火星"),
    ("jupiter", "木星"),
    ("saturn",  "土星"),
    ("uranus",  "天王星"),
    ("neptune", "海王星"),
    ("pluto",   "冥王星"),
]

ELEMENT_MAP: dict[str, str] = {
    "Aries": "Fire", "Leo": "Fire", "Sagittarius": "Fire",
    "Taurus": "Earth", "Virgo": "Earth", "Capricorn": "Earth",
    "Gemini": "Air", "Libra": "Air", "Aquarius": "Air",
    "Cancer": "Water", "Scorpio": "Water", "Pisces": "Water",
}

ELEMENT_JA: dict[str, str] = {
    "Fire": "火", "Earth": "地", "Air": "風", "Water": "水",
}


def calculate_chart(
    name: str,
    year: int, month: int, day: int,
    hour: int, minute: int,
    lat: float, lng: float, tz_str: str,
    house_system: str = "P",
) -> ChartResult:
    """
    Kerykeion 5.x で出生チャートを計算し、DB解釈と紐付けて返す
    """
    subject = AstrologicalSubject(
        name=name,
        year=year, month=month, day=day,
        hour=hour, minute=minute,
        lng=lng, lat=lat, tz_str=tz_str,
        houses_system_identifier=house_system,
        online=False,
    )

    # ── 天体位置 ──────────────────────────────────────────
    planets: dict[str, dict] = {}
    planet_positions_for_db: dict[str, dict] = {}

    for attr, name_ja in PLANET_ATTRS:
        obj = getattr(subject, attr, None)
        if obj is None:
            continue

        sign_en = _sign_en(obj.sign)
        sign_ja = SIGN_NAMES_JA.get(sign_en, sign_en)
        house = _house_int(obj.house)

        planets[attr] = {
            "name_en": attr,
            "name_ja": name_ja,
            "sign_en": sign_en,
            "sign_ja": sign_ja,
            "house": house,
            "degree": round(float(obj.position), 2),
            "absolute_degree": round(float(obj.abs_pos), 2),
            "retrograde": bool(obj.retrograde),
        }
        planet_positions_for_db[attr] = {"sign_en": sign_en, "house": house}

    # ── 感受点（ASC・MC）─────────────────────────────────
    points: dict[str, dict] = {}
    for attr, key, name_ja in [
        ("first_house",  "asc", "アセンダント"),
        ("tenth_house",  "mc",  "MC（中天）"),
    ]:
        obj = getattr(subject, attr, None)
        if obj is None:
            continue
        sign_en = _sign_en(obj.sign)
        points[key] = {
            "name_ja": name_ja,
            "sign_en": sign_en,
            "sign_ja": SIGN_NAMES_JA.get(sign_en, sign_en),
            "degree": round(float(obj.position), 2),
        }

    # ── アスペクト ─────────────────────────────────────────
    aspects: list[dict] = []
    try:
        natal_aspects = NatalAspects(subject)
        for asp in natal_aspects.relevant_aspects:
            aspects.append({
                "planet1_en": asp.p1_name,
                "planet1_ja": PLANET_NAMES_JA.get(asp.p1_name.lower(), asp.p1_name),
                "planet2_en": asp.p2_name,
                "planet2_ja": PLANET_NAMES_JA.get(asp.p2_name.lower(), asp.p2_name),
                "aspect_en": asp.aspect,
                "aspect_ja": ASPECT_NAMES_JA.get(asp.aspect.lower(), asp.aspect),
                "orb": round(float(asp.orbit), 2),
            })
    except Exception as e:
        print(f"[aspect] {e}")

    # ── DB紐付け ──────────────────────────────────────────
    interpretations = build_interpretations(planet_positions_for_db)

    asc_sign_en = points.get("asc", {}).get("sign_en", "")
    asc_interp = get_asc_in_sign(asc_sign_en)
    if asc_interp:
        text = (
            asc_interp.get("interpretation_ja")
            or asc_interp.get("description_ja")
            or asc_interp.get("meaning_ja")
            or asc_interp.get("personality_mask")
            or asc_interp.get("life_approach")
            or asc_interp.get("life_theme")
            or ""
        )
        if text:
            interpretations["asc_in_sign"] = text

    # ── 支配元素 ──────────────────────────────────────────
    element_count: dict[str, int] = {"Fire": 0, "Earth": 0, "Air": 0, "Water": 0}
    for pos in planets.values():
        el = ELEMENT_MAP.get(pos["sign_en"], "")
        if el:
            element_count[el] += 1
    dominant_element = max(element_count, key=lambda k: element_count[k])

    return ChartResult(
        name=name,
        birth_year=year, birth_month=month, birth_day=day,
        birth_hour=hour, birth_minute=minute,
        birth_city="", birth_lat=lat, birth_lng=lng, birth_tz=tz_str,
        planets=planets,
        points=points,
        aspects=aspects,
        interpretations=interpretations,
        sun_sign_ja=planets.get("sun", {}).get("sign_ja", ""),
        moon_sign_ja=planets.get("moon", {}).get("sign_ja", ""),
        asc_sign_ja=points.get("asc", {}).get("sign_ja", ""),
        dominant_element_ja=ELEMENT_JA.get(dominant_element, ""),
    )


def chart_to_dict(result: ChartResult) -> dict[str, Any]:
    return asdict(result)
