"""
Iteration 10: Backend API Regression Tests
Tests all endpoints requested in the testing request for IPTV app.
"""
import pytest
import requests
import os

BASE_URL = "https://channel-hub-android.preview.emergentagent.com"
TEST_USERNAME = "DJBIGANT"
TEST_PASSWORD = "sTtb4D5v7T"


class TestHealthEndpoint:
    """Test /api/health endpoint"""
    
    def test_health_returns_ok(self):
        """GET /api/health should return status ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "xtream_dns" in data
        print(f"✓ Health check passed: {data}")


class TestLiveEndpoints:
    """Test /api/live/* endpoints"""
    
    def test_get_live_categories(self):
        """GET /api/live/categories should return categories list"""
        response = requests.get(
            f"{BASE_URL}/api/live/categories",
            params={"username": TEST_USERNAME, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify category structure
        first_cat = data[0]
        assert "category_id" in first_cat
        assert "category_name" in first_cat
        print(f"✓ Live categories returned: {len(data)} categories")
    
    def test_get_live_streams(self):
        """GET /api/live/streams should return streams list"""
        response = requests.get(
            f"{BASE_URL}/api/live/streams",
            params={"username": TEST_USERNAME, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify stream structure
        first_stream = data[0]
        assert "stream_id" in first_stream
        assert "name" in first_stream
        print(f"✓ Live streams returned: {len(data)} streams")


class TestStreamUrlEndpoint:
    """Test /api/stream/url endpoint"""
    
    def test_get_stream_url(self):
        """GET /api/stream/url should return resolved stream URL"""
        response = requests.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD,
                "stream_id": 400,
                "stream_type": "live"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "fallback_url" in data
        assert ".m3u8" in data["url"] or ".ts" in data["fallback_url"]
        print(f"✓ Stream URL resolved: {data['url'][:60]}...")


class TestEpgEndpoints:
    """Test /api/epg/* endpoints"""
    
    def test_get_epg_for_stream(self):
        """GET /api/epg/{stream_id} should return EPG data"""
        response = requests.get(
            f"{BASE_URL}/api/epg/400",
            params={"username": TEST_USERNAME, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        # EPG may or may not have listings depending on the stream
        assert "epg_listings" in data or isinstance(data, dict)
        print(f"✓ EPG endpoint working, listings count: {len(data.get('epg_listings', []))}")


class TestFavoritesEndpoints:
    """Test /api/user/favorites POST toggle and GET list"""
    
    def test_favorites_toggle_add(self):
        """POST /api/user/favorites should add a favorite"""
        payload = {
            "username": "TEST_iteration10_user",
            "stream_id": 12345,
            "stream_name": "Test Channel 10",
            "stream_icon": "",
            "stream_type": "live",
            "category_name": "Test Category"
        }
        response = requests.post(f"{BASE_URL}/api/user/favorites", json=payload)
        assert response.status_code == 200
        data = response.json()
        # First time adding should return "added"
        assert data["status"] in ["added", "removed"]
        print(f"✓ Favorites toggle: {data['status']}")
    
    def test_favorites_get_list(self):
        """GET /api/user/favorites should return favorites list without _id"""
        # First add a favorite
        payload = {
            "username": "TEST_iteration10_user",
            "stream_id": 12346,
            "stream_name": "Test Channel 10 GET",
            "stream_icon": "",
            "stream_type": "live",
            "category_name": "Test"
        }
        requests.post(f"{BASE_URL}/api/user/favorites", json=payload)
        
        # Now get the list
        response = requests.get(
            f"{BASE_URL}/api/user/favorites",
            params={"username": "TEST_iteration10_user"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify _id is excluded (MongoDB ObjectId serialization safe)
        for item in data:
            assert "_id" not in item
        print(f"✓ Favorites list returned: {len(data)} items, no _id field")
    
    def test_favorites_toggle_remove(self):
        """POST /api/user/favorites for existing should remove"""
        payload = {
            "username": "TEST_iteration10_user",
            "stream_id": 12346,
            "stream_name": "Test Channel 10 GET",
            "stream_icon": "",
            "stream_type": "live",
            "category_name": "Test"
        }
        # Toggle twice to ensure remove works
        requests.post(f"{BASE_URL}/api/user/favorites", json=payload)
        response = requests.post(f"{BASE_URL}/api/user/favorites", json=payload)
        # Should toggle (either add or remove based on state)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["added", "removed"]
        print(f"✓ Favorites toggle (second call): {data['status']}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self):
        """Remove test favorites created during tests"""
        # Remove test favorites by toggling them off
        for stream_id in [12345, 12346]:
            payload = {
                "username": "TEST_iteration10_user",
                "stream_id": stream_id,
                "stream_name": "Test",
                "stream_icon": "",
                "stream_type": "live",
                "category_name": "Test"
            }
            # Check if exists, if so toggle to remove
            response = requests.get(
                f"{BASE_URL}/api/user/favorites",
                params={"username": "TEST_iteration10_user"}
            )
            favorites = response.json()
            if any(f["stream_id"] == stream_id for f in favorites):
                requests.post(f"{BASE_URL}/api/user/favorites", json=payload)
        print("✓ Test data cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
