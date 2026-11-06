import info from './model-info.json';
import {CharSpellModel} from './core';
export async function decodeCharSpell(data:string):Promise<CharSpellModel>{
  if(data.length!==Math.ceil(info.bytes/3)*4)throw Error('CharSpell fayl ölçüsü uyğun deyil.');
  const raw=atob(data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(bytes.length!==info.bytes||hash!==info.sha256)throw Error('CharSpell bütövlük yoxlaması keçmədi.');
  const view=new DataView(bytes.buffer),values=new Float32Array(info.parameters);
  for(let i=0;i<values.length;i++)values[i]=view.getFloat32(i*4,true);
  return new CharSpellModel(values);
}
let pending:Promise<CharSpellModel>|undefined;
export function loadCharSpell():Promise<CharSpellModel>{
  pending??=import('./weights.json').then(data=>decodeCharSpell(data.default.data)).catch((error:unknown)=>{pending=undefined;throw error});
  return pending;
}
