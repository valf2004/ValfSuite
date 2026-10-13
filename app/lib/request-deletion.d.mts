export type DeleteRequestResult={status:"deleted"|"missing"|"changed"|"linked"|"submitted";storageKeys:string[]};
export const requestDeletionBlockSql:string;
export const requestDeletionMessages:Record<"linked"|"submitted"|"changed",string>;
export function isRequestAttachment(key:unknown,requestId:string):boolean;
export function removeRequestAttachments(keys:string[],requestId:string,remove:(key:string)=>Promise<void>):Promise<string[]>;
