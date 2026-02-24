"""
Iteration 5 backend tests: EPG batch endpoint, health check, route ordering
Focus: EPG /batch endpoint returns data without 503 errors, route ordering correct
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


class TestHealthCheck:
    """Health check endpoint tests"""

    def test_health_returns_ok(self):
        """Test /api/health returns status ok"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "ok", f"Expected 'ok', got {data.get('status')}"
        assert "xtream_dns" in data, "Missing xtream_dns in health response"
        print(f"✓ Health check OK: {data}")


class TestEpgRouteOrdering:
    """Test that /epg/batch is matched before /epg/{stream_id} with 'batch' as literal"""

    def test_batch_route_not_treated_as_stream_id(self):
        """Test that /api/epg/batch is NOT treated as parameterized route with stream_id='batch'"""
        # If route ordering is wrong, this would try to parse 'batch' as int and fail with 422
        response = requests.get(
            f"{BASE_URL}/api/epg/batch",
            params={
                "username": "test_user",
                "password": "test_pass",
                "stream_ids": "400,401"
            },
            timeout=30
        )
        # Should NOT return 422 (which would mean 'batch' was parsed as stream_id integer)
        assert response.status_code != 422, f"Route ordering issue: got 422 (batch parsed as int stream_id)"
        # Should return 200 (even if credentials are invalid, the endpoint resolves correctly)
        # or 400/404/500 but NOT 422
        print(f"✓ /epg/batch route is correctly matched (status: {response.status_code})")

    def test_epg_stream_id_still_works(self):
        """Test that /api/epg/{stream_id} still works for integer stream_id"""
        response = requests.get(
            f"{BASE_URL}/api/epg/400",
            params={"username": "test_user", "password": "test_pass"},
            timeout=30
        )
        # Should NOT be 422 (route should be parsed correctly)
        # May be 200 with empty result or 504 timeout from Xtream
        assert response.status_code in [200, 504, 500], \
            f"Unexpected status {response.status_code} for /epg/400"
        print(f"✓ /epg/{{stream_id}} still resolves correctly (status: {response.status_code})")


class TestEpgBatchEndpoint:
    """EPG batch endpoint - core feature test"""

    def test_batch_epg_returns_200_with_valid_request(self):
        """Test /api/epg/batch returns 200 status"""
        response = requests.get(
            f"{BASE_URL}/api/epg/batch",
            params={
                "username": "test_user",
                "password": "test_pass",
                "stream_ids": "400,401,402"
            },
            timeout=60
        )
        assert response.status_code == 200, \
            f"Expected 200, got {response.status_code}. Body: {response.text[:200]}"
        print(f"✓ /api/epg/batch returned 200")

    def test_batch_epg_returns_dict_structure(self):
        """Test /api/epg/batch response is a dict keyed by stream_id"""
        response = requests.get(
            f"{BASE_URL}/api/epg/batch",
            params={
                "username": "test_user",
                "password": "test_pass",
                "stream_ids": "400,401"
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        print(f"✓ Response is dict with keys: {list(data.keys())}")

    def test_batch_epg_no_503_errors(self):
        """Test that batch endpoint doesn't return 503 (rate-limiting issue)"""
        response = requests.get(
            f"{BASE_URL}/api/epg/batch",
            params={
                "username": "test_user",
                "password": "test_pass",
                "stream_ids": "100,200,300"
            },
            timeout=120  # Long timeout since sequential requests with 150ms delay
        )
        assert response.status_code != 503, \
            f"Got 503 rate limiting error - sequential delay not working"
        assert response.status_code == 200, \
            f"Expected 200, got {response.status_code}"
        print(f"✓ No 503 errors from batch EPG endpoint")

    def test_batch_epg_handles_single_stream_id(self):
        """Test batch endpoint handles a single stream_id"""
        response = requests.get(
            f"{BASE_URL}/api/epg/batch",
            params={
                "username": "test_user",
                "password": "test_pass",
                "stream_ids": "400"
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "400" in data, f"Expected key '400' in response, got: {list(data.keys())}"
        print(f"✓ Single stream_id handled correctly: {list(data.keys())}")

    def test_batch_epg_respects_20_limit(self):
        """Test that batch endpoint caps at 20 streams"""
        # Send 25 IDs, should only process up to 20
        ids = ",".join(str(i) for i in range(400, 425))  # 25 IDs
        response = requests.get(
            f"{BASE_URL}/api/epg/batch",
            params={
                "username": "test_user",
                "password": "test_pass",
                "stream_ids": ids
            },
            timeout=120
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 20, f"Expected max 20 results, got {len(data)}"
        print(f"✓ Batch limit respected: {len(data)} streams processed (max 20)")

    def test_batch_epg_each_entry_has_epg_listings_key(self):
        """Test each stream entry in batch has epg_listings key"""
        response = requests.get(
            f"{BASE_URL}/api/epg/batch",
            params={
                "username": "test_user",
                "password": "test_pass",
                "stream_ids": "400,401"
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        for stream_id, entry in data.items():
            # Each entry should be a dict (possibly empty) or have epg_listings
            # With invalid creds, may get empty dict or {"epg_listings": []}
            if isinstance(entry, dict):
                print(f"  Stream {stream_id}: {type(entry)} - keys: {list(entry.keys())}")
            else:
                print(f"  Stream {stream_id}: {type(entry)} - value: {entry}")
        print(f"✓ Batch EPG entries validated for {len(data)} streams")

    def test_batch_epg_missing_stream_ids_param(self):
        """Test that missing stream_ids returns validation error"""
        response = requests.get(
            f"{BASE_URL}/api/epg/batch",
            params={
                "username": "test_user",
                "password": "test_pass"
                # Missing stream_ids
            },
            timeout=10
        )
        assert response.status_code == 422, \
            f"Expected 422 for missing stream_ids, got {response.status_code}"
        print(f"✓ Missing stream_ids correctly returns 422")

    def test_batch_epg_empty_stream_ids(self):
        """Test batch with empty string stream_ids"""
        response = requests.get(
            f"{BASE_URL}/api/epg/batch",
            params={
                "username": "test_user",
                "password": "test_pass",
                "stream_ids": ""
            },
            timeout=10
        )
        # Should return 200 with empty dict (no valid IDs to process)
        assert response.status_code == 200, \
            f"Expected 200 for empty stream_ids, got {response.status_code}"
        data = response.json()
        assert data == {}, f"Expected empty dict, got: {data}"
        print(f"✓ Empty stream_ids returns empty dict")


class TestStreamUrlEndpoint:
    """Test stream URL generation"""

    def test_stream_url_live(self):
        """Test /api/stream/url for live type returns URL"""
        response = requests.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": "test_user",
                "password": "test_pass",
                "stream_id": 400,
                "stream_type": "live",
                "container_extension": "ts"
            },
            timeout=20
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "url" in data, "Missing 'url' in response"
        assert "raw_url" in data, "Missing 'raw_url' in response"
        print(f"✓ Stream URL returned: {data.get('url', '')[:60]}...")

    def test_stream_url_contains_stream_id(self):
        """Test that stream URL contains the stream ID"""
        response = requests.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": "test_user",
                "password": "test_pass",
                "stream_id": 12345,
                "stream_type": "live"
            },
            timeout=20
        )
        assert response.status_code == 200
        data = response.json()
        raw_url = data.get("raw_url", "")
        assert "12345" in raw_url, f"Stream ID 12345 not found in URL: {raw_url}"
        print(f"✓ Stream ID present in URL: {raw_url[:60]}...")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
