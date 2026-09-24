import crypto from 'node:crypto'; import { config } from '../config.js';
import { z } from 'zod';
const endpoint=()=>`https://graph.facebook.com/${config.WHATSAPP_GRAPH_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;
export class WhatsAppSendError extends Error {
  constructor(public status:number, public code?:number, public subcode?:number) {
    super(`WhatsApp send failed (HTTP ${status}, code ${code ?? 'unknown'}, subcode ${subcode ?? 'none'})`);
    this.name='WhatsAppSendError';
  }
}
export function safeErrorDetails(error:unknown) {
  if(error instanceof WhatsAppSendError) return {kind:error.name,status:error.status,code:error.code,subcode:error.subcode};
  const e=error as {name?:unknown;code?:unknown;cause?:{code?:unknown}}|null;
  // Never log raw provider messages, request bodies, tokens, or recipient numbers.
  const safe=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9_]{1,50}$/.test(v)?v:undefined;
  return {kind:safe(e?.name)??'Error',code:safe(e?.code),networkCode:safe(e?.cause?.code)};
}
async function send(body:Record<string,unknown>){
  const r=await fetch(endpoint(),{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',...body})});
  if(!r.ok){
    const data=await r.json().catch(()=>null) as {error?:{code?:unknown;error_subcode?:unknown}}|null;
    const numeric=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:undefined;
    throw new WhatsAppSendError(r.status,numeric(data?.error?.code),numeric(data?.error?.error_subcode));
  }
  return r.json();
}
export const sendText=(to:string,body:string)=>send({to,type:'text',text:{body:body.slice(0,4096),preview_url:true}});
export const sendDocument=(to:string,url:string,filename:string)=>send({to,type:'document',document:{link:url,filename,caption:'Your confirmed travel voucher'}});
export function validMetaSignature(raw:Buffer,signature?:string){if(!signature)return false;const expected='sha256='+crypto.createHmac('sha256',config.WHATSAPP_APP_SECRET).update(raw).digest('hex');return signature.length===expected.length&&crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))}
const incoming=z.object({entry:z.array(z.object({changes:z.array(z.object({value:z.object({messages:z.array(z.object({id:z.string().min(1).max(250),from:z.string().regex(/^\d{7,20}$/),text:z.object({body:z.string().min(1).max(4000)}).optional(),interactive:z.object({button_reply:z.object({id:z.string().max(4000)}).optional(),list_reply:z.object({id:z.string().max(4000)}).optional()}).optional()})).optional()})}))}))});
export function messagesFrom(payload:unknown):Array<{id:string;from:string;text:string}>{const parsed=incoming.safeParse(payload);if(!parsed.success)return [];const out=[];for(const e of parsed.data.entry)for(const c of e.changes)for(const m of c.value.messages??[]){const text=m.text?.body??m.interactive?.button_reply?.id??m.interactive?.list_reply?.id;if(text)out.push({id:m.id,from:m.from,text})}return out}
