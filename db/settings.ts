import { sql } from "drizzle-orm";
import { applicationSettings } from "./schema";

export type StoredSetting = {
  key: string;
  encryptedValue: string;
  updatedAt: string;
  updatedBy: string;
};

const usesPostgres = () => Boolean(process.env["DATABASE_URL"]?.trim());
const postgresRepository = () => import("./availability.postgres");

export async function getStoredSettings(keys: string[]): Promise<StoredSetting[]> {
  if (usesPostgres()) return (await postgresRepository()).getStoredSettings(keys);
  const { getDb } = await import(".");
  const rows = await getDb().select().from(applicationSettings);
  const wanted = new Set(keys);
  return rows.filter((row) => wanted.has(row.key));
}

export async function saveStoredSettings(settings: StoredSetting[]) {
  if (usesPostgres()) return (await postgresRepository()).saveStoredSettings(settings);
  if (!settings.length) return;
  const { getDb } = await import(".");
  await getDb().insert(applicationSettings).values(settings).onConflictDoUpdate({
    target: applicationSettings.key,
    set: {
      encryptedValue: sql`excluded.encrypted_value`,
      updatedAt: sql`excluded.updated_at`,
      updatedBy: sql`excluded.updated_by`,
    },
  });
}
