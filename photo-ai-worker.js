// U²-Net-P: free local segmentation, from the U-2-Net/rembg repositories.
// Mirror is pinned and SHA-256 checked against the original rembg release asset.
const MODEL_URL='https://huggingface.co/skillsafe-ai/u2netp/resolve/33f0c8b5c2429bcf0cfd62bbf48669eeec80c2a2/u2netp.onnx';
const MODEL_SHA='309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8';
let ready=null;
const progress=message=>self.postMessage({type:'progress',message});
async function modelBytes(){
 let cache;try{cache=await caches.open('samz-photo-model-v1');const hit=await cache.match(MODEL_URL);if(hit){const bytes=await hit.arrayBuffer();if(await verified(bytes))return bytes;}}catch{}
 progress('Downloading the free photo model (about 5 MB)…');const response=await fetch(MODEL_URL);if(!response.ok)throw new Error('Model download unavailable.');const bytes=await response.arrayBuffer();if(!await verified(bytes))throw new Error('Model integrity check failed.');try{if(cache)await cache.put(MODEL_URL,new Response(bytes.slice(0),{headers:{'Content-Type':'application/octet-stream'}}));}catch{}return bytes;
}
async function verified(bytes){const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')===MODEL_SHA;}
async function load(){
 progress('Loading the free AI runtime…');const ort=await import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.wasm.min.mjs');ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';const session=await ort.InferenceSession.create(await modelBytes(),{executionProviders:['wasm'],graphOptimizationLevel:'all'});return {ort,session};
}
self.onmessage=async({data})=>{
 if(data.type!=='remove')return;
 try{
  ready ||=load();const {ort,session}=await ready;progress('Separating your crochet from the background…');
  const source=new OffscreenCanvas(data.width,data.height);source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);
  const size=320,target=new OffscreenCanvas(size,size),ctx=target.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,size,size);const pixels=ctx.getImageData(0,0,size,size).data,count=size*size,input=new Float32Array(3*count),mean=[.485,.456,.406],std=[.229,.224,.225];let max=1;for(let i=0;i<pixels.length;i+=4)max=Math.max(max,pixels[i],pixels[i+1],pixels[i+2]);
  for(let i=0;i<count;i++)for(let channel=0;channel<3;channel++)input[channel*count+i]=(pixels[i*4+channel]/max-mean[channel])/std[channel];
  const outputs=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',input,[1,3,size,size])}),values=outputs[session.outputNames[0]].data;let lo=Infinity,hi=-Infinity;for(let i=0;i<count;i++){lo=Math.min(lo,values[i]);hi=Math.max(hi,values[i]);}if(!Number.isFinite(hi-lo)||hi-lo<1e-6)throw new Error('No clear foreground found.');const mask=new Uint8Array(count);for(let i=0;i<count;i++)mask[i]=Math.round(255*Math.min(1,Math.max(0,(values[i]-lo)/(hi-lo))));
  self.postMessage({type:'result',mask:mask.buffer,width:size,height:size,channels:1},[mask.buffer]);
 }catch(error){ready=null;self.postMessage({type:'error',detail:String(error.message||error),message:'Free AI could not run on this device or connection. You can retry, or keep the original background.'});}
};
