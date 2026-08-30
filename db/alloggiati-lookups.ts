import { asc, eq } from "drizzle-orm";
import { alloggiatiLookupValues } from "./schema";

export type AlloggiatiLookupInput={itemKey:string;itemValue:string;metadata:Record<string,string>};
export type AlloggiatiLookupValue={tableName:string;itemKey:string;itemValue:string;metadata:Record<string,string>;syncedAt:string};
const usesPostgres=()=>Boolean(process.env["DATABASE_URL"]?.trim());
const postgresRepository=()=>import("./alloggiati-lookups.postgres");

export async function replaceAlloggiatiLookupTable(tableName:string,items:AlloggiatiLookupInput[]){
  if(usesPostgres())return (await postgresRepository()).replaceAlloggiatiLookupTable(tableName,items);
  const {getDb}=await import(".");const db=getDb();const syncedAt=new Date().toISOString();
  await db.update(alloggiatiLookupValues).set({active:false,syncedAt}).where(eq(alloggiatiLookupValues.tableName,tableName));
  for(const item of items){const record={id:`${tableName}:${item.itemKey}`,tableName,itemKey:item.itemKey,itemValue:item.itemValue,metadataJson:JSON.stringify(item.metadata),active:true,syncedAt};await db.insert(alloggiatiLookupValues).values(record).onConflictDoUpdate({target:[alloggiatiLookupValues.tableName,alloggiatiLookupValues.itemKey],set:record});}
  return {tableName,count:items.length,syncedAt};
}

export async function listAlloggiatiLookupValues():Promise<AlloggiatiLookupValue[]>{
  if(usesPostgres())return (await postgresRepository()).listAlloggiatiLookupValues();
  const {getDb}=await import(".");const rows=await getDb().select().from(alloggiatiLookupValues).where(eq(alloggiatiLookupValues.active,true)).orderBy(asc(alloggiatiLookupValues.tableName),asc(alloggiatiLookupValues.itemValue));
  return rows.map(row=>({tableName:row.tableName,itemKey:row.itemKey,itemValue:row.itemValue,metadata:safeMetadata(row.metadataJson),syncedAt:row.syncedAt}));
}

function safeMetadata(value:string){try{return JSON.parse(value) as Record<string,string>;}catch{return {};}}
