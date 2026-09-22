import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { config } from './config.js';
import { api } from './controllers/api.js';
import { demo } from './controllers/demo.js';
import { stripeWebhook } from './controllers/stripe.js';
import { verifyWhatsApp, whatsappWebhook } from './controllers/whatsapp.js';

export const app=express();
app.use(helmet({contentSecurityPolicy:{directives:{'upgrade-insecure-requests':null}}}));
if(!config.DEMO_MODE)app.post('/api/webhooks/stripe',express.raw({type:'application/json'}),stripeWebhook);
app.use(express.json({limit:'1mb',verify:(req,_res,buf)=>{(req as express.Request&{rawBody?:Buffer}).rawBody=Buffer.from(buf)}}));
app.get('/api/webhooks/whatsapp',verifyWhatsApp);
app.post('/api/webhooks/whatsapp',whatsappWebhook);
app.use('/api/demo',demo);
if(!config.DEMO_MODE)app.use('/api',api);
app.get('/health',(_req,res)=>res.json({ok:true,demoMode:config.DEMO_MODE}));
app.use(express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public')));
app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not available in this mode.'}));
app.use((e:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if(e instanceof ZodError){res.status(400).json({error:'Please check your request fields.'});return}
  const status=(e as {status?:number})?.status;
  if(status===400||status===413){res.status(status).json({error:status===413?'Message too large.':'Invalid JSON request.'});return}
  console.error('Request failed', e instanceof Error?e.name:'Unknown error');
  res.status(500).json({error:'Unable to complete the request. Please try again.'});
});
