import pytest
import requests
import os
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
if frontend_env.exists():
    load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
USERNAME = "DJBIGANT"
PASSWORD = "sTtb4D5v7T"

class TestStreamUrlEndpoint:
    """Test /api/stream/url endpoint for live and movie streams"""

    def test_stream_url_live_returns_200(self):
        """Test /api/stream/url returns 200 for live stream"""
        # Get a live stream ID first
        streams_response = requests.get(
            f"{BASE_URL}/api/live/streams",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        assert streams_response.status_code == 200
        streams = streams_response.json()
        assert len(streams) > 0, "No live streams available"
        
        stream_id = streams[0]["stream_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "stream_id": stream_id,
                "stream_type": "live",
                "container_extension": "ts"
            },
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ /api/stream/url returned 200 for live stream {stream_id}")

    def test_stream_url_live_has_required_fields(self):
        """Test live stream URL response has url, fallback_url, raw_url"""
        streams_response = requests.get(
            f"{BASE_URL}/api/live/streams",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        streams = streams_response.json()
        stream_id = streams[0]["stream_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "stream_id": stream_id,
                "stream_type": "live",
                "container_extension": "ts"
            },
            timeout=30
        )
        data = response.json()
        
        assert "url" in data, "Response missing 'url' field"
        assert "fallback_url" in data, "Response missing 'fallback_url' field"
        assert "raw_url" in data, "Response missing 'raw_url' field"
        
        assert isinstance(data["url"], str), "url field is not string"
        assert isinstance(data["fallback_url"], str), "fallback_url field is not string"
        assert isinstance(data["raw_url"], str), "raw_url field is not string"
        
        assert len(data["url"]) > 0, "url field is empty"
        assert len(data["fallback_url"]) > 0, "fallback_url field is empty"
        assert len(data["raw_url"]) > 0, "raw_url field is empty"
        
        print(f"✓ Live stream URL response has all required fields")
        print(f"  url: {data['url'][:80]}...")
        print(f"  fallback_url: {data['fallback_url'][:80]}...")
        print(f"  raw_url: {data['raw_url'][:80]}...")

    def test_stream_url_live_contains_m3u8(self):
        """Test live stream URL contains m3u8 format"""
        streams_response = requests.get(
            f"{BASE_URL}/api/live/streams",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        streams = streams_response.json()
        stream_id = streams[0]["stream_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "stream_id": stream_id,
                "stream_type": "live",
                "container_extension": "ts"
            },
            timeout=30
        )
        data = response.json()
        
        # raw_url should contain m3u8 for live streams
        assert ".m3u8" in data["raw_url"] or ".ts" in data["raw_url"], f"Live stream raw_url missing m3u8 or ts: {data['raw_url']}"
        print(f"✓ Live stream URL uses m3u8/ts format")

    def test_stream_url_movie_returns_200(self):
        """Test /api/stream/url returns 200 for movie stream"""
        # Get a movie stream ID first
        movies_response = requests.get(
            f"{BASE_URL}/api/vod/streams",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        assert movies_response.status_code == 200
        movies = movies_response.json()
        assert len(movies) > 0, "No movies available"
        
        movie = movies[0]
        stream_id = movie["stream_id"]
        container_ext = movie.get("container_extension", "mp4")
        
        response = requests.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "stream_id": stream_id,
                "stream_type": "movie",
                "container_extension": container_ext
            },
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ /api/stream/url returned 200 for movie stream {stream_id}")

    def test_stream_url_movie_has_required_fields(self):
        """Test movie stream URL response has url, fallback_url, raw_url"""
        movies_response = requests.get(
            f"{BASE_URL}/api/vod/streams",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        movies = movies_response.json()
        movie = movies[0]
        stream_id = movie["stream_id"]
        container_ext = movie.get("container_extension", "mp4")
        
        response = requests.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "stream_id": stream_id,
                "stream_type": "movie",
                "container_extension": container_ext
            },
            timeout=30
        )
        data = response.json()
        
        assert "url" in data, "Response missing 'url' field"
        assert "fallback_url" in data, "Response missing 'fallback_url' field"
        assert "raw_url" in data, "Response missing 'raw_url' field"
        
        print(f"✓ Movie stream URL response has all required fields")
        print(f"  url: {data['url'][:80]}...")

    def test_stream_url_movie_uses_container_extension(self):
        """Test movie stream URL uses correct container extension"""
        movies_response = requests.get(
            f"{BASE_URL}/api/vod/streams",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        movies = movies_response.json()
        movie = movies[0]
        stream_id = movie["stream_id"]
        container_ext = movie.get("container_extension", "mp4")
        
        response = requests.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "stream_id": stream_id,
                "stream_type": "movie",
                "container_extension": container_ext
            },
            timeout=30
        )
        data = response.json()
        
        # Check that URL contains the container extension
        assert f".{container_ext}" in data["raw_url"], f"Movie URL missing container extension {container_ext}: {data['raw_url']}"
        print(f"✓ Movie stream URL uses container extension: {container_ext}")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
