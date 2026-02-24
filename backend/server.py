from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Xtream Codes DNS
XTREAM_DNS = os.environ['XTREAM_DNS']

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Pydantic Models
class LoginRequest(BaseModel):
    username: str
    password: str

class HistoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    stream_id: int
    stream_name: str
    stream_icon: str = ""
    stream_type: str = "live"
    category_name: str = ""
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FavoriteItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    stream_id: int
    stream_name: str
    stream_icon: str = ""
    stream_type: str = "live"
    category_name: str = ""

# Helper to call Xtream Codes API
async def xtream_api_call(username: str, password: str, action: str, extra_params: dict = None):
    params = {"username": username, "password": password, "action": action}
    if extra_params:
        params.update(extra_params)
    url = f"{XTREAM_DNS}/player_api.php"
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client_http:
            response = await client_http.get(url, params=params)
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if "text/html" in content_type or response.text.strip().startswith("<"):
                return []
            data = response.json()
            return data if data else []
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Xtream server timeout")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Xtream API error")
    except Exception as e:
        logger.error(f"Xtream API error: {e}")
        return []

# Auth
@api_router.post("/auth/login")
async def login(req: LoginRequest):
    params = {"username": req.username, "password": req.password}
    url = f"{XTREAM_DNS}/player_api.php"
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client_http:
            response = await client_http.get(url, params=params)
            content_type = response.headers.get("content-type", "")
            if "text/html" in content_type or response.text.strip().startswith("<"):
                raise HTTPException(status_code=401, detail="Invalid credentials")
            data = response.json()
            if not data or not isinstance(data, dict):
                raise HTTPException(status_code=401, detail="Invalid credentials")
            if data.get("user_info", {}).get("auth") == 1:
                return data
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=401, detail="Invalid username or password")

# Live
@api_router.get("/live/categories")
async def get_live_categories(username: str, password: str):
    return await xtream_api_call(username, password, "get_live_categories")

@api_router.get("/live/streams")
async def get_live_streams(username: str, password: str, category_id: Optional[str] = None):
    extra = {"category_id": category_id} if category_id else None
    return await xtream_api_call(username, password, "get_live_streams", extra)

# VOD
@api_router.get("/vod/categories")
async def get_vod_categories(username: str, password: str):
    return await xtream_api_call(username, password, "get_vod_categories")

@api_router.get("/vod/streams")
async def get_vod_streams(username: str, password: str, category_id: Optional[str] = None):
    extra = {"category_id": category_id} if category_id else None
    return await xtream_api_call(username, password, "get_vod_streams", extra)

@api_router.get("/vod/info/{vod_id}")
async def get_vod_info(vod_id: int, username: str, password: str):
    return await xtream_api_call(username, password, "get_vod_info", {"vod_id": str(vod_id)})

# Series
@api_router.get("/series/categories")
async def get_series_categories(username: str, password: str):
    return await xtream_api_call(username, password, "get_series_categories")

@api_router.get("/series")
async def get_series(username: str, password: str, category_id: Optional[str] = None):
    extra = {"category_id": category_id} if category_id else None
    return await xtream_api_call(username, password, "get_series", extra)

@api_router.get("/series/info/{series_id}")
async def get_series_info(series_id: int, username: str, password: str):
    return await xtream_api_call(username, password, "get_series_info", {"series_id": str(series_id)})

# Catch-up
@api_router.get("/catchup/categories")
async def get_catchup_categories(username: str, password: str):
    return await xtream_api_call(username, password, "get_live_categories")

@api_router.get("/catchup/streams")
async def get_catchup_streams(username: str, password: str, category_id: Optional[str] = None):
    extra = {"category_id": category_id} if category_id else None
    data = await xtream_api_call(username, password, "get_live_streams", extra)
    # Filter streams that support catchup (tv_archive == 1)
    if isinstance(data, list):
        return [s for s in data if s.get("tv_archive") == 1]
    return data

# EPG
@api_router.get("/epg/{stream_id}")
async def get_epg(stream_id: int, username: str, password: str):
    return await xtream_api_call(username, password, "get_short_epg", {"stream_id": str(stream_id)})

@api_router.get("/epg/full/{stream_id}")
async def get_full_epg(stream_id: int, username: str, password: str):
    return await xtream_api_call(username, password, "get_simple_data_table", {"stream_id": str(stream_id)})

# User History
@api_router.post("/user/history")
async def add_history(item: HistoryItem):
    doc = item.dict()
    # Upsert - update if same user+stream exists, otherwise insert
    await db.watch_history.update_one(
        {"username": doc["username"], "stream_id": doc["stream_id"]},
        {"$set": doc},
        upsert=True
    )
    return {"status": "ok"}

@api_router.get("/user/history")
async def get_history(username: str, limit: int = 20):
    items = await db.watch_history.find(
        {"username": username},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return items

@api_router.delete("/user/history")
async def clear_history(username: str):
    await db.watch_history.delete_many({"username": username})
    return {"status": "ok"}

# User Favorites
@api_router.post("/user/favorites")
async def add_favorite(item: FavoriteItem):
    doc = item.dict()
    existing = await db.favorites.find_one(
        {"username": doc["username"], "stream_id": doc["stream_id"]},
        {"_id": 0}
    )
    if existing:
        await db.favorites.delete_one({"username": doc["username"], "stream_id": doc["stream_id"]})
        return {"status": "removed"}
    await db.favorites.insert_one(doc)
    return {"status": "added"}

@api_router.get("/user/favorites")
async def get_favorites(username: str):
    items = await db.favorites.find(
        {"username": username},
        {"_id": 0}
    ).to_list(1000)
    return items

# Health check
@api_router.get("/health")
async def health():
    return {"status": "ok", "xtream_dns": XTREAM_DNS}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
