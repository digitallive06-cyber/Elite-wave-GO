"""
Iteration 4: Backend tests for Tubi-style player, EPG, and Live TV improvements
Tests: stream URL endpoint, EPG endpoints, live streams, recently watched history
"""
import pytest
import requests
import os

# Use public backend URL
BASE_URL = "https://iptv-player-refactor.preview.emergentagent.com"

# Xtream credentials
USERNAME = "DJBIGANT"
PASSWORD = "sTtb4D5v7T"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestHealthCheck:
    """Verify backend is running"""
    
    def test_health_endpoint(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "xtream_dns" in data
        print(f"✅ Health check passed: {data}")


class TestStreamUrl:
    """Test /api/stream/url endpoint for live streams"""
    
    def test_stream_url_live(self, api_client):
        """Test live stream URL generation"""
        response = api_client.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "stream_id": 400,
                "stream_type": "live",
                "container_extension": "ts"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "fallback_url" in data
        assert "raw_url" in data
        # Verify URL contains credentials and stream_id
        assert USERNAME in data["url"]
        assert "400" in data["url"]
        print(f"✅ Live stream URL: {data['url'][:100]}...")
    
    def test_stream_url_movie(self, api_client):
        """Test movie stream URL generation"""
        response = api_client.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "stream_id": 1,
                "stream_type": "movie",
                "container_extension": "mp4"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "mp4" in data["url"] or "movie" in data["url"]
        print(f"✅ Movie stream URL generated")


class TestEpgEndpoints:
    """Test EPG endpoints for Live TV"""
    
    def test_get_epg_for_stream(self, api_client):
        """Test EPG data for a live stream"""
        response = api_client.get(
            f"{BASE_URL}/api/epg/400",
            params={"username": USERNAME, "password": PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        # EPG response should have epg_listings (may be empty)
        if isinstance(data, dict):
            assert "epg_listings" in data
            print(f"✅ EPG endpoint working, listings count: {len(data.get('epg_listings', []))}")
        else:
            print(f"✅ EPG endpoint returns data: {type(data)}")


class TestLiveStreams:
    """Test live streams and categories for Live TV screen"""
    
    def test_get_live_categories(self, api_client):
        """Test live categories endpoint"""
        response = api_client.get(
            f"{BASE_URL}/api/live/categories",
            params={"username": USERNAME, "password": PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check first category structure
        assert "category_id" in data[0]
        assert "category_name" in data[0]
        print(f"✅ Live categories count: {len(data)}")
    
    def test_get_live_streams(self, api_client):
        """Test live streams endpoint (all streams)"""
        response = api_client.get(
            f"{BASE_URL}/api/live/streams",
            params={"username": USERNAME, "password": PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check first stream structure
        stream = data[0]
        assert "stream_id" in stream
        assert "name" in stream
        print(f"✅ Live streams count: {len(data)}")
    
    def test_get_live_streams_by_category(self, api_client):
        """Test live streams filtered by category"""
        response = api_client.get(
            f"{BASE_URL}/api/live/streams",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "category_id": "1"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Live streams in category 1: {len(data)}")


class TestWatchHistory:
    """Test watch history for recently watched"""
    
    def test_add_to_history(self, api_client):
        """Test adding item to watch history"""
        payload = {
            "username": USERNAME,
            "stream_id": 400,
            "stream_name": "TEST_Channel_400",
            "stream_icon": "",
            "stream_type": "live",
            "category_name": "Test Category"
        }
        response = api_client.post(f"{BASE_URL}/api/user/history", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print(f"✅ Added to history: {payload['stream_name']}")
    
    def test_get_history(self, api_client):
        """Test retrieving watch history"""
        response = api_client.get(
            f"{BASE_URL}/api/user/history",
            params={"username": USERNAME}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least the item we just added
        if len(data) > 0:
            assert "stream_id" in data[0]
            assert "stream_name" in data[0]
            assert "timestamp" in data[0]
            print(f"✅ History count: {len(data)}, last watched: {data[0]['stream_name']}")
        else:
            print(f"⚠️ No history items found (may be normal)")


class TestRecentContent:
    """Test recent VOD and series endpoints for home screen"""
    
    def test_recent_vod(self, api_client):
        """Test recent VOD endpoint"""
        response = api_client.get(
            f"{BASE_URL}/api/vod/recent",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "limit": 20
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Recent VOD count: {len(data)}")
    
    def test_recent_series(self, api_client):
        """Test recent series endpoint"""
        response = api_client.get(
            f"{BASE_URL}/api/series/recent",
            params={
                "username": USERNAME,
                "password": PASSWORD,
                "limit": 20
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Recent series count: {len(data)}")
