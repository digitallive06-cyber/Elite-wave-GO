"""
Iteration 14: Home Screen Hero Card & Live TV Navigation Flow Verification
Tests:
1. Backend API endpoints (/api/health, /api/live/categories, /api/live/streams, /api/stream/url, /api/epg/batch, /api/user/history, /api/user/favorites)
2. Code structure verification for home.tsx, live.tsx, GlobalVideoPlayer.tsx
"""
import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackendAPIs:
    """Backend API endpoint tests - verify all required endpoints respond correctly"""
    
    def test_health_endpoint(self):
        """Test /api/health returns status ok"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        assert "xtream_dns" in data
        print(f"Health check passed: {data}")

    def test_live_categories_endpoint(self):
        """Test /api/live/categories responds (returns empty array without valid credentials)"""
        response = requests.get(f"{BASE_URL}/api/live/categories", 
                              params={"username": "test", "password": "test"}, timeout=10)
        # Should return 200 even with invalid credentials (empty array)
        assert response.status_code == 200
        data = response.json()
        # Returns empty array for invalid credentials - that's expected
        assert isinstance(data, list)
        print(f"Live categories endpoint responded: {len(data)} categories")

    def test_live_streams_endpoint(self):
        """Test /api/live/streams responds correctly"""
        response = requests.get(f"{BASE_URL}/api/live/streams",
                              params={"username": "test", "password": "test"}, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Live streams endpoint responded: {len(data)} streams")

    def test_stream_url_endpoint(self):
        """Test /api/stream/url generates stream URLs"""
        response = requests.get(f"{BASE_URL}/api/stream/url",
                              params={
                                  "username": "test",
                                  "password": "test", 
                                  "stream_id": 12345,
                                  "stream_type": "live"
                              }, timeout=15)
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "fallback_url" in data
        print(f"Stream URL endpoint responded: {data.get('url', '')[:50]}...")

    def test_epg_batch_endpoint(self):
        """Test /api/epg/batch endpoint responds correctly"""
        response = requests.get(f"{BASE_URL}/api/epg/batch",
                              params={
                                  "username": "test",
                                  "password": "test",
                                  "stream_ids": "123,456,789"
                              }, timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"EPG batch endpoint responded: {len(data)} entries")

    def test_user_history_post_endpoint(self):
        """Test POST /api/user/history endpoint"""
        response = requests.post(f"{BASE_URL}/api/user/history",
                               json={
                                   "username": "TEST_iteration14",
                                   "stream_id": 99999,
                                   "stream_name": "Test Channel",
                                   "stream_icon": "",
                                   "stream_type": "live",
                                   "category_name": "Test"
                               }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"History POST endpoint passed: {data}")

    def test_user_history_get_endpoint(self):
        """Test GET /api/user/history endpoint"""
        response = requests.get(f"{BASE_URL}/api/user/history",
                              params={"username": "TEST_iteration14"}, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least one entry from our POST test
        assert len(data) >= 1
        assert data[0].get("stream_id") == 99999
        print(f"History GET endpoint passed: {len(data)} entries")

    def test_user_favorites_post_endpoint(self):
        """Test POST /api/user/favorites endpoint (toggle add)"""
        response = requests.post(f"{BASE_URL}/api/user/favorites",
                               json={
                                   "username": "TEST_iteration14",
                                   "stream_id": 88888,
                                   "stream_name": "Test Favorite",
                                   "stream_icon": "",
                                   "stream_type": "live",
                                   "category_name": "Test"
                               }, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") in ["added", "removed"]
        print(f"Favorites POST endpoint passed: {data}")

    def test_user_favorites_get_endpoint(self):
        """Test GET /api/user/favorites endpoint"""
        response = requests.get(f"{BASE_URL}/api/user/favorites",
                              params={"username": "TEST_iteration14"}, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Favorites GET endpoint passed: {len(data)} entries")


class TestHomeScreenCodeStructure:
    """Verify home.tsx has correct code structure for hero card feature"""

    def test_home_uses_linear_gradient(self):
        """Verify home.tsx imports and uses LinearGradient for hero card"""
        with open("/app/frontend/app/(tabs)/home.tsx", "r") as f:
            content = f.read()
        
        # Check import
        assert "import { LinearGradient } from 'expo-linear-gradient'" in content, \
            "home.tsx should import LinearGradient"
        
        # Check usage in hero card
        assert "<LinearGradient" in content, "home.tsx should use LinearGradient component"
        print("PASS: home.tsx imports and uses LinearGradient")

    def test_home_hero_card_has_live_badge(self):
        """Verify hero card has LIVE badge with red background"""
        with open("/app/frontend/app/(tabs)/home.tsx", "r") as f:
            content = f.read()
        
        # Check for LIVE badge structure
        assert "heroLiveBadge" in content, "home.tsx should have heroLiveBadge style"
        assert "heroLiveText" in content, "home.tsx should have heroLiveText style"
        assert ">LIVE<" in content, "home.tsx should render LIVE text"
        
        # Check for red badge color (#E50914 is Netflix red)
        assert "#E50914" in content or "E50914" in content, \
            "home.tsx should have red color for LIVE badge"
        print("PASS: home.tsx has LIVE badge with correct styling")

    def test_home_has_auto_play_logic(self):
        """Verify home.tsx has auto-play logic for hero channel (lines 60-73)"""
        with open("/app/frontend/app/(tabs)/home.tsx", "r") as f:
            content = f.read()
        
        # Check for auto-play refs and logic
        assert "autoPlayedRef" in content, "home.tsx should have autoPlayedRef"
        assert "useEffect" in content, "home.tsx should have useEffect for auto-play"
        
        # Check for playStream call in auto-play
        assert "playStream(" in content, "home.tsx should call playStream"
        print("PASS: home.tsx has auto-play logic for hero channel")

    def test_home_uses_set_stream_list(self):
        """Verify home.tsx calls setStreamList for channel navigation support"""
        with open("/app/frontend/app/(tabs)/home.tsx", "r") as f:
            content = f.read()
        
        # Check for setStreamList import and usage
        assert "setStreamList" in content, "home.tsx should use setStreamList"
        
        # Check it's destructured from useGlobalVideo
        assert "useGlobalVideo" in content, "home.tsx should use useGlobalVideo context"
        print("PASS: home.tsx uses setStreamList for channel navigation")

    def test_home_hero_card_structure(self):
        """Verify hero card JSX structure (lines 100-157)"""
        with open("/app/frontend/app/(tabs)/home.tsx", "r") as f:
            content = f.read()
        
        # Check for hero card components
        assert "heroCard" in content, "home.tsx should have heroCard style/testID"
        assert "heroImage" in content, "home.tsx should have heroImage for featured channel"
        assert "heroGradient" in content, "home.tsx should have gradient overlay"
        assert "heroPlayBtn" in content, "home.tsx should have play button"
        assert "playHeroFullscreen" in content, "home.tsx should have fullscreen play handler"
        print("PASS: home.tsx has correct hero card JSX structure")


class TestLiveTVCodeStructure:
    """Verify live.tsx has correct code structure for channel list first navigation"""

    def test_live_uses_show_guide_state(self):
        """Verify live.tsx uses showGuide state for view switching (line 41)"""
        with open("/app/frontend/app/(tabs)/live.tsx", "r") as f:
            content = f.read()
        
        # Check for showGuide state
        assert "showGuide" in content, "live.tsx should have showGuide state"
        assert "setShowGuide" in content, "live.tsx should have setShowGuide setter"
        assert "useState(false)" in content, "showGuide should default to false (channel list view)"
        print("PASS: live.tsx uses showGuide state for view switching")

    def test_live_play_channel_sets_show_guide_true(self):
        """Verify playChannel sets showGuide to true (lines 192-195)"""
        with open("/app/frontend/app/(tabs)/live.tsx", "r") as f:
            content = f.read()
        
        # Check playChannel function sets showGuide(true) when playing
        assert "setShowGuide(true)" in content, \
            "live.tsx should set showGuide to true when playing a channel"
        print("PASS: live.tsx playChannel sets showGuide to true")

    def test_live_resets_guide_when_stream_stops(self):
        """Verify useEffect resets showGuide when stream stops (lines 199-204)"""
        with open("/app/frontend/app/(tabs)/live.tsx", "r") as f:
            content = f.read()
        
        # Check for useEffect that resets guide view
        assert "setShowGuide(false)" in content, \
            "live.tsx should reset showGuide to false when stream stops"
        print("PASS: live.tsx resets guide view when stream stops")

    def test_live_view_switch_condition(self):
        """Verify view switch uses !showGuide condition (line 403)"""
        with open("/app/frontend/app/(tabs)/live.tsx", "r") as f:
            content = f.read()
        
        # Check for conditional rendering based on showGuide
        assert "!showGuide" in content, \
            "live.tsx should use !showGuide to show channel list first"
        print("PASS: live.tsx uses !showGuide for channel list first view")

    def test_live_has_back_to_channels_button(self):
        """Verify TV guide view has 'Back to channels' button"""
        with open("/app/frontend/app/(tabs)/live.tsx", "r") as f:
            content = f.read()
        
        # Check for back button in guide view
        assert "guide-back-btn" in content, "live.tsx should have guide-back-btn testID"
        assert "Back to channels" in content, "live.tsx should have 'Back to channels' text"
        print("PASS: live.tsx has 'Back to channels' button in guide view")


class TestGlobalVideoPlayerCodeStructure:
    """Verify GlobalVideoPlayer.tsx has correct code structure"""

    def test_global_video_player_has_home_inline_container(self):
        """Verify homeInlineContainer style with rounded corners (line 305)"""
        with open("/app/frontend/src/components/GlobalVideoPlayer.tsx", "r") as f:
            content = f.read()
        
        # Check for homeInlineContainer style
        assert "homeInlineContainer" in content, \
            "GlobalVideoPlayer should have homeInlineContainer style"
        
        # Check for borderRadius in homeInlineContainer
        assert "borderRadius: 16" in content or "borderRadius:16" in content, \
            "homeInlineContainer should have borderRadius: 16 for rounded corners"
        print("PASS: GlobalVideoPlayer has homeInlineContainer with rounded corners")

    def test_global_video_player_container_style_logic(self):
        """Verify containerStyle selection logic (lines 164-168)"""
        with open("/app/frontend/src/components/GlobalVideoPlayer.tsx", "r") as f:
            content = f.read()
        
        # Check for containerStyle conditional logic
        assert "isOnHomeTab" in content, "GlobalVideoPlayer should check isOnHomeTab"
        assert "homeInlineContainer" in content and "inlineContainer" in content, \
            "GlobalVideoPlayer should have both home and regular inline containers"
        print("PASS: GlobalVideoPlayer has correct container style selection logic")

    def test_global_video_player_channel_up_down(self):
        """Verify channel up/down controls exist for fullscreen"""
        with open("/app/frontend/src/components/GlobalVideoPlayer.tsx", "r") as f:
            content = f.read()
        
        # Check for channel change handler
        assert "handleChangeChannel" in content, \
            "GlobalVideoPlayer should have handleChangeChannel function"
        assert "chevron-up" in content, "GlobalVideoPlayer should have chevron-up for channel up"
        assert "chevron-down" in content, "GlobalVideoPlayer should have chevron-down for channel down"
        print("PASS: GlobalVideoPlayer has channel up/down controls")

    def test_global_video_player_auto_mute_home(self):
        """Verify auto-mute on Home tab, unmute on Live tab"""
        with open("/app/frontend/src/components/GlobalVideoPlayer.tsx", "r") as f:
            content = f.read()
        
        # Check for mute logic based on tab
        assert "setMuted" in content, "GlobalVideoPlayer should have setMuted"
        assert "isOnHomeTab" in content, "GlobalVideoPlayer should check isOnHomeTab"
        assert "isOnLiveTab" in content, "GlobalVideoPlayer should check isOnLiveTab"
        print("PASS: GlobalVideoPlayer has auto-mute logic for Home/Live tabs")


class TestCleanup:
    """Cleanup test data created during testing"""

    def test_cleanup_test_data(self):
        """Delete TEST_ prefixed data"""
        # Delete history
        response = requests.delete(f"{BASE_URL}/api/user/history",
                                 params={"username": "TEST_iteration14"}, timeout=10)
        assert response.status_code == 200
        
        # Note: We don't have a delete favorites endpoint, but that's fine for testing
        print("PASS: Test data cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
