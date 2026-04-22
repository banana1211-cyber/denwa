"""
地名 → 緯度・経度・タイムゾーン変換
GeoNames API（無料アカウント必要）を使用
"""

import os
import requests
from typing import TypedDict


class GeoResult(TypedDict):
    city: str
    country: str
    lat: float
    lng: float
    tz_str: str


def geocode(city: str, country: str = "JP") -> GeoResult | None:
    """
    都市名と国コードから緯度・経度・タイムゾーンを取得

    Args:
        city: 都市名（例: "Tokyo", "東京"）
        country: 国コード（例: "JP", "US"）

    Returns:
        GeoResult または None（見つからない場合）

    環境変数:
        GEONAMES_USERNAME: GeoNames アカウント名（無料登録）
    """
    username = os.getenv("GEONAMES_USERNAME", "")
    if not username:
        raise ValueError(
            "GEONAMES_USERNAME が未設定です。"
            "https://www.geonames.org/ で無料アカウントを作成してください"
        )

    # 都市検索
    search_url = "http://api.geonames.org/searchJSON"
    params = {
        "q": city,
        "country": country,
        "maxRows": 1,
        "username": username,
        "lang": "ja",
    }

    try:
        res = requests.get(search_url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()
        geonames = data.get("geonames", [])
        if not geonames:
            return None

        place = geonames[0]
        lat = float(place["lat"])
        lng = float(place["lng"])
        geoname_id = place["geonameId"]

        # タイムゾーン取得
        tz_url = "http://api.geonames.org/timezoneJSON"
        tz_params = {
            "lat": lat,
            "lng": lng,
            "username": username,
        }
        tz_res = requests.get(tz_url, params=tz_params, timeout=10)
        tz_res.raise_for_status()
        tz_data = tz_res.json()
        tz_str = tz_data.get("timezoneId", "Asia/Tokyo")

        return GeoResult(
            city=place.get("name", city),
            country=country,
            lat=lat,
            lng=lng,
            tz_str=tz_str,
        )

    except Exception as e:
        raise RuntimeError(f"ジオコーディング失敗: {e}") from e


# よく使う都市のキャッシュ（GeoNames APIを節約）
CITY_PRESETS: dict[str, GeoResult] = {
    "東京": GeoResult(city="東京", country="JP", lat=35.6895, lng=139.6917, tz_str="Asia/Tokyo"),
    "大阪": GeoResult(city="大阪", country="JP", lat=34.6937, lng=135.5022, tz_str="Asia/Tokyo"),
    "名古屋": GeoResult(city="名古屋", country="JP", lat=35.1815, lng=136.9066, tz_str="Asia/Tokyo"),
    "福岡": GeoResult(city="福岡", country="JP", lat=33.5904, lng=130.4017, tz_str="Asia/Tokyo"),
    "札幌": GeoResult(city="札幌", country="JP", lat=43.0642, lng=141.3469, tz_str="Asia/Tokyo"),
    "tokyo": GeoResult(city="Tokyo", country="JP", lat=35.6895, lng=139.6917, tz_str="Asia/Tokyo"),
}


def resolve_location(city: str, country: str = "JP") -> GeoResult:
    """
    まずプリセットを確認し、なければGeoNames APIを呼ぶ
    """
    preset = CITY_PRESETS.get(city.strip()) or CITY_PRESETS.get(city.strip().lower())
    if preset:
        return preset
    return geocode(city, country) or GeoResult(
        city=city, country=country,
        lat=35.6895, lng=139.6917,  # フォールバック: 東京
        tz_str="Asia/Tokyo"
    )
