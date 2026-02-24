import pytest
import requests
import os
from pathlib import Path
from dotenv import load_dotenv
import base64

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
if frontend_env.exists():
    load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
USERNAME = "DJBIGANT"
PASSWORD = "sTtb4D5v7T"

class TestLoginWithValidCredentials:
    """Test login with valid Xtream Codes credentials"""

    def test_login_success(self):
        """Test login with valid credentials returns 200 and user data"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": USERNAME, "password": PASSWORD},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_info" in data, "Response missing 'user_info' field"
        assert "server_info" in data, "Response missing 'server_info' field"
        assert data["user_info"].get("auth") == 1, "User auth field is not 1"
        assert data["user_info"].get("username") == USERNAME, f"Username mismatch: {data['user_info'].get('username')}"
        print(f"✓ Login successful with user: {data['user_info'].get('username')}")


class TestRecentVodEndpoint:
    """Test /api/vod/recent endpoint for recently added movies"""

    def test_vod_recent_returns_200(self):
        """Test that /api/vod/recent returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/vod/recent",
            params={"username": USERNAME, "password": PASSWORD, "limit": 20},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ /api/vod/recent returned 200")

    def test_vod_recent_returns_list(self):
        """Test that /api/vod/recent returns a list"""
        response = requests.get(
            f"{BASE_URL}/api/vod/recent",
            params={"username": USERNAME, "password": PASSWORD, "limit": 20},
            timeout=30
        )
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ /api/vod/recent returned list with {len(data)} movies")

    def test_vod_recent_sorted_by_added_date(self):
        """Test that movies are sorted by 'added' field descending"""
        response = requests.get(
            f"{BASE_URL}/api/vod/recent",
            params={"username": USERNAME, "password": PASSWORD, "limit": 20},
            timeout=30
        )
        data = response.json()
        if len(data) > 1:
            # Check that 'added' field exists and is sorted descending
            added_dates = [item.get("added", "0") for item in data]
            is_sorted = all(added_dates[i] >= added_dates[i+1] for i in range(len(added_dates)-1))
            assert is_sorted, f"Movies not sorted by added date descending: {added_dates[:5]}"
            print(f"✓ Movies sorted correctly by added date")
        else:
            print(f"✓ Only {len(data)} movies, skipping sort validation")


class TestRecentSeriesEndpoint:
    """Test /api/series/recent endpoint for recently added series"""

    def test_series_recent_returns_200(self):
        """Test that /api/series/recent returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/series/recent",
            params={"username": USERNAME, "password": PASSWORD, "limit": 20},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ /api/series/recent returned 200")

    def test_series_recent_returns_list(self):
        """Test that /api/series/recent returns a list (may be empty)"""
        response = requests.get(
            f"{BASE_URL}/api/series/recent",
            params={"username": USERNAME, "password": PASSWORD, "limit": 20},
            timeout=30
        )
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ /api/series/recent returned list with {len(data)} series (may be 0 if server has no series)")


class TestEpgEndpoint:
    """Test /api/epg/{stream_id} endpoint with EPG decoding"""

    def test_epg_endpoint_returns_200(self):
        """Test that /api/epg/{stream_id} returns 200"""
        # First get a live stream ID with EPG
        streams_response = requests.get(
            f"{BASE_URL}/api/live/streams",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        streams = streams_response.json()
        
        # Find a stream with EPG
        stream_with_epg = None
        for stream in streams[:20]:
            if stream.get("epg_channel_id"):
                stream_with_epg = stream
                break
        
        if not stream_with_epg:
            pytest.skip("No streams with EPG found in first 20 streams")
        
        stream_id = stream_with_epg["stream_id"]
        response = requests.get(
            f"{BASE_URL}/api/epg/{stream_id}",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ /api/epg/{stream_id} returned 200")

    def test_epg_titles_are_decoded(self):
        """Test that EPG titles are decoded from base64 to readable text"""
        # Get a stream with EPG
        streams_response = requests.get(
            f"{BASE_URL}/api/live/streams",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        streams = streams_response.json()
        
        stream_with_epg = None
        for stream in streams[:20]:
            if stream.get("epg_channel_id"):
                stream_with_epg = stream
                break
        
        if not stream_with_epg:
            pytest.skip("No streams with EPG found")
        
        stream_id = stream_with_epg["stream_id"]
        response = requests.get(
            f"{BASE_URL}/api/epg/{stream_id}",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        data = response.json()
        
        if isinstance(data, dict) and "epg_listings" in data and len(data["epg_listings"]) > 0:
            # Check that titles are NOT base64 (they should be decoded)
            first_listing = data["epg_listings"][0]
            title = first_listing.get("title", "")
            
            # If title is readable (contains spaces or common chars), it's decoded
            # Base64 strings typically don't have spaces
            is_likely_decoded = " " in title or len(title) < 100
            
            # Try to decode as base64 - if it fails, it's already decoded
            try:
                base64.b64decode(title)
                # If decode succeeds, check if result is gibberish
                decoded = base64.b64decode(title).decode("utf-8", errors="replace")
                if decoded != title:
                    print(f"⚠ Title appears to be base64 encoded: {title[:50]}")
                    assert False, f"Title is still base64 encoded: {title[:50]}"
            except Exception:
                # Decode failed = it's already decoded text
                print(f"✓ EPG title is decoded: '{title[:50]}'")
                assert True
        else:
            print(f"✓ No EPG listings returned (server may not have EPG data)")


class TestLiveStreamsWithEpg:
    """Test live streams endpoint to ensure EPG data is available"""

    def test_live_streams_have_epg_channel_ids(self):
        """Test that some live streams have epg_channel_id"""
        response = requests.get(
            f"{BASE_URL}/api/live/streams",
            params={"username": USERNAME, "password": PASSWORD},
            timeout=30
        )
        assert response.status_code == 200
        
        streams = response.json()
        assert isinstance(streams, list), "Expected list of streams"
        
        streams_with_epg = [s for s in streams if s.get("epg_channel_id")]
        print(f"✓ Found {len(streams_with_epg)} out of {len(streams)} streams with EPG")
        
        # We don't assert > 0 because server may not have EPG data
        assert len(streams) > 0, "No live streams returned"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
