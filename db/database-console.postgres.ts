import postgres from "postgres";
import {selectedTable,validateReadOnlyQuery,type DatabaseQueryResult} from "./database-console";

const url=process.env["DATABASE_URL"];
if(!url)throw new Error("DATABASE_URL is required in the Docker runtime");
const sql=postgres(url,{max:2,idle_timeout:20,connect_timeout:10});

export async function listDatabaseTables():Promise<string[]>{
  const rows=await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`;
  return rows.map(row=>String(row.table_name));
}

export async function executeReadOnlyQuery(input:string):Promise<DatabaseQueryResult>{
  const query=validateReadOnlyQuery(input);const table=selectedTable(query);const tables=await listDatabaseTables();
  if(!tables.includes(table))throw new Error("La query può usare soltanto una tabella presente nell’elenco.");
  const rows=await sql.begin("read only",async transaction=>{await transaction`SET LOCAL statement_timeout = '5000ms'`;return transaction.unsafe(`SELECT * FROM (${query}) AS valfsuite_query LIMIT 501`);});
  const selected=rows.slice(0,500).map(row=>normalizeRow(row as Record<string,unknown>));
  return {columns:selected[0]?Object.keys(selected[0]):[],rows:selected,truncated:rows.length>500,limit:500};
}

function normalizeRow(row:Record<string,unknown>){return Object.fromEntries(Object.entries(row).map(([key,value])=>[key,normalizeValue(value)]));}
function normalizeValue(value:unknown):string|null{if(value==null)return null;if(value instanceof Date)return value.toISOString();if(typeof value==="bigint")return value.toString();if(typeof value==="object")return JSON.stringify(value);return String(value);}
