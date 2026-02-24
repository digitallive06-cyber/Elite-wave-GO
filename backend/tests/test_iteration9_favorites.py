"""
Iteration 9: Backend API Tests for Favorites System and Related Endpoints
Tests: /api/user/favorites (POST toggle, GET list), /api/user/history, /api/stream/url, /api/epg/batch, /api/health
"""

import pytest
import requests
import os
from pathlib import Path
from dotenv import load_dotenv
import uuid

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
if frontend_env.exists():
    load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://xtream-codes-app-1.preview.emergentagent.com')

# Test username (unique per test run to avoid conflicts)
TEST_USERNAME = f"TEST_user_{uuid.uuid4().hex[:8]}"


class TestHealthEndpoint:
    """Health check endpoint tests"""

    def test_health_endpoint_returns_200(self):
        """Test /api/health returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "status" in data, "Response missing 'status' field"
        assert data["status"] == "ok", f"Expected status 'ok', got {data.get('status')}"
        assert "xtream_dns" in data, "Response missing 'xtream_dns' field"
        print(f"✓ Health endpoint OK: {data}")


class TestFavoritesEndpoint:
    """Favorites CRUD tests - POST toggle and GET list"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test username"""
        self.username = TEST_USERNAME
        yield
        # Cleanup: remove test favorites after tests
        try:
            # Get all favorites for cleanup
            response = requests.get(f"{BASE_URL}/api/user/favorites", params={"username": self.username})
            if response.status_code == 200:
                favorites = response.json()
                for fav in favorites:
                    # Toggle (remove) each favorite
                    requests.post(
                        f"{BASE_URL}/api/user/favorites",
                        json={
                            "username": self.username,
                            "stream_id": fav.get("stream_id"),
                            "stream_name": fav.get("stream_name", "cleanup"),
                            "stream_icon": "",
                            "stream_type": "live",
                            "category_name": ""
                        }
                    )
        except Exception as e:
            print(f"Cleanup error (non-critical): {e}")

    def test_favorites_add_returns_added_status(self):
        """Test POST /api/user/favorites adds a favorite and returns 'added' status"""
        payload = {
            "username": self.username,
            "stream_id": 12345,
            "stream_name": "TEST Channel 1",
            "stream_icon": "https://example.com/icon.png",
            "stream_type": "live",
            "category_name": "Test Category"
        }
        response = requests.post(f"{BASE_URL}/api/user/favorites", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "status" in data, "Response missing 'status' field"
        assert data["status"] == "added", f"Expected status 'added', got {data.get('status')}"
        print(f"✓ Favorites POST (add) returned: {data}")

    def test_favorites_toggle_removes_on_second_call(self):
        """Test POST /api/user/favorites toggles (removes) on second call"""
        payload = {
            "username": self.username,
            "stream_id": 11111,
            "stream_name": "TEST Toggle Channel",
            "stream_icon": "",
            "stream_type": "live",
            "category_name": ""
        }
        # First call - should add
        response1 = requests.post(f"{BASE_URL}/api/user/favorites", json=payload)
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["status"] == "added", f"First call should add, got {data1.get('status')}"
        print(f"✓ First toggle: {data1}")
        
        # Second call - should remove
        response2 = requests.post(f"{BASE_URL}/api/user/favorites", json=payload)
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["status"] == "removed", f"Second call should remove, got {data2.get('status')}"
        print(f"✓ Second toggle: {data2}")

    def test_favorites_get_returns_list(self):
        """Test GET /api/user/favorites returns list of favorites"""
        # First add a favorite
        payload = {
            "username": self.username,
            "stream_id": 22222,
            "stream_name": "TEST Get List Channel",
            "stream_icon": "https://example.com/icon2.png",
            "stream_type": "live",
            "category_name": "Sports"
        }
        requests.post(f"{BASE_URL}/api/user/favorites", json=payload)
        
        # Then get favorites
        response = requests.get(f"{BASE_URL}/api/user/favorites", params={"username": self.username})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), f"Expected list response, got {type(data)}"
        print(f"✓ Favorites GET returned {len(data)} item(s)")
        
        # Verify the added favorite is in the list
        stream_ids = [f.get("stream_id") for f in data]
        assert 22222 in stream_ids, f"Added stream_id 22222 not found in favorites list"
        print(f"✓ Favorite verified in list: stream_id 22222 present")

    def test_favorites_no_mongodb_id_in_response(self):
        """Test that _id is excluded from favorites response (MongoDB ObjectId not serializable)"""
        # Add a favorite
        payload = {
            "username": self.username,
            "stream_id": 33333,
            "stream_name": "TEST ID Check Channel",
            "stream_icon": "",
            "stream_type": "live",
            "category_name": ""
        }
        requests.post(f"{BASE_URL}/api/user/favorites", json=payload)
        
        # Get favorites
        response = requests.get(f"{BASE_URL}/api/user/favorites", params={"username": self.username})
        assert response.status_code == 200
        data = response.json()
        
        # Check that no item has _id field
        for item in data:
            assert "_id" not in item, f"MongoDB _id found in response item: {item}"
        print(f"✓ No MongoDB _id in favorites response - correctly excluded")

    def test_favorites_get_empty_for_unknown_user(self):
        """Test GET /api/user/favorites returns empty list for unknown user"""
        unknown_user = f"unknown_user_{uuid.uuid4().hex}"
        response = requests.get(f"{BASE_URL}/api/user/favorites", params={"username": unknown_user})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), f"Expected list response, got {type(data)}"
        assert len(data) == 0, f"Expected empty list for unknown user, got {len(data)} items"
        print(f"✓ Favorites GET for unknown user returned empty list")

    def test_favorites_persistence_add_then_get(self):
        """Test that favorites are persisted in database: add → GET verification"""
        payload = {
            "username": self.username,
            "stream_id": 44444,
            "stream_name": "TEST Persistence Channel",
            "stream_icon": "https://example.com/icon3.png",
            "stream_type": "live",
            "category_name": "Movies"
        }
        
        # Add favorite
        add_response = requests.post(f"{BASE_URL}/api/user/favorites", json=payload)
        assert add_response.status_code == 200
        assert add_response.json()["status"] == "added"
        
        # Verify via GET
        get_response = requests.get(f"{BASE_URL}/api/user/favorites", params={"username": self.username})
        assert get_response.status_code == 200
        favorites = get_response.json()
        
        # Find the added favorite
        found = None
        for fav in favorites:
            if fav.get("stream_id") == 44444:
                found = fav
                break
        
        assert found is not None, "Added favorite not found in GET response"
        assert found["stream_name"] == payload["stream_name"], "stream_name mismatch"
        assert found["stream_type"] == payload["stream_type"], "stream_type mismatch"
        assert found["category_name"] == payload["category_name"], "category_name mismatch"
        print(f"✓ Favorite persisted and retrieved correctly: {found}")


class TestHistoryEndpoint:
    """Watch history CRUD tests"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test username"""
        self.username = f"TEST_history_{uuid.uuid4().hex[:8]}"
        yield
        # Cleanup: clear test user history
        try:
            requests.delete(f"{BASE_URL}/api/user/history", params={"username": self.username})
        except Exception:
            pass

    def test_history_add_returns_ok(self):
        """Test POST /api/user/history adds history item"""
        payload = {
            "username": self.username,
            "stream_id": 99999,
            "stream_name": "TEST History Channel",
            "stream_icon": "",
            "stream_type": "live",
            "category_name": "Test"
        }
        response = requests.post(f"{BASE_URL}/api/user/history", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "ok", f"Expected status 'ok', got {data}"
        print(f"✓ History POST returned: {data}")

    def test_history_get_returns_list(self):
        """Test GET /api/user/history returns history list"""
        # Add a history item
        payload = {
            "username": self.username,
            "stream_id": 88888,
            "stream_name": "TEST Get History Channel",
            "stream_icon": "",
            "stream_type": "live",
            "category_name": ""
        }
        requests.post(f"{BASE_URL}/api/user/history", json=payload)
        
        # Get history
        response = requests.get(f"{BASE_URL}/api/user/history", params={"username": self.username})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ History GET returned {len(data)} item(s)")
        
        # Verify the item is present
        stream_ids = [h.get("stream_id") for h in data]
        assert 88888 in stream_ids, "Added history item not found"
        print(f"✓ History item verified in list")

    def test_history_no_mongodb_id_in_response(self):
        """Test that _id is excluded from history response"""
        # Add a history item
        payload = {
            "username": self.username,
            "stream_id": 77777,
            "stream_name": "TEST ID Check History",
            "stream_icon": "",
            "stream_type": "live",
            "category_name": ""
        }
        requests.post(f"{BASE_URL}/api/user/history", json=payload)
        
        # Get history
        response = requests.get(f"{BASE_URL}/api/user/history", params={"username": self.username})
        assert response.status_code == 200
        data = response.json()
        
        for item in data:
            assert "_id" not in item, f"MongoDB _id found in history response: {item}"
        print(f"✓ No MongoDB _id in history response - correctly excluded")

    def test_history_upsert_updates_existing(self):
        """Test that adding same stream_id updates timestamp (upsert behavior)"""
        payload = {
            "username": self.username,
            "stream_id": 66666,
            "stream_name": "TEST Upsert Channel",
            "stream_icon": "",
            "stream_type": "live",
            "category_name": ""
        }
        
        # Add first time
        requests.post(f"{BASE_URL}/api/user/history", json=payload)
        
        # Add second time (should upsert/update)
        requests.post(f"{BASE_URL}/api/user/history", json=payload)
        
        # Get history - should have only 1 entry for this stream_id
        response = requests.get(f"{BASE_URL}/api/user/history", params={"username": self.username})
        data = response.json()
        
        count_66666 = sum(1 for h in data if h.get("stream_id") == 66666)
        assert count_66666 == 1, f"Expected 1 entry after upsert, got {count_66666}"
        print(f"✓ History upsert working - only 1 entry for duplicate stream_id")


class TestStreamUrlEndpoint:
    """Stream URL generation tests"""

    def test_stream_url_live_returns_urls(self):
        """Test GET /api/stream/url generates live stream URLs"""
        params = {
            "username": "testuser",
            "password": "testpass",
            "stream_id": 12345,
            "stream_type": "live"
        }
        response = requests.get(f"{BASE_URL}/api/stream/url", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "url" in data, "Response missing 'url' field"
        assert "fallback_url" in data, "Response missing 'fallback_url' field"
        assert "raw_url" in data, "Response missing 'raw_url' field"
        
        # Verify URLs contain expected components
        assert "12345" in data["url"], "stream_id not in URL"
        assert "testuser" in data["url"], "username not in URL"
        print(f"✓ Stream URL generated: {data['url'][:80]}...")

    def test_stream_url_movie_type(self):
        """Test GET /api/stream/url with movie stream type"""
        params = {
            "username": "testuser",
            "password": "testpass",
            "stream_id": 54321,
            "stream_type": "movie",
            "container_extension": "mp4"
        }
        response = requests.get(f"{BASE_URL}/api/stream/url", params=params)
        assert response.status_code == 200
        data = response.json()
        
        assert "/movie/" in data["raw_url"], "movie path not in URL"
        assert ".mp4" in data["raw_url"], "mp4 extension not in URL"
        print(f"✓ Movie stream URL: {data['raw_url']}")

    def test_stream_url_series_type(self):
        """Test GET /api/stream/url with series stream type"""
        params = {
            "username": "testuser",
            "password": "testpass",
            "stream_id": 67890,
            "stream_type": "series",
            "container_extension": "mkv"
        }
        response = requests.get(f"{BASE_URL}/api/stream/url", params=params)
        assert response.status_code == 200
        data = response.json()
        
        assert "/series/" in data["raw_url"], "series path not in URL"
        assert ".mkv" in data["raw_url"], "mkv extension not in URL"
        print(f"✓ Series stream URL: {data['raw_url']}")


class TestBatchEpgEndpoint:
    """Batch EPG endpoint tests"""

    def test_batch_epg_returns_dict(self):
        """Test GET /api/epg/batch returns dictionary keyed by stream_id"""
        params = {
            "username": "testuser",
            "password": "testpass",
            "stream_ids": "1,2,3"
        }
        response = requests.get(f"{BASE_URL}/api/epg/batch", params=params)
        # May return 200 or 504 depending on Xtream API availability
        if response.status_code == 504:
            pytest.skip("Xtream server timeout - skipping EPG batch test")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert isinstance(data, dict), f"Expected dict response, got {type(data)}"
        # Should have keys for each requested stream_id
        assert "1" in data or "2" in data or "3" in data, "No stream_id keys in response"
        print(f"✓ Batch EPG returned dict with {len(data)} stream(s)")

    def test_batch_epg_limits_to_20_streams(self):
        """Test that batch EPG limits to 20 streams max"""
        # Request 25 streams - should only process 20
        stream_ids = ",".join(str(i) for i in range(1, 26))
        params = {
            "username": "testuser",
            "password": "testpass",
            "stream_ids": stream_ids
        }
        response = requests.get(f"{BASE_URL}/api/epg/batch", params=params)
        if response.status_code == 504:
            pytest.skip("Xtream server timeout")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have at most 20 keys
        assert len(data) <= 20, f"Expected max 20 streams, got {len(data)}"
        print(f"✓ Batch EPG correctly limited to {len(data)} streams (max 20)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
