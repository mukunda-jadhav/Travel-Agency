import { z } from 'zod';

const text = z.string().trim().min(1).max(160);
export const criteriaSchema = z.object({
  origin:text.optional(), destination:text.optional(), location:text.optional(), pickup:text.optional(),
  departureDate:text.optional(), returnDate:text.optional(), checkIn:text.optional(), checkOut:text.optional(), pickupTime:text.optional(),
  tripType:z.enum(['one_way','round_trip']).optional(), passengers:z.number().int().min(1).max(9).optional(),
  guests:z.number().int().min(1).max(12).optional(), rooms:z.number().int().min(1).max(6).optional(), nights:z.number().int().min(1).max(30).optional(),
  maxPrice:z.number().positive().max(10000000).optional(), time:z.enum(['morning','afternoon','evening','night']).optional(),
  direct:z.boolean().optional(), airline:text.optional(), cabin:z.enum(['economy','premium_economy','business','first']).optional(), afterHour:z.number().int().min(0).max(23).optional(),
  area:text.optional(), amenities:z.array(text).max(10).optional(), rating:z.number().min(0).max(5).optional(), vehicle:text.optional()
});
export const extractionSchema = z.object({
  intent:z.enum(['flight_search','hotel_search','cab_search','accept_recommendation','reject_recommendation','modify_search','provide_missing_information','booking_request','cancel','greeting','help','unknown']),
  travelType:z.enum(['flight','hotel','cab']).optional(), criteria:criteriaSchema.default({}),
  details:z.object({fullName:text.optional(),email:z.string().email().max(254).optional(),phone:z.string().regex(/^\+?[0-9 ()-]{7,20}$/).optional()}).default({}),
  refinement:z.enum(['cheaper','later','another']).optional()
});
export type Criteria = z.infer<typeof criteriaSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type TravelType = 'flight'|'hotel'|'cab';
export const optionSchema = z.object({
  id:text, provider:text, type:z.enum(['flight','hotel','cab']), name:text, price:z.number().finite().nonnegative(), currency:z.string().regex(/^[A-Z]{3}$/), mock:z.boolean(),
  origin:text.optional(), destination:text.optional(), departureTime:text.optional(), arrivalTime:text.optional(), duration:text.optional(), stops:z.number().int().nonnegative().optional(),
  location:text.optional(), rating:z.number().min(0).max(5).optional(), amenities:z.array(text).optional(), checkIn:text.optional(), checkOut:text.optional(),
  pickup:text.optional(), estimatedArrival:text.optional(), vehicle:text.optional()
});
export type Option = z.infer<typeof optionSchema>;
export interface Session {
  userId:string; travelType?:TravelType; intent?:Extraction['intent'];
  status:'idle'|'collecting_search_details'|'searching'|'awaiting_confirmation'|'collecting_booking_details'|'booked'|'cancelled';
  searchCriteria:Criteria; recommendedOption?:Option; alternatives:Option[]; bookingDetails:Extraction['details'];
  pendingCancellation?:string; pendingField?:keyof Criteria|'fullName'|'email'; approved?:boolean; bookingId?:string; lastUpdatedAt:string;
}
export interface DemoBooking { bookingId:string; type:TravelType; status:'confirmed_demo'|'cancelled_demo'; userId:string; selectedOption:Option; travelerDetails:Extraction['details']; createdAt:string }
export interface Turn { session:Session; reply:string; booking?:DemoBooking }
export const newSession=(userId:string,now=new Date()):Session=>({userId,status:'idle',searchCriteria:{},alternatives:[],bookingDetails:{},lastUpdatedAt:now.toISOString()});
