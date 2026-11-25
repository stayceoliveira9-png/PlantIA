// API client for PlantIA backend.
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { uploadForm } from "./utils/upload";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;

const TOKEN_KEY = "plantia_session_token";

let inMemoryToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") inMemoryToken = window.localStorage.getItem(TOKEN_KEY);
  } else {
    inMemoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
  }
  return inMemoryToken;
}

export async function setToken(token: string | null) {
  inMemoryToken = token;
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      if (token) window.localStorage.setItem(TOKEN_KEY, token);
      else window.localStorage.removeItem(TOKEN_KEY);
    }
  } else {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(init.headers as any),
  };
  if (init.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND_URL}${path}`, { ...init, headers });
  if (res.status === 401) {
    await setToken(null);
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export const api = {
  exchangeSession: (session_id: string) =>
    request("/api/auth/session", { method: "POST", body: JSON.stringify({ session_id }) }),
  me: () => request("/api/auth/me"),
  logout: () => request("/api/auth/logout", { method: "POST" }),

  listPlants: () => request("/api/plants"),
  getPlant: (id: string) => request(`/api/plants/${id}`),
  createPlant: (data: any) => request("/api/plants", { method: "POST", body: JSON.stringify(data) }),
  updatePlant: (id: string, data: any) =>
    request(`/api/plants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  waterPlant: (id: string) => request(`/api/plants/${id}/water`, { method: "POST" }),
  deletePlant: (id: string) => request(`/api/plants/${id}`, { method: "DELETE" }),

  listGuides: () => request("/api/guides"),
  generateGuide: (plant_name: string, mode: "plant" | "horta") =>
    request("/api/guides/generate", {
      method: "POST",
      body: JSON.stringify({ plant_name, mode }),
    }),

  scanIdentify: async (uri: string, mimeType?: string) => {
    const token = await getToken();
    const res = await uploadForm(`${BACKEND_URL}/api/scan/identify`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      files: { file: { uri, name: "scan.jpg", mimeType: mimeType || "image/jpeg" } },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  scanDiagnose: async (uri: string, mimeType?: string) => {
    const token = await getToken();
    const res = await uploadForm(`${BACKEND_URL}/api/scan/diagnose`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      files: { file: { uri, name: "scan.jpg", mimeType: mimeType || "image/jpeg" } },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  uploadFile: async (uri: string, mimeType?: string): Promise<{ path: string }> => {
    const token = await getToken();
    const res = await uploadForm(`${BACKEND_URL}/api/upload`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      files: { file: { uri, name: "photo.jpg", mimeType: mimeType || "image/jpeg" } },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

export function fileUrl(path: string): string {
  // For <Image> on web, token must be in query string (no headers allowed on web <img>)
  const token = inMemoryToken;
  if (Platform.OS === "web" && token) {
    return `${BACKEND_URL}/api/files/${path}?token=${encodeURIComponent(token)}`;
  }
  return `${BACKEND_URL}/api/files/${path}`;
}

export function authHeaders(): Record<string, string> {
  return inMemoryToken ? { Authorization: `Bearer ${inMemoryToken}` } : {};
}

export { BACKEND_URL };
