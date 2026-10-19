// Generate a transparent, antialiased Windows icon from the TacLens logo geometry.
const fs=require('node:fs'),path=require('node:path');
const sizes=[16,32,48,64],samples=4;
function covered(x,y){
 const ring=Math.abs(Math.hypot(x-11.5,y-11.5)-7.5)<=1.1;
 const t=Math.max(0,Math.min(1,((x-17)*7+(y-17)*7)/98));
 return ring||Math.hypot(x-(17+t*7),y-(17+t*7))<=1.4;
}
function bitmap(size){
 const maskStride=Math.ceil(size/32)*4,pixels=Buffer.alloc(size*size*4),mask=Buffer.alloc(maskStride*size),header=Buffer.alloc(40);
 header.writeUInt32LE(40,0);header.writeInt32LE(size,4);header.writeInt32LE(size*2,8);header.writeUInt16LE(1,12);header.writeUInt16LE(32,14);header.writeUInt32LE(pixels.length+mask.length,20);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let hits=0;for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++)if(covered((x+(sx+.5)/samples)*28/size,(y+(sy+.5)/samples)*28/size))hits++;
  const alpha=Math.round(hits/(samples*samples)*255),row=size-1-y,i=(row*size+x)*4;
  pixels[i]=0x52;pixels[i+1]=0x9a;pixels[i+2]=0xe3;pixels[i+3]=alpha;
  if(!alpha)mask[row*maskStride+(x>>3)]|=0x80>>(x%8);
 }
 return Buffer.concat([header,pixels,mask]);
}
const images=sizes.map(bitmap),directory=Buffer.alloc(6+sizes.length*16);directory.writeUInt16LE(1,2);directory.writeUInt16LE(sizes.length,4);
let offset=directory.length;images.forEach((image,i)=>{const pos=6+i*16;directory[pos]=sizes[i];directory[pos+1]=sizes[i];directory.writeUInt16LE(1,pos+4);directory.writeUInt16LE(32,pos+6);directory.writeUInt32LE(image.length,pos+8);directory.writeUInt32LE(offset,pos+12);offset+=image.length;});
fs.writeFileSync(path.join(__dirname,'../favicon.ico'),Buffer.concat([directory,...images]));
