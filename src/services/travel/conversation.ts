import { randomUUID } from 'node:crypto';
import { addDays, resolveDate, todayInZone } from './dates.js';
import { flightLocation } from './location.js';
import { rankOptions, recommendation } from './recommendation.js';
import { searchOptions, type TravelProvider } from './providers.js';
import { newSession, type Session, type Extraction, type TravelType, type Turn, type Criteria } from './types.js';

const questions:Record<string,string>={origin:'Sure — which city are you flying from?',destination:'Where would you like to go?',departureDate:'What date would you like to fly?',returnDate:'What date would you like to return?',location:'Which city would you like to stay in?',checkIn:'When would you like to check in?',checkOut:'When would you like to check out?',pickup:'Where should the cab pick you up?',fullName:'What is the lead traveller’s full name for the demo booking?',email:'What email should I put on the demo booking?'};
export async function advance(session:Session,input:string,x:Extraction,providers:Record<TravelType,TravelProvider>,now=new Date(),timezone='Asia/Kolkata'):Promise<Turn> {
  let s=structuredClone(session);const today=todayInZone(now,timezone);
  const finish=(reply:string):Turn=>{s.lastUpdatedAt=now.toISOString();return {session:s,reply}};
  const ask=(field:Session['pendingField'],prefix='')=>{s.pendingField=field;return finish(prefix+questions[field!])};
  if(x.intent==='cancel'){s=newSession(s.userId,now);s.status='cancelled';return finish('I’ve cancelled this conversation request. Existing bookings are unchanged.')}
  if(x.intent==='greeting'||x.intent==='help')return finish('I can help find flights, hotels and cabs, then make a demo booking. Tell me where you’d like to go.');
  if(x.travelType&&(x.travelType!==s.travelType||['booked','cancelled','idle'].includes(s.status))){s={...newSession(s.userId,now),travelType:x.travelType,status:'collecting_search_details'}}
  s.intent=x.intent;
  Object.assign(s.bookingDetails,x.details);
  if(['accept_recommendation','booking_request'].includes(x.intent)){
    // Acceptance must refer to an actual current recommendation; the model cannot change state.
    if(s.status!=='awaiting_confirmation'||!s.recommendedOption)return finish(s.status==='booked'?`Your demo booking ${s.bookingId} is already confirmed.`:'Let’s find an option first. Tell me your flight, hotel or cab request.');
    s.approved=true;s.status='collecting_booking_details';
  }
  if(!s.travelType)return finish('Tell me where you’d like to fly, stay, or take a cab.');
  if(s.status==='collecting_booking_details'&&!Object.keys(x.criteria).length&&!x.refinement){
    Object.assign(s.bookingDetails,x.details);
    if(!s.bookingDetails.fullName)return ask('fullName');
    if(s.travelType!=='cab'&&!s.bookingDetails.email)return ask('email');
    if(!s.approved||!s.recommendedOption)return finish('Please select an option first.');
    const id=`DEMO-${{flight:'FLT',hotel:'HTL',cab:'CAB'}[s.travelType]}-${randomUUID().slice(0,8).toUpperCase()}`;
    s.status='booked';s.bookingId=id;s.pendingField=undefined;s.approved=false;
    return {...finish(`Demo booking confirmed!\n${id}\n${s.recommendedOption.name}\n\nNo payment was taken and no real reservation was made.\n\nSend /status ${id}, /voucher ${id}, or /cancel ${id}.`),booking:{bookingId:id,type:s.travelType,status:'confirmed_demo',userId:s.userId,selectedOption:s.recommendedOption,travelerDetails:s.bookingDetails,createdAt:now.toISOString()}};
  }
  if(x.intent==='unknown')return finish(s.pendingField?questions[s.pendingField]!: 'Would you like to change your search, demo-book the option, or cancel?');
  if(s.status==='booked'&&!Object.keys(x.criteria).length)return finish(`Your demo booking ${s.bookingId} is confirmed. Tell me your next travel request.`);
  const previous=s.recommendedOption;
  const patch={...x.criteria};
  s.approved=false;s.recommendedOption=undefined;s.status='collecting_search_details';
  for(const key of ['departureDate','returnDate','checkIn','checkOut'] as const){
    if(patch[key]){const resolved=resolveDate(patch[key]!,today);if(!resolved||resolved<today)return ask(key,'That date is invalid or in the past. ');patch[key]=resolved}
  }
  if(patch.checkIn&&/weekend/i.test(x.criteria.checkIn??'')&&!patch.checkOut)patch.checkOut=addDays(patch.checkIn,2);
  if(patch.pickupTime){const resolved=resolveDate(patch.pickupTime,today);if(!resolved||resolved<today)return finish('When should the cab arrive? Please give today, tomorrow, or a date as YYYY-MM-DD.');patch.pickupTime=`${resolved}${input.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i)?.[0]?` ${input.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i)![0]}`:''} (${timezone})`}
  if(x.refinement==='cheaper'&&previous)patch.maxPrice=Math.min(s.searchCriteria.maxPrice??Infinity,previous.price-1);
  if(x.refinement==='later'&&previous?.departureTime)patch.afterHour=Number(previous.departureTime.slice(11,13));
  if(patch.checkOut&&!patch.nights)delete s.searchCriteria.nights;
  Object.assign(s.searchCriteria,patch);
  const c=s.searchCriteria;
  if(c.checkIn&&c.nights)c.checkOut=addDays(c.checkIn,c.nights);
  s.status='collecting_search_details';s.approved=false;s.recommendedOption=undefined;s.alternatives=[];
  const required:Array<keyof Criteria>=s.travelType==='flight'?['origin','destination','departureDate',...(c.tripType==='round_trip'?['returnDate' as const]:[])]:s.travelType==='hotel'?['location','checkIn','checkOut']:['pickup','destination'];
  for(const field of required)if(!c[field])return ask(field);
  for(const field of ['departureDate','checkIn','returnDate','checkOut'] as const)if(c[field]&&c[field]!<today){delete c[field];return ask(field,'Your previous date has passed. ')}
  if(c.returnDate&&c.departureDate&&c.returnDate<c.departureDate){delete c.returnDate;return ask('returnDate','The return must be on or after departure. ')}
  if(c.checkOut&&c.checkIn&&c.checkOut<=c.checkIn){delete c.checkOut;delete c.nights;return ask('checkOut','Check-out must be after check-in. ')}
  if(s.travelType==='flight'){
    for(const field of ['origin','destination'] as const){const code=flightLocation(c[field]!);if(!code){s.pendingField=field;return finish(`I couldn’t identify “${c[field]}”. Which city and country do you mean? Supported examples include Mumbai, Delhi, Bangalore and New York.`)}c[field]=code}
    if(c.origin===c.destination){delete c.destination;return ask('destination','Please choose a different destination. ')}
  }
  s.pendingField=undefined;s.status='searching';
  try {
    const options=rankOptions(await searchOptions(providers[s.travelType],c),c,previous,x.refinement??(x.intent==='reject_recommendation'?'another':undefined));
    if(!options.length){s.status='collecting_search_details';return finish('I couldn’t find a match for those preferences. Would you like to change the budget or timing?')}
    s.recommendedOption=options[0];s.alternatives=options.slice(1,5);s.status='awaiting_confirmation';
    return finish(recommendation(options[0]!,c));
  } catch {console.warn('Travel search failed',{type:s.travelType});s.status='collecting_search_details';return finish('The travel search service is temporarily unavailable. Your details are saved — say “try again” in a moment.')}
}
