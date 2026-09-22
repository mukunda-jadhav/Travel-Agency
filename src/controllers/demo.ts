import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { z } from 'zod';
import { runTravelAssistant } from '../services/travel/index.js';

export const demo = Router();
demo.post('/chat',async(req,res)=>{if(!config.DEMO_MODE){res.sendStatus(404);return}const parsed=z.object({userId:z.string().regex(/^demo-[a-zA-Z0-9-]{3,80}$/),message:z.string().trim().min(1).max(4000),messageId:z.string().uuid()}).safeParse(req.body);if(!parsed.success){res.status(400).json({error:'A demo userId, message and UUID messageId are required.'});return}const x=parsed.data;res.json({reply:await runTravelAssistant(x.userId,x.message,x.messageId)})});
const trips=new Map<string,{status:string;pnr:string}>();
demo.get('/config',(_req,res)=>res.json({demoMode:config.DEMO_MODE}));
demo.post('/confirm',(req,res)=>{if(!config.DEMO_MODE){res.status(404).json({error:'Demo mode disabled'});return;}const id=`VZ-${randomUUID().slice(0,8).toUpperCase()}`,pnr=`ZZ${Math.random().toString(36).slice(2,7).toUpperCase()}`;trips.set(id,{status:'CONFIRMED',pnr});res.json({bookingId:id,pnr,status:'CONFIRMED',paidAmount:'₹87,420'})});
demo.get('/status/:id',(req,res)=>{const trip=trips.get(req.params.id);res.json(trip??{status:'CONFIRMED',pnr:'ZZDEMO'});});
demo.post('/cancel/:id',(req,res)=>{const trip=trips.get(req.params.id);if(trip)trip.status='CANCELLED';res.json({status:'CANCELLED',refund:'₹87,420',message:'Test refund created'});});
