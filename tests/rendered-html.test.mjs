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
  const [reservedArea, privatePage, privateChrome, sitePage, callback, gitignore] = await Promise.all([
    source("app/area-riservata/page.tsx"),
    source("app/area-privata/page.tsx"),
    source("app/area-privata/PrivateChrome.tsx"),
    source("app/SitePage.tsx"),
    source("app/api/auth/google/callback/route.ts"),
    source(".gitignore"),
  ]);

  assert.match(reservedArea, /index:\s*false/);
  assert.match(sitePage, /https:\/\/valfsuite\.valfservice\.it\/area-riservata/);
  assert.match(privatePage, /host\.endsWith\("\.chatgpt\.site"\)/);
  assert.match(privatePage, /query\.errore/);
  assert.match(privateChrome, /Account non autorizzato/);
  assert.match(callback, /authCookies\.session, session, 8 \* 60 \* 60, "Lax"/);
  assert.match(callback, /google_auth_callback_failed/);
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
  assert.match(paymentForm,/totalCents-\(confirmedCents>0\?confirmedCents:initialRequestedCents\)/);
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
  assert.equal((dashboard.match(/authenticatedFetch\(/g)||[]).length,5);
  assert.match(authenticatedFetch,/response\.status !== 401/);
  assert.match(authenticatedFetch,/window\.location\.replace/);
  assert.match(authenticatedFetch,/sessione", "scaduta"/);
  assert.match(privatePage,/query\.sessione==="scaduta"/);
  assert.match(privateChrome,/La sessione è scaduta\./);
  assert.match(privateChrome,/role="alert"/);
  assert.match(receiptRoute,/Location:"\/area-riservata\?sessione=scaduta"/);
  assert.match(styles,/\.private-session-expired/);
});


test("creates linked practices without changing accepted bookings", async () => {
  const [schema,route,dashboard,postgres,migration] = await Promise.all([
    source("db/schema.ts"),
    source("app/api/gestione/richieste/route.ts"),
    source("app/area-privata/RequestsDashboard.tsx"),
    source("db/availability.postgres.ts"),
    source("drizzle/0006_ambiguous_white_queen.sql"),
  ]);
  assert.match(schema,/sourceRequestId: text\("source_request_id"\)/);
  assert.match(schema,/relationReason: text\("relation_reason"/);
  assert.match(schema,/related_request_created/);
  assert.match(route,/export async function POST/);
  assert.match(route,/todayAtProperty\(\)/);
  assert.match(route,/sourceRequestId:source.id/);
  assert.match(route,/paymentStatus:"unpaid"/);
  assert.match(route,/La pratica originale resta invariata/);
  assert.match(dashboard,/canReviseQuote=.*paymentStatus==="unpaid"/);
  assert.match(dashboard,/Crea nuova richiesta/);
  assert.match(dashboard,/Variazione soggiorno/);
  assert.match(dashboard,/method:"POST"/);
  assert.match(dashboard,/Crea e prepara preventivo/);
  assert.match(postgres,/source_request_id,relation_reason/);
  assert.match(migration,/source_request_id/);
  assert.match(migration,/relation_reason/);
});


test("configures deposit and balance percentages and persists the calculated payment", async () => {
  const [dashboard,route,schema,repository,postgresRepository,paymentPage,paymentForm,balanceRoute,migration] = await Promise.all([
    source("app/area-privata/RequestsDashboard.tsx"),
    source("app/api/gestione/preventivo/route.ts"),
    source("db/schema.ts"),
    source("db/availability.ts"),
    source("db/availability.postgres.ts"),
    source("app/pagamento/[token]/page.tsx"),
    source("app/pagamento/[token]/PaymentForm.tsx"),
    source("app/api/gestione/saldo/route.ts"),
    source("drizzle/0008_previous_lester.sql"),
  ]);
  assert.match(dashboard,/Importo richiesto ora/);
  assert.match(dashboard,/isShortNotice\(item\.arrivalDate,today\)/);
  assert.match(dashboard,/entro 7 giorni/);
  assert.match(dashboard,/depositPercent/);
  assert.match(dashboard,/balancePercent/);
  assert.match(dashboard,/paymentFromPercentage/);
  assert.match(dashboard,/CONDIZIONI_PAGAMENTO/);
  assert.match(route,/data\.depositPercent \+ data\.balancePercent !== 100/);
  assert.match(route,/requestedPaymentCents===quoteAmountCents/);
  assert.match(route,/quoteAmountCents \* depositPercent \/ 100/);
  assert.match(route,/pagamento dell’intero importo/);
  assert.match(route,/requestedPaymentCents,depositPercent,balancePercent,subject/);
  assert.match(schema,/quoteRequestedPaymentCents: integer\("quote_requested_payment_cents"\)/);
  assert.match(schema,/requestedPaymentCents: integer\("requested_payment_cents"\)/);
  assert.match(schema,/quoteDepositPercent: integer\("quote_deposit_percent"\)/);
  assert.match(schema,/depositPercent: integer\("deposit_percent"\)/);
  assert.match(repository,/requestedPaymentCents:quote\.requestedPaymentCents/);
  assert.match(postgresRepository,/requested_payment_cents/);
  assert.match(paymentPage,/requestedPaymentCents=\{quote\.requestedPaymentCents\}/);
  assert.match(paymentForm,/initialRequestedCents/);
  assert.match(paymentForm,/Importo richiesto/);
  assert.match(balanceRoute,/quoteRequestedPaymentCents/);
  assert.match(migration,/deposit_percent/);
  assert.match(migration,/balance_percent/);
  assert.match(migration,/quote_deposit_percent/);
  assert.match(migration,/quote_balance_percent/);
});


test("manages the complete VM environment from one protected page", async () => {
  const [chrome,page,form,route,settings,schema,compose,example] = await Promise.all([
    source("app/area-privata/PrivateChrome.tsx"),source("app/area-riservata/impostazioni/page.tsx"),source("app/area-privata/EnvironmentSettingsForm.tsx"),source("app/api/gestione/impostazioni/route.ts"),source("app/lib/environment-settings.ts"),source("db/schema.ts"),source("docker-compose.yml"),source(".env.example"),
  ]);
  assert.ok(chrome.indexOf("settings-link") < chrome.indexOf('href="/api/auth/logout"'));
  assert.match(page,/privateUserFromCookie/);
  assert.match(page,/EnvironmentSettingsForm/);
  assert.match(form,/Salva nel \.env/);
  assert.match(form,/input\[type="password"\]/);
  assert.match(form,/setting\.editable/);
  assert.match(route,/privateUserFromCookie/);
  assert.match(settings,/ENV_FILE_PATH/);
  assert.match(settings,/writeFile\(envPath/);
  assert.match(settings,/updateEnvFile/);
  assert.match(settings,/if\(replaced\.has\(match\[1\]\)\)return \[\]/);
  assert.match(settings,/POSTGRES_PASSWORD[^}]*editable:false/);
  assert.match(settings,/RECEIPTS_DIR[^}]*editable:false/);
  for(const key of ["SMTP_APP_PASSWORD","GOOGLE_OAUTH_CLIENT_SECRET","AUTH_SESSION_SECRET","ALLOGGIATI_WSKEY","AUTHORIZED_ADMIN_EMAILS"]){assert.match(settings,new RegExp(key));assert.match(example,new RegExp(key));}
  assert.match(schema,/compatibilità con la migrazione 0009/);
  assert.match(compose,/ENV_FILE_PATH: \/app\/\.env\.runtime/);
  assert.match(compose,/\.\/\.env:\/app\/\.env\.runtime/);
});

test("explains environment settings through an in-page help dialog", async () => {
  const [form,settings,styles]=await Promise.all([source("app/area-privata/EnvironmentSettingsForm.tsx"),source("app/lib/environment-settings.ts"),source("app/checkin.css")]);
  assert.match(form,/settings-help-button/);
  assert.match(form,/role="dialog"/);
  assert.match(form,/Attualmente VALF Suite non usa questo collegamento/);
  assert.match(form,/event\.key==="Escape"/);
  assert.match(settings,/Opzionale e attualmente non utilizzato/);
  assert.match(styles,/settings-help-overlay/);
});

test("creates a generic Alloggiati lookup table", async () => {
  const [schema,postgres,migration]=await Promise.all([source("db/schema.ts"),source("db/availability.postgres.ts"),source("drizzle/0010_youthful_preak.sql")]);
  assert.match(schema,/alloggiati_lookup_values/);
  for(const field of ["id","tableName","itemKey","itemValue"])assert.match(schema,new RegExp(field));
  assert.match(schema,/idx_alloggiati_lookup_table_key/);
  assert.match(postgres,/CREATE TABLE IF NOT EXISTS alloggiati_lookup_values/);
  assert.match(migration,/alloggiati_lookup_values/);
  assert.match(migration,/table_name/);
  assert.match(migration,/item_key/);
  assert.match(migration,/item_value/);
});

test("offers a protected read-only database console with bounded results", async () => {
  const [page,component,route,repository,postgres,chrome,styles]=await Promise.all([source("app/area-riservata/database/page.tsx"),source("app/area-privata/DatabaseConsole.tsx"),source("app/api/gestione/database/route.ts"),source("db/database-console.ts"),source("db/database-console.postgres.ts"),source("app/area-privata/PrivateChrome.tsx"),source("app/checkin.css")]);
  assert.match(page,/privateUserFromCookie/);
  assert.match(page,/robots:{index:false,follow:false}/);
  assert.match(route,/privateUserFromCookie/);
  assert.match(chrome,/area-riservata\/database/);
  assert.match(component,/SELECT \* FROM/);
  assert.match(component,/Esegui SELECT/);
  assert.match(repository,/sqlite_schema/);
  assert.match(repository,/LIMIT 501/);
  assert.match(repository,/Sono consentite query su una sola tabella/);
  assert.match(repository,/Funzioni, sottoquery e commenti SQL non sono consentiti/);
  assert.match(repository,/tables\.includes\(table\)/);
  assert.match(postgres,/begin\("read only"/);
  assert.match(postgres,/statement_timeout/);
  assert.match(styles,/database-results-scroll \{ max-height:calc\(100vh - 330px\); min-height:180px; overflow:auto/);
  assert.match(styles,/position:sticky/);
});

test("operators can complete check-in from the private dashboard", async () => {
  const [dashboard,operatorRoute,operatorPage,guestForm,repository]=await Promise.all([
    source("app/area-privata/RequestsDashboard.tsx"),
    source("app/api/gestione/checkin/[id]/route.ts"),
    source("app/area-riservata/checkin/[id]/page.tsx"),
    source("app/checkin/GuestCheckin.tsx"),
    source("db/availability.ts"),
  ]);
  assert.match(dashboard,/Compila check-in/);
  assert.match(operatorRoute,/privateUserFromCookie/);
  assert.match(operatorRoute,/prepareCheckinSubmission/);
  assert.match(operatorPage,/operatorMode/);
  assert.match(guestForm,/Registra check-in/);
  assert.match(repository,/Check-in compilato dall’operatore/);
});

test("keeps guest and operator check-ins editable until Alloggiati submission", async () => {
  const [dashboard,operatorRoute,guestRoute,operatorPage,guestPage,form,repository,postgres,schema,migration]=await Promise.all([
    source("app/area-privata/RequestsDashboard.tsx"),
    source("app/api/gestione/checkin/[id]/route.ts"),
    source("app/api/checkin/[token]/route.ts"),
    source("app/area-riservata/checkin/[id]/page.tsx"),
    source("app/checkin/[token]/page.tsx"),
    source("app/checkin/GuestCheckin.tsx"),
    source("db/availability.ts"),
    source("db/availability.postgres.ts"),
    source("db/schema.ts"),
    source("drizzle/0011_thin_mach_iv.sql"),
  ]);
  assert.match(dashboard,/Modifica check-in/);
  assert.match(operatorRoute,/["accepted","checked_in"]/);
  assert.match(guestRoute,/["accepted","checked_in"]/);
  assert.match(operatorRoute,/police_registered/);
  assert.match(guestRoute,/police_registered/);
  assert.match(operatorPage,/getCheckinSubmission/);
  assert.match(guestPage,/getCheckinSubmission/);
  assert.doesNotMatch(form,/alreadyCompleted/);
  assert.match(form,/booking\.draft\?\.values/);
  assert.match(form,/La scheda resta modificabile fino all’invio ad Alloggiati Web/);
  assert.match(form,/navigateOperatorArea/);
  assert.match(form,/window\.location\.assign\("\/area-riservata"\)/);
  assert.match(repository,/checkin_updated/);
  assert.match(postgres,/version=checkin_practices\.version\+1/);
  assert.match(schema,/checkinPractices/);
  assert.match(schema,/checkinGuests/);
  assert.match(migration,/CREATE TABLE `checkin_practices`/);
  assert.match(migration,/CREATE TABLE `checkin_guests`/);
});

test("imports and applies the official Alloggiati reference tables", async () => {
  const [client,route,settings,form,submission,lookups,postgres,schema,migration]=await Promise.all([
    source("app/lib/alloggiati-client.ts"),
    source("app/api/gestione/alloggiati/tabelle/route.ts"),
    source("app/area-privata/EnvironmentSettingsForm.tsx"),
    source("app/checkin/GuestCheckin.tsx"),
    source("app/lib/checkin-submission.ts"),
    source("db/alloggiati-lookups.ts"),
    source("db/alloggiati-lookups.postgres.ts"),
    source("db/schema.ts"),
    source("drizzle/0011_thin_mach_iv.sql"),
  ]);
  for(const name of ["Luoghi","Tipi_Documento","Tipi_Alloggiato","TipoErrore","ListaAppartamenti"])assert.match(client,new RegExp(name));
  assert.match(client,/SOAPAction/);
  assert.match(client,/parseLookupCsv/);
  assert.match(client,/non contiene righe importabili/);
  assert.match(route,/privateUserFromCookie/);
  assert.match(settings,/Aggiorna tabelle Alloggiati/);
  assert.match(form,/alloggiati-places/);
  assert.match(form,/<option value="1">/);
  assert.match(form,/<option value="2">/);
  assert.match(submission,/validateCheckinLookupCodes/);
  for(const code of ["16","17","18","19","20"])assert.match(submission,new RegExp(`"${code}"`));
  assert.match(lookups,/active:false/);
  assert.match(postgres,/ON CONFLICT \(table_name,item_key\)/);
  assert.match(schema,/metadataJson/);
  assert.match(schema,/syncedAt/);
  assert.match(migration,/metadata_json/);
  assert.match(migration,/synced_at/);
});

test("prepares and audits Alloggiati Web test submissions without enabling real sends", async () => {
  const [dashboard,page,form,route,records,client,repository,postgres,schema]=await Promise.all([
    source("app/area-privata/RequestsDashboard.tsx"),
    source("app/area-riservata/alloggiati/[id]/page.tsx"),
    source("app/area-privata/AlloggiatiTestForm.tsx"),
    source("app/api/gestione/alloggiati/test/[id]/route.ts"),
    source("app/lib/alloggiati-record.ts"),
    source("app/lib/alloggiati-client.ts"),
    source("db/availability.ts"),
    source("db/availability.postgres.ts"),
    source("db/schema.ts"),
  ]);
  assert.match(dashboard,/Prepara Alloggiati/);
  assert.match(page,/buildAlloggiatiRecords/);
  assert.match(form,/Invia test/);
  assert.match(form,/Invio reale · non attivo/);
  assert.match(form,/disabled title=/);
  assert.match(route,/privateUserFromCookie/);
  assert.match(route,/item\.status!=="checked_in"/);
  assert.match(records,/record\.length!==168/);
  assert.match(records,/Massimo 30|da 1 a 30 giorni/);
  assert.match(client,/GestioneAppartamenti_Test/);
  assert.match(client,/AlloggiatiService\/\$\{action\}/);
  assert.match(repository,/recordAlloggiatiTestResult/);
  assert.match(postgres,/recordAlloggiatiTestResult/);
  assert.match(schema,/alloggiati_tested/);
});

test("publishes the supplied VALF Suite photographs in the hero and gallery", async () => {
  const [site,styles]=await Promise.all([source("app/SitePage.tsx"),source("app/globals.css")]);
  for(const image of ["_DSC4773.jpg","_DSC4776.jpg","_DSC4779.jpg","_DSC4782.jpg","_DSC4786.jpg","_DSC4789.jpg","_DSC4791.jpg","_DSC4803.jpg","_DSC4816.jpg","_DSC5885.jpg","_DSC5888.jpg"])assert.match(site,new RegExp(image.replace(".","\\.")));
  assert.match(site,/GallerySlider/);
  assert.match(site,/gallery-arrow previous/);
  assert.match(site,/gallery-thumbnails/);
  assert.match(site,/ArrowLeft/);
  assert.match(site,/ArrowRight/);
  assert.match(site,/Scopri gli ambienti interni/);
  assert.match(styles,/\.hero-art img/);
  assert.match(styles,/\.gallery-stage img/);
  assert.match(styles,/\.gallery-thumbnails button\.active/);
});
