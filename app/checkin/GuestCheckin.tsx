"use client";

import { FormEvent, MouseEvent, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Lang = "it" | "en" | "fr" | "es" | "de";

const languageNames: Record<Lang, string> = { it: "Italiano", en: "English", fr: "Français", es: "Español", de: "Deutsch" };
const text: Record<Lang, Record<string, string>> = {
  it: { demo:"Anteprima sicura", demoText:"Questa versione non salva né trasmette dati personali.", title:"Pre-check-in online", intro:"Inserisci in anticipo i dati degli ospiti. Angela verificherà i documenti originali al vostro arrivo.", stay:"Soggiorno", lead:"Ospite principale", guests:"Altri ospiti", review:"Riepilogo", arrival:"Arrivo", departure:"Partenza", count:"Numero di ospiti", reference:"Codice prenotazione", name:"Nome", surname:"Cognome", birth:"Data di nascita", sex:"Sesso", citizenship:"Cittadinanza", birthCountry:"Stato di nascita", birthPlace:"Comune o località di nascita", documentType:"Tipo di documento", documentNumber:"Numero del documento", issuePlace:"Luogo di rilascio", male:"Maschile", female:"Femminile", choose:"Seleziona", back:"Indietro", next:"Continua", send:"Invia ad Angela", privacy:"Ho letto l’informativa sul trattamento dei dati per gli obblighi di pubblica sicurezza.", legal:"I dati saranno utilizzati esclusivamente per la gestione del soggiorno e per gli adempimenti previsti dall’art. 109 T.U.L.P.S. Non è richiesto il caricamento di fotografie dei documenti.", complete:"Pre-check-in dimostrativo completato", completeText:"In questa anteprima nessun dato è stato salvato. Nella versione definitiva Angela riceverà una notifica e verificherà i documenti all’arrivo.", home:"Torna al sito" },
  en: { demo:"Secure preview", demoText:"This version does not save or transmit personal data.", title:"Online pre-check-in", intro:"Enter guest details in advance. Angela will check the original documents when you arrive.", stay:"Stay", lead:"Lead guest", guests:"Other guests", review:"Review", arrival:"Arrival", departure:"Departure", count:"Number of guests", reference:"Booking reference", name:"First name", surname:"Last name", birth:"Date of birth", sex:"Sex", citizenship:"Citizenship", birthCountry:"Country of birth", birthPlace:"Town or place of birth", documentType:"Document type", documentNumber:"Document number", issuePlace:"Place of issue", male:"Male", female:"Female", choose:"Select", back:"Back", next:"Continue", send:"Send to Angela", privacy:"I have read the privacy notice concerning processing required for public-security obligations.", legal:"Data will be used only to manage the stay and meet the obligations under Article 109 T.U.L.P.S. No document photographs are required.", complete:"Demo pre-check-in completed", completeText:"No data was saved in this preview. In the final version Angela will be notified and will check the documents on arrival.", home:"Back to website" },
  fr: { demo:"Aperçu sécurisé", demoText:"Cette version n’enregistre ni ne transmet de données personnelles.", title:"Pré-enregistrement en ligne", intro:"Saisissez à l’avance les informations des voyageurs. Angela vérifiera les documents originaux à votre arrivée.", stay:"Séjour", lead:"Voyageur principal", guests:"Autres voyageurs", review:"Récapitulatif", arrival:"Arrivée", departure:"Départ", count:"Nombre de voyageurs", reference:"Code de réservation", name:"Prénom", surname:"Nom", birth:"Date de naissance", sex:"Sexe", citizenship:"Nationalité", birthCountry:"Pays de naissance", birthPlace:"Commune ou lieu de naissance", documentType:"Type de document", documentNumber:"Numéro du document", issuePlace:"Lieu de délivrance", male:"Masculin", female:"Féminin", choose:"Sélectionner", back:"Retour", next:"Continuer", send:"Envoyer à Angela", privacy:"J’ai lu l’information sur le traitement des données requis par les obligations de sécurité publique.", legal:"Les données seront utilisées uniquement pour gérer le séjour et respecter l’article 109 T.U.L.P.S. Aucune photo de document n’est demandée.", complete:"Pré-enregistrement de démonstration terminé", completeText:"Aucune donnée n’a été enregistrée dans cet aperçu. Dans la version finale, Angela sera avertie et vérifiera les documents à l’arrivée.", home:"Retour au site" },
  es: { demo:"Vista previa segura", demoText:"Esta versión no guarda ni transmite datos personales.", title:"Pre check-in online", intro:"Introduce con antelación los datos de los huéspedes. Angela comprobará los documentos originales a la llegada.", stay:"Estancia", lead:"Huésped principal", guests:"Otros huéspedes", review:"Resumen", arrival:"Llegada", departure:"Salida", count:"Número de huéspedes", reference:"Código de reserva", name:"Nombre", surname:"Apellidos", birth:"Fecha de nacimiento", sex:"Sexo", citizenship:"Nacionalidad", birthCountry:"País de nacimiento", birthPlace:"Municipio o lugar de nacimiento", documentType:"Tipo de documento", documentNumber:"Número del documento", issuePlace:"Lugar de expedición", male:"Masculino", female:"Femenino", choose:"Seleccionar", back:"Atrás", next:"Continuar", send:"Enviar a Angela", privacy:"He leído la información sobre el tratamiento de datos necesario para las obligaciones de seguridad pública.", legal:"Los datos se utilizarán únicamente para gestionar la estancia y cumplir el artículo 109 T.U.L.P.S. No se solicitan fotografías de documentos.", complete:"Pre check-in de demostración completado", completeText:"En esta vista previa no se ha guardado ningún dato. En la versión final, Angela recibirá un aviso y comprobará los documentos a la llegada.", home:"Volver al sitio" },
  de: { demo:"Sichere Vorschau", demoText:"Diese Version speichert oder übermittelt keine personenbezogenen Daten.", title:"Online-Vorab-Check-in", intro:"Geben Sie die Gästedaten vorab ein. Angela prüft die Originaldokumente bei Ihrer Ankunft.", stay:"Aufenthalt", lead:"Hauptgast", guests:"Weitere Gäste", review:"Übersicht", arrival:"Anreise", departure:"Abreise", count:"Anzahl der Gäste", reference:"Buchungscode", name:"Vorname", surname:"Nachname", birth:"Geburtsdatum", sex:"Geschlecht", citizenship:"Staatsangehörigkeit", birthCountry:"Geburtsland", birthPlace:"Geburtsort", documentType:"Dokumentart", documentNumber:"Dokumentnummer", issuePlace:"Ausstellungsort", male:"Männlich", female:"Weiblich", choose:"Auswählen", back:"Zurück", next:"Weiter", send:"An Angela senden", privacy:"Ich habe die Datenschutzhinweise zur Verarbeitung für die Pflichten der öffentlichen Sicherheit gelesen.", legal:"Die Daten werden nur zur Verwaltung des Aufenthalts und zur Erfüllung von Artikel 109 T.U.L.P.S. verwendet. Dokumentfotos sind nicht erforderlich.", complete:"Demo-Vorab-Check-in abgeschlossen", completeText:"In dieser Vorschau wurden keine Daten gespeichert. In der endgültigen Version wird Angela benachrichtigt und prüft die Dokumente bei der Ankunft.", home:"Zurück zur Website" },
};

const steps = ["stay", "lead", "guests", "arrival", "review"] as const;

const arrivalText: Record<Lang, { step:string; time:string; transport:string; notes:string; car:string; train:string; plane:string; other:string; help:string }> = {
  it: { step:"Arrivo", time:"Orario previsto", transport:"Come arriverete?", notes:"Note per Angela (facoltative)", car:"Auto", train:"Treno", plane:"Aereo", other:"Altro", help:"Queste informazioni ci aiutano ad accogliervi al momento giusto." },
  en: { step:"Arrival", time:"Expected time", transport:"How will you arrive?", notes:"Notes for Angela (optional)", car:"Car", train:"Train", plane:"Plane", other:"Other", help:"This information helps us welcome you at the right time." },
  fr: { step:"Arrivée", time:"Heure prévue", transport:"Comment arriverez-vous ?", notes:"Notes pour Angela (facultatif)", car:"Voiture", train:"Train", plane:"Avion", other:"Autre", help:"Ces informations nous aident à vous accueillir au bon moment." },
  es: { step:"Llegada", time:"Hora prevista", transport:"¿Cómo llegarán?", notes:"Notas para Angela (opcional)", car:"Coche", train:"Tren", plane:"Avión", other:"Otro", help:"Esta información nos ayuda a recibirles en el momento adecuado." },
  de: { step:"Anreise", time:"Voraussichtliche Uhrzeit", transport:"Wie reisen Sie an?", notes:"Hinweise für Angela (optional)", car:"Auto", train:"Zug", plane:"Flugzeug", other:"Andere", help:"Diese Angaben helfen uns, Sie zur richtigen Zeit zu empfangen." },
};

const dateText: Record<Lang, { pastArrival:string; departureOrder:string; futureBirth:string; oldBirth:string; adultLead:string }> = {
  it: { pastArrival:"La data di arrivo non può essere precedente a oggi.", departureOrder:"La partenza deve essere successiva all’arrivo.", futureBirth:"La data di nascita non può essere futura.", oldBirth:"Controlla la data di nascita: non può risalire a più di 120 anni fa.", adultLead:"L’ospite principale deve avere almeno 18 anni." },
  en: { pastArrival:"The arrival date cannot be earlier than today.", departureOrder:"Departure must be after arrival.", futureBirth:"The date of birth cannot be in the future.", oldBirth:"Please check the date of birth: it cannot be more than 120 years ago.", adultLead:"The lead guest must be at least 18 years old." },
  fr: { pastArrival:"La date d’arrivée ne peut pas être antérieure à aujourd’hui.", departureOrder:"Le départ doit être postérieur à l’arrivée.", futureBirth:"La date de naissance ne peut pas être future.", oldBirth:"Vérifiez la date de naissance : elle ne peut pas remonter à plus de 120 ans.", adultLead:"Le voyageur principal doit avoir au moins 18 ans." },
  es: { pastArrival:"La fecha de llegada no puede ser anterior a hoy.", departureOrder:"La salida debe ser posterior a la llegada.", futureBirth:"La fecha de nacimiento no puede ser futura.", oldBirth:"Comprueba la fecha de nacimiento: no puede remontarse a más de 120 años.", adultLead:"El huésped principal debe tener al menos 18 años." },
  de: { pastArrival:"Das Anreisedatum darf nicht vor dem heutigen Datum liegen.", departureOrder:"Die Abreise muss nach der Anreise liegen.", futureBirth:"Das Geburtsdatum darf nicht in der Zukunft liegen.", oldBirth:"Bitte prüfen Sie das Geburtsdatum: Es darf nicht mehr als 120 Jahre zurückliegen.", adultLead:"Der Hauptgast muss mindestens 18 Jahre alt sein." },
};

export function GuestCheckin() {
  const [lang, setLang] = useState<Lang>("it");
  const [step, setStep] = useState(0);
  const [guestCount, setGuestCount] = useState(2);
  const [complete, setComplete] = useState(false);
  const [values, setValues] = useState<Record<string,string>>({ reference: "VALF-DEMO-01" });
  const [dateError, setDateError] = useState("");
  const t = text[lang];
  const a = arrivalText[lang];
  const d = dateText[lang];
  const today = isoDate(new Date());
  const oldestBirthDate = shiftYears(today, -120);
  const adultBirthDate = shiftYears(today, -18);
  const companions = useMemo(() => Array.from({ length: Math.max(0, guestCount - 1) }), [guestCount]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateCurrentDates(step, values, today, oldestBirthDate, adultBirthDate, d);
    if (error) {
      setDateError(error);
      event.currentTarget.querySelector<HTMLInputElement>('input[type="date"]:invalid')?.focus();
      return;
    }
    setDateError("");
    if (step < steps.length - 1) setStep(step + 1);
    else setComplete(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (complete) return <main className="checkin-page"><CheckinHeader lang={lang} setLang={setLang}/><section className="checkin-complete"><span>✓</span><p className="eyebrow">VALF Suite</p><h1>{t.complete}</h1><p>{t.completeText}</p><Link className="button" href={lang === "it" ? "/" : `/${lang}`} onClick={event => navigateHome(event, lang)}>{t.home}</Link></section></main>;

  return <main className="checkin-page">
    <CheckinHeader lang={lang} setLang={setLang}/>
    <div className="checkin-demo"><strong>{t.demo}</strong><span>{t.demoText}</span></div>
    <section className="checkin-intro"><p className="eyebrow">VALF Suite · Arcola</p><h1>{t.title}</h1><p>{t.intro}</p></section>
    <section className="checkin-shell">
      <ol className="checkin-progress" aria-label="Progress">
        {steps.map((key, index) => <li key={key} className={index === step ? "active" : index < step ? "done" : ""} aria-current={index === step ? "step" : undefined}><span>{index < step ? "✓" : index + 1}</span><b>{key === "arrival" ? a.step : t[key]}</b></li>)}
      </ol>
      <form className="checkin-form" onSubmit={submit} onChange={event => { const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement; if (target.name) { setDateError(""); setValues(current => ({ ...current, [target.name]: target.value })); } }}>
        {dateError && <p className="form-error" role="alert">{dateError}</p>}
        {step === 0 && <fieldset><legend>{t.stay}</legend><p className="form-help">VALF Suite · Via Aurelia Nord 97, Arcola (SP)</p><div className="checkin-grid"><Field label={t.arrival} name="arrival-date" type="date" min={today} defaultValue={values["arrival-date"]}/><Field label={t.departure} name="departure-date" type="date" min={values["arrival-date"] ? nextDay(values["arrival-date"]) : nextDay(today)} defaultValue={values["departure-date"]}/><label>{t.count}<select value={guestCount} onChange={e=>setGuestCount(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}</select></label><Field label={t.reference} name="reference" defaultValue={values.reference}/></div></fieldset>}
        {step === 1 && <fieldset><legend>{t.lead}</legend><p className="form-help">{t.legal}</p><PersonFields t={t} values={values} prefix="lead" minBirth={oldestBirthDate} maxBirth={adultBirthDate} document/></fieldset>}
        {step === 2 && <fieldset><legend>{t.guests}</legend>{companions.length === 0 ? <p className="empty-guests">—</p> : companions.map((_, index)=><section className="companion" key={index}><h2>{t.guests} {index + 1}</h2><PersonFields t={t} values={values} prefix={`guest-${index + 1}`} minBirth={oldestBirthDate} maxBirth={today}/></section>)}</fieldset>}
        {step === 3 && <fieldset><legend>{a.step}</legend><p className="form-help">{a.help}</p><div className="checkin-grid"><Field label={a.time} name="arrival-time" type="time" defaultValue={values["arrival-time"]}/><label>{a.transport}<select name="transport" required defaultValue={values.transport || ""}><option value="" disabled>{t.choose}</option><option>{a.car}</option><option>{a.train}</option><option>{a.plane}</option><option>{a.other}</option></select></label><label className="field-wide">{a.notes}<textarea name="arrival-notes" rows={5} defaultValue={values["arrival-notes"]}/></label></div></fieldset>}
        {step === 4 && <fieldset><legend>{t.review}</legend><div className="review-card"><div><small>{t.stay}</small><strong>{values["arrival-date"] || "—"} → {values["departure-date"] || "—"}</strong><span>{guestCount} {t.count.toLowerCase()}</span></div><div><small>{t.reference}</small><strong>{values.reference || "—"}</strong><span>{values["lead-name"]} {values["lead-surname"]}</span></div><div><small>{a.step}</small><strong>{values.transport || "—"} · {values["arrival-time"] || "—"}</strong><span>{values["arrival-notes"] || a.help}</span></div></div><p className="legal-note">{t.legal}</p><label className="checkin-consent"><input type="checkbox" required/><span>{t.privacy}</span></label></fieldset>}
        <div className="checkin-actions">{step > 0 && <button type="button" className="button-secondary" onClick={()=>setStep(step-1)}>{t.back}</button>}<button className="button" type="submit">{step === steps.length - 1 ? t.send : t.next}</button></div>
      </form>
    </section>
    <footer className="checkin-footer">© {new Date().getFullYear()} VALF Suite · <a href="mailto:valfsuite@gmail.com">valfsuite@gmail.com</a></footer>
  </main>;
}

function CheckinHeader({lang,setLang}:{lang:Lang;setLang:(lang:Lang)=>void}) { return <header className="checkin-header"><Link href={lang === "it" ? "/" : `/${lang}`} onClick={event => navigateHome(event, lang)}><Image src="/logo-valf-suite.png" width={174} height={64} alt="VALF Suite" priority/></Link><label><span className="sr-only">Language</span><select value={lang} onChange={e=>setLang(e.target.value as Lang)}>{(Object.keys(languageNames) as Lang[]).map(key=><option value={key} key={key}>{languageNames[key]}</option>)}</select></label></header>; }

function Field({label,name,type="text",defaultValue,min,max}:{label:string;name:string;type?:string;defaultValue?:string;min?:string;max?:string}) { return <label>{label}<input name={name} type={type} defaultValue={defaultValue} min={min} max={max} required/></label>; }

function PersonFields({t,values,prefix,minBirth,maxBirth,document=false}:{t:Record<string,string>;values:Record<string,string>;prefix:string;minBirth:string;maxBirth:string;document?:boolean}) { const name=(key:string)=>`${prefix}-${key}`; return <div className="checkin-grid"><Field label={t.name} name={name("name")} defaultValue={values[name("name")]}/><Field label={t.surname} name={name("surname")} defaultValue={values[name("surname")]}/><Field label={t.birth} name={name("birth")} type="date" min={minBirth} max={maxBirth} defaultValue={values[name("birth")]}/><label>{t.sex}<select name={name("sex")} required defaultValue={values[name("sex")] || ""}><option value="" disabled>{t.choose}</option><option>{t.male}</option><option>{t.female}</option></select></label><Field label={t.citizenship} name={name("citizenship")} defaultValue={values[name("citizenship")]}/><Field label={t.birthCountry} name={name("birthCountry")} defaultValue={values[name("birthCountry")]}/><Field label={t.birthPlace} name={name("birthPlace")} defaultValue={values[name("birthPlace")]}/>{document && <><label>{t.documentType}<select name={name("documentType")} required defaultValue={values[name("documentType")] || ""}><option value="" disabled>{t.choose}</option><option>Identity card</option><option>Passport</option><option>Driving licence</option></select></label><Field label={t.documentNumber} name={name("documentNumber")} defaultValue={values[name("documentNumber")]}/><Field label={t.issuePlace} name={name("issuePlace")} defaultValue={values[name("issuePlace")]}/></>}</div>; }

function validateCurrentDates(step:number, values:Record<string,string>, today:string, oldest:string, adult:string, messages:typeof dateText.it) {
  if (step === 0) {
    if (values["arrival-date"] < today) return messages.pastArrival;
    if (values["departure-date"] <= values["arrival-date"]) return messages.departureOrder;
  }
  if (step === 1 || step === 2) {
    const births = Object.entries(values).filter(([key]) => key.endsWith("-birth") && (step === 1 ? key.startsWith("lead-") : key.startsWith("guest-")));
    if (births.some(([, value]) => value > today)) return messages.futureBirth;
    if (births.some(([, value]) => value < oldest)) return messages.oldBirth;
    if (step === 1 && values["lead-birth"] > adult) return messages.adultLead;
  }
  return "";
}

function isoDate(date:Date) { const year=date.getFullYear(); const month=String(date.getMonth()+1).padStart(2,"0"); const day=String(date.getDate()).padStart(2,"0"); return `${year}-${month}-${day}`; }
function shiftYears(value:string, years:number) { const date=new Date(`${value}T12:00:00`); date.setFullYear(date.getFullYear()+years); return isoDate(date); }
function nextDay(value:string) { const date=new Date(`${value}T12:00:00`); date.setDate(date.getDate()+1); return isoDate(date); }
function navigateHome(event:MouseEvent<HTMLAnchorElement>, lang:Lang) { event.preventDefault(); window.location.assign(lang === "it" ? "/" : `/${lang}`); }
