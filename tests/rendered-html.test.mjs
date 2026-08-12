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
  assert.match(checkin, /departureOrder/);
  assert.match(checkin, /adultLead/);
  assert.match(checkin, /shiftYears/);
  assert.match(checkin, /nextDay/);
  assert.match(checkin, /window\.location\.assign/);
});

test("persists validated availability requests in D1", async () => {
  const [route, schema, hosting] = await Promise.all([
    source("app/api/disponibilita/route.ts"),
    source("db/schema.ts"),
    source(".openai/hosting.json"),
  ]);

  assert.match(route, /createAvailabilityRequest/);
  assert.match(route, /departureDate <= arrivalDate/);
  assert.match(route, /crypto\.randomUUID/);
  assert.match(schema, /availability_requests/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});

test("uses PostgreSQL on the VM without publishing a database port", async () => {
  const [repository, compose] = await Promise.all([source("db/availability.ts"), source("docker-compose.yml")]);
  assert.match(repository, /process\.env\.DATABASE_URL/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS availability_requests/);
  assert.match(compose, /image: postgres:17-alpine/);
  assert.match(compose, /postgres_data:\/var\/lib\/postgresql\/data/);
  assert.doesNotMatch(compose, /5432:5432/);
});

test("notifies the four administrators after persistence", async () => {
  const [route, mailer] = await Promise.all([
    source("app/api/disponibilita/route.ts"),
    source("app/lib/availability-email.ts"),
  ]);
  assert.ok(route.indexOf("insert(availabilityRequests)") < route.lastIndexOf("sendAvailabilityNotification"));
  for (const email of ["valfsuite@gmail.com", "viliorlandi@gmail.com", "angrimaldi@gmail.com", "valf2004@gmail.com"]) {
    assert.match(await source(".env.example"), new RegExp(email));
  }
  assert.match(mailer, /replyTo: data\.email/);
  assert.match(mailer, /SMTP_APP_PASSWORD/);
});
