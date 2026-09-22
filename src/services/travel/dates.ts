export function todayInZone(now:Date,timezone:string){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function addDays(date:string,days:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function resolveDate(value:string,today:string):string|undefined {
  const s=value.toLowerCase().trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const d=new Date(`${s}T12:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:undefined}
  if(s.includes('day after tomorrow'))return addDays(today,2);
  if(s.includes('tomorrow'))return addDays(today,1);
  if(/\b(today|tonight)\b/.test(s))return today;
  const day=new Date(`${today}T12:00:00Z`).getUTCDay();
  if(/weekend/.test(s)){let delta=(6-day+7)%7;if(s.includes('next'))delta=delta===0?7:delta+7;return addDays(today,delta)}
  const names=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const target=names.findIndex(n=>s.includes(n));
  if(target>=0){let delta=(target-day+7)%7;if(s.includes('next'))delta=delta===0?7:delta;return addDays(today,delta)}
  return undefined;
}
export const datePhrase=/\d{4}-\d{2}-\d{2}|day after tomorrow|tomorrow(?: morning| evening| night)?|today|tonight|(?:this |next )?weekend|(?:this |next )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/ig;
