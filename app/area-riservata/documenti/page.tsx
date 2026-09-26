import type {Metadata} from "next";
import {headers} from "next/headers";
import {PrivateHeader,PrivateLogin} from "../../area-privata/PrivateChrome";
import {authIsConfigured,privateUserFromCookie} from "../../lib/google-auth";

export const dynamic="force-dynamic";

export const metadata:Metadata={
  title:"Documenti ospiti | VALF Suite",
  robots:{index:false,follow:false},
};

const guides=[
  {code:"it",language:"Italiano",label:"Guida ospiti in italiano"},
  {code:"en",language:"English",label:"Guest guide in English"},
  {code:"fr",language:"Français",label:"Guide d’accueil en français"},
  {code:"es",language:"Español",label:"Guía para huéspedes en español"},
  {code:"de",language:"Deutsch",label:"Gästehandbuch auf Deutsch"},
];

export default async function GuestDocumentsPage(){
  const requestHeaders=await headers();
  const user=await privateUserFromCookie(requestHeaders.get("cookie"));
  if(!user)return <PrivateLogin configured={authIsConfigured()}/>;
  return <main className="dashboard-page">
    <PrivateHeader user={user} active="documents"/>
    <section className="settings-panel guest-documents-panel">
      <header className="settings-heading"><div><p className="eyebrow">Ospitalità</p><h1>Documenti per gli ospiti</h1><p>Le guide non sono pubbliche. Scaricale qui e condividile soltanto con gli ospiti dopo la conferma del soggiorno.</p></div></header>
      <div className="guest-document-list">{guides.map(guide=><article key={guide.code}><div><small>{guide.language}</small><strong>{guide.label}</strong></div><a className="button" href={`/api/gestione/guide-ospiti/${guide.code}`}>Scarica PDF</a></article>)}</div>
    </section>
  </main>;
}
