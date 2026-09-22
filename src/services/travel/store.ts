import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { db, getConversation } from '../../db.js';
import type { DemoBooking, Session, Turn } from './types.js';

export interface TravelStore { bookings(userId:string):Promise<DemoBooking[]>; load(userId:string):Promise<Session|undefined>; reply(userId:string,eventId:string):Promise<string|undefined>; commit(userId:string,eventId:string,turn:Turn):Promise<void> }
interface FileData { sessions:Record<string,Session>; events:Record<string,{userId:string;reply:string}>; bookings:Record<string,DemoBooking> }
export class FileTravelStore implements TravelStore {
  constructor(private file:string){}
  private async read():Promise<FileData>{try{return JSON.parse(await readFile(this.file,'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {sessions:{},events:{},bookings:{}};throw e}}
  async bookings(id:string){return Object.values((await this.read()).bookings).filter(b=>b.userId===id)}
  async load(id:string){return (await this.read()).sessions[id]}
  async reply(id:string,event:string){const e=(await this.read()).events[event];return e?.userId===id?e.reply:undefined}
  async commit(id:string,event:string,turn:Turn){
    const data=await this.read();if(data.events[event])return;
    data.sessions[id]=turn.session;data.events[event]={userId:id,reply:turn.reply};
    if(turn.booking)data.bookings[turn.booking.bookingId]=turn.booking;
    await mkdir(path.dirname(this.file),{recursive:true});const temp=`${this.file}.tmp`;
    await writeFile(temp,JSON.stringify(data),{mode:0o600});await rename(temp,this.file);
  }
}
export class SupabaseTravelStore implements TravelStore {
  async bookings(id:string){const r=await db.from('travel_demo_bookings').select('record').eq('user_phone',id);if(r.error)throw r.error;return (r.data??[]).map(b=>b.record as DemoBooking)}
  async load(id:string){const c=await getConversation(id);return (c?.state.travel as Session|undefined)}
  async reply(id:string,event:string){const r=await db.from('travel_message_results').select('reply').eq('event_id',event).eq('user_phone',id).maybeSingle();if(r.error)throw r.error;return r.data?.reply as string|undefined}
  async commit(id:string,event:string,turn:Turn){const r=await db.rpc('commit_travel_turn',{p_user:id,p_event:event,p_state:turn.session,p_reply:turn.reply,p_booking:turn.booking??null});if(r.error)throw r.error}
}
