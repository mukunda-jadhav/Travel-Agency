import { getBooking } from './db.js';
export async function statusText(id:string,phone:string){const b=await getBooking(id);if(b.user_phone!==phone)throw new Error('Booking not found');return `Booking ${b.id}\nStatus: ${b.status}\nPNR: ${b.pnr??'Not issued'}${b.voucher_url?`\nVoucher: ${b.voucher_url}`:''}`;}
