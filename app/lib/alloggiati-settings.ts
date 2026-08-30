import { getStoredSettings, saveStoredSettings } from "../../db/settings";
import { authConfig } from "./google-auth";

export type AlloggiatiAccountMode = "standard" | "apartments";
export type AlloggiatiSettingsSummary = {
  userConfigured: boolean;
  passwordConfigured: boolean;
  wsKeyConfigured: boolean;
  apartmentIdConfigured: boolean;
  accountMode: AlloggiatiAccountMode;
  userHint: string;
  apartmentIdHint: string;
  source: "database" | "environment" | "none";
  updatedAt: string | null;
  updatedBy: string | null;
};

export type AlloggiatiSettingsInput = {
  user?: unknown;
  password?: unknown;
  wsKey?: unknown;
  accountMode?: unknown;
  apartmentId?: unknown;
};

const settingKeys = {
  user: "alloggiati.user",
  password: "alloggiati.password",
  wsKey: "alloggiati.wskey",
  accountMode: "alloggiati.account_mode",
  apartmentId: "alloggiati.apartment_id",
} as const;

const databaseKeys = Object.values(settingKeys);

export async function getAlloggiatiSettingsSummary(): Promise<AlloggiatiSettingsSummary> {
  const result = await loadSettings();
  const latest = result.rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return {
    userConfigured: Boolean(result.values.user),
    passwordConfigured: Boolean(result.values.password),
    wsKeyConfigured: Boolean(result.values.wsKey),
    apartmentIdConfigured: Boolean(result.values.apartmentId),
    accountMode: result.values.accountMode,
    userHint: mask(result.values.user),
    apartmentIdHint: mask(result.values.apartmentId),
    source: result.rows.length ? "database" : hasEnvironmentSettings() ? "environment" : "none",
    updatedAt: latest?.updatedAt ?? null,
    updatedBy: latest?.updatedBy ?? null,
  };
}

export async function saveAlloggiatiSettings(input: AlloggiatiSettingsInput, actorEmail: string) {
  const current = (await loadSettings()).values;
  if (input.accountMode !== undefined && input.accountMode !== "apartments" && input.accountMode !== "standard") throw new Error("Tipo account non valido.");
  const accountMode = input.accountMode === "apartments" ? "apartments" : input.accountMode === "standard" ? "standard" : current.accountMode;
  const values = {
    user: keepOrReplace(current.user, input.user, 120),
    password: keepOrReplace(current.password, input.password, 240),
    wsKey: keepOrReplace(current.wsKey, input.wsKey, 500),
    accountMode,
    apartmentId: keepOrReplace(current.apartmentId, input.apartmentId, 120, accountMode === "standard"),
  };

  if (!values.user || !values.password || !values.wsKey) throw new Error("Inserisci utente, password e WSKEY di Alloggiati Web.");
  if (accountMode === "apartments" && !values.apartmentId) throw new Error("Inserisci il codice appartamento per questo tipo di account.");

  const updatedAt = new Date().toISOString();
  await saveStoredSettings(await Promise.all(Object.entries(values).map(async ([name, value]) => ({
    key: settingKeys[name as keyof typeof settingKeys],
    encryptedValue: await encrypt(String(value)),
    updatedAt,
    updatedBy: actorEmail,
  }))));
  return getAlloggiatiSettingsSummary();
}

async function loadSettings() {
  const rows = await getStoredSettings(databaseKeys);
  const decrypted = new Map<string, string>();
  await Promise.all(rows.map(async (row) => {
    try { decrypted.set(row.key, await decrypt(row.encryptedValue)); } catch { /* A damaged value is treated as missing. */ }
  }));
  const mode = decrypted.get(settingKeys.accountMode) || process.env["ALLOGGIATI_ACCOUNT_MODE"]?.trim();
  return {
    rows,
    values: {
      user: decrypted.get(settingKeys.user) ?? process.env["ALLOGGIATI_USER"]?.trim() ?? "",
      password: decrypted.get(settingKeys.password) ?? process.env["ALLOGGIATI_PASSWORD"]?.trim() ?? "",
      wsKey: decrypted.get(settingKeys.wsKey) ?? process.env["ALLOGGIATI_WSKEY"]?.trim() ?? "",
      accountMode: mode === "apartments" ? "apartments" as const : "standard" as const,
      apartmentId: decrypted.get(settingKeys.apartmentId) ?? process.env["ALLOGGIATI_APARTMENT_ID"]?.trim() ?? "",
    },
  };
}

function keepOrReplace(current: string, proposed: unknown, maxLength: number, allowClear = false) {
  if (proposed === undefined || proposed === null) return current;
  if (typeof proposed !== "string") throw new Error("Formato dei valori non valido.");
  const value = proposed.trim();
  if (value.length > maxLength) throw new Error("Uno dei valori inseriti è troppo lungo.");
  return value || (allowClear ? "" : current);
}

function hasEnvironmentSettings() {
  return ["ALLOGGIATI_USER", "ALLOGGIATI_PASSWORD", "ALLOGGIATI_WSKEY", "ALLOGGIATI_APARTMENT_ID"].some((key) => Boolean(process.env[key]?.trim()));
}

function mask(value: string) {
  if (!value) return "";
  if (value.length < 5) return "••••";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

async function encryptionKey() {
  const secret = authConfig().sessionSecret;
  if (secret.length < 32) throw new Error("AUTH_SESSION_SECRET non configurato.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`valfsuite-settings:${secret}`));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
}

async function decrypt(value: string) {
  const [version, ivValue, cipherValue] = value.split(".");
  if (version !== "v1" || !ivValue || !cipherValue) throw new Error("Formato cifrato non valido.");
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64url(ivValue) }, await encryptionKey(), fromBase64url(cipherValue));
  return new TextDecoder().decode(clear);
}

function base64url(value: Uint8Array) {
  let binary = "";
  value.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
