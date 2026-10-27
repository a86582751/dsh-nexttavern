/** Narrow pixel oracle for the pinned 480x800 KVM Models checkbox after SHOW.
 * Actual checked/empty samples: run 40588408787, artifact SHA256 f14583a77fcbd92fea0ebda534c66b79bcd6331c35a0cf053663b8cab57812e3.
 * This is not OCR or a general screen locator. Changed layout/theme => unknown.
 */
import {createRequire} from 'node:module';
export function classifyModelCheckbox(rgb:Uint8Array,width:number,height:number,channels:number) {
  if(width!==480||height!==800||channels!==3||rgb.length!==width*height*channels)
    return {state:'unknown',blue:0,white:0,dark:0};
  let blue=0,white=0,dark=0;
  for(let y=578;y<604;y++)for(let x=30;x<56;x++) {
    const at=(y*width+x)*3,r=rgb[at],g=rgb[at+1],b=rgb[at+2];
    if(b>150&&b>r+60&&b>g+20)blue++;
    if(Math.min(r,g,b)>235)white++;
    if(Math.max(r,g,b)<150)dark++;
  }
  const state=blue>=400&&white>=100&&white<=260&&dark<=10?'checked'
    :blue<=10&&white>=450&&dark>=50&&dark<=140?'unchecked':'unknown';
  return {state,blue,white,dark};
}
export async function observeModelCheckbox(png:Buffer) {
  // Already locked and installed by the public build; no new dependency.
  const sharp=createRequire(new URL('../../build-tools/package.json',import.meta.url))('sharp');
  const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
  return classifyModelCheckbox(data,info.width,info.height,info.channels);
}
