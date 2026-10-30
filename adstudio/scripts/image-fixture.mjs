// Real decodable RGB PNG with detailed pixels; large enough to exercise full image validation.
import {deflateSync} from 'node:zlib';
const crc32=b=>{let c=0xffffffff;for(const x of b){c^=x;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const t=Buffer.from(type),head=Buffer.alloc(4),crc=Buffer.alloc(4);head.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([head,t,data,crc]);};
export function detailedPng(size=1024){const raw=Buffer.alloc((size*3+1)*size);let n=123456789;for(let y=0;y<size;y++)for(let x=1;x<=size*3;x++){n^=n<<13;n^=n>>>17;n^=n<<5;raw[y*(size*3+1)+x]=n&255;}const h=Buffer.alloc(13);h.writeUInt32BE(size,0);h.writeUInt32BE(size,4);h[8]=8;h[9]=2;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
