// Excel serials and Date cells express a wall-clock date, not an instant in UTC.
// This importer reports Colombia business dates. Explicit ISO timestamps retain their offset.
export function parseHistoricalDate(value,parseExcelSerial) {
 const calendar=(y,m,d,h=0,min=0,s=0)=>{
  const utc=new Date(Date.UTC(y,m-1,d,h,min,s));
  if(utc.getUTCFullYear()!==y||utc.getUTCMonth()!==m-1||utc.getUTCDate()!==d)return null;
  return new Date(utc.getTime()+5*3600000);
 };
 if(value instanceof Date)return Number.isFinite(value.getTime())?calendar(value.getUTCFullYear(),value.getUTCMonth()+1,value.getUTCDate(),value.getUTCHours(),value.getUTCMinutes(),value.getUTCSeconds()):null;
 if(typeof value==='number'&&Number.isFinite(value)){
  const parsed=parseExcelSerial?.(value);
  return parsed?calendar(parsed.y,parsed.m,parsed.d,parsed.H||0,parsed.M||0,Math.floor(parsed.S||0)):null;
 }
 const raw=String(value??'').trim();if(!raw)return null;
 const iso=raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
 if(iso)return calendar(Number(iso[1]),Number(iso[2]),Number(iso[3]));
 const dmy=raw.match(/^(\d{1,2})[/.\\-](\d{1,2})[/.\\-](\d{2}|\d{4})$/);
 if(dmy)return calendar(Number(dmy[3].length===2?'20'+dmy[3]:dmy[3]),Number(dmy[2]),Number(dmy[1]));
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}([.]\d+)?)?(Z|[+-]\d{2}:\d{2})$/i.test(raw))return null;
 const [year,month,day]=raw.slice(0,10).split('-').map(Number);
 if(!calendar(year,month,day))return null;
 const date=new Date(raw);return Number.isFinite(date.getTime())?date:null;
}
export function explicitBusinessWithdrawal(row,columns){
 const index=columns.findIndex(c=>/retiro.*negocio|sale.*negocio/i.test(String(c).normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
 if(index<0)return null;
 const value=String(row[index]??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(['si','yes','true','1'].includes(value))return true;
 if(['no','false','0'].includes(value))return false;
 return null;
}
