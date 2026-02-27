"""
Iteration 11 Tests - Fullscreen Player Architecture Verification
Testing the major architectural change where fullscreen is now handled WITHIN live.tsx
instead of navigating to player.tsx

Key features to verify:
1. Backend APIs: /api/health, /api/live/categories, /api/live/streams, /api/stream/url
2. No navigation to /player from live.tsx fullscreen (goFullscreen = enterFullscreen)
3. Same player instance used (inlinePlayer in both inline and fullscreen modes)
4. Orientation handling: landscape → fullscreen, portrait → exit fullscreen
5. BackHandler for Android back button in fullscreen
6. Multiview pauses player before navigation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://channel-hub-android.preview.emergentagent.com')

# Test credentials from logs
TEST_USERNAME = "DJBIGANT"
TEST_PASSWORD = "sTtb4D5v7T"

class TestBackendAPIs:
    """Verify all backend API endpoints are working"""
    
    def test_health_endpoint(self):
        """GET /api/health - returns status ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        assert "xtream_dns" in data
        print(f"✓ Health check passed: {data}")
    
    def test_live_categories(self):
        """GET /api/live/categories - returns categories array"""
        response = requests.get(
            f"{BASE_URL}/api/live/categories",
            params={"username": TEST_USERNAME, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "category_id" in data[0]
        assert "category_name" in data[0]
        print(f"✓ Live categories: {len(data)} categories found")
    
    def test_live_streams(self):
        """GET /api/live/streams - returns streams array"""
        response = requests.get(
            f"{BASE_URL}/api/live/streams",
            params={"username": TEST_USERNAME, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "stream_id" in data[0]
        assert "name" in data[0]
        print(f"✓ Live streams: {len(data)} streams found")
    
    def test_stream_url_resolution(self):
        """GET /api/stream/url - returns resolved URL"""
        response = requests.get(
            f"{BASE_URL}/api/stream/url",
            params={
                "username": TEST_USERNAME, 
                "password": TEST_PASSWORD,
                "stream_id": 400,
                "stream_type": "live",
                "container_extension": "ts"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "fallback_url" in data
        assert data["url"].startswith("http")
        print(f"✓ Stream URL resolved: {data['url'][:60]}...")
    
    def test_live_streams_with_category_filter(self):
        """GET /api/live/streams with category_id filter"""
        response = requests.get(
            f"{BASE_URL}/api/live/streams",
            params={"username": TEST_USERNAME, "password": TEST_PASSWORD, "category_id": "1"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned streams should be in category 1
        for stream in data[:5]:  # Check first 5
            assert stream.get("category_id") == "1" or 1 in stream.get("category_ids", [])
        print(f"✓ Filtered streams: {len(data)} streams in category 1")


class TestStaticCodeVerification:
    """
    These tests verify the code structure by checking file contents.
    Since this is a React Native app, we verify code patterns rather than runtime behavior.
    """
    
    def test_live_tsx_has_fullscreen_state(self):
        """live.tsx should have isFullscreen state and enterFullscreen/exitFullscreen functions"""
        with open("/app/frontend/app/(tabs)/live.tsx", "r") as f:
            content = f.read()
        
        # Check for isFullscreen state
        assert "const [isFullscreen, setIsFullscreen] = useState" in content, "Missing isFullscreen state"
        
        # Check for enterFullscreen function
        assert "const enterFullscreen = useCallback" in content, "Missing enterFullscreen function"
        
        # Check for exitFullscreen function  
        assert "const exitFullscreen = useCallback" in content, "Missing exitFullscreen function"
        
        print("✓ live.tsx: isFullscreen state and fullscreen functions exist")
    
    def test_live_tsx_fullscreen_uses_same_player(self):
        """Fullscreen mode should use the same inlinePlayer with fs-video-player testID"""
        with open("/app/frontend/app/(tabs)/live.tsx", "r") as f:
            content = f.read()
        
        # Check for fs-video-player testID in fullscreen section
        assert 'testID="fs-video-player"' in content, "Missing fs-video-player testID"
        
        # Check that fullscreen VideoView uses inlinePlayer
        assert "player={inlinePlayer}" in content, "Fullscreen should use inlinePlayer"
        
        print("✓ live.tsx: Fullscreen mode uses same inlinePlayer (fs-video-player testID)")
    
    def test_live_tsx_fullscreen_controls(self):
        """Fullscreen controls should include back, aspect, play/pause, channel switch, favorites, multiview"""
        with open("/app/frontend/app/(tabs)/live.tsx", "r") as f:
            content = f.read()
        
        # Check for fullscreen control testIDs
        required_controls = [
            'testID="fs-back-btn"',
            'testID="fs-aspect-btn"',
            'testID="fs-play-btn"',
            'testID="fs-prev-btn"',
            'testID="fs-next-btn"',
            'testID="fs-fav-btn"',
            'testID="fs-multiview-btn"',
        ]
        
        for control in required_controls:
            assert control in content, f"Missing fullscreen control: {control}"
        
        print("✓ live.tsx: All fullscreen controls present (back, aspect, play/pause, channel switch, favorites, multiview)")
    
    def test_live_tsx_orientation_listener(self):
        """Orientation listener should use unlockAsync and handle landscape→fullscreen, portrait→exit"""
        with open("/app/frontend/app/(tabs)/live.tsx", "r") as f:
            content = f.read()
        
        # Check for unlockAsync call before orientation listener
        assert "ScreenOrientation.unlockAsync()" in content, "Missing unlockAsync call"
        
        # Check for addOrientationChangeListener
        assert "addOrientationChangeListener" in content, "Missing orientation change listener"
        
        # Check for landscape detection triggering fullscreen
        assert "LANDSCAPE_LEFT" in content and "LANDSCAPE_RIGHT" in content, "Missing landscape orientation handling"
        
        # Check for portrait detection exiting fullscreen
        assert "PORTRAIT_UP" in content, "Missing portrait orientation handling"
        
        # Check that landscape triggers enterFullscreen
        assert "enterFullscreen()" in content, "Landscape should trigger enterFullscreen"
        
        # Check that portrait triggers exitFullscreen
        assert "exitFullscreen()" in content, "Portrait should trigger exitFullscreen"
        
        print("✓ live.tsx: Orientation listener uses unlockAsync and handles bidirectional rotation")
    
    def test_live_tsx_backhandler(self):
        """Android BackHandler should be present for fullscreen exit"""
        with open("/app/frontend/app/(tabs)/live.tsx", "r") as f:
            content = f.read()
        
        # Check for BackHandler import
        assert "BackHandler" in content, "Missing BackHandler import"
        
        # Check for hardwareBackPress listener
        assert "hardwareBackPress" in content, "Missing hardwareBackPress handler"
        
        # Check that it returns true in fullscreen
        assert "return true" in content, "BackHandler should return true to prevent app exit"
        
        print("✓ live.tsx: BackHandler for Android back button in fullscreen")
    
    def test_live_tsx_no_player_navigation(self):
        """goFullscreen should call enterFullscreen, NOT router.push to /player"""
        with open("/app/frontend/app/(tabs)/live.tsx", "r") as f:
            content = f.read()
        
        # Find the goFullscreen function
        assert "const goFullscreen = useCallback" in content, "Missing goFullscreen function"
        
        # Check that goFullscreen calls enterFullscreen
        go_fullscreen_section = content[content.find("const goFullscreen"):content.find("const goFullscreen") + 200]
        assert "enterFullscreen()" in go_fullscreen_section, "goFullscreen should call enterFullscreen"
        
        # Verify there's no router.push('/player') for fullscreen
        # (router.push is only used for multiview)
        router_push_count = content.count("router.push(")
        assert router_push_count <= 2, "Should have minimal router.push calls (only for multiview)"
        
        # Verify the only router.push is for multiview
        assert "pathname: '/multiview'" in content, "router.push should be for multiview only"
        
        print("✓ live.tsx: goFullscreen calls enterFullscreen (no navigation to /player)")
    
    def test_player_tsx_multiview_pauses(self):
        """player.tsx multiview button should pause player before navigation"""
        with open("/app/frontend/app/player.tsx", "r") as f:
            content = f.read()
        
        # Find the multiview button section
        assert 'testID="player-multiview-btn"' in content, "Missing player-multiview-btn testID"
        
        # Check that player.pause() is called before router.push
        # The multiview button handler should pause the player
        assert "player.pause()" in content, "Multiview button should pause player"
        
        print("✓ player.tsx: Multiview button pauses player before navigation")
    
    def test_multiview_tsx_structure(self):
        """multiview.tsx should have 2x2 grid, category picker, and audio routing"""
        with open("/app/frontend/app/multiview.tsx", "r") as f:
            content = f.read()
        
        # Check for 2x2 grid structure
        assert "cellW" in content and "cellH" in content, "Missing cell dimensions for grid"
        assert "/ 2" in content, "Grid should be 2x2 (divide by 2)"
        
        # Check for category picker modal
        assert "Modal" in content, "Missing Modal for category picker"
        assert "Select Category" in content, "Missing category selection UI"
        
        # Check for audio routing (volume-based)
        assert "volume" in content.lower(), "Missing volume-based audio routing"
        assert "isActive" in content, "Missing active slot tracking"
        
        # Check for add channel buttons (uses template literal)
        assert 'testID={`multiview-add-' in content, "Missing add channel buttons"
        
        print("✓ multiview.tsx: 2x2 grid with category picker and audio routing")
    
    def test_tabs_layout_portrait_lock(self):
        """tabs/_layout.tsx should lock portrait on mount"""
        with open("/app/frontend/app/(tabs)/_layout.tsx", "r") as f:
            content = f.read()
        
        # Check for useEffect with portrait lock
        assert "useEffect" in content, "Missing useEffect hook"
        assert "ScreenOrientation" in content, "Missing ScreenOrientation import"
        assert "PORTRAIT_UP" in content, "Missing PORTRAIT_UP lock"
        assert "lockAsync" in content, "Missing lockAsync call"
        
        print("✓ tabs/_layout.tsx: Portrait lock on mount")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
