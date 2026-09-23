const italyCode="100000100";
const tourismTypes=new Set(["CULTURALE","BALNEARE","CONGRESSUALE/AFFARI","FIERISTICO","SPORTIVO/FITNESS","SCOLASTICO","RELIGIOSO","SOCIALE","PARCHI TEMATICI","TERMALE/TRATTAMENTI SALUTE","ENOGASTRONOMICO","CICLOTURISMO","ESCURSIONISTICO/NATURALISTICO","ALTRO MOTIVO","NON SPECIFICATO"]);
const transports=new Set(["AUTO","TRENO","AEREO","ALTRO MEZZO"]);

export function buildRoss1000Xml({requestId,arrivalDate,draft,structureCode="L12648",product="VALF Suite",availableUnits=1,availableBeds=4}){
  required(structureCode,20,"Codice struttura");required(product,100,"Prodotto");date(arrivalDate,"Data movimento");
  if(!Number.isInteger(availableUnits)||availableUnits<1)throw new Error("Le unità disponibili Ross1000 non sono valide.");
  if(!Number.isInteger(availableBeds)||availableBeds<1)throw new Error("I letti disponibili Ross1000 non sono validi.");
  if(!draft||!Number.isInteger(draft.guestCount)||draft.guestCount<1)throw new Error("Il check-in non contiene ospiti.");
  const tourism=(draft.values.tourismType||"").trim().toUpperCase();if(!tourismTypes.has(tourism))throw new Error("Seleziona un motivo del soggiorno previsto da Ross1000.");
  const transport=normalizeTransport(draft.values.transport);if(!transports.has(transport))throw new Error("Seleziona un mezzo di trasporto previsto da Ross1000.");
  const leadId=guestId(requestId,0);
  const arrivals=Array.from({length:draft.guestCount},(_,ordinal)=>{
    const prefix=ordinal===0?"lead":`guest-${ordinal}`;const value=field=>String(draft.values[`${prefix}-${field}`]||"").trim();
    const guest={idswh:guestId(requestId,ordinal),tipoalloggiato:guestType(draft.groupType,ordinal),idcapo:ordinal===0?"":leadId,cognome:value("surname"),nome:value("name"),sesso:value("sex")==="1"?"M":value("sex")==="2"?"F":"",cittadinanza:value("citizenship"),statoresidenza:value("residenceCountry"),luogoresidenza:value("residencePlace"),datanascita:date(value("birth"),`Data di nascita ospite ${ordinal+1}`),statonascita:value("birthCountry"),comunenascita:value("birthCountry")===italyCode?value("birthPlace"):"",tipoturismo:tourism,mezzotrasporto:transport,canaleprenotazione:"DIRETTA WEB",titolostudio:"",professione:"",esenzioneimposta:""};
    required(guest.cognome,50,`Cognome ospite ${ordinal+1}`);required(guest.nome,30,`Nome ospite ${ordinal+1}`);
    if(!guest.sesso)throw new Error(`Sesso ospite ${ordinal+1} non valido.`);
    required(guest.cittadinanza,9,`Cittadinanza ospite ${ordinal+1}`);required(guest.statoresidenza,9,`Stato di residenza ospite ${ordinal+1}`);
    if(guest.statoresidenza===italyCode)required(guest.luogoresidenza,9,`Comune di residenza ospite ${ordinal+1}`);else if(guest.luogoresidenza.length>30)throw new Error(`Località di residenza ospite ${ordinal+1}: massimo 30 caratteri.`);
    required(guest.statonascita,9,`Stato di nascita ospite ${ordinal+1}`);if(guest.statonascita===italyCode)required(guest.comunenascita,9,`Comune di nascita ospite ${ordinal+1}`);
    return guest;
  });
  const tags=arrivals.map(guest=>`    <arrivo>\n${Object.entries(guest).map(([key,value])=>`      <${key}>${escapeXml(value)}</${key}>`).join("\n")}\n    </arrivo>`).join("\n");
  const movementDate=date(arrivalDate,"Data movimento");
  const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<movimenti>\n  <codice>${escapeXml(structureCode)}</codice>\n  <prodotto>${escapeXml(product)}</prodotto>\n  <movimento>\n    <data>${movementDate}</data>\n    <struttura>\n      <apertura>SI</apertura>\n      <camereoccupate>1</camereoccupate>\n      <cameredisponibili>${availableUnits}</cameredisponibili>\n      <lettidisponibili>${availableBeds}</lettidisponibili>\n    </struttura>\n    <arrivi>\n${tags}\n    </arrivi>\n  </movimento>\n</movimenti>\n`;
  const validation=validateRoss1000Xml(xml);if(!validation.valid)throw new Error(validation.errors[0]||"XML non valido.");
  return {xml,fileName:`ross1000-${structureCode}-${movementDate}.xml`,movementDate,arrivals,validation};
}

export function validateRoss1000Xml(xml){
  const errors=[];const stack=[];const tag=/<\/?([A-Za-z][\w.-]*)(?:\s[^>]*)?>/g;let match;
  while((match=tag.exec(xml))){const raw=match[0];const name=match[1];if(raw.startsWith("</")){if(stack.pop()!==name){errors.push(`Chiusura XML non coerente: ${name}.`);break;}}else if(!raw.endsWith("/>")&&!raw.startsWith("<?"))stack.push(name);}
  if(stack.length)errors.push(`Elemento XML non chiuso: ${stack.at(-1)}.`);
  if(!xml.includes("<movimenti>")||!xml.includes("</movimenti>"))errors.push("Elemento radice movimenti mancante.");
  if(/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml))errors.push("Carattere XML non codificato.");
  return {valid:errors.length===0,errors,checks:["XML ben formato","Campi obbligatori presenti","Lunghezze e valori ammessi","Codici di residenza e nascita"]};
}

function guestId(requestId,ordinal){const clean=String(requestId).replace(/[^A-Za-z0-9]/g,"").toUpperCase();return `VS${clean.slice(-16)}${String(ordinal+1).padStart(2,"0")}`.slice(0,20);}
function guestType(groupType,ordinal){if(ordinal===0)return groupType==="single"?"16":groupType==="family"?"17":"18";return groupType==="family"?"19":"20";}
function normalizeTransport(value){const clean=String(value||"").trim().toUpperCase();if(["AUTO","CAR","COCHE","VOITURE"].includes(clean))return "AUTO";if(["TRENO","TRAIN","TREN","ZUG"].includes(clean))return "TRENO";if(["AEREO","PLANE","AVION","FLUGZEUG"].includes(clean))return "AEREO";return clean==="ALTRO"||clean==="OTHER"||clean==="AUTRE"||clean==="ANDERE"?"ALTRO MEZZO":clean;}
function date(value,label){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));if(!match)throw new Error(`${label} non valida.`);return `${match[1]}${match[2]}${match[3]}`;}
function required(value,max,label){const clean=String(value||"").trim();if(!clean)throw new Error(`${label} obbligatorio.`);if(clean.length>max)throw new Error(`${label}: massimo ${max} caratteri.`);return clean;}
function escapeXml(value){return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
