# PlantIA — Plant Care Assistant (Expo + FastAPI)

## Vision
Mobile app that helps users identify plants from photos, diagnose plant health issues, track personal plants with watering reminders, and generate AI-driven planting/garden (horta) guides.

## Users
Home gardeners and plant enthusiasts in Brazil (UI in pt-BR).

## Core Features
1. **Google Sign-in** (Emergent managed OAuth)
2. **Identify Plant** — take photo → GPT-5.4 vision returns name, species, confidence, quick care tips
3. **Diagnose Plant** — take photo → GPT-5.4 vision returns health status, problems, water/fertilizer recommendations
4. **My Plants** — CRUD with per-plant watering interval (days) and amount (ml)
5. **Watering reminders** — local notifications (expo-notifications) scheduled based on interval
6. **Quick water log** — one tap resets next watering date
7. **AI Guides** — on-demand generation of step-by-step planting guides for a specific plant or a vegetable garden ("horta")
8. **Photo storage** — Emergent Object Storage via backend

## Stack
- Frontend: Expo SDK 58, Expo Router, React Query, expo-image-picker, expo-image-manipulator, expo-notifications, @gorhom/bottom-sheet, @react-native-vector-icons/material-design-icons
- Backend: FastAPI + Motor (MongoDB), emergentintegrations (OpenAI GPT-5.4 vision), Emergent Object Storage, Emergent Google Auth session exchange
- Theme: Minimal modern, Forest green (#2E4F2E) brand on off-white surface

## Key Endpoints
- `POST /api/auth/session` — exchange session_id for session_token
- `GET /api/auth/me` — current user
- `POST /api/auth/logout`
- `POST /api/upload` (multipart) — upload a file; returns `{path}`
- `GET /api/files/{path}` — fetch file (owner-only)
- `POST /api/scan/identify` (multipart) — identify a plant
- `POST /api/scan/diagnose` (multipart) — diagnose plant health
- `GET/POST /api/plants`, `GET/PATCH/DELETE /api/plants/{id}`, `POST /api/plants/{id}/water`
- `POST /api/guides/generate`, `GET /api/guides`

## Business Enhancement
Freemium: unlimited watering + manual plant entries free; unlimited AI identification/diagnosis & AI guide generation as "PlantIA Pro" subscription — increases engagement and monetization.
