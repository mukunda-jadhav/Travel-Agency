import { config } from '../../config.js';
import { searchFlights, searchStays } from '../duffel.js';
import { geocode } from '../cab.js';
import { optionSchema, type Criteria, type Option, type TravelType } from './types.js';

export interface TravelProvider { search(criteria:Criteria):Promise<Option[]> }
export class MockProvider implements TravelProvider {
  constructor(private type:TravelType){}
  async search(c:Criteria):Promise<Option[]> {
    return [0,1,2].map(i=>({id:`mock-${this.type}-${i}`,provider:'mock',type:this.type,mock:true,currency:'INR',
      name:this.type==='flight'?`Demo Airways ${101+i}`:this.type==='hotel'?`Demo ${['Comfort','Budget','Garden'][i]} Hotel`:`Demo ${['Sedan','Hatchback','SUV'][i]}`,
      price:(this.type==='flight'?[4800,3600,5500]:this.type==='hotel'?[4200,2800,4800]:[650,450,900])[i]!*(this.type==='flight'?(c.passengers??1)*(c.returnDate?2:1):this.type==='hotel'?(c.rooms??1):1),
      ...(this.type==='flight'?{origin:c.origin,destination:c.destination,departureTime:`${c.departureDate}T${[8,18,21][i]}:10:00`.replace('T8:','T08:'),arrivalTime:`${c.departureDate}T${[10,23,23][i]}:20:00`,duration:i===1?'5h 10m':'2h 10m',stops:i===1?1:0}:{}),
      ...(this.type==='hotel'?{location:[c.location,c.area].filter(Boolean).join(', '),checkIn:c.checkIn,checkOut:c.checkOut,rating:[4.5,3.8,4.2][i],amenities:['wifi','breakfast']}:{}),
      ...(this.type==='cab'?{pickup:c.pickup,destination:c.destination,vehicle:['Sedan','Hatchback','SUV'][i],estimatedArrival:'8 min',duration:'45 min'}:{})
    }));
  }
}
export class DuffelFlightProvider implements TravelProvider {
  async search(c:Criteria){
    if(!config.DUFFEL_ACCESS_TOKEN.startsWith('duffel_test_'))throw new Error('Travel search requires a Duffel test token');
    const r=await searchFlights({origin:c.origin!,destination:c.destination!,departureDate:c.departureDate!,returnDate:c.returnDate,adults:c.passengers??1,cabin:c.cabin});
    return r.offers.map(o=>optionSchema.parse({id:o.id,provider:'duffel',type:'flight',mock:false,name:o.airline,price:Number(o.amount),currency:o.currency.toUpperCase(),origin:c.origin,destination:c.destination,departureTime:o.slices[0]?.departingAt,arrivalTime:o.slices[0]?.arrivingAt,duration:o.slices[0]?.duration,stops:o.slices[0]?.stops}));
  }
}
export class DuffelHotelProvider implements TravelProvider {
  async search(c:Criteria){
    if(!config.DUFFEL_ACCESS_TOKEN.startsWith('duffel_test_'))throw new Error('Travel search requires a Duffel test token');
    const point=await geocode([c.area,c.location].filter(Boolean).join(', '));
    const results=await searchStays({latitude:point.lat,longitude:point.lng,checkInDate:c.checkIn!,checkOutDate:c.checkOut!,adults:c.guests??1,rooms:c.rooms??1,stars:c.rating});
    const nights=(Date.parse(c.checkOut!)-Date.parse(c.checkIn!))/86400000;
    return results.map(o=>optionSchema.parse({id:o.searchResultId,provider:'duffel',type:'hotel',mock:false,name:o.name,price:Number(o.amount)/nights,currency:o.currency.toUpperCase(),location:c.location,rating:o.stars??undefined,checkIn:c.checkIn,checkOut:c.checkOut}));
  }
}
export const providers:Record<TravelType,TravelProvider>={flight:config.DEMO_MODE?new MockProvider('flight'):new DuffelFlightProvider(),hotel:config.DEMO_MODE?new MockProvider('hotel'):new DuffelHotelProvider(),cab:new MockProvider('cab')};
export async function searchOptions(provider:TravelProvider,c:Criteria){
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return optionSchema.array().max(100).parse(await Promise.race([provider.search(c),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Provider timeout')),20000)})]))}finally{clearTimeout(timer)}
}
