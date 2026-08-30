export type EnvironmentSetting={key:string;label:string;type:"text"|"password"|"number"|"url"|"select"|"textarea";value:string;configured:boolean;editable:boolean;note?:string;options?:Array<{value:string;label:string}>};
export type EnvironmentSettingsGroup={id:string;title:string;description:string;settings:EnvironmentSetting[]};
export type EnvironmentSettingsSummary={writable:boolean;source:"file"|"environment"|"unavailable";updatedAt:string|null;groups:EnvironmentSettingsGroup[]};
type Definition=Omit<EnvironmentSetting,"value"|"configured">&{group:string;list?:boolean};

const groupDefinitions=[
  {id:"site",title:"Sito e collegamenti",description:"Indirizzo pubblico e integrazioni generali dell’applicazione."},
  {id:"email",title:"Invio email",description:"Account SMTP e destinatari delle notifiche."},
  {id:"google",title:"Accesso Google",description:"OAuth e account autorizzati all’area riservata."},
  {id:"alloggiati",title:"Alloggiati Web",description:"Credenziali del Web Service per le schedine degli ospiti."},
  {id:"infrastructure",title:"Infrastruttura",description:"Valori gestiti da Docker e mostrati per completezza."},
  {id:"other",title:"Altri parametri",description:"Ulteriori variabili già presenti nel file .env."},
] as const;

const definitions:Definition[]=[
  {key:"PUBLIC_BASE_URL",label:"Indirizzo pubblico",group:"site",type:"url",editable:true},
  {key:"AVAILABILITY_WEBHOOK_URL",label:"Webhook disponibilità",group:"site",type:"url",editable:true,note:"Opzionale e attualmente non utilizzato. Può restare vuoto."},
  {key:"SMTP_HOST",label:"Server SMTP",group:"email",type:"text",editable:true},
  {key:"SMTP_PORT",label:"Porta SMTP",group:"email",type:"number",editable:true},
  {key:"SMTP_SECURE",label:"Connessione sicura",group:"email",type:"select",editable:true,options:[{value:"true",label:"Sì"},{value:"false",label:"No"}]},
  {key:"SMTP_USER",label:"Utente SMTP",group:"email",type:"text",editable:true},
  {key:"SMTP_APP_PASSWORD",label:"Password per l’app",group:"email",type:"password",editable:true},
  {key:"EMAIL_RECIPIENTS",label:"Destinatari notifiche",group:"email",type:"textarea",editable:true,list:true,note:"Indirizzi separati da virgola."},
  {key:"GOOGLE_OAUTH_CLIENT_ID",label:"Google Client ID",group:"google",type:"text",editable:true},
  {key:"GOOGLE_OAUTH_CLIENT_SECRET",label:"Google Client Secret",group:"google",type:"password",editable:true},
  {key:"GOOGLE_OAUTH_REDIRECT_URI",label:"Google Redirect URI",group:"google",type:"url",editable:true},
  {key:"AUTH_SESSION_SECRET",label:"Segreto sessioni",group:"google",type:"password",editable:true,note:"Minimo 32 caratteri. Cambiarlo disconnette le sessioni esistenti."},
  {key:"AUTHORIZED_ADMIN_EMAILS",label:"Account autorizzati",group:"google",type:"textarea",editable:true,list:true,note:"Indirizzi Google separati da virgola."},
  {key:"ALLOGGIATI_USER",label:"Utente Alloggiati Web",group:"alloggiati",type:"text",editable:true},
  {key:"ALLOGGIATI_PASSWORD",label:"Password Alloggiati Web",group:"alloggiati",type:"password",editable:true},
  {key:"ALLOGGIATI_WSKEY",label:"WSKEY",group:"alloggiati",type:"password",editable:true},
  {key:"ALLOGGIATI_ACCOUNT_MODE",label:"Tipo account",group:"alloggiati",type:"select",editable:true,options:[{value:"standard",label:"Struttura singola"},{value:"apartments",label:"Gestione appartamenti"}]},
  {key:"ALLOGGIATI_APARTMENT_ID",label:"Codice appartamento",group:"alloggiati",type:"text",editable:true,note:"Richiesto solo per account appartamenti."},
  {key:"POSTGRES_PASSWORD",label:"Password PostgreSQL",group:"infrastructure",type:"password",editable:false,note:"Non modificabile qui: va coordinata con l’utente interno del database."},
  {key:"RECEIPTS_DIR",label:"Archivio ricevute",group:"infrastructure",type:"text",editable:false,note:"Il percorso effettivo è gestito dal volume Docker."},
];

export async function getEnvironmentSettingsSummary():Promise<EnvironmentSettingsSummary>{
  const snapshot=await loadEnvironment();const known=new Set(definitions.map(item=>item.key));
  const dynamic:Definition[]=[...snapshot.fileValues.keys()].filter(key=>!known.has(key)).sort().map(key=>({key,label:key,group:"other",type:isSecretKey(key)?"password":"text",editable:true,note:"Variabile già presente nel file .env."}));
  const all=[...definitions,...dynamic];
  const groups=groupDefinitions.map(group=>({...group,settings:all.filter(item=>item.group===group.id).map(item=>publicSetting(item,snapshot.values.get(item.key)??""))})).filter(group=>group.settings.length>0);
  return {writable:snapshot.writable,source:snapshot.source,updatedAt:snapshot.updatedAt,groups};
}

export async function saveEnvironmentSettings(input:unknown){
  const envPath=process.env["ENV_FILE_PATH"]?.trim();
  if(!envPath)throw new Error("Il salvataggio diretto nel file .env è disponibile soltanto sulla VM di produzione.");
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Formato dei parametri non valido.");
  const submitted=input as Record<string,unknown>;const snapshot=await loadEnvironment();const known=new Map(definitions.map(item=>[item.key,item]));
  for(const key of snapshot.fileValues.keys())if(!known.has(key))known.set(key,{key,label:key,group:"other",type:isSecretKey(key)?"password":"text",editable:true});
  const updates:Record<string,string>={};
  for(const [key,proposed] of Object.entries(submitted)){
    const definition=known.get(key);if(!definition?.editable)continue;
    if(typeof proposed!=="string")throw new Error(`Valore non valido per ${key}.`);
    let value=proposed.trim();const current=snapshot.values.get(key)??"";
    if(definition.type==="password"&&!value)value=current;
    if(definition.list)value=value.split(/[\r\n;,]+/).map(part=>part.trim()).filter(Boolean).join(",");
    validateValue(definition,value);updates[key]=value;
  }
  if(!Object.keys(updates).length)throw new Error("Nessun parametro modificabile ricevuto.");
  const {readFile,writeFile}=await import("node:fs/promises");const currentFile=await readFile(envPath,"utf8");
  await writeFile(envPath,updateEnvFile(currentFile,updates),{encoding:"utf8",mode:0o600});
  for(const [key,value] of Object.entries(updates))process.env[key]=value;
  return getEnvironmentSettingsSummary();
}

async function loadEnvironment(){
  const envPath=process.env["ENV_FILE_PATH"]?.trim();const fileValues=new Map<string,string>();let updatedAt:string|null=null;
  if(envPath)try{const {readFile,stat}=await import("node:fs/promises");const [content,fileStat]=await Promise.all([readFile(envPath,"utf8"),stat(envPath)]);for(const line of content.split(/\r?\n/)){const match=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(match)fileValues.set(match[1],decodeEnvValue(match[2]));}updatedAt=fileStat.mtime.toISOString();}catch{/* Concrete errors are returned on save. */}
  const values=new Map(fileValues);for(const definition of definitions)if(!values.has(definition.key))values.set(definition.key,process.env[definition.key]?.trim()??"");
  const hasValues=[...values.values()].some(Boolean);return {fileValues,values,writable:Boolean(envPath),source:envPath?"file" as const:hasValues?"environment" as const:"unavailable" as const,updatedAt};
}

function publicSetting(definition:Definition,value:string):EnvironmentSetting{return {key:definition.key,label:definition.label,type:definition.type,value:definition.type==="password"?"":value,configured:Boolean(value),editable:definition.editable,note:definition.note,options:definition.options};}
function validateValue(definition:Definition,value:string){if(/\r|\n/.test(value))throw new Error(`Il valore ${definition.key} deve occupare una sola riga.`);if(value.length>4000)throw new Error(`Il valore ${definition.key} è troppo lungo.`);if(definition.type==="number"&&value&&!/^\d+$/.test(value))throw new Error(`${definition.label}: inserisci un numero valido.`);if(definition.type==="select"&&value&&!definition.options?.some(option=>option.value===value))throw new Error(`${definition.label}: valore non previsto.`);if(definition.key==="AUTH_SESSION_SECRET"&&value&&value.length<32)throw new Error("Il segreto delle sessioni deve contenere almeno 32 caratteri.");if(definition.type==="url"&&value)try{new URL(value);}catch{throw new Error(`${definition.label}: inserisci un indirizzo completo e valido.`);}}
function updateEnvFile(content:string,updates:Record<string,string>){const remaining=new Map(Object.entries(updates));const replaced=new Set<string>();const lines=content.replace(/\r\n/g,"\n").split("\n").flatMap(line=>{const match=line.match(/^([A-Z][A-Z0-9_]*)=/);if(!match||!remaining.has(match[1]))return [line];if(replaced.has(match[1]))return [];replaced.add(match[1]);const value=remaining.get(match[1])??"";remaining.delete(match[1]);return [`${match[1]}=${encodeEnvValue(value)}`];});if(remaining.size){if(lines.at(-1)!=="")lines.push("");lines.push("# Parametri aggiunti dall'area riservata");for(const [key,value] of remaining)lines.push(`${key}=${encodeEnvValue(value)}`);}return `${lines.join("\n").replace(/\n+$/,"")}\n`;}
function encodeEnvValue(value:string){if(/^[A-Za-z0-9._~:/@+,-]*$/.test(value))return value;return `"${value.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\$/g,"$$$$")}"`;}
function decodeEnvValue(value:string){const trimmed=value.trim();if(trimmed.startsWith('"')&&trimmed.endsWith('"'))return trimmed.slice(1,-1).replace(/\\"/g,'"').replace(/\\\\/g,"\\").replace(/\$\$/g,"$");if(trimmed.startsWith("'")&&trimmed.endsWith("'"))return trimmed.slice(1,-1);return trimmed;}
function isSecretKey(key:string){return /(PASSWORD|SECRET|TOKEN|PRIVATE|WSKEY|API_KEY)/i.test(key);}
