import {jwtVerify,SignJWT} from "jose";
import {authConfig} from "./google-auth";

const issuer="valfsuite-checkin";
const audience="valfsuite-guests";

export async function createCheckinToken(requestId:string,departureDate:string){
  const secret=checkinSecret();
  const departureEnd=Math.floor(Date.parse(`${departureDate}T23:59:59Z`)/1000);
  const expiresAt=Math.max(Math.floor(Date.now()/1000)+86_400,departureEnd+30*86_400);
  return new SignJWT({requestId})
    .setProtectedHeader({alg:"HS256"})
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);
}

export async function verifyCheckinToken(token:string){
  try{
    const {payload}=await jwtVerify(token,checkinSecret(),{issuer,audience,algorithms:["HS256"]});
    return typeof payload.requestId==="string"?payload.requestId:null;
  }catch{return null;}
}

function checkinSecret(){
  const value=authConfig().sessionSecret;
  if(value.length<32)throw new Error("AUTH_SESSION_SECRET is required for check-in links");
  return new TextEncoder().encode(value);
}
