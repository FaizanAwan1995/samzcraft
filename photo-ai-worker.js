// Pinned, open-source browser inference. No API key or remote inference call.
import { AutoModel, AutoProcessor, RawImage, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const MODEL='onnx-community/BiRefNet_lite-ONNX';
const REVISION='de15b22ba131738a16dff04aab8bdf8dc32e3ac1';
env.allowLocalModels=false;
env.useBrowserCache=true;
env.backends.onnx.wasm.numThreads=1;
env.backends.onnx.wasm.proxy=false;
let ready=null;
async function load(){
 const progress_callback=p=>{if(p.status==='progress'&&p.file?.endsWith('.onnx'))self.postMessage({type:'progress',message:'Downloading free AI model: '+Math.round(p.progress||0)+'%'});};
 let gpu=false;try{const adapter=navigator.gpu?await navigator.gpu.requestAdapter():null;gpu=!!adapter?.features.has('shader-f16');}catch{}
 const options={revision:REVISION,device:gpu?'webgpu':'wasm',dtype:gpu?'fp16':'fp32',progress_callback};
 self.postMessage({type:'progress',message:'Loading free AI editor. The first download can take several minutes.'});
 const [model,processor]=await Promise.all([AutoModel.from_pretrained(MODEL,options),AutoProcessor.from_pretrained(MODEL,{revision:REVISION})]);return {model,processor};
}
self.onmessage=async({data})=>{
 if(data.type!=='remove')return;
 try{
  ready ||=load();const {model,processor}=await ready;
  self.postMessage({type:'progress',message:'Separating your crochet from the background…'});
  const image=new RawImage(new Uint8ClampedArray(data.pixels),data.width,data.height,4);
  const {pixel_values}=await processor(image);
  const {output_image}=await model({input_image:pixel_values});
  const mask=RawImage.fromTensor(output_image[0].sigmoid().mul(255).to('uint8'));
  // Return only the mask. The original product pixels are retained in the main thread.
  const bytes=new Uint8Array(mask.data);self.postMessage({type:'result',mask:bytes.buffer,width:mask.width,height:mask.height,channels:mask.channels},[bytes.buffer]);
 }catch(error){ready=null;self.postMessage({type:'error',message:'Free AI could not run on this device or connection. You can retry, or keep the original background.'});}
};
