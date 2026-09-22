import { describe,it,expect,vi } from 'vitest';
import { mkdtemp,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localIntent } from '../src/services/travel/intent.js';
import { advance } from '../src/services/travel/conversation.js';
import { newSession,extractionSchema,type Session,type TravelType } from '../src/services/travel/types.js';
import { MockProvider,type TravelProvider } from '../src/services/travel/providers.js';
import { FileTravelStore } from '../src/services/travel/store.js';
import { createTravelAssistant } from '../src/services/travel/index.js';
import { resolveDate,todayInZone } from '../src/services/travel/dates.js';
import { messagesFrom,validMetaSignature } from '../src/services/whatsapp.js';

const now=new Date('2026-09-05T10:00:00Z');
const providers:Record<TravelType,TravelProvider>={flight:new MockProvider('flight'),hotel:new MockProvider('hotel'),cab:new MockProvider('cab')};
const step=(s:Session,text:string,p=providers)=>advance(s,text,localIntent(text,s),p,now);
describe('travel conversation',()=>{
 it('retains a flight request, refines, collects minimal details, and demo-books',async()=>{
   let r=await step(newSession('919999999999',now),'I want to fly to Delhi tomorrow.');expect(r.session.pendingField).toBe('origin');
   r=await step(r.session,'Mumbai');expect(r.session.status).toBe('awaiting_confirmation');expect(r.session.searchCriteria.departureDate).toBe('2026-09-06');expect(r.reply).toContain('mock');
   const firstPrice=r.session.recommendedOption!.price;
   r=await step(r.session,'cheaper one');expect(r.session.recommendedOption?.price).toBeLessThan(firstPrice);
   r=await step(r.session,'yes book it');expect(r.session.pendingField).toBe('fullName');expect(r.booking).toBeUndefined();
   r=await step(r.session,'Arjun Mehta');expect(r.session.pendingField).toBe('email');
   r=await step(r.session,'arjun@example.com');expect(r.booking?.status).toBe('confirmed_demo');expect(r.booking?.bookingId).toMatch(/^DEMO-FLT-/);
   expect((await step(r.session,'yes')).booking).toBeUndefined();
 });
 it('resolves weekend hotel dates and budget',async()=>{
   const r=await step(newSession('user',now),'Need a hotel in Goa this weekend under 5000.');expect(r.session.status).toBe('awaiting_confirmation');expect(r.session.searchCriteria).toMatchObject({location:'Goa',checkIn:'2026-09-05',checkOut:'2026-09-07',maxPrice:5000});
 });
 it('books a mock cab with only a rider name',async()=>{
   let r=await step(newSession('user',now),'Need a cab from Pune airport to Hinjewadi.');expect(r.session.recommendedOption?.pickup).toBe('Pune airport');
   r=await step(r.session,'book it');r=await step(r.session,'Arjun Mehta');expect(r.booking?.type).toBe('cab');
 });
 it('does not approve a random yes or book after invalid refinement',async()=>{
   expect((await step(newSession('user',now),'yes')).booking).toBeUndefined();
   let r=await step(newSession('user',now),'flight from Mumbai to Delhi tomorrow');r=await step(r.session,'2026-02-30');
   const after=await step(r.session,'yes');expect(after.booking).toBeUndefined();expect(after.session.status).not.toBe('collecting_booking_details');
 });
 it('validates dates, unknown locations, and hotel date order',async()=>{
   let r=await step(newSession('user',now),'flight from Mumbai to Delhi 2026-02-30');expect(r.reply).toContain('invalid');
   r=await step(newSession('user',now),'flight from Mumbai to Delhi 2020-01-01');expect(r.reply).toContain('past');
   r=await step(newSession('user',now),'flight from Atlantis to Delhi tomorrow');expect(r.reply).toContain('couldn’t identify');
   r=await step(newSession('user',now),'hotel in Goa 2026-09-10 2026-09-09');expect(r.session.pendingField).toBe('checkOut');
 });
 it('retains criteria on API failure and retries',async()=>{
   const search=vi.fn().mockRejectedValue(new Error('429 secret provider body'));
   let r=await step(newSession('user',now),'flight from Mumbai to Delhi tomorrow',{...providers,flight:{search}});expect(r.reply).toContain('temporarily unavailable');expect(r.reply).not.toContain('secret');
   r=await step(r.session,'try again');expect(r.session.status).toBe('awaiting_confirmation');
 });
 it('handles no results and switches travel type',async()=>{
   let r=await step(newSession('user',now),'flight from Mumbai to Delhi tomorrow under 10');expect(r.reply).toContain('couldn’t find');
   r=await step(r.session,'hotel in Goa for 2 nights');expect(r.session.searchCriteria.origin).toBeUndefined();expect(r.session.pendingField).toBe('checkIn');
   r=await step(r.session,'tomorrow');expect(r.session.searchCriteria.checkOut).toBe('2026-09-08');
 });
 it('keeps later-time refinements and direct-flight requirements',async()=>{
   let r=await step(newSession('user',now),'flight from Mumbai to Delhi tomorrow');
   r=await step(r.session,'something later');expect(r.session.recommendedOption?.departureTime).toContain('T18:');
   r=await step(r.session,'I want a direct flight');expect(r.session.recommendedOption?.stops).toBe(0);expect(r.session.recommendedOption?.departureTime).toContain('T21:');
 });
 it('collects a scheduled cab pickup and destination over separate turns',async()=>{
   let r=await step(newSession('user',now),'Need a cab tomorrow at 8 AM');expect(r.session.pendingField).toBe('pickup');
   expect(r.session.searchCriteria.pickupTime).toContain('2026-09-06 8 AM');
   r=await step(r.session,'Pune airport');expect(r.session.pendingField).toBe('destination');
   r=await step(r.session,'Hinjewadi');expect(r.session.status).toBe('awaiting_confirmation');
 });
 it('persists across restarts and deduplicates concurrent deliveries and bookings',async()=>{
   const file=path.join(await mkdtemp(path.join(tmpdir(),'voyage-test-')),'state.json');const deps={extractIntent:async(t:string,s:Session)=>localIntent(t,s),providers};
   let run=createTravelAssistant(new FileTravelStore(file),deps,()=>now);
   await run('demo-user','cab from Pune airport to Hinjewadi','one');
   run=createTravelAssistant(new FileTravelStore(file),deps,()=>now);
   await run('demo-user','yes','two');
   const replies=await Promise.all([run('demo-user','Arjun Mehta','three'),run('demo-user','Arjun Mehta','three')]);expect(replies[0]).toBe(replies[1]);
   const data=JSON.parse(await readFile(file,'utf8'));expect(Object.keys(data.bookings)).toHaveLength(1);expect(data.sessions['demo-user'].status).toBe('booked');
 });
 it('expires old confirmation state',async()=>{
   const file=path.join(await mkdtemp(path.join(tmpdir(),'voyage-test-')),'state.json');const deps={extractIntent:async(t:string,s:Session)=>localIntent(t,s),providers};
   await createTravelAssistant(new FileTravelStore(file),deps,()=>now)('demo-user','cab from Pune to Mumbai','one');
   const reply=await createTravelAssistant(new FileTravelStore(file),deps,()=>new Date('2026-09-10T10:00:00Z'))('demo-user','yes','two');expect(reply).toContain('expired');expect(reply).not.toContain('confirmed!');
 });
});
describe('validation',()=>{
 it('handles timezone boundaries and relative dates',()=>{expect(todayInZone(new Date('2026-09-05T20:00:00Z'),'Asia/Kolkata')).toBe('2026-09-06');expect(resolveDate('day after tomorrow','2026-09-05')).toBe('2026-09-07');expect(resolveDate('this Friday','2026-09-05')).toBe('2026-09-11');expect(resolveDate('next Monday','2026-09-05')).toBe('2026-09-07');expect(resolveDate('2026-02-30','2026-09-05')).toBeUndefined()});
 it('rejects malformed intent and strips arbitrary fields',()=>{expect(extractionSchema.safeParse({intent:'pay'}).success).toBe(false);expect(extractionSchema.parse({intent:'unknown',execute:'pay'})).not.toHaveProperty('execute');expect(extractionSchema.safeParse({intent:'flight_search',criteria:{passengers:-1}}).success).toBe(false)});
 it('rejects malformed Meta payloads/signatures',()=>{expect(messagesFrom(null)).toEqual([]);expect(messagesFrom({entry:'bad'})).toEqual([]);expect(validMetaSignature(Buffer.from('{}'),'bad')).toBe(false)});
});
