# Plantia backend API tests — seeded session
import base64, io, os, time
import pytest, requests
from PIL import Image

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://plantapp-1--29bsmmwq.preview.emergentagent.com").rstrip("/")
TOKEN = os.environ.get("TEST_TOKEN", "TEST_SESSION_9771ef0d80f246e2a51f07262936b3b9")
H = {"Authorization": f"Bearer {TOKEN}"}

def _real_jpeg():
    # Non-uniform JPEG with features (gradient + shapes)
    img = Image.new("RGB", (256, 256), "white")
    px = img.load()
    for y in range(256):
        for x in range(256):
            px[x,y] = ((x+y) % 255, (x*2) % 255, (y*3) % 255)
    # Add a green rectangle (fake leaf)
    for y in range(80, 200):
        for x in range(60, 180):
            px[x,y] = (30, 150, 60)
    b = io.BytesIO(); img.save(b, "JPEG", quality=85); return b.getvalue()

# --- Auth ---
def test_root():
    r = requests.get(f"{BASE}/api/")
    assert r.status_code == 200

def test_auth_me_no_token():
    r = requests.get(f"{BASE}/api/auth/me")
    assert r.status_code == 401

def test_auth_me_ok():
    r = requests.get(f"{BASE}/api/auth/me", headers=H)
    assert r.status_code == 200, r.text
    assert r.json()["email"].startswith("TEST_")

def test_session_exchange_invalid():
    r = requests.post(f"{BASE}/api/auth/session", json={"session_id": "invalid_xxx"})
    assert r.status_code == 401

# --- Plants CRUD ---
_state = {}

def test_plant_create():
    r = requests.post(f"{BASE}/api/plants", headers=H,
        json={"name": "TEST_Cacto", "species": "Cactaceae", "water_interval_days": 7, "water_amount_ml": 50})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["name"] == "TEST_Cacto"
    assert d["water_interval_days"] == 7
    assert "next_water_at" in d and d["last_watered_at"] is None
    _state["pid"] = d["plant_id"]

def test_plant_list_no_id():
    r = requests.get(f"{BASE}/api/plants", headers=H)
    assert r.status_code == 200
    lst = r.json()
    assert isinstance(lst, list) and len(lst) >= 1
    for p in lst:
        assert "_id" not in p

def test_plant_get():
    r = requests.get(f"{BASE}/api/plants/{_state['pid']}", headers=H)
    assert r.status_code == 200
    assert r.json()["plant_id"] == _state["pid"]

def test_plant_patch_recalcs_next():
    r = requests.patch(f"{BASE}/api/plants/{_state['pid']}", headers=H,
        json={"water_interval_days": 14})
    assert r.status_code == 200
    d = r.json()
    assert d["water_interval_days"] == 14

def test_plant_water():
    r = requests.post(f"{BASE}/api/plants/{_state['pid']}/water", headers=H)
    assert r.status_code == 200
    d = r.json()
    assert d["last_watered_at"] is not None

def test_plant_delete():
    r = requests.delete(f"{BASE}/api/plants/{_state['pid']}", headers=H)
    assert r.status_code == 200
    r2 = requests.get(f"{BASE}/api/plants/{_state['pid']}", headers=H)
    assert r2.status_code == 404

# --- Upload + Files ---
def test_upload_and_download():
    img = _real_jpeg()
    r = requests.post(f"{BASE}/api/upload", headers=H,
        files={"file": ("test.jpg", img, "image/jpeg")})
    assert r.status_code == 200, r.text
    path = r.json()["path"]
    assert "/uploads/" in path
    _state["upload_path"] = path
    r2 = requests.get(f"{BASE}/api/files/{path}?token={TOKEN}")
    assert r2.status_code == 200
    assert r2.content[:3] == b"\xff\xd8\xff"

# --- AI Vision ---
def test_scan_identify():
    img = _real_jpeg()
    r = requests.post(f"{BASE}/api/scan/identify", headers=H,
        files={"file": ("leaf.jpg", img, "image/jpeg")}, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "scan_id" in d and "result" in d
    assert isinstance(d["result"], dict)

def test_scan_diagnose():
    img = _real_jpeg()
    r = requests.post(f"{BASE}/api/scan/diagnose", headers=H,
        files={"file": ("leaf.jpg", img, "image/jpeg")}, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "scan_id" in d and isinstance(d["result"], dict)

# --- Guides ---
def test_guide_generate_plant():
    r = requests.post(f"{BASE}/api/guides/generate", headers=H,
        json={"plant_name": "Manjericão", "mode": "plant"}, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["plant_name"] == "Manjericão"
    assert isinstance(d["content"], dict)

def test_guide_generate_horta():
    r = requests.post(f"{BASE}/api/guides/generate", headers=H,
        json={"plant_name": "Tomate cereja", "mode": "horta"}, timeout=120)
    assert r.status_code == 200
    assert "content" in r.json()

def test_guides_list():
    r = requests.get(f"{BASE}/api/guides", headers=H)
    assert r.status_code == 200
    assert isinstance(r.json(), list) and len(r.json()) >= 1
