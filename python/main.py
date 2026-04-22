"""
チャート計算 FastAPI サーバー

起動方法:
  cd python
  pip install -r requirements.txt
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Next.js からは NEXT_PUBLIC_CHART_API_URL=http://localhost:8000 で接続
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from chart_engine import calculate_chart, chart_to_dict, resolve_location

app = FastAPI(title="占星術チャート計算API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── リクエスト/レスポンス型 ────────────────────────────────

class BirthDataRequest(BaseModel):
    name: str = Field(default="ゲスト", description="名前（任意）")
    year: int = Field(..., ge=1900, le=2100, description="生年")
    month: int = Field(..., ge=1, le=12, description="生月")
    day: int = Field(..., ge=1, le=31, description="生日")
    hour: int = Field(default=12, ge=0, le=23, description="生時（不明なら12）")
    minute: int = Field(default=0, ge=0, le=59, description="生分")

    # 場所は都市名か緯度経度のどちらかで指定
    city: Optional[str] = Field(default=None, description="出生地の都市名（例: 東京）")
    country: str = Field(default="JP", description="国コード（例: JP）")
    lat: Optional[float] = Field(default=None, description="緯度（直接指定する場合）")
    lng: Optional[float] = Field(default=None, description="経度（直接指定する場合）")
    tz_str: Optional[str] = Field(default=None, description="タイムゾーン（例: Asia/Tokyo）")

    house_system: str = Field(default="P", description="ハウスシステム: P=プラシーダス, W=ホールサイン")


# ── エンドポイント ────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "chart-engine"}


@app.post("/calculate")
def calculate(req: BirthDataRequest):
    """
    出生データからネイタルチャートを計算してDBの解釈文と紐付けて返す
    """
    try:
        # 場所の解決
        if req.lat is not None and req.lng is not None:
            lat = req.lat
            lng = req.lng
            tz_str = req.tz_str or "Asia/Tokyo"
            city_name = req.city or f"{lat},{lng}"
        elif req.city:
            geo = resolve_location(req.city, req.country)
            lat = geo["lat"]
            lng = geo["lng"]
            tz_str = req.tz_str or geo["tz_str"]
            city_name = geo["city"]
        else:
            raise HTTPException(status_code=400, detail="city または lat/lng を指定してください")

        # チャート計算
        result = calculate_chart(
            name=req.name,
            year=req.year,
            month=req.month,
            day=req.day,
            hour=req.hour,
            minute=req.minute,
            lat=lat,
            lng=lng,
            tz_str=tz_str,
            house_system=req.house_system,
        )

        result_dict = chart_to_dict(result)
        result_dict["birth_city"] = city_name

        return {"success": True, "chart": result_dict}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/geocode")
def geocode_city(city: str, country: str = "JP"):
    """都市名 → 緯度・経度・タイムゾーンに変換"""
    try:
        geo = resolve_location(city, country)
        return {"success": True, "location": geo}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
