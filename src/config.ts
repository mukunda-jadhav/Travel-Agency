import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  TRAVEL_TIMEZONE:z.string().default('Asia/Kolkata').refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true}catch{return false}},'Invalid timezone'),
  TRAVEL_SESSION_HOURS:z.coerce.number().positive().default(24), TRAVEL_DATA_FILE:z.string().default('data/travel.json'),
  TRAVEL_STORE:z.enum(['auto','file','supabase']).default('auto'),
  NODE_ENV: z.enum(['development','test','production']).default('development'), PORT: z.coerce.number().default(3000), DEMO_MODE:z.string().default('true').transform(v=>v==='true'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'), APP_NAME: z.string().default('VoyageZero'), DEFAULT_CURRENCY: z.string().length(3).default('USD'),
  GOOGLE_API_KEY: z.string().default('demo-key'), GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  WHATSAPP_VERIFY_TOKEN: z.string().default('demo-verify-token'), WHATSAPP_ACCESS_TOKEN: z.string().default('demo-token'), WHATSAPP_PHONE_NUMBER_ID: z.string().default('demo-phone'), WHATSAPP_APP_SECRET: z.string().default('demo-secret'), WHATSAPP_GRAPH_VERSION: z.string().default('v23.0'),
  DUFFEL_ACCESS_TOKEN: z.string().default('duffel_test_demo'), ORS_API_KEY: z.string().default('demo-key'),
  CAB_BASE_FARE_MINOR: z.coerce.number().nonnegative().default(300), CAB_PER_KM_MINOR: z.coerce.number().nonnegative().default(125), CAB_PER_MINUTE_MINOR: z.coerce.number().nonnegative().default(25),
  STRIPE_SECRET_KEY: z.string().default('sk_test_demo'), STRIPE_WEBHOOK_SECRET: z.string().default('whsec_demo'), STRIPE_SUCCESS_URL: z.string().url().default('http://localhost:3000'), STRIPE_CANCEL_URL: z.string().url().default('http://localhost:3000'),
  SUPABASE_URL: z.string().url().default('https://demo.supabase.co').transform(value=>value.replace(/\/rest\/v1\/?$/,'')), SUPABASE_SERVICE_ROLE_KEY: z.string().default('demo-key'), SUPABASE_VOUCHERS_BUCKET: z.string().default('vouchers')
});
export type Config = z.infer<typeof schema>;
export const config = schema.parse(Object.fromEntries(Object.entries(process.env).filter(([,value])=>value!=='')));
