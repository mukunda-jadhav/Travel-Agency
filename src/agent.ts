import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { config } from './config.js';
import { createBooking, getBooking, getConversation, saveConversation, updateBooking } from './db.js';
import { createPaymentLink } from './services/payment.js';
import { conversationalTools } from './tools/index.js';
import { quoteStay, revalidateFlight } from './services/duffel.js';

const baseModel = new ChatGoogleGenerativeAI({ apiKey:config.GOOGLE_API_KEY, model:config.GEMINI_MODEL, temperature:0.2 });
const passenger = z.object({ givenName:z.string(), familyName:z.string(), bornOn:z.string(), gender:z.enum(['m','f']), title:z.enum(['mr','ms','mrs','miss']), email:z.string().email(), phoneNumber:z.string(), passport:z.object({uniqueIdentifier:z.string(),expiresOn:z.string(),issuingCountryCode:z.string().length(2)}).optional() });
const system = `You are ${config.APP_NAME}, a WhatsApp travel concierge. Gather origin/destination IATA codes, dates and adult count, then search flights. Search stays only when requested; after the user selects a property, call getStayRates and show its real rooms, terms and cancellation policy before accepting a rate. Cab quotes are route-based estimates only: clearly say they do not reserve a vehicle and never include them in the payable total. Present at most 5 concise numbered options. After selection, gather every traveller's name, DOB, title, gender, email, phone and passport details when required. Then call prepareCheckout exactly once. hotelSnapshot must contain the chosen rateId, or null when no hotel was chosen. The server revalidates inventory and calculates the total; never invent IDs/prices or claim confirmation before payment. /status UUID and Cancel booking UUID are handled outside you. Everything is sandbox/test.`;

export async function runAgent(phone:string,input:string) {
  const checkout = new DynamicStructuredTool({
    name:'prepareCheckout', description:'Persist the selected package and return Stripe test Checkout. Requires explicit selection and complete guests.',
    schema:z.object({selectedOfferId:z.string(),flightSnapshot:z.record(z.unknown()),hotelSnapshot:z.record(z.unknown()).nullable(),cabSnapshot:z.record(z.unknown()).nullable(),passengers:z.array(passenger).min(1)}),
    func:async x=>{const flight=await revalidateFlight(x.selectedOfferId);const hotelInput=x.hotelSnapshot as {rateId?:unknown}|null;const hotel=hotelInput?.rateId?await quoteStay(String(hotelInput.rateId)):null;if(hotel&&hotel.currency!==flight.currency)throw new Error('Flight and hotel use different currencies; choose matching inventory');const toMinor=(amount:string)=>Math.round(Number(amount)*100);const amountMinor=toMinor(flight.amount)+(hotel?toMinor(hotel.amount):0);let b=await createBooking({user_phone:phone,status:'DRAFT',selected_offer_id:x.selectedOfferId,flight_snapshot:flight,hotel_snapshot:hotel,cab_snapshot:x.cabSnapshot?{...x.cabSnapshot,bookingStatus:'ESTIMATE_ONLY',includedInTotal:false}:null,passengers:x.passengers,amount_minor:amountMinor,currency:flight.currency.toUpperCase()});const pay=await createPaymentLink(b);b=await updateBooking(b.id,{status:'PAYMENT_PENDING',stripe_session_id:pay.id});return JSON.stringify({bookingId:b.id,paymentUrl:pay.url,status:b.status,amountMinor,currency:b.currency,cabIncluded:false});}
  });
  const tools:any[]=[...conversationalTools,checkout]; const model=baseModel.bindTools(tools); const toolMap:Map<string,any>=new Map(tools.map(t=>[t.name,t]));
  const c=await getConversation(phone); const history=(c?.messages??[]).slice(-16);
  const msgs:any[]=[new SystemMessage(system),...history.map(m=>m.role==='user'?new HumanMessage(m.content):new AIMessage(m.content)),new HumanMessage(input)];
  for(let i=0;i<8;i++){const ai=await model.invoke(msgs);msgs.push(ai);if(!ai.tool_calls?.length){const answer=typeof ai.content==='string'?ai.content:JSON.stringify(ai.content);await saveConversation({user_phone:phone,state:c?.state??{},messages:[...history,{role:'user' as const,content:input},{role:'assistant' as const,content:answer}].slice(-20)});return answer;}for(const call of ai.tool_calls){const t=toolMap.get(call.name);const content=t?await t.invoke(call.args):`Unknown tool ${call.name}`;msgs.push(new ToolMessage({tool_call_id:call.id??call.name,content:String(content)}));}}
  throw new Error('Agent exceeded tool-call limit');
}
export async function statusText(id:string,phone:string){const b=await getBooking(id);if(b.user_phone!==phone)throw new Error('Booking not found');return `Booking ${b.id}\nStatus: ${b.status}\nPNR: ${b.pnr??'Not issued'}${b.voucher_url?`\nVoucher: ${b.voucher_url}`:''}`;}
