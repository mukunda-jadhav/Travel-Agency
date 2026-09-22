import type { TravelStore } from './store.js';
import { newSession, type DemoBooking, type Session, type Turn } from './types.js';

export function bookingSummary(b:DemoBooking){
  const o=b.selectedOption;
  const nights=o.type==='hotel'?Math.max(1,(Date.parse(o.checkOut!)-Date.parse(o.checkIn!))/86400000):1;
  const money=new Intl.NumberFormat('en-IN',{style:'currency',currency:o.currency}).format(o.price*nights);
  return `${b.bookingId}\n${b.status==='cancelled_demo'?'Cancelled (demo)':'Confirmed (demo)'}\n${o.name}\n${o.type==='hotel'?`${o.location} · ${o.checkIn} to ${o.checkOut}`:`${o.origin??o.pickup} → ${o.destination}${o.departureTime?` · ${o.departureTime}`:''}`}\nTraveller: ${b.travelerDetails.fullName}\nTotal: ${money}${o.type==='hotel'?` for ${nights} nights`:''}\nNo payment or real reservation. Not valid for travel.`;
}
export async function handleBookingCommand(store:TravelStore,session:Session,input:string,now:Date):Promise<Turn|undefined>{
  const s=structuredClone(session);s.lastUpdatedAt=now.toISOString();
  const done=(reply:string,booking?:DemoBooking):Turn=>({session:s,reply,booking});
  const t=input.trim();
  if(/^(?:\/)?(?:help|hi|hello|hey)[!. ]*$/i.test(t))return done('Welcome to your travel assistant. Try:\n• Flight from Mumbai to Delhi tomorrow\n• Hotel in Goa tomorrow for 2 nights under 5000\n• Cab from Pune airport to Hinjewadi\n\nI’ll ask for missing details, then show a demo option. Say “cheaper one”, “another”, or “book it”.\n\n/bookings — your bookings\n/status BOOKING-ID — status\n/voucher BOOKING-ID — travel summary\n/cancel BOOKING-ID — cancel a demo booking\n/reset — start a new search\n\nAll prices and reservations are simulated.');
  if(/^\/reset$/i.test(t))return {session:newSession(s.userId,now),reply:'New search started. Existing bookings are saved. Where would you like to go?'};
  if(/^(?:\/bookings|my bookings)$/i.test(t)){
    const bookings=await store.bookings(s.userId);
    return done(bookings.length?bookings.slice(-10).reverse().map(bookingSummary).join('\n\n'):'You have no demo bookings yet. Try a flight, hotel, or cab request.');
  }
  if(s.pendingCancellation&&/^(?:yes|confirm|confirm cancel|no|keep it)$/i.test(t)){
    const id=s.pendingCancellation;delete s.pendingCancellation;
    if(/^(no|keep it)$/i.test(t))return done('Booking kept. No cancellation was made.');
    const booking=(await store.bookings(s.userId)).find(b=>b.bookingId===id);
    if(!booking)return done('Booking not found for this traveller.');
    if(s.bookingId===id)s.status='cancelled';
    return done(`Demo booking ${id} cancelled. No payment was taken, so no refund is needed.`,{...booking,status:'cancelled_demo'});
  }
  const match=t.match(/^(?:\/(status|voucher|cancel)|(?:cancel booking))\s+(\S+)$/i);
  if(match){
    delete s.pendingCancellation;
    const booking=(await store.bookings(s.userId)).find(b=>b.bookingId===match[2]!.toUpperCase());
    if(!booking)return done('Booking not found for this traveller. Send /bookings to see your references.');
    const action=match[1]?.toLowerCase()??'cancel';
    if(action==='cancel'&&booking.status!=='cancelled_demo'){s.pendingCancellation=booking.bookingId;return done(`Cancel demo booking ${booking.bookingId}? Reply “yes” to cancel or “no” to keep it.`)}
    return done(`${action==='voucher'?'DEMO TRAVEL SUMMARY — NOT VALID FOR TRAVEL\n\n':''}${bookingSummary(booking)}`);
  }
  if(/^\//.test(t))return done('Unknown or incomplete command. Send /help to see examples.');
  // A new request dismisses any old cancellation confirmation.
  delete session.pendingCancellation;
  return undefined;
}
