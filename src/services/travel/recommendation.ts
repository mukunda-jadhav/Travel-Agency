import type { Criteria, Option } from './types.js';
export function rankOptions(options:Option[],c:Criteria,previous?:Option,refinement?:string){
  const hours=(o:Option)=>Number(o.departureTime?.slice(11,13));
  const ranges={morning:[5,12],afternoon:[12,17],evening:[17,21],night:[21,24]};
  return options.filter(o=>{
    if(c.maxPrice!==undefined&&(o.currency!=='INR'||o.price>c.maxPrice))return false;
    if(c.direct&&o.stops!==0)return false;
    if(c.airline&&!o.name.toLowerCase().includes(c.airline.toLowerCase()))return false;
    if(c.rating&&(o.rating??0)<c.rating)return false;
    if(c.amenities?.some(a=>!o.amenities?.some(b=>b.toLowerCase()===a.toLowerCase())))return false;
    if(c.vehicle&&o.vehicle?.toLowerCase()!==c.vehicle.toLowerCase())return false;
    if(c.afterHour!==undefined&&o.type==='flight'&&hours(o)<=c.afterHour)return false;
    if(c.time&&o.type==='flight'){const [min,max]=ranges[c.time];if(!(hours(o)>=min!&&hours(o)<max!))return false}
    if(previous&&refinement==='cheaper'&&(o.currency!==previous.currency||o.price>=previous.price))return false;
    if(previous&&refinement==='later'&&!(hours(o)>hours(previous)))return false;
    if(previous&&refinement==='another'&&o.id===previous.id)return false;
    return true;
  }).sort((a,b)=>a.currency.localeCompare(b.currency)||(a.price+(a.stops??0)*1500-(a.rating??0)*200)-(b.price+(b.stops??0)*1500-(b.rating??0)*200));
}
export function recommendation(o:Option,c:Criteria){
  const money=new Intl.NumberFormat('en-IN',{style:'currency',currency:o.currency,maximumFractionDigits:0}).format(o.price);
  const description=o.type==='flight'?`${o.origin} → ${o.destination}\n${o.departureTime?.replace('T',' ')} – ${o.arrivalTime?.slice(11,16)} (airport local time)\n${o.stops===0?'Non-stop':`${o.stops??'Unknown'} stops`}${c.returnDate?`\nReturn: ${c.returnDate}`:''}`:o.type==='hotel'?`${o.location}\n${o.checkIn} → ${o.checkOut}${o.rating?` · Rating ${o.rating}`:''}`:`${o.pickup} → ${o.destination}\nEstimated ${o.duration}${c.pickupTime?` · Pickup ${c.pickupTime}`:''}`;
  return `${o.mock?'Demo example — mock availability and prices.':'Sandbox search result.'}\n\n${o.name}\n${description}\n${money}${o.type==='hotel'?' per night (all requested rooms)':o.type==='flight'?' total':''}\n\nThis is a good-value match for your search. Shall I demo-book this option? No payment or real reservation.`;
}
