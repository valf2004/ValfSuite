import {deleteCheckinDocumentMetadata,listCheckinDocuments,replaceCheckinDocuments,type CheckinDocumentInput} from "../../db/availability";
import {deleteReceipt,storeReceipt} from "./receipt-storage";

const acceptedTypes=new Set(["application/pdf","image/jpeg","image/png"]);
const maxFiles=2;
const maxFileSize=5*1024*1024;

export async function parseCheckinRequest(request:Request){
  const contentType=request.headers.get("content-type")||"";
  if(!contentType.toLowerCase().includes("multipart/form-data"))return {data:await request.json().catch(()=>null),files:[] as File[]};
  const form=await request.formData();
  const payload=form.get("payload");
  const data=typeof payload==="string"?JSON.parse(payload):null;
  const files=form.getAll("document").filter((value):value is File=>value instanceof File&&value.size>0);
  if(files.length>maxFiles)throw new CheckinUploadError("Puoi caricare al massimo due file per il documento.");
  for(const file of files){
    if(file.size>maxFileSize)throw new CheckinUploadError("Ogni file del documento può avere una dimensione massima di 5 MB.");
    if(!acceptedTypes.has(file.type)||!await fileMatchesType(file))throw new CheckinUploadError("Il documento deve essere in formato PDF, JPG o PNG.");
  }
  return {data,files};
}

export async function replaceUploadedCheckinDocuments(requestId:string,files:File[],uploadedBy:"guest"|"operator"){
  if(!files.length)return;
  const oldDocuments=await listCheckinDocuments(requestId);
  const stored:CheckinDocumentInput[]=[];
  try{
    for(const file of files){
      const id=crypto.randomUUID();const extension=extensionFor(file.type);const storageKey=`identity-documents/${requestId}/${id}.${extension}`;
      await storeReceipt(storageKey,file);
      stored.push({id,requestId,guestOrdinal:0,storageKey,originalName:safeName(file.name),contentType:file.type,size:file.size,uploadedBy,createdAt:new Date().toISOString()});
    }
    await replaceCheckinDocuments(requestId,stored);
  }catch(error){await Promise.allSettled(stored.map(item=>deleteReceipt(item.storageKey)));throw error;}
  await Promise.allSettled(oldDocuments.map(item=>deleteReceipt(item.storageKey)));
}

export async function removeCheckinDocument(id:string){
  const metadata=await deleteCheckinDocumentMetadata(id);
  if(metadata)await deleteReceipt(metadata.storageKey);
  return metadata;
}

export async function removeAllCheckinDocuments(requestId:string){
  const documents=await listCheckinDocuments(requestId);
  await Promise.all(documents.map(document=>deleteReceipt(document.storageKey)));
  await replaceCheckinDocuments(requestId,[]);
  return documents.length;
}

export class CheckinUploadError extends Error{}

async function fileMatchesType(file:File){
  const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
  if(file.type==="application/pdf")return bytes.length>=5&&bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d;
  if(file.type==="image/png")return bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value);
  return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
}
function extensionFor(type:string){return type==="application/pdf"?"pdf":type==="image/png"?"png":"jpg";}
function safeName(name:string){const clean=name.replace(/[\\/\p{Cc}]/gu,"_").trim();return (clean||"documento").slice(0,180);}
