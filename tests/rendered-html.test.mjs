import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("contains the VALF Suite production metadata", async () => {
  const [layout, packageJson] = await Promise.all([
    source("app/layout.tsx"),
    source("package.json"),
  ]);

  assert.match(layout, /VALF Suite \| Casa vacanze ad Arcola/);
  assert.match(layout, /https:\/\/valfsuite\.valfservice\.it/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.equal(JSON.parse(packageJson).name, "valfsuite");
});

test("declares all public languages and pages", async () => {
  const routes = await source("app/[[...segments]]/page.tsx");

  for (const language of ["it", "en", "fr", "es", "de"]) {
    assert.match(routes, new RegExp(`"${language}"`));
  }
  for (const page of ["la-suite", "servizi", "galleria", "dintorni", "prenota", "contatti", "condizioni"]) {
    assert.match(routes, new RegExp(`"${page}"`));
  }
});

test("keeps the reserved area private and OAuth sessions compatible", async () => {
  const [reservedArea, callback, gitignore] = await Promise.all([
    source("app/area-riservata/page.tsx"),
    source("app/api/auth/google/callback/route.ts"),
    source(".gitignore"),
  ]);

  assert.match(reservedArea, /index:\s*false/);
  assert.match(callback, /authCookies\.session, session, 8 \* 60 \* 60, "Lax"/);
  assert.match(gitignore, /^\.env\*/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});

test("provides a five-step check-in preview with arrival details", async () => {
  const checkin = await source("app/checkin/GuestCheckin.tsx");

  assert.match(checkin, /\["stay", "lead", "guests", "arrival", "review"\]/);
  assert.match(checkin, /arrival-time/);
  assert.match(checkin, /arrival-notes/);
  assert.match(checkin, /setValues/);
});
