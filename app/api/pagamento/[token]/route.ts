import {createPaymentSubmission,findActiveQuoteByTokenHash,type PaymentMethod} from "../../../../db/availability";
import {sendPaymentNotification} from "../../../lib/availability-email";
import {hashPaymentToken} from "../../../lib/payment-token";
import {todayAtProperty} from "../../../lib/property-date";
import {storeReceipt} from "../../../lib/receipt-storage";

const allowedTypes=new Map([["application/pdf","pdf"],["image/jpeg","jpg"],["image/png","png"]]);

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
  try{
    const {token}=await params;
    if(!token||token.length!==64)return Response.json({message:"Collegamento non valido."},{status:404});
    const quote=await findActiveQuoteByTokenHash(await hashPaymentToken(token));
    if(!quote||!["quote_sent","accepted","checked_in","police_registered"].includes(quote.status))return Response.json({message:"La proposta non è più disponibile."},{status:409});
    const form=await request.formData();
    const method=String(form.get("method")||"") as PaymentMethod;
    const paidAt=String(form.get("paidAt")||"").trim();
    const amountText=String(form.get("amount")||"").trim().replace(",",".");
    const reference=String(form.get("reference")||"").trim().slice(0,120);
    const message=String(form.get("message")||"").trim().slice(0,2000);
    if(!["bank_transfer","paypal"].includes(method)||!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)||paidAt>todayAtProperty()||!/^\d+(\.\d{1,2})?$/.test(amountText))return Response.json({message:"Controlla i dati del pagamento."},{status:400});
    const paidAmountCents=Math.round(Number(amountText)*100);
    if(paidAmountCents<=0||paidAmountCents>quote.amountCents-quote.confirmedAmountCents)return Response.json({message:"L’importo non è valido o supera il saldo residuo."},{status:400});
    const receipt=form.get("receipt");
    if(receipt instanceof File&&receipt.size>5*1024*1024)return Response.json({message:"La ricevuta supera 5 MB."},{status:400});
    if(receipt instanceof File&&receipt.size>0&&!allowedTypes.has(receipt.type))return Response.json({message:"Sono ammessi soltanto PDF, JPG e PNG."},{status:400});
    const submissionId=crypto.randomUUID();
    let stored:{key:string;contentType:string;size:number}|null=null;
    let receiptName:string|null=null;
    if(receipt instanceof File&&receipt.size>0){
      const extension=allowedTypes.get(receipt.type)!;
      receiptName=receipt.name.replace(/[^\p{L}\p{N}._ -]/gu,"_").slice(0,160)||`ricevuta.${extension}`;
      stored=await storeReceipt(`${quote.requestId}/${submissionId}.${extension}`,receipt);
    }
    const createdAt=new Date().toISOString();
    const updated=await createPaymentSubmission({id:submissionId,quoteId:quote.quoteId,requestId:quote.requestId,method,paidAmountCents,paidAt,paymentReference:reference,message,receiptKey:stored?.key??null,receiptName,receiptContentType:stored?.contentType??null,receiptSize:stored?.size??null,createdAt});
    if(!updated.length)return Response.json({message:"Richiesta non trovata."},{status:404});
    try{
      await sendPaymentNotification({name:quote.name,email:quote.email,arrivalDate:quote.arrivalDate,departureDate:quote.departureDate,method:method==="paypal"?"PayPal":"Bonifico bancario",paidAmountCents,paidAt,reference,hasReceipt:Boolean(stored)});
    }catch(error){console.error("payment_notification_failed",error instanceof Error?error.message:"unknown");}
    return Response.json({ok:true,status:updated[0]?.status,paymentStatus:"reported"});
  }catch(error){console.error("payment_submission_failed",error instanceof Error?error.message:"unknown");return Response.json({message:"Registrazione del pagamento non riuscita."},{status:500});}
}
