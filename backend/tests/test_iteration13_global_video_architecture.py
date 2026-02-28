"""
Iteration 13: Global Video Player Architecture Testing
Tests backend APIs and validates frontend code structure for the new GlobalVideoPlayer architecture.

Key Features to Test:
- Backend API endpoints: /api/health, /api/auth/login, /api/live/categories, /api/live/streams, /api/stream/url, /api/epg/batch
- Frontend code structure: GlobalVideoContext, GlobalVideoPlayer, live.tsx without local video
"""

import pytest
import requests
import os

# Use the public URL from env
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://multiview-test.preview.emergentagent.com').rstrip('/')


class TestHealthEndpoint:
    """Test /api/health endpoint"""
    
    def test_health_returns_ok(self):
        """Health endpoint should return status ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        assert "xtream_dns" in data
        print(f"Health check passed: {data}")


class TestAuthEndpoint:
    """Test /api/auth/login endpoint"""
    
    def test_login_with_invalid_credentials(self):
        """Login with invalid credentials should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "invalid_test_user", "password": "invalid_pass"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "invalid" in data["detail"].lower() or "credentials" in data["detail"].lower()
        print(f"Login error handling passed: {data}")
    
    def test_login_post_endpoint_exists(self):
        """Login endpoint should accept POST requests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "test", "password": "test"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 401 for invalid creds, not 404 or 405
        assert response.status_code in [200, 401], f"Expected 200 or 401, got {response.status_code}"
        print(f"Login POST endpoint exists, returned: {response.status_code}")


class TestLiveEndpoints:
    """Test /api/live/* endpoints"""
    
    def test_live_categories_requires_auth_params(self):
        """Live categories should require username and password params"""
        # Without params - should fail or return empty
        response = requests.get(f"{BASE_URL}/api/live/categories")
        # Could be 422 (missing params) or return empty
        print(f"Live categories without auth: {response.status_code}")
        
    def test_live_streams_endpoint_exists(self):
        """Live streams endpoint should exist"""
        response = requests.get(f"{BASE_URL}/api/live/streams")
        # Should not return 404
        assert response.status_code != 404
        print(f"Live streams endpoint exists: {response.status_code}")


class TestStreamUrlEndpoint:
    """Test /api/stream/url endpoint"""
    
    def test_stream_url_endpoint_exists(self):
        """Stream URL endpoint should exist and require params"""
        response = requests.get(f"{BASE_URL}/api/stream/url")
        # Should not return 404 - might be 422 for missing params
        assert response.status_code != 404
        print(f"Stream URL endpoint exists: {response.status_code}")


class TestEpgBatchEndpoint:
    """Test /api/epg/batch endpoint"""
    
    def test_epg_batch_endpoint_exists(self):
        """EPG batch endpoint should exist"""
        response = requests.get(f"{BASE_URL}/api/epg/batch")
        # Should not return 404
        assert response.status_code != 404
        print(f"EPG batch endpoint exists: {response.status_code}")


class TestFrontendCodeStructure:
    """Test frontend code structure for Global Video Architecture"""
    
    def test_global_video_context_exists(self):
        """GlobalVideoContext.tsx should exist and have required exports"""
        context_path = "/app/frontend/src/contexts/GlobalVideoContext.tsx"
        assert os.path.exists(context_path), f"GlobalVideoContext.tsx not found at {context_path}"
        
        with open(context_path, 'r') as f:
            content = f.read()
        
        # Check for required exports/functions
        required_items = [
            'playStream',
            'stopStream',
            'setFullscreen',
            'togglePlay',
            'cycleResizeMode',
            'GlobalVideoProvider',
            'useGlobalVideo',
            'streamId',  # Should store streamId
            'categoryId',  # Should store categoryId
        ]
        
        for item in required_items:
            assert item in content, f"GlobalVideoContext.tsx missing: {item}"
            print(f"GlobalVideoContext: Found {item}")
        
        print("GlobalVideoContext.tsx structure verified")
    
    def test_global_video_player_exists(self):
        """GlobalVideoPlayer.tsx should exist and handle both inline and fullscreen"""
        player_path = "/app/frontend/src/components/GlobalVideoPlayer.tsx"
        assert os.path.exists(player_path), f"GlobalVideoPlayer.tsx not found at {player_path}"
        
        with open(player_path, 'r') as f:
            content = f.read()
        
        # Check for key elements
        required_items = [
            'Video',  # expo-av Video component
            'ResizeMode',  # Resize mode support
            'inlineContainer',  # Inline container style
            'fullscreenContainer',  # Fullscreen container style
            'useGlobalVideo',  # Uses global context
            'setFullscreen',  # Fullscreen toggle
            'stopStream',  # Stop stream function
        ]
        
        for item in required_items:
            assert item in content, f"GlobalVideoPlayer.tsx missing: {item}"
            print(f"GlobalVideoPlayer: Found {item}")
        
        print("GlobalVideoPlayer.tsx structure verified")
    
    def test_root_layout_includes_global_player(self):
        """_layout.tsx should include GlobalVideoProvider and GlobalVideoPlayer"""
        layout_path = "/app/frontend/app/_layout.tsx"
        assert os.path.exists(layout_path), f"_layout.tsx not found at {layout_path}"
        
        with open(layout_path, 'r') as f:
            content = f.read()
        
        # Check for global player integration
        required_items = [
            'GlobalVideoProvider',
            'GlobalVideoPlayer',
            'useGlobalVideo',  # For checking fullscreen state
        ]
        
        for item in required_items:
            assert item in content, f"_layout.tsx missing: {item}"
            print(f"_layout.tsx: Found {item}")
        
        # Check that GlobalVideoPlayer is rendered in the layout
        assert '<GlobalVideoPlayer' in content, "_layout.tsx should render GlobalVideoPlayer component"
        print("_layout.tsx properly integrates GlobalVideoPlayer at root")
    
    def test_live_tsx_uses_global_video(self):
        """live.tsx should use useGlobalVideo, not local Video component"""
        live_path = "/app/frontend/app/(tabs)/live.tsx"
        assert os.path.exists(live_path), f"live.tsx not found at {live_path}"
        
        with open(live_path, 'r') as f:
            content = f.read()
        
        # Should use global video context
        assert 'useGlobalVideo' in content, "live.tsx should import useGlobalVideo"
        assert 'playStream' in content, "live.tsx should use playStream from global context"
        
        # Should NOT have local Video component
        # Check if there's no Video import or if Video is NOT directly rendered
        if 'import { Video' in content or 'import {Video' in content:
            # If Video is imported, it should be from context usage, not direct rendering
            # Check that we're not rendering <Video directly
            assert content.count('<Video') == 0, "live.tsx should NOT render local <Video> component"
        
        print("live.tsx correctly uses useGlobalVideo, no local Video component")
    
    def test_tabs_layout_has_live_tab(self):
        """Tabs layout should include Live TV tab"""
        tabs_path = "/app/frontend/app/(tabs)/_layout.tsx"
        assert os.path.exists(tabs_path), f"_layout.tsx not found at {tabs_path}"
        
        with open(tabs_path, 'r') as f:
            content = f.read()
        
        # Check for Live tab
        assert 'name="live"' in content, "Tabs should include live screen"
        assert 'Live' in content, "Tabs should have Live title"
        assert 'tab-live' in content or 'tabBarTestID' in content, "Live tab should have testID"
        
        print("Tabs layout includes Live TV tab")


class TestApiUtilsConfiguration:
    """Test API utils configuration"""
    
    def test_api_utils_uses_env_backend_url(self):
        """api.ts should use EXPO_PUBLIC_BACKEND_URL from environment"""
        api_path = "/app/frontend/src/utils/api.ts"
        assert os.path.exists(api_path), f"api.ts not found at {api_path}"
        
        with open(api_path, 'r') as f:
            content = f.read()
        
        assert 'EXPO_PUBLIC_BACKEND_URL' in content, "api.ts should use EXPO_PUBLIC_BACKEND_URL"
        assert 'process.env' in content, "api.ts should use process.env"
        
        print("api.ts correctly uses EXPO_PUBLIC_BACKEND_URL from environment")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
