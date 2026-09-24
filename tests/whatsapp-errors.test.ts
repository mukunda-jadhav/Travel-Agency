import {afterEach,expect,it,vi} from 'vitest';
import {sendText,safeErrorDetails} from '../src/services/whatsapp.js';
afterEach(()=>vi.unstubAllGlobals());
it('reports Meta error codes without leaking response contents',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:190,error_subcode:463,message:'secret-token recipient-number'}}),{status:401})));
  try {await sendText('123456789','private message');throw new Error('Expected rejection');}
  catch(error){expect(safeErrorDetails(error)).toEqual({kind:'WhatsAppSendError',status:401,code:190,subcode:463});expect(JSON.stringify(safeErrorDetails(error))).not.toContain('secret-token');}
});
it('handles non-JSON errors and retains network error classification',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private proxy error',{status:502})));
  await expect(sendText('123456789','hi')).rejects.toThrow('HTTP 502');
  expect(safeErrorDetails(new TypeError('private',{cause:{code:'ECONNRESET'}}))).toEqual({kind:'TypeError',code:undefined,networkCode:'ECONNRESET'});
});
