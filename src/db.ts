import { createClient } from '@supabase/supabase-js';
import { config } from './config.js'; import type { Booking,Conversation } from './types.js';
export const db=createClient(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=<T>(r:{data:T|null;error:unknown}):T=>{if(r.error)throw r.error;if(r.data===null)throw new Error('Database returned no data');return r.data};
export async function getConversation(phone:string){const r=await db.from('conversations').select('*').eq('user_phone',phone).maybeSingle();if(r.error)throw r.error;return r.data as Conversation|null}
export async function saveConversation(c:Omit<Conversation,'updated_at'>){return must(await db.from('conversations').upsert({...c,updated_at:new Date().toISOString()}).select().single()) as Conversation}
export async function createBooking(values:Partial<Booking>&Pick<Booking,'user_phone'>){return must(await db.from('bookings').insert(values).select().single()) as Booking}
export async function getBooking(id:string){return must(await db.from('bookings').select('*').eq('id',id).single()) as Booking}
export async function updateBooking(id:string,values:Partial<Booking>){return must(await db.from('bookings').update({...values,updated_at:new Date().toISOString()}).eq('id',id).select().single()) as Booking}
export async function claimEvent(provider:string,eventId:string){const r=await db.from('webhook_events').insert({provider,event_id:eventId});if(!r.error)return true;if((r.error as {code?:string}).code==='23505')return false;throw r.error}
