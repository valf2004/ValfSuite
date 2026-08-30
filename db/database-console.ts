export type DatabaseQueryResult={columns:string[];rows:Array<Record<string,string|null>>;truncated:boolean;limit:number};
const usesPostgres=()=>Boolean(process.env["DATABASE_URL"]?.trim());
const postgresRepository=()=>import("./database-console.postgres");

export async function listDatabaseTables():Promise<string[]>{
  if(usesPostgres())return (await postgresRepository()).listDatabaseTables();
  const {env}=await import("cloudflare:workers");
  const result=await env.DB.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all<{name:string}>();
  return result.results.map(row=>row.name);
}

export async function executeReadOnlyQuery(input:string):Promise<DatabaseQueryResult>{
  if(usesPostgres())return (await postgresRepository()).executeReadOnlyQuery(input);
  const query=validateReadOnlyQuery(input);const table=selectedTable(query);const tables=await listDatabaseTables();
  if(!tables.includes(table))throw new Error("La query può usare soltanto una tabella presente nell’elenco.");
  const {env}=await import("cloudflare:workers");
  const result=await env.DB.prepare(`SELECT * FROM (${query}) AS valfsuite_query LIMIT 501`).all<Record<string,unknown>>();
  const selected=result.results.slice(0,500).map(normalizeRow);
  return {columns:selected[0]?Object.keys(selected[0]):[],rows:selected,truncated:result.results.length>500,limit:500};
}

export function validateReadOnlyQuery(input:string){
  if(typeof input!=="string")throw new Error("Query non valida.");
  let query=input.trim();if(query.endsWith(";"))query=query.slice(0,-1).trim();
  if(!query||query.length>4000)throw new Error("La query è vuota o troppo lunga.");
  if(query.includes(";"))throw new Error("È consentita una sola istruzione SQL.");
  if(!/^select\s+\*\s+from\s/i.test(query))throw new Error("Usa la forma SELECT * FROM tabella, aggiungendo eventualmente filtri e ordinamento.");
  if((query.match(/\bselect\b/gi)?.length??0)!==1||(query.match(/\bfrom\b/gi)?.length??0)!==1||/\b(join|union|intersect|except)\b/i.test(query))throw new Error("Sono consentite query su una sola tabella.");
  if(/[()]/.test(query)||/--|\/\*/.test(query))throw new Error("Funzioni, sottoquery e commenti SQL non sono consentiti.");
  if(/\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|reindex|replace|truncate|grant|revoke|copy|call|execute)\b/i.test(query))throw new Error("La query contiene un comando non consentito.");
  return query;
}

export function selectedTable(query:string){const match=query.match(/^select\s+\*\s+from\s+(?:"([A-Za-z_][A-Za-z0-9_]*)"|([A-Za-z_][A-Za-z0-9_]*))(?:\s|$)/i);const table=match?.[1]||match?.[2];if(!table)throw new Error("Nome della tabella non valido.");return table.toLowerCase();}

function normalizeRow(row:Record<string,unknown>){return Object.fromEntries(Object.entries(row).map(([key,value])=>[key,normalizeValue(value)]));}
function normalizeValue(value:unknown):string|null{if(value==null)return null;if(value instanceof Date)return value.toISOString();if(typeof value==="object")return JSON.stringify(value);return String(value);}
