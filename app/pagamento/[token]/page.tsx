import type {Metadata} from "next";
import {findActiveQuoteByTokenHash} from "../../../db/availability";
import {hashPaymentToken} from "../../lib/payment-token";
import {todayAtProperty} from "../../lib/property-date";
import PaymentForm from "./PaymentForm";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Comunica il pagamento | VALF Suite",robots:{index:false,follow:false}};

export default async function PaymentPage({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  const quote=token&&token.length===64?await findActiveQuoteByTokenHash(await hashPaymentToken(token)):null;
  if(!quote||!["quote_sent","payment_reported","accepted"].includes(quote.status))return <PaymentUnavailable/>;
  const locale=({it:"it-IT",en:"en-GB",fr:"fr-FR",es:"es-ES",de:"de-DE"} as Record<string,string>)[quote.language]||"it-IT";
  const date=(value:string)=>new Intl.DateTimeFormat(locale,{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));
  return <main className="payment-page"><header className="payment-header"><a href="/"><img src="/logo-valf-suite.png" alt="VALF Suite"/></a></header><section className="payment-intro"><p className="eyebrow">VALF Suite · Prenotazione</p><h1>Comunica il pagamento</h1><p>Compila il modulo dopo aver effettuato il pagamento. La registrazione sarà aggiornata soltanto dopo la verifica dell’accredito.</p></section><PaymentForm token={token} language={quote.language} guestName={quote.name} arrival={date(quote.arrivalDate)} departure={date(quote.departureDate)} guests={quote.guestCount} totalCents={quote.amountCents} confirmedCents={quote.confirmedAmountCents} today={todayAtProperty()}/><footer className="payment-footer">VALF Suite · Arcola, Liguria</footer></main>;
}

function PaymentUnavailable(){return <main className="payment-page"><header className="payment-header"><a href="/"><img src="/logo-valf-suite.png" alt="VALF Suite"/></a></header><section className="payment-unavailable"><p className="eyebrow">VALF Suite</p><h1>Collegamento non disponibile</h1><p>La proposta è stata sostituita, è già stata gestita oppure il collegamento non è valido. Rispondi all’email ricevuta per chiedere assistenza.</p><a className="button" href="/">Torna al sito</a></section></main>}
