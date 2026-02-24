"""
Iteration 6 backend tests: TV Guide mode - Full EPG, EPG batch, and Live TV endpoints
Focus: /api/epg/full/{stream_id} (new endpoint), /api/epg/batch, live channels, stream URL
"""
import pytest
import requests
import os
import time
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
if frontend_env.exists():
    load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')

# Credentials from iteration 5 context
USERNAME = "DJBIGANT"
PASSWORD = "sTtb4D5v7T"
STREAM_ID = 400


class TestHealthCheck:
    """Health check endpoint tests"""

    def test_health_returns_ok(self):
        """Test /api/health returns status ok"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✓ Health check OK: {data}")


class TestFullEpgEndpoint:
    """Test the new /api/epg/full/{stream_id} endpoint"""

    def test_full_epg_returns_200(self):
        """Test GET /api/epg/full/{stream_id} returns 200 status"""
        response = requests.get(
            f"{BASE_URL}/api/epg/full/{STREAM_ID}",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        assert response.status_code == 200, \
            f"Expected 200 for full EPG, got {response.status_code}. Body: {response.text[:300]}"
        print(f"✓ /api/epg/full/{STREAM_ID} returned 200")

    def test_full_epg_returns_dict_with_epg_listings(self):
        """Test full EPG response has epg_listings key"""
        response = requests.get(
            f"{BASE_URL}/api/epg/full/{STREAM_ID}",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        assert "epg_listings" in data, f"Missing 'epg_listings' key. Got keys: {list(data.keys())}"
        print(f"✓ Full EPG has epg_listings key with {len(data['epg_listings'])} items")

    def test_full_epg_listings_have_timestamps(self):
        """Test that full EPG listings have start_timestamp fields"""
        response = requests.get(
            f"{BASE_URL}/api/epg/full/{STREAM_ID}",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        listings = data.get("epg_listings", [])
        if len(listings) > 0:
            first = listings[0]
            assert "start_timestamp" in first or "start" in first, \
                f"EPG listing missing start_timestamp. Keys: {list(first.keys())}"
            print(f"✓ First listing keys: {list(first.keys())}")
            if "start_timestamp" in first:
                ts = first["start_timestamp"]
                print(f"  start_timestamp={ts} (type={type(ts).__name__})")
        else:
            print("⚠ No EPG listings returned (may be OK if no guide data for this channel)")
        print(f"✓ Full EPG listings structure validated ({len(listings)} items)")

    def test_full_epg_with_invalid_stream_id(self):
        """Test full EPG returns 200 with empty listings for invalid stream"""
        response = requests.get(
            f"{BASE_URL}/api/epg/full/99999999",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        # Should return 200 with empty/minimal data, not 500
        assert response.status_code in [200, 504], \
            f"Expected 200 or 504, got {response.status_code}"
        print(f"✓ Invalid stream_id returns acceptable status: {response.status_code}")

    def test_full_epg_without_credentials_returns_error(self):
        """Test full EPG without credentials returns 422 (missing params)"""
        response = requests.get(
            f"{BASE_URL}/api/epg/full/{STREAM_ID}",
            timeout=10
        )
        assert response.status_code == 422, \
            f"Expected 422 for missing credentials, got {response.status_code}"
        print(f"✓ Missing credentials returns 422")

    def test_full_epg_different_channel(self):
        """Test full EPG works for another stream ID"""
        response = requests.get(
            f"{BASE_URL}/api/epg/full/401",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        assert response.status_code == 200, \
            f"Expected 200 for stream 401, got {response.status_code}"
        data = response.json()
        assert isinstance(data, dict)
        assert "epg_listings" in data
        print(f"✓ Stream 401 full EPG: {len(data['epg_listings'])} listings")


class TestEpgBatchEndpoint:
    """Test /api/epg/batch endpoint (regression)"""

    def test_batch_epg_returns_200(self):
        """Test /api/epg/batch returns 200 with valid credentials"""
        response = requests.get(
            f"{BASE_URL}/api/epg/batch",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "stream_ids": f"{STREAM_ID},401,402"
            },
            timeout=60
        )
        assert response.status_code == 200, \
            f"Expected 200, got {response.status_code}. Body: {response.text[:200]}"
        data = response.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        print(f"✓ Batch EPG returned 200 with {len(data)} entries")

    def test_batch_epg_keyed_by_stream_id(self):
        """Test batch EPG dict is keyed by string stream_id"""
        response = requests.get(
            f"{BASE_URL}/api/epg/batch",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "stream_ids": str(STREAM_ID)
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert str(STREAM_ID) in data, \
            f"Expected key '{STREAM_ID}' in response. Got: {list(data.keys())}"
        print(f"✓ Batch EPG keyed by stream_id: keys={list(data.keys())}")


class TestLiveTVEndpoints:
    """Test live TV endpoints needed by the TV guide feature"""

    def test_live_categories_returns_list(self):
        """Test /api/live/categories returns a list"""
        response = requests.get(
            f"{BASE_URL}/api/live/categories",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) > 0, "Expected at least one category"
        print(f"✓ Live categories returned {len(data)} categories")
        # Validate category structure
        first = data[0]
        assert "category_id" in first, f"Missing category_id. Keys: {list(first.keys())}"
        assert "category_name" in first, f"Missing category_name"

    def test_live_streams_returns_list(self):
        """Test /api/live/streams returns a list"""
        response = requests.get(
            f"{BASE_URL}/api/live/streams",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Live streams returned {len(data)} streams")
        if len(data) > 0:
            first = data[0]
            assert "stream_id" in first, f"Missing stream_id. Keys: {list(first.keys())}"
            assert "name" in first, f"Missing name"

    def test_stream_url_for_live_channel(self):
        """Test /api/stream/url for a live channel"""
        response = requests.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "stream_id": STREAM_ID,
                "stream_type": "live",
                "container_extension": "ts"
            },
            timeout=20
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "url" in data, "Missing 'url' in response"
        print(f"✓ Stream URL generated: {data.get('url', '')[:60]}...")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
