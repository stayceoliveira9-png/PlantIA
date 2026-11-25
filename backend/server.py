import asyncio
import base64
import logging
import os
import uuid
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import httpx
import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware

from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
APP_NAME = "plantia"

# Object Storage
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as exc:
        logging.getLogger(__name__).error("init_storage failed: %s", exc)
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not initialized")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
    ],
    "user_sessions": [
        IndexModel([("session_token", ASCENDING)], name="session_token", unique=True),
        IndexModel([("user_id", ASCENDING)], name="user_id"),
        IndexModel([("expires_at", ASCENDING)], name="expires_ttl", expireAfterSeconds=0),
    ],
    "plants": [
        IndexModel([("plant_id", ASCENDING)], name="plant_id", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
        IndexModel([("next_water_at", ASCENDING)], name="next_water"),
    ],
    "scans": [
        IndexModel([("scan_id", ASCENDING)], name="scan_id", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
    ],
    "guides": [
        IndexModel([("guide_id", ASCENDING)], name="guide_id", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logging.getLogger(__name__).error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


app = FastAPI()


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api_router = APIRouter(prefix="/api")


# ============== Models ==============
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SessionExchangeBody(BaseModel):
    session_id: str


class SessionResponse(BaseModel):
    session_token: str
    user: User


class PlantCreate(BaseModel):
    name: str
    species: Optional[str] = None
    water_interval_days: int = 7
    water_amount_ml: int = 200
    notes: Optional[str] = None
    photo_path: Optional[str] = None


class PlantUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    water_interval_days: Optional[int] = None
    water_amount_ml: Optional[int] = None
    notes: Optional[str] = None
    photo_path: Optional[str] = None


class Plant(BaseModel):
    plant_id: str
    user_id: str
    name: str
    species: Optional[str] = None
    water_interval_days: int
    water_amount_ml: int
    notes: Optional[str] = None
    photo_path: Optional[str] = None
    last_watered_at: Optional[datetime] = None
    next_water_at: datetime
    created_at: datetime


class ScanResult(BaseModel):
    scan_id: str
    kind: str  # "identify" or "diagnose"
    photo_path: str
    result: dict
    created_at: datetime


class GuideRequest(BaseModel):
    plant_name: str
    mode: str = "plant"  # "plant" or "horta"


class Guide(BaseModel):
    guide_id: str
    plant_name: str
    mode: str
    content: dict
    created_at: datetime


# ============== Auth ==============
async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.removeprefix("Bearer ").strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(401, "Invalid session")
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return User(**user)


@api_router.post("/auth/session", response_model=SessionResponse)
async def exchange_session(body: SessionExchangeBody):
    async with httpx.AsyncClient(timeout=30) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(401, "Invalid session_id")
    data = r.json()
    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
        user_doc = {**existing, "name": name, "picture": picture}
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(dict(user_doc))

    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        }
    )
    return SessionResponse(session_token=session_token, user=User(**{k: v for k, v in user_doc.items() if k != "_id"}))


@api_router.get("/auth/me", response_model=User)
async def auth_me(user: User = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ============== File Upload ==============
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    data = await file.read()
    ext = (file.filename or "upload.jpg").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{user.user_id}/{uuid.uuid4().hex}.{ext}"
    content_type = file.content_type or "image/jpeg"
    await run_in_threadpool(put_object, path, data, content_type)
    return {"path": path}


@api_router.get("/files/{path:path}")
async def download_file(path: str, token: Optional[str] = None, authorization: Optional[str] = Header(None)):
    # Verify auth — accept header or query token
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.removeprefix("Bearer ").strip()
    elif token:
        auth_token = token
    if not auth_token:
        raise HTTPException(401, "Auth required")
    session = await db.user_sessions.find_one({"session_token": auth_token}, {"_id": 0})
    if not session:
        raise HTTPException(401, "Invalid session")
    # Only allow access to files owned by this user
    if f"/uploads/{session['user_id']}/" not in f"/{path}":
        raise HTTPException(403, "Forbidden")
    data, ctype = await run_in_threadpool(get_object, path)
    return Response(content=data, media_type=ctype)


# ============== AI: Identification & Diagnosis ==============
async def _run_vision(system_prompt: str, user_text: str, image_bytes: bytes) -> str:
    b64 = base64.b64encode(image_bytes).decode("ascii")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"vision-{uuid.uuid4().hex[:8]}",
        system_message=system_prompt,
    ).with_model("openai", "gpt-5.4")
    msg = UserMessage(text=user_text, file_contents=[ImageContent(image_base64=b64)])
    resp = await chat.send_message(msg)
    return resp if isinstance(resp, str) else str(resp)


def _extract_json(text: str) -> dict:
    import json, re
    # try fenced block
    m = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    candidate = m.group(1).strip() if m else text.strip()
    # trim leading/trailing noise
    first = candidate.find("{")
    last = candidate.rfind("}")
    if first != -1 and last != -1:
        candidate = candidate[first : last + 1]
    try:
        return json.loads(candidate)
    except Exception:
        return {"raw": text}


@api_router.post("/scan/identify")
async def scan_identify(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    data = await file.read()
    ext = (file.filename or "upload.jpg").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{user.user_id}/{uuid.uuid4().hex}.{ext}"
    ctype = file.content_type or "image/jpeg"
    await run_in_threadpool(put_object, path, data, ctype)

    prompt = (
        "Você é um botânico especialista. Identifique a planta ou fruta na foto. "
        "Responda SOMENTE em JSON válido (sem markdown) no formato: "
        '{"nome_popular":"...","nome_cientifico":"...","confianca":0.0-1.0,'
        '"tipo":"planta_ornamental|fruta|hortalica|suculenta|outro",'
        '"descricao":"breve descrição em pt-BR","cuidados_rapidos":["item1","item2","item3"]}'
    )
    text = await _run_vision(prompt, "Identifique esta planta.", data)
    result = _extract_json(text)
    scan_id = f"scan_{uuid.uuid4().hex[:12]}"
    doc = {
        "scan_id": scan_id,
        "user_id": user.user_id,
        "kind": "identify",
        "photo_path": path,
        "result": result,
        "created_at": datetime.now(timezone.utc),
    }
    await db.scans.insert_one(dict(doc))
    return {"scan_id": scan_id, "photo_path": path, "result": result}


@api_router.post("/scan/diagnose")
async def scan_diagnose(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    data = await file.read()
    ext = (file.filename or "upload.jpg").split(".")[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{user.user_id}/{uuid.uuid4().hex}.{ext}"
    ctype = file.content_type or "image/jpeg"
    await run_in_threadpool(put_object, path, data, ctype)

    prompt = (
        "Você é um fitopatologista. Analise a foto da planta e identifique o que ela precisa "
        "(água, luz, adubo, poda), além de pragas, doenças ou deficiências. "
        "Responda SOMENTE em JSON válido (sem markdown) no formato: "
        '{"estado_geral":"saudavel|atencao|critico","diagnostico":"resumo em pt-BR",'
        '"problemas":[{"tipo":"...","gravidade":"baixa|media|alta","descricao":"..."}],'
        '"recomendacoes":[{"acao":"...","detalhe":"..."}],'
        '"adubo":"recomendação de adubo ou vazio","agua":"frequência de rega"}'
    )
    text = await _run_vision(prompt, "Diagnostique esta planta.", data)
    result = _extract_json(text)
    scan_id = f"scan_{uuid.uuid4().hex[:12]}"
    doc = {
        "scan_id": scan_id,
        "user_id": user.user_id,
        "kind": "diagnose",
        "photo_path": path,
        "result": result,
        "created_at": datetime.now(timezone.utc),
    }
    await db.scans.insert_one(dict(doc))
    return {"scan_id": scan_id, "photo_path": path, "result": result}


# ============== Plants CRUD ==============
@api_router.post("/plants", response_model=Plant)
async def create_plant(body: PlantCreate, user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    plant_id = f"plant_{uuid.uuid4().hex[:12]}"
    next_water = now + timedelta(days=body.water_interval_days)
    doc = {
        "plant_id": plant_id,
        "user_id": user.user_id,
        "name": body.name,
        "species": body.species,
        "water_interval_days": body.water_interval_days,
        "water_amount_ml": body.water_amount_ml,
        "notes": body.notes,
        "photo_path": body.photo_path,
        "last_watered_at": None,
        "next_water_at": next_water,
        "created_at": now,
    }
    await db.plants.insert_one(dict(doc))
    return Plant(**{k: v for k, v in doc.items() if k != "_id"})


@api_router.get("/plants", response_model=List[Plant])
async def list_plants(user: User = Depends(get_current_user)):
    cursor = db.plants.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(200)
    return [Plant(**i) for i in items]


@api_router.get("/plants/{plant_id}", response_model=Plant)
async def get_plant(plant_id: str, user: User = Depends(get_current_user)):
    doc = await db.plants.find_one({"plant_id": plant_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Plant not found")
    return Plant(**doc)


@api_router.patch("/plants/{plant_id}", response_model=Plant)
async def update_plant(plant_id: str, body: PlantUpdate, user: User = Depends(get_current_user)):
    doc = await db.plants.find_one({"plant_id": plant_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Plant not found")
    update = {k: v for k, v in body.dict().items() if v is not None}
    if "water_interval_days" in update:
        base = doc.get("last_watered_at") or datetime.now(timezone.utc)
        if base.tzinfo is None:
            base = base.replace(tzinfo=timezone.utc)
        update["next_water_at"] = base + timedelta(days=update["water_interval_days"])
    if update:
        await db.plants.update_one({"plant_id": plant_id}, {"$set": update})
    new_doc = await db.plants.find_one({"plant_id": plant_id}, {"_id": 0})
    return Plant(**new_doc)


@api_router.post("/plants/{plant_id}/water", response_model=Plant)
async def water_plant(plant_id: str, user: User = Depends(get_current_user)):
    doc = await db.plants.find_one({"plant_id": plant_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Plant not found")
    now = datetime.now(timezone.utc)
    next_water = now + timedelta(days=doc["water_interval_days"])
    await db.plants.update_one(
        {"plant_id": plant_id},
        {"$set": {"last_watered_at": now, "next_water_at": next_water}},
    )
    new_doc = await db.plants.find_one({"plant_id": plant_id}, {"_id": 0})
    return Plant(**new_doc)


@api_router.delete("/plants/{plant_id}")
async def delete_plant(plant_id: str, user: User = Depends(get_current_user)):
    await db.plants.delete_one({"plant_id": plant_id, "user_id": user.user_id})
    return {"ok": True}


# ============== AI Guides ==============
@api_router.post("/guides/generate", response_model=Guide)
async def generate_guide(body: GuideRequest, user: User = Depends(get_current_user)):
    if body.mode == "horta":
        prompt = (
            "Você é um agrônomo especialista em hortas urbanas. Crie um guia completo em pt-BR "
            f"para plantar e cuidar de '{body.plant_name}' em uma horta doméstica. "
            "Responda SOMENTE em JSON válido (sem markdown) no formato: "
            '{"titulo":"...","resumo":"breve resumo",'
            '"materiais":["item1","item2"],'
            '"passos":[{"titulo":"...","descricao":"...","dica":"..."}],'
            '"rega":"...","adubo":"...","colheita":"quando colher","dicas_extras":["..."]}'
        )
    else:
        prompt = (
            "Você é um especialista em jardinagem. Crie um guia completo em pt-BR para plantar e "
            f"cuidar da planta '{body.plant_name}'. "
            "Responda SOMENTE em JSON válido (sem markdown) no formato: "
            '{"titulo":"...","resumo":"breve resumo",'
            '"materiais":["item1","item2"],'
            '"passos":[{"titulo":"...","descricao":"...","dica":"..."}],'
            '"rega":"...","adubo":"...","luz":"necessidade de luz","dicas_extras":["..."]}'
        )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"guide-{uuid.uuid4().hex[:8]}",
        system_message=prompt,
    ).with_model("openai", "gpt-5.4")
    resp = await chat.send_message(UserMessage(text=f"Gere o guia para: {body.plant_name}"))
    content = _extract_json(resp if isinstance(resp, str) else str(resp))
    guide_id = f"guide_{uuid.uuid4().hex[:12]}"
    doc = {
        "guide_id": guide_id,
        "user_id": user.user_id,
        "plant_name": body.plant_name,
        "mode": body.mode,
        "content": content,
        "created_at": datetime.now(timezone.utc),
    }
    await db.guides.insert_one(dict(doc))
    return Guide(**{k: v for k, v in doc.items() if k not in ("_id", "user_id")})


@api_router.get("/guides", response_model=List[Guide])
async def list_guides(user: User = Depends(get_current_user)):
    cursor = db.guides.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(100)
    return [Guide(**{k: v for k, v in i.items() if k != "user_id"}) for i in items]


# ============== Mount & Middleware ==============
@api_router.get("/")
async def root():
    return {"message": "PlantIA API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def start_background() -> None:
    app.state.index_task = asyncio.create_task(ensure_indexes())
    try:
        await run_in_threadpool(init_storage)
    except Exception as exc:
        logger.error("startup init_storage: %s", exc)


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
