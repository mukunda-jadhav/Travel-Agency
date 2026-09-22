import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

let server:Server,base:string,directory:string;
const nativeFetch=globalThis.fetch;
const deliveries:Array<{to:string;text:{body:string}}>=[];
beforeAll(async()=>{
  directory=await mkdtemp(path.join(tmpdir(),'travel-api-'));
  vi.stubEnv('DEMO_MODE','true');vi.stubEnv('TRAVEL_DATA_FILE',path.join(directory,'state.json'));
  vi.stubEnv('WHATSAPP_APP_SECRET','test-secret');vi.stubEnv('WHATSAPP_VERIFY_TOKEN','test-verify');
  vi.stubGlobal('fetch',vi.fn(async(input:Parameters<typeof fetch>[0],init?:RequestInit)=>{
    if(String(input).startsWith('https://graph.facebook.com/')){deliveries.push(JSON.parse(String(init?.body)));return new Response('{}',{status:200})}
    if(!String(input).startsWith('http://127.0.0.1:'))throw new Error('Unexpected external network request');
    return nativeFetch(input,init);
  }));
  const {app}=await import('../src/app.js');
  server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
});
afterAll(async()=>{await new Promise<void>((resolve,reject)=>server?server.close(e=>e?reject(e):resolve()):resolve());vi.unstubAllGlobals();vi.unstubAllEnvs();await rm(directory,{recursive:true,force:true})});
async function chat(userId:string,message:string,messageId=randomUUID()){
 const r=await fetch(base+'/api/demo/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,message,messageId})});expect(r.status).toBe(200);return (await r.json()).reply as string;
}
describe('demo HTTP workflow',()=>{
 it('serves the real preview and rejects old fake payment endpoints and malformed input',async()=>{
  expect((await (await fetch(base+'/')).text())).toContain('id="composer"');
  expect((await fetch(base+'/api/demo/confirm',{method:'POST'})).status).toBe(404);
  expect((await fetch(base+'/api/bookings',{method:'POST'})).status).toBe(404);
  expect((await fetch(base+'/api/demo/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status).toBe(400);
 });
 it('books, deduplicates, scopes ownership, returns vouchers and confirms persistent cancellation',async()=>{
  const user='demo-test-owner';
  expect(await chat(user,'cab from Pune airport to Hinjewadi')).toContain('mock');
  await chat(user,'book it');const event=randomUUID();const reply=await chat(user,'Arjun Mehta',event);
  const id=reply.match(/DEMO-CAB-[A-F0-9]+/)![0];
  expect(await chat(user,'Arjun Mehta',event)).toBe(reply);
  expect(await chat('demo-other-user','/status '+id)).toContain('not found');
  expect(await chat(user,'/voucher '+id)).toContain('NOT VALID FOR TRAVEL');
  expect(await chat(user,'/cancel '+id)).toContain('Reply “yes”');
  expect(await chat(user,'no')).toContain('kept');
  expect(await chat(user,'/status '+id)).toContain('Confirmed (demo)');
  await chat(user,'/cancel '+id);expect(await chat(user,'yes')).toContain('cancelled');
  expect(await chat(user,'/status '+id)).toContain('Cancelled (demo)');
  const {FileTravelStore}=await import('../src/services/travel/store.js');
  const records=await new FileTravelStore(path.join(directory,'state.json')).bookings(user);
  expect(records).toHaveLength(1);expect(records[0].status).toBe('cancelled_demo');
  await chat(user,'/reset');expect(await chat(user,'/bookings')).toContain(id);
 });
 it('supports hotel rooms and a full-stay total',async()=>{
  const user='demo-hotel-user';
  const reply=await chat(user,'hotel in Goa tomorrow for 2 nights for 2 rooms');
  expect(reply).toContain('per night');await chat(user,'book it');await chat(user,'Arjun Mehta');await chat(user,'arjun@example.com');
  const summary=await chat(user,'/bookings');expect(summary).toContain('for 2 nights');expect(summary).toContain('11,200.00');
 });
 it('verifies signed WhatsApp webhooks and replies through the shared assistant',async()=>{
  expect(await (await fetch(base+'/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=hello')).text()).toBe('hello');
  const id=randomUUID();const body=JSON.stringify({entry:[{changes:[{value:{messages:[{id,from:'919999999999',text:{body:'cab from Pune airport to Hinjewadi'}}]}}]}]});
  const signature='sha256='+createHmac('sha256','test-secret').update(body).digest('hex');
  const post=(sig:string)=>fetch(base+'/api/webhooks/whatsapp',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':sig},body});
  expect((await post('bad')).status).toBe(401);
  expect((await post(signature)).status).toBe(200);
  await vi.waitFor(()=>expect(deliveries).toHaveLength(1));expect(deliveries[0].text.body).toContain('mock');
  expect((await post(signature)).status).toBe(200);
  await vi.waitFor(()=>expect(deliveries).toHaveLength(2));expect(deliveries[1].text.body).toBe(deliveries[0].text.body);
 });
});
