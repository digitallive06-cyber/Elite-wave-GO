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
        if e.response.status_code == 503:
            return []  # Rate limited, return empty gracefully
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

# EPG - decode base64 titles
import base64

def decode_epg_listings(data):
    """Decode base64 encoded EPG titles and descriptions"""
    if isinstance(data, dict):
        listings = data.get("epg_listings", [])
        for item in listings:
            if item.get("title"):
                try:
                    item["title"] = base64.b64decode(item["title"]).decode("utf-8", errors="replace")
                except Exception:
                    pass
            if item.get("description"):
                try:
                    item["description"] = base64.b64decode(item["description"]).decode("utf-8", errors="replace")
                except Exception:
                    pass
        return data
    return data

@api_router.get("/epg/{stream_id}")
async def get_epg(stream_id: int, username: str, password: str):
    data = await xtream_api_call(username, password, "get_short_epg", {"stream_id": str(stream_id)})
    return decode_epg_listings(data)

@api_router.get("/epg/full/{stream_id}")
async def get_full_epg(stream_id: int, username: str, password: str):
    data = await xtream_api_call(username, password, "get_simple_data_table", {"stream_id": str(stream_id)})
    return decode_epg_listings(data)

# Batch EPG endpoint - fetches EPG for multiple streams sequentially to avoid rate limiting
import asyncio

@api_router.get("/epg/batch")
async def get_batch_epg(username: str, password: str, stream_ids: str):
    """Get EPG for multiple streams in one call. stream_ids is comma-separated."""
    ids = [int(x.strip()) for x in stream_ids.split(",") if x.strip().isdigit()][:20]
    results = {}
    for sid in ids:
        try:
            data = await xtream_api_call(username, password, "get_short_epg", {"stream_id": str(sid)})
            decoded = decode_epg_listings(data) if isinstance(data, dict) else data
            results[str(sid)] = decoded
        except Exception:
            results[str(sid)] = {"epg_listings": []}
        await asyncio.sleep(0.15)  # 150ms delay between requests to avoid 503
    return results


@api_router.get("/vod/recent")
async def get_recent_vod(username: str, password: str, limit: int = 20):
    data = await xtream_api_call(username, password, "get_vod_streams")
    if isinstance(data, list) and len(data) > 0:
        # Sort by 'added' field descending (most recent first)
        sorted_data = sorted(data, key=lambda x: x.get("added", "0"), reverse=True)
        return sorted_data[:limit]
    return []

@api_router.get("/series/recent")
async def get_recent_series(username: str, password: str, limit: int = 20):
    data = await xtream_api_call(username, password, "get_series")
    if isinstance(data, list) and len(data) > 0:
        sorted_data = sorted(data, key=lambda x: x.get("last_modified", "0"), reverse=True)
        return sorted_data[:limit]
    return []

# Stream URL generation and resolution (handles LB redirects)
class StreamUrlRequest(BaseModel):
    username: str
    password: str
    stream_id: int
    stream_type: str = "live"  # live, movie, series
    container_extension: str = "ts"

@api_router.post("/stream/resolve")
async def resolve_stream_url(req: StreamUrlRequest):
    """Generate stream URL and resolve LB redirects to get the actual playable URL"""
    # Build the base stream URL
    if req.stream_type == "live":
        path = f"/live/{req.username}/{req.password}/{req.stream_id}.m3u8"
    elif req.stream_type == "movie":
        ext = req.container_extension or "mp4"
        path = f"/movie/{req.username}/{req.password}/{req.stream_id}.{ext}"
    elif req.stream_type == "series":
        ext = req.container_extension or "mp4"
        path = f"/series/{req.username}/{req.password}/{req.stream_id}.{ext}"
    else:
        path = f"/live/{req.username}/{req.password}/{req.stream_id}.m3u8"

    base_url = f"{XTREAM_DNS}{path}"

    # Try to resolve the URL by following redirects to handle LB
    resolved_url = base_url
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False, follow_redirects=False) as client_http:
            response = await client_http.head(base_url)
            if response.status_code in (301, 302, 303, 307, 308):
                redirect_url = response.headers.get("location", "")
                if redirect_url:
                    resolved_url = redirect_url
                    logger.info(f"Stream {req.stream_id} redirected to LB: {redirect_url}")
            elif response.status_code == 200:
                resolved_url = base_url
            else:
                # If HEAD fails, try with .ts for live
                if req.stream_type == "live":
                    ts_path = f"/live/{req.username}/{req.password}/{req.stream_id}.ts"
                    ts_url = f"{XTREAM_DNS}{ts_path}"
                    response2 = await client_http.head(ts_url)
                    if response2.status_code in (301, 302, 303, 307, 308):
                        redirect_url = response2.headers.get("location", "")
                        if redirect_url:
                            resolved_url = redirect_url
                    elif response2.status_code == 200:
                        resolved_url = ts_url
    except Exception as e:
        logger.warning(f"Could not resolve stream URL, using base: {e}")

    # Also provide alternate URLs for fallback
    urls = {
        "resolved_url": resolved_url,
        "m3u8_url": f"{XTREAM_DNS}/live/{req.username}/{req.password}/{req.stream_id}.m3u8" if req.stream_type == "live" else resolved_url,
        "ts_url": f"{XTREAM_DNS}/live/{req.username}/{req.password}/{req.stream_id}.ts" if req.stream_type == "live" else resolved_url,
        "raw_url": base_url,
        "stream_type": req.stream_type,
    }
    return urls

@api_router.get("/stream/url")
async def get_stream_url(username: str, password: str, stream_id: int, stream_type: str = "live", container_extension: str = "ts"):
    """Simple GET endpoint for stream URL generation"""
    if stream_type == "live":
        url = f"{XTREAM_DNS}/live/{username}/{password}/{stream_id}.m3u8"
        ts_url = f"{XTREAM_DNS}/live/{username}/{password}/{stream_id}.ts"
    elif stream_type == "movie":
        ext = container_extension or "mp4"
        url = f"{XTREAM_DNS}/movie/{username}/{password}/{stream_id}.{ext}"
        ts_url = url
    elif stream_type == "series":
        ext = container_extension or "mp4"
        url = f"{XTREAM_DNS}/series/{username}/{password}/{stream_id}.{ext}"
        ts_url = url
    else:
        url = f"{XTREAM_DNS}/live/{username}/{password}/{stream_id}.m3u8"
        ts_url = url

    # Resolve redirects for LB
    resolved_url = url
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False, follow_redirects=False) as client_http:
            response = await client_http.head(url)
            if response.status_code in (301, 302, 303, 307, 308):
                redirect_url = response.headers.get("location", "")
                if redirect_url:
                    resolved_url = redirect_url
    except Exception as e:
        logger.warning(f"Could not resolve redirect: {e}")

    return {
        "url": resolved_url,
        "fallback_url": ts_url,
        "raw_url": url,
    }


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
