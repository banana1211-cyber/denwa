"""
Kerykeion ラッパー：出生データ → チャート計算
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any
from kerykeion import AstrologicalSubject
from .constants import SIGN_NAMES_JA, PLANET_NAMES_JA, ASPECT_NAMES_JA
from .db_linker import build_interpretations, get_asc_in_sign


@dataclass
class PlanetPosition:
    name_en: str
    name_ja: str
    sign_en: str
    sign_ja: str
    house: int
    degree: float          # 星座内の度数（0〜29.9）
    absolute_degree: float # 黄道上の絶対度数（0〜359.9）
    retrograde: bool


@dataclass
class PointPosition:
    name_en: str
    name_ja: str
    sign_en: str
    sign_ja: str
    degree: float


@dataclass
class AspectResult:
    planet1_en: str
    planet1_ja: str
    planet2_en: str
    planet2_ja: str
    aspect_en: str
    aspect_ja: str
    orb: float             # 実際の角度のズレ（許容差）


@dataclass
class ChartResult:
    # 入力情報
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

    # 計算結果
    planets: dict[str, dict]    # 各天体の配置
    points: dict[str, dict]     # ASC・MC等
    aspects: list[dict]         # アスペクト一覧
    interpretations: dict[str, str]  # DBから引いた解釈文

    # サマリー
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


def calculate_chart(
    name: str,
    year: int,
    month: int,
    day: int,
    hour: int,
    minute: int,
    lat: float,
    lng: float,
    tz_str: str,
    house_system: str = "P",  # P=Placidus, W=WholeSign
) -> ChartResult:
    """
    Kerykeion を使って出生チャートを計算し、DB解釈と紐付けて返す

    house_system:
      "P" → プラシーダス（デフォルト・最一般的）
      "W" → ホールサイン（古典的・シンプル）
    """
    subject = AstrologicalSubject(
        name=name,
        year=year,
        month=month,
        day=day,
        hour=hour,
        minute=minute,
        lng=lng,
        lat=lat,
        tz_str=tz_str,
        houses_system_identifier=house_system,
        online=False,
    )

    # ── 天体位置の収集 ──────────────────────────────────────
    planets: dict[str, dict] = {}
    planet_positions_for_db: dict[str, dict] = {}

    for attr, name_ja in PLANET_ATTRS:
        obj = getattr(subject, attr, None)
        if obj is None:
            continue

        sign_en = obj.sign
        sign_ja = SIGN_NAMES_JA.get(sign_en, sign_en)
        house = getattr(obj, "house", 0)
        if isinstance(house, str):
            house = int(house.replace("House_", "").replace("_", ""))

        pos = {
            "name_en": attr,
            "name_ja": name_ja,
            "sign_en": sign_en,
            "sign_ja": sign_ja,
            "house": house,
            "degree": round(obj.position, 2),
            "absolute_degree": round(obj.abs_pos, 2),
            "retrograde": bool(getattr(obj, "retrograde", False)),
        }
        planets[attr] = pos
        planet_positions_for_db[attr] = {"sign_en": sign_en, "house": house}

    # ── 感受点（ASC・MC）──────────────────────────────────
    points: dict[str, dict] = {}
    for attr, name_ja in [("first_house", "アセンダント"), ("tenth_house", "MC（中天）")]:
        obj = getattr(subject, attr, None)
        if obj is None:
            continue
        sign_en = obj.sign
        points[attr.replace("_house", "")] = {
            "name_ja": name_ja,
            "sign_en": sign_en,
            "sign_ja": SIGN_NAMES_JA.get(sign_en, sign_en),
            "degree": round(obj.position, 2),
        }

    # ── アスペクト ──────────────────────────────────────────
    aspects: list[dict] = []
    try:
        aspect_list = subject.aspects_list
        if aspect_list:
            for asp in aspect_list:
                aspects.append({
                    "planet1_en": asp.get("p1_name", ""),
                    "planet1_ja": PLANET_NAMES_JA.get(asp.get("p1_name", "").lower(), ""),
                    "planet2_en": asp.get("p2_name", ""),
                    "planet2_ja": PLANET_NAMES_JA.get(asp.get("p2_name", "").lower(), ""),
                    "aspect_en": asp.get("aspect", ""),
                    "aspect_ja": ASPECT_NAMES_JA.get(asp.get("aspect", "").lower(), asp.get("aspect", "")),
                    "orb": round(asp.get("orbit", 0), 2),
                })
    except Exception:
        pass  # アスペクト計算失敗は無視

    # ── DB紐付け（解釈文） ──────────────────────────────────
    interpretations = build_interpretations(planet_positions_for_db)

    # ASC解釈
    asc_sign = points.get("first", {}).get("sign_en", "")
    asc_interp = get_asc_in_sign(asc_sign)
    if asc_interp:
        text = (
            asc_interp.get("interpretation_ja")
            or asc_interp.get("description_ja")
            or ""
        )
        if text:
            interpretations["asc_in_sign"] = text

    # ── 支配元素の計算 ──────────────────────────────────────
    element_count = {"Fire": 0, "Earth": 0, "Air": 0, "Water": 0}
    element_map = {
        "Aries": "Fire", "Leo": "Fire", "Sagittarius": "Fire",
        "Taurus": "Earth", "Virgo": "Earth", "Capricorn": "Earth",
        "Gemini": "Air", "Libra": "Air", "Aquarius": "Air",
        "Cancer": "Water", "Scorpio": "Water", "Pisces": "Water",
    }
    for pos in planets.values():
        el = element_map.get(pos["sign_en"], "")
        if el:
            element_count[el] += 1

    dominant_element = max(element_count, key=lambda k: element_count[k])
    element_ja_map = {"Fire": "火", "Earth": "地", "Air": "風", "Water": "水"}

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
        asc_sign_ja=points.get("first", {}).get("sign_ja", ""),
        dominant_element_ja=element_ja_map.get(dominant_element, ""),
    )


def chart_to_dict(result: ChartResult) -> dict[str, Any]:
    return asdict(result)
