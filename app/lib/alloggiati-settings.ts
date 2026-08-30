export type AlloggiatiAccountMode = "standard" | "apartments";
export type AlloggiatiSettingsSummary = {
  userConfigured: boolean;
  passwordConfigured: boolean;
  wsKeyConfigured: boolean;
  apartmentIdConfigured: boolean;
  accountMode: AlloggiatiAccountMode;
  userHint: string;
  apartmentIdHint: string;
  source: "file" | "environment" | "unavailable";
  writable: boolean;
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

const envKeys = {
  user: "ALLOGGIATI_USER",
  password: "ALLOGGIATI_PASSWORD",
  wsKey: "ALLOGGIATI_WSKEY",
  accountMode: "ALLOGGIATI_ACCOUNT_MODE",
  apartmentId: "ALLOGGIATI_APARTMENT_ID",
} as const;

export async function getAlloggiatiSettingsSummary(): Promise<AlloggiatiSettingsSummary> {
  const values = await loadValues();
  const envPath = process.env["ENV_FILE_PATH"]?.trim();
  let updatedAt: string | null = null;
  if (envPath) {
    try {
      const { stat } = await import("node:fs/promises");
      updatedAt = (await stat(envPath)).mtime.toISOString();
    } catch { /* The page remains usable and reports the write error on save. */ }
  }
  return {
    userConfigured: Boolean(values.user),
    passwordConfigured: Boolean(values.password),
    wsKeyConfigured: Boolean(values.wsKey),
    apartmentIdConfigured: Boolean(values.apartmentId),
    accountMode: values.accountMode,
    userHint: mask(values.user),
    apartmentIdHint: mask(values.apartmentId),
    source: envPath ? "file" : hasEnvironmentSettings() ? "environment" : "unavailable",
    writable: Boolean(envPath),
    updatedAt,
    updatedBy: null,
  };
}

export async function saveAlloggiatiSettings(input: AlloggiatiSettingsInput, _actorEmail: string) {
  const envPath = process.env["ENV_FILE_PATH"]?.trim();
  if (!envPath) throw new Error("Il salvataggio diretto nel file .env è disponibile soltanto sulla VM di produzione.");
  const current = await loadValues();
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

  const { readFile, writeFile } = await import("node:fs/promises");
  const currentFile = await readFile(envPath, "utf8");
  const updatedFile = updateEnvFile(currentFile, {
    [envKeys.user]: values.user,
    [envKeys.password]: values.password,
    [envKeys.wsKey]: values.wsKey,
    [envKeys.accountMode]: values.accountMode,
    [envKeys.apartmentId]: values.apartmentId,
  });
  await writeFile(envPath, updatedFile, { encoding: "utf8", mode: 0o600 });
  for (const [name, value] of Object.entries(values)) process.env[envKeys[name as keyof typeof envKeys]] = String(value);
  return getAlloggiatiSettingsSummary();
}

async function loadValues() {
  const fromFile = new Map<string, string>();
  const envPath = process.env["ENV_FILE_PATH"]?.trim();
  if (envPath) {
    try {
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(envPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
        if (match) fromFile.set(match[1], decodeEnvValue(match[2]));
      }
    } catch { /* Fall back to the process environment. */ }
  }
  const value = (key: string) => fromFile.get(key) ?? process.env[key]?.trim() ?? "";
  const mode = value(envKeys.accountMode);
  return {
    user: value(envKeys.user),
    password: value(envKeys.password),
    wsKey: value(envKeys.wsKey),
    accountMode: mode === "apartments" ? "apartments" as const : "standard" as const,
    apartmentId: value(envKeys.apartmentId),
  };
}

function updateEnvFile(content: string, updates: Record<string, string>) {
  const remaining = new Map(Object.entries(updates));
  const lines = content.replace(/\r\n/g, "\n").split("\n").map((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!match || !remaining.has(match[1])) return line;
    const value = remaining.get(match[1]) ?? "";
    remaining.delete(match[1]);
    return match[1] + "=" + encodeEnvValue(value);
  });
  if (remaining.size) {
    if (lines.at(-1) !== "") lines.push("");
    lines.push("# Alloggiati Web · gestito dall'area riservata");
    for (const [key, value] of remaining) lines.push(key + "=" + encodeEnvValue(value));
  }
  return lines.join("\n").replace(/\n+$/, "") + "\n";
}

function encodeEnvValue(value: string) {
  if (/^[A-Za-z0-9._~:/@+,-]*$/.test(value)) return value;
  return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "$$$$") + '"';
}

function decodeEnvValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\$\$/g, "$");
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}

function keepOrReplace(current: string, proposed: unknown, maxLength: number, allowClear = false) {
  if (proposed === undefined || proposed === null) return current;
  if (typeof proposed !== "string") throw new Error("Formato dei valori non valido.");
  const value = proposed.trim();
  if (/\r|\n/.test(value)) throw new Error("I valori non possono contenere ritorni a capo.");
  if (value.length > maxLength) throw new Error("Uno dei valori inseriti è troppo lungo.");
  return value || (allowClear ? "" : current);
}

function hasEnvironmentSettings() {
  return Object.values(envKeys).some((key) => Boolean(process.env[key]?.trim()));
}

function mask(value: string) {
  if (!value) return "";
  if (value.length < 5) return "••••";
  return value.slice(0, 2) + "••••" + value.slice(-2);
}
