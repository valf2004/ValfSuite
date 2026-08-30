import postgres from "postgres";
import type {AlloggiatiLookupInput,AlloggiatiLookupValue} from "./alloggiati-lookups";

const url=process.env["DATABASE_URL"];
if(!url)throw new Error("DATABASE_URL is required in the Docker runtime");
const sql=postgres(url,{max:2,idle_timeout:20,connect_timeout:10});

export async function replaceAlloggiatiLookupTable(tableName:string,items:AlloggiatiLookupInput[]){
  const syncedAt=new Date().toISOString();
  await sql.begin(async transaction=>{
    await transaction`UPDATE alloggiati_lookup_values SET active=false,synced_at=${syncedAt} WHERE table_name=${tableName}`;
    for(const item of items)await transaction`INSERT INTO alloggiati_lookup_values (id,table_name,item_key,item_value,metadata_json,active,synced_at) VALUES (${`${tableName}:${item.itemKey}`},${tableName},${item.itemKey},${item.itemValue},${JSON.stringify(item.metadata)},true,${syncedAt}) ON CONFLICT (table_name,item_key) DO UPDATE SET item_value=EXCLUDED.item_value,metadata_json=EXCLUDED.metadata_json,active=true,synced_at=EXCLUDED.synced_at`;
  });
  return {tableName,count:items.length,syncedAt};
}

export async function listAlloggiatiLookupValues():Promise<AlloggiatiLookupValue[]>{
  const rows=await sql`SELECT table_name,item_key,item_value,metadata_json,synced_at FROM alloggiati_lookup_values WHERE active=true ORDER BY table_name,item_value`;
  return rows.map(row=>({tableName:String(row.table_name),itemKey:String(row.item_key),itemValue:String(row.item_value),metadata:safeMetadata(row.metadata_json),syncedAt:new Date(row.synced_at as string).toISOString()}));
}
function safeMetadata(value:unknown){try{return JSON.parse(String(value||"{}")) as Record<string,string>;}catch{return {};}}
