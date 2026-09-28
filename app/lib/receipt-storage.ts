type StoredReceipt={key:string;contentType:string;size:number};
type ReceiptBody={body:BodyInit;contentType:string;size:number|null};
type R2ObjectBody={body:ReadableStream;size:number;httpMetadata?:{contentType?:string}};
type R2BucketLike={put:(key:string,value:ArrayBuffer,options?:{httpMetadata?:{contentType?:string}})=>Promise<unknown>;get:(key:string)=>Promise<R2ObjectBody|null>;delete:(key:string)=>Promise<unknown>};

export async function storeReceipt(key:string,file:File):Promise<StoredReceipt>{
  const contentType=file.type||"application/octet-stream";
  return storeReceiptBytes(key,new Uint8Array(await file.arrayBuffer()),contentType);
}

export async function storeReceiptBytes(key:string,value:Uint8Array,contentType="application/octet-stream"):Promise<StoredReceipt>{
  const bytes=value.slice();
  const directory=process.env["RECEIPTS_DIR"]?.trim();
  if(directory){
    const [{mkdir,writeFile},path]=await Promise.all([import("node:fs/promises"),import("node:path")]);
    const target=path.join(directory,...key.split("/"));
    await mkdir(path.dirname(target),{recursive:true});
    await writeFile(target,bytes);
    return {key,contentType,size:bytes.byteLength};
  }
  const {env}=await import("cloudflare:workers");
  const bucket=Reflect.get(env,"RECEIPTS") as R2BucketLike|undefined;
  if(!bucket)throw new Error("Receipt storage is unavailable");
  await bucket.put(key,bytes.buffer,{httpMetadata:{contentType}});
  return {key,contentType,size:bytes.byteLength};
}

export async function readReceipt(key:string):Promise<ReceiptBody|null>{
  const directory=process.env["RECEIPTS_DIR"]?.trim();
  if(directory){
    const [{readFile},path]=await Promise.all([import("node:fs/promises"),import("node:path")]);
    try{return {body:new Uint8Array(await readFile(path.join(directory,...key.split("/")))),contentType:contentTypeFromKey(key),size:null};}catch(error){if((error as {code?:string}).code==="ENOENT")return null;throw error;}
  }
  const {env}=await import("cloudflare:workers");
  const bucket=Reflect.get(env,"RECEIPTS") as R2BucketLike|undefined;
  if(!bucket)return null;
  const object=await bucket.get(key);
  return object?{body:object.body,contentType:object.httpMetadata?.contentType||contentTypeFromKey(key),size:object.size}:null;
}

export async function deleteReceipt(key:string):Promise<void>{
  const directory=process.env["RECEIPTS_DIR"]?.trim();
  if(directory){
    const [{unlink},path]=await Promise.all([import("node:fs/promises"),import("node:path")]);
    try{await unlink(path.join(directory,...key.split("/")));}catch(error){if((error as {code?:string}).code!=="ENOENT")throw error;}
    return;
  }
  const {env}=await import("cloudflare:workers");
  const bucket=Reflect.get(env,"RECEIPTS") as R2BucketLike|undefined;
  if(!bucket)throw new Error("Receipt storage is unavailable");
  await bucket.delete(key);
}

function contentTypeFromKey(key:string){if(key.endsWith(".pdf"))return "application/pdf";if(key.endsWith(".png"))return "image/png";return "image/jpeg";}
