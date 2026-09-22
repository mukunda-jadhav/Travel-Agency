import express from 'express'; import cors from 'cors'; import helmet from 'helmet'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { config } from './config.js'; import { api } from './controllers/api.js'; import { demo } from './controllers/demo.js'; import { stripeWebhook } from './controllers/stripe.js'; import { verifyWhatsApp,whatsappWebhook } from './controllers/whatsapp.js';
const app=express();app.use(helmet({contentSecurityPolicy:false}));app.use(cors());
app.post('/api/webhooks/stripe',express.raw({type:'application/json'}),stripeWebhook);
app.use(express.json({limit:'1mb',verify:(req,_res,buf)=>{(req as express.Request&{rawBody?:Buffer}).rawBody=Buffer.from(buf)}}));
app.get('/api/webhooks/whatsapp',verifyWhatsApp);app.post('/api/webhooks/whatsapp',whatsappWebhook);app.use('/api/demo',demo);app.use('/api',api);
app.get('/health',(_req,res)=>res.json({ok:true,demoMode:config.DEMO_MODE}));const publicDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');app.use(express.static(publicDir));
app.use((e:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(e);res.status(500).json({error:e instanceof Error?e.message:'Internal error'})});app.listen(config.PORT,()=>console.log(`${config.APP_NAME} listening on ${config.PORT}`));
