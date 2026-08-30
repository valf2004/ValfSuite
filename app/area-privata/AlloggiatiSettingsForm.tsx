"use client";

import { useState, type FormEvent } from "react";
import type { AlloggiatiSettingsSummary } from "../lib/alloggiati-settings";
import { authenticatedFetch } from "./authenticated-fetch";

export default function AlloggiatiSettingsForm({ initialSummary }: { initialSummary: AlloggiatiSettingsSummary }) {
  const [summary, setSummary] = useState(initialSummary);
  const [mode, setMode] = useState(summary.accountMode);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await authenticatedFetch("/api/gestione/impostazioni/alloggiati", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: String(form.get("user") || ""),
          password: String(form.get("password") || ""),
          wsKey: String(form.get("wsKey") || ""),
          accountMode: mode,
          apartmentId: String(form.get("apartmentId") || ""),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossibile salvare le impostazioni.");
      setSummary(data.settings);
      setNotice({ kind: "ok", text: "Impostazioni salvate e cifrate correttamente." });
      formElement.reset();
      setMode(data.settings.accountMode);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Impossibile salvare le impostazioni." });
    } finally {
      setSaving(false);
    }
  }

  return <section className="settings-panel">
    <div className="settings-heading">
      <div><p className="eyebrow">Configurazione</p><h1>Alloggiati Web</h1><p>Credenziali del Web Service usato per la trasmissione delle schedine.</p></div>
      <span className={`settings-source ${summary.source}`}>{summary.source === "database" ? "Configurazione protetta" : summary.source === "environment" ? "Valori iniziali da .env" : "Da configurare"}</span>
    </div>
    <form className="settings-form" onSubmit={submit}>
      <div className="settings-security-note"><strong>Valori protetti</strong><span>Password e WSKEY vengono cifrate e non sono mai mostrate. Lascia un campo vuoto per mantenere il valore già configurato.</span></div>
      <div className="settings-grid">
        <label><span>Utente Alloggiati Web</span><input name="user" autoComplete="username" placeholder={summary.userHint || "Inserisci il nome utente"} required={!summary.userConfigured}/><small>{summary.userConfigured ? "Configurato" : "Obbligatorio"}</small></label>
        <label><span>Password</span><input name="password" type="password" autoComplete="current-password" placeholder={summary.passwordConfigured ? "••••••••" : "Inserisci la password"} required={!summary.passwordConfigured}/><small>{summary.passwordConfigured ? "Configurata" : "Obbligatoria"}</small></label>
        <label className="settings-wide"><span>WSKEY</span><input name="wsKey" type="password" autoComplete="off" placeholder={summary.wsKeyConfigured ? "••••••••" : "Incolla la WSKEY generata"} required={!summary.wsKeyConfigured}/><small>{summary.wsKeyConfigured ? "Configurata" : "Obbligatoria"}</small></label>
        <label><span>Tipo account</span><select name="accountMode" value={mode} onChange={(event) => setMode(event.target.value as "standard" | "apartments")}><option value="standard">Struttura singola</option><option value="apartments">Gestione appartamenti</option></select></label>
        <label><span>Codice appartamento</span><input name="apartmentId" autoComplete="off" disabled={mode !== "apartments"} required={mode === "apartments" && !summary.apartmentIdConfigured} placeholder={summary.apartmentIdHint || "Richiesto solo per account appartamenti"}/><small>{mode === "apartments" ? summary.apartmentIdConfigured ? "Configurato" : "Obbligatorio" : "Non necessario"}</small></label>
      </div>
      {notice && <p className={`settings-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}
      <div className="settings-footer"><div>{summary.updatedAt && <small>Ultimo aggiornamento: {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.updatedAt))}{summary.updatedBy ? ` · ${summary.updatedBy}` : ""}</small>}</div><button type="submit" disabled={saving}>{saving ? "Salvataggio…" : "Salva impostazioni"}</button></div>
    </form>
  </section>;
}
