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
  assert.match(dashboard, /status-control/);
  assert.match(route, /privateUserFromCookie/);
  assert.match(route, /recordSentQuote/);
  assert.match(route, /\{LINK_PAGAMENTO\}/);
  assert.match(dashboard, /formatCurrency\(item\.quoteAmountCents\)/);
  assert.match(dashboard, /Preventivo non registrato/);
  assert.match(mailer, /sendQuoteEmail/);
  assert.match(mailer, /return \{ sent: true as const, subject, body \}/);
  assert.match(mailer, /return \{ sent: true as const, subject: copy\.subject, body: copy\.body \}/);
  assert.match(route, /quote_send_failed/);
});

test("stores and displays the complete request timeline", async () => {
  const [schema,dashboard,statusRoute,requestRoute,migration] = await Promise.all([source("db/schema.ts"),source("app/area-privata/RequestsDashboard.tsx"),source("app/api/gestione/richieste/route.ts"),source("app/api/disponibilita/route.ts"),source("drizzle/0003_request_timeline.sql")]);
  assert.match(schema,/availability_events/);
  assert.match(dashboard,/request-expand/);
  assert.match(dashboard,/Apri cronologia/);
  assert.doesNotMatch(dashboard,/>Dettagli</);
  assert.match(dashboard,/request-timeline/);
  assert.match(dashboard,/sort\(compareStayPeriod\)/);
  assert.match(dashboard,/arrivalDate\.localeCompare\(b\.arrivalDate\)/);
  assert.match(dashboard,/status-modal/);
  assert.match(dashboard,/testo completo di un’email/);
  assert.doesNotMatch(dashboard,/className="request-message"/);
  assert.doesNotMatch(dashboard,/Attività in ordine di priorità/);
  assert.ok(dashboard.indexOf('className="request-actions"') < dashboard.indexOf('expanded && <div className="request-details"'));
  assert.match(statusRoute,/note/);
  assert.match(requestRoute,/recordAvailabilityEvent/);
  assert.match(migration,/idx_availability_events_request_created/);
});

test("persists the sent quote value and message history", async () => {
  const [schema, repository, postgresRepository, migration] = await Promise.all([
    source("db/schema.ts"), source("db/availability.ts"), source("db/availability.postgres.ts"), source("drizzle/0002_quote_history.sql"),
  ]);
  for (const field of ["quoteAmountCents", "quoteSubject", "quoteBody", "quoteSentAt"]) assert.match(schema, new RegExp(field));
  assert.match(repository, /recordSentQuote/);
  assert.match(postgresRepository, /quote_amount_cents/);
  assert.match(migration, /quote_sent_at/);
});

test("collects payment notifications before booking acceptance", async () => {
  const [schema,dashboard,quoteRoute,paymentRoute,paymentPage,storage,compose,migration,hosting,propertyDate] = await Promise.all([
    source("db/schema.ts"),source("app/area-privata/RequestsDashboard.tsx"),source("app/api/gestione/preventivo/route.ts"),source("app/api/pagamento/[token]/route.ts"),source("app/pagamento/[token]/PaymentForm.tsx"),source("app/lib/receipt-storage.ts"),source("docker-compose.yml"),source("drizzle/0004_payment_flow.sql"),source(".openai/hosting.json"),source("app/lib/property-date.ts"),
  ]);
  for (const content of [schema,dashboard]) assert.match(content,/payment_reported/);
  assert.match(dashboard,/Pagamenti da verificare/);
  assert.match(dashboard,/Scarica ricevuta/);
  assert.match(quoteRoute,/createPaymentToken/);
  assert.match(quoteRoute,/hashPaymentToken/);
  assert.match(paymentRoute,/createPaymentSubmission/);
  assert.match(paymentRoute,/5\*1024\*1024/);
  assert.match(paymentPage,/Receipt \(optional\)/);
  assert.match(paymentPage,/defaultValue=\{today\}/);
  assert.match(paymentPage,/max=\{today\}/);
  assert.match(paymentRoute,/todayAtProperty\(\)/);
  assert.match(propertyDate,/Europe\/Rome/);
  assert.match(storage,/RECEIPTS_DIR/);
  assert.match(storage,/RECEIPTS/);
  assert.match(compose,/receipts_data:\/app\/private-receipts/);
  assert.match(migration,/payment_submissions/);
  assert.equal(JSON.parse(hosting).r2,"RECEIPTS");
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

test("shows overlapping requests in a protected booking calendar", async () => {
  const [calendarPage,calendar,chrome,styles,statusRoute] = await Promise.all([
    source("app/area-riservata/calendario/page.tsx"),
    source("app/area-privata/BookingCalendar.tsx"),
    source("app/area-privata/PrivateChrome.tsx"),
    source("app/checkin.css"),
    source("app/api/gestione/richieste/route.ts"),
  ]);
  assert.match(calendarPage,/privateUserFromCookie/);
  assert.match(calendarPage,/robots:\{index:false,follow:false\}/);
  assert.match(chrome,/area-riservata\/calendario/);
  assert.match(calendar,/Calendario prenotazioni/);
  assert.match(calendar,/items\.slice\(0,3\)/);
  assert.match(calendar,/\+ altre/);
  assert.match(calendar,/item\.departureDate>key/);
  assert.match(calendar,/confirmedStatuses/);
  for(const status of ["quote_requested","quote_sent","accepted","checked_in","police_registered","archived"])assert.match(calendar,new RegExp(status));
  assert.match(styles,/booking-calendar/);
  assert.match(styles,/calendar-event\.tentative/);
  assert.match(statusRoute,/target\.arrivalDate<item\.departureDate&&target\.departureDate>item\.arrivalDate/);
  assert.match(statusRoute,/data\.force!==true/);
  assert.match(statusRoute,/Sovrapposizione confermata manualmente/);
});

test("confirms verified payments and tracks the remaining balance", async () => {
  const [route,dashboard,schema,repository,postgresRepository,mailer,paymentPage,paymentRoute,paymentForm] = await Promise.all([
    source("app/api/gestione/conferma/route.ts"),
    source("app/area-privata/RequestsDashboard.tsx"),
    source("db/schema.ts"),
    source("db/availability.ts"),
    source("db/availability.postgres.ts"),
    source("app/lib/availability-email.ts"),
    source("app/pagamento/[token]/page.tsx"),
    source("app/api/pagamento/[token]/route.ts"),
    source("app/pagamento/[token]/PaymentForm.tsx"),
  ]);
  assert.match(route,/privateUserFromCookie/);
  assert.match(route,/sendPaymentConfirmationEmail/);
  assert.match(route,/recordPaymentConfirmation/);
  assert.match(route,/confirmedCents/);
  assert.match(route,/remainingAfter/);
  assert.match(route,/todayAtProperty\(\)>=dueDate/);
  assert.match(route,/7 giorni prima dell’arrivo/);
  assert.match(route,/meno di 7 giorni all’arrivo/);
  assert.match(dashboard,/Conferma pagamento/);
  assert.match(dashboard,/Saldo da versare:/);
  assert.match(dashboard,/payment-confirmation-form/);
  assert.match(dashboard,/\{ISTRUZIONI_SALDO\}/);
  assert.match(schema,/payment_confirmed/);
  assert.match(repository,/recordPaymentConfirmation/);
  assert.match(postgresRepository,/recordPaymentConfirmation/);
  assert.match(repository,/fullyPaid/);
  assert.match(mailer,/sendPaymentConfirmationEmail/);
  assert.match(paymentPage,/"accepted"/);
  assert.match(paymentPage,/confirmedCents=\{quote\.confirmedAmountCents\}/);
  assert.match(paymentRoute,/"accepted"/);
  assert.match(paymentForm,/remainingCents=Math\.max\(0,totalCents-confirmedCents\)/);
  assert.match(paymentForm,/balanceRequested\?balanceCents/);
  assert.match(paymentForm,/totalCents-\(confirmedCents>0\?confirmedCents:depositCents\)/);
  assert.match(paymentForm,/Saldo residuo/);
});

test("sends balance and check-in links through the accepted booking workflow", async () => {
  const [dashboard,confirmation,balanceRoute,inviteRoute,checkinRoute,checkinPage,checkinForm,tokenHelper,repository,postgresRepository,schema,mailer,paymentRoute] = await Promise.all([
    source("app/area-privata/RequestsDashboard.tsx"),
    source("app/api/gestione/conferma/route.ts"),
    source("app/api/gestione/saldo/route.ts"),
    source("app/api/gestione/checkin-invito/route.ts"),
    source("app/api/checkin/[token]/route.ts"),
    source("app/checkin/[token]/page.tsx"),
    source("app/checkin/GuestCheckin.tsx"),
    source("app/lib/checkin-token.ts"),
    source("db/availability.ts"),
    source("db/availability.postgres.ts"),
    source("db/schema.ts"),
    source("app/lib/availability-email.ts"),
    source("app/api/pagamento/[token]/route.ts"),
  ]);
  assert.match(dashboard,/Richiedi saldo/);
  assert.match(dashboard,/Invita al check-in/);
  assert.match(dashboard,/balanceRequestTemplate/);
  assert.match(dashboard,/checkinInviteTemplate/);
  assert.match(dashboard,/{ISTRUZIONI_PROSSIMO_PASSO}/);
  assert.match(confirmation,/nextPaymentTokenHash/);
  assert.match(confirmation,/createCheckinToken/);
  assert.match(confirmation,/nextStepInstruction/);
  assert.match(balanceRoute,/recordGuestCommunication/);
  assert.match(balanceRoute,/recordedOrExpectedDeposit/);
  assert.match(balanceRoute,/Math\.round\(item\.quoteAmountCents\*\.3\)/);
  assert.match(balanceRoute,/{LINK_SALDO}/);
  assert.match(balanceRoute,/\?saldo=1/);
  assert.match(inviteRoute,/createCheckinToken/);
  assert.match(inviteRoute,/{LINK_CHECKIN}/);
  assert.match(checkinRoute,/verifyCheckinToken/);
  assert.match(checkinRoute,/recordCheckinSubmission/);
  assert.match(checkinPage,/booking=\{\{/);
  assert.match(checkinForm,/\/api\/checkin\/\$\{token\}/);
  assert.match(checkinForm,/Check-in protetto/);
  assert.match(tokenHelper,/new SignJWT/);
  assert.match(tokenHelper,/jwtVerify/);
  assert.match(repository,/recordGuestCommunication/);
  assert.match(repository,/recordCheckinSubmission/);
  assert.match(postgresRepository,/recordGuestCommunication/);
  assert.match(postgresRepository,/recordCheckinSubmission/);
  for(const eventType of ["balance_requested","checkin_invited","checkin_submitted"])assert.match(schema,new RegExp(eventType));
  assert.match(mailer,/actionUrl\?:string/);
  assert.match(paymentRoute,/"checked_in","police_registered"/);
});

test("keeps payment progress separate from booking status", async () => {
  const [schema,repository,postgresRepository,dashboard,confirmation,paymentRoute,statusRoute,migration] = await Promise.all([
    source("db/schema.ts"),
    source("db/availability.ts"),
    source("db/availability.postgres.ts"),
    source("app/area-privata/RequestsDashboard.tsx"),
    source("app/api/gestione/conferma/route.ts"),
    source("app/api/pagamento/[token]/route.ts"),
    source("app/api/gestione/richieste/route.ts"),
    source("drizzle/0005_fantastic_zodiak.sql"),
  ]);
  assert.match(schema,/paymentStatus: text\("payment_status"/);
  for(const value of ["unpaid","reported","partial","paid"])assert.match(schema,new RegExp(`"${value}"`));
  assert.match(repository,/set\(\{paymentStatus:"reported"/);
  assert.doesNotMatch(repository,/set\(\{status:"payment_reported"/);
  assert.match(postgresRepository,/SET payment_status='reported'/);
  assert.doesNotMatch(postgresRepository,/SET status='payment_reported'/);
  assert.match(confirmation,/item\.paymentStatus!=="reported"/);
  assert.match(dashboard,/matchesTab\(item,active\)/);
  assert.match(dashboard,/item\.paymentStatus==="reported"/);
  assert.match(dashboard,/Stato prenotazione/);
  assert.doesNotMatch(statusRoute,/const statuses = \[[^\]]*payment_reported/);
  assert.match(paymentRoute,/paymentStatus:"reported"/);
  assert.match(migration,/ADD `payment_status`/);
  assert.match(migration,/SET `payment_status` = 'reported'/);
  assert.match(migration,/SET `status` = COALESCE/);
});

test("returns expired private sessions to the login page", async () => {
  const [dashboard,authenticatedFetch,privatePage,privateChrome,receiptRoute,styles] = await Promise.all([
    source("app/area-privata/RequestsDashboard.tsx"),
    source("app/area-privata/authenticated-fetch.ts"),
    source("app/area-privata/page.tsx"),
    source("app/area-privata/PrivateChrome.tsx"),
    source("app/api/gestione/ricevute/[id]/route.ts"),
    source("app/checkin.css"),
  ]);
  assert.equal((dashboard.match(/authenticatedFetch\(/g)||[]).length,4);
  assert.match(authenticatedFetch,/response\.status !== 401/);
  assert.match(authenticatedFetch,/window\.location\.replace/);
  assert.match(authenticatedFetch,/sessione", "scaduta"/);
  assert.match(privatePage,/query\.sessione==="scaduta"/);
  assert.match(privateChrome,/La sessione è scaduta\./);
  assert.match(privateChrome,/role="alert"/);
  assert.match(receiptRoute,/Location:"\/area-riservata\?sessione=scaduta"/);
  assert.match(styles,/\.private-session-expired/);
});
