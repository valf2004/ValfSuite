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
  const [repository, compose, dockerfile] = await Promise.all([source("db/availability.postgres.ts"), source("docker-compose.yml"), source("Dockerfile")]);
  assert.match(repository, /process\.env(?:\.DATABASE_URL|\["DATABASE_URL"\])/);
  assert.match(repository, /CREATE TABLE IF NOT EXISTS availability_requests/);
  assert.match(compose, /image: postgres:17-alpine/);
  assert.match(compose, /postgres_data:\/var\/lib\/postgresql\/data/);
  assert.doesNotMatch(compose, /5432:5432/);
  assert.match(dockerfile, /availability\.postgres\.ts db\/availability\.ts/);
  assert.match(dockerfile, /delete j\.exports\.workerd/);
  assert.doesNotMatch(repository, /cloudflare:workers/);
});

test("models the complete booking workflow and archive outcomes", async () => {
  const [schema, dashboard, postgresRepository, migration] = await Promise.all([source("db/schema.ts"), source("app/area-privata/RequestsDashboard.tsx"), source("db/availability.postgres.ts"), source("drizzle/0001_booking_workflow.sql")]);
  for (const status of ["quote_requested","quote_sent","accepted","checked_in","police_registered","archived"]) assert.match(schema,new RegExp(status));
  for (const outcome of ["completed","cancelled","unavailable"]) assert.match(dashboard,new RegExp(outcome));
  assert.match(postgresRepository,/departure_date < CURRENT_DATE/);
  assert.match(migration,/archive_outcome/);
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

test("sends localized quotes and advances the workflow", async () => {
  const [dashboard, route, mailer] = await Promise.all([
    source("app/area-privata/RequestsDashboard.tsx"),
    source("app/api/gestione/preventivo/route.ts"),
    source("app/lib/availability-email.ts"),
  ]);
  for (const language of ["it", "en", "fr", "es", "de"]) assert.match(dashboard, new RegExp(`${language}:\\{subject:`));
  assert.match(dashboard, /\{PREZZO\}/);
  assert.match(dashboard, /manual-status/);
  assert.match(route, /privateUserFromCookie/);
  assert.match(route, /updateAvailabilityQuote\(item\.id, quoteAmountCents, subject, deliveredBody, user\.email\)/);
  assert.match(dashboard, /formatCurrency\(item\.quoteAmountCents\)/);
  assert.match(dashboard, /Non registrato/);
  assert.match(mailer, /sendQuoteEmail/);
});

test("stores and displays the complete request timeline", async () => {
  const [schema,dashboard,statusRoute,requestRoute,migration] = await Promise.all([source("db/schema.ts"),source("app/area-privata/RequestsDashboard.tsx"),source("app/api/gestione/richieste/route.ts"),source("app/api/disponibilita/route.ts"),source("drizzle/0003_request_timeline.sql")]);
  assert.match(schema,/availability_events/);
  assert.match(dashboard,/request-expand/);
  assert.match(dashboard,/request-timeline/);
  assert.match(dashboard,/Nota operatore/);
  assert.doesNotMatch(dashboard,/Attività in ordine di priorità/);
  assert.match(statusRoute,/note/);
  assert.match(requestRoute,/recordAvailabilityEvent/);
  assert.match(migration,/idx_availability_events_request_created/);
});

test("persists the sent quote value and message history", async () => {
  const [schema, repository, postgresRepository, migration] = await Promise.all([
    source("db/schema.ts"), source("db/availability.ts"), source("db/availability.postgres.ts"), source("drizzle/0002_quote_history.sql"),
  ]);
  for (const field of ["quoteAmountCents", "quoteSubject", "quoteBody", "quoteSentAt"]) assert.match(schema, new RegExp(field));
  assert.match(repository, /updateAvailabilityQuote/);
  assert.match(postgresRepository, /quote_amount_cents/);
  assert.match(migration, /quote_sent_at/);
});

test("confirms each availability request to the guest in their language", async () => {
  const [route, mailer] = await Promise.all([source("app/api/disponibilita/route.ts"), source("app/lib/availability-email.ts")]);
  assert.match(route, /sendAvailabilityConfirmation/);
  assert.match(route, /Promise\.allSettled/);
  assert.ok(route.indexOf("createAvailabilityRequest") < route.lastIndexOf("sendAvailabilityConfirmation"));
  assert.match(mailer, /to: data\.email/);
  for (const language of ["it", "en", "fr", "es", "de"]) assert.match(mailer, new RegExp(`${language}:\\{subject:`));
  assert.match(mailer, /non costituisce ancora una prenotazione/);
});
