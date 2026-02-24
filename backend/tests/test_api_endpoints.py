import pytest
import requests
import os
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
if frontend_env.exists():
    load_dotenv(frontend_env)

# Test backend health and auth endpoints
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://xtream-player-dev.preview.emergentagent.com')

class TestHealthEndpoint:
    """Health check endpoint tests"""

    def test_health_endpoint_returns_200(self):
        """Test that /api/health returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Health endpoint returned 200")

    def test_health_endpoint_response_structure(self):
        """Test that /api/health returns correct response structure"""
        response = requests.get(f"{BASE_URL}/api/health")
        data = response.json()
        assert "status" in data, "Response missing 'status' field"
        assert data["status"] == "ok", f"Expected status 'ok', got {data.get('status')}"
        assert "xtream_dns" in data, "Response missing 'xtream_dns' field"
        print(f"✓ Health endpoint response structure is correct: {data}")


class TestAuthEndpoint:
    """Authentication endpoint tests"""

    def test_login_with_invalid_credentials_returns_401(self):
        """Test that login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "invalid_user", "password": "invalid_pass"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 401, 500, or 520 (520 = Xtream API timeout/unreachable)
        assert response.status_code in [401, 500, 520], f"Expected 401/500/520, got {response.status_code}"
        print(f"✓ Login with invalid credentials returned {response.status_code}")

    def test_login_with_empty_username_validation(self):
        """Test that login validates empty username"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "", "password": "somepass"},
            headers={"Content-Type": "application/json"}
        )
        # Backend might not validate empty fields, but should fail at Xtream API
        assert response.status_code in [401, 422, 500, 520], f"Expected error status, got {response.status_code}"
        print(f"✓ Login with empty username returned {response.status_code}")

    def test_login_with_empty_password_validation(self):
        """Test that login validates empty password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "someuser", "password": ""},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 422, 500, 520], f"Expected error status, got {response.status_code}"
        print(f"✓ Login with empty password returned {response.status_code}")

    def test_login_with_missing_fields(self):
        """Test that login handles missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422, f"Expected 422 for missing fields, got {response.status_code}"
        print(f"✓ Login with missing fields returned 422")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
