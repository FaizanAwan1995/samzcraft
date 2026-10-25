'use strict';
function foregroundBounds(data,width,height){
 let left=width,top=height,right=-1,bottom=-1,count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>24){count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(count<width*height*.001||count>width*height*.995)throw new Error('The AI could not clearly separate this item. Keep the original background or try a plainer surface.');
 const padding=Math.ceil(Math.max(width,height)*.025);left=Math.max(0,left-padding);top=Math.max(0,top-padding);right=Math.min(width-1,right+padding);bottom=Math.min(height-1,bottom+padding);return {x:left,y:top,width:right-left+1,height:bottom-top+1};
}
const SamzPhotoAI=(()=>{
 let worker=null,active=null;
 function cancel(){if(worker)worker.terminate();worker=null;if(active){clearTimeout(active.timer);const reject=active.reject;active=null;reject(new DOMException('AI editing skipped.','AbortError'));}}
 function removeBackground(image,onProgress=()=>{}){
  if(active)return Promise.reject(new Error('Another photo is still being prepared.'));
  if(!window.Worker)return Promise.reject(new Error('This browser cannot run the free AI editor. You can keep the original background.'));
  const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);const original=ctx.getImageData(0,0,canvas.width,canvas.height);
  return new Promise((resolve,reject)=>{
   const pending={reject,timer:null};
   const fail=error=>{if(active!==pending)return;clearTimeout(active.timer);active=null;if(worker)worker.terminate();worker=null;reject(error);};
   active=pending;pending.timer=setTimeout(()=>fail(new Error('AI editing took too long. Try again or keep the original background.')),480000);
   try{
    worker ||=new Worker('/photo-ai-worker.js',{type:'module'});
    worker.onerror=event=>{console.warn('Samz photo worker:',event.message);fail(new Error('The free AI model could not load. Check your connection or keep the original background.'));};
    worker.onmessage=async({data})=>{
     if(active!==pending)return;if(data.type==='progress'){onProgress(data.message);return;}if(data.type==='error'){console.warn('Samz photo AI:',data.detail);fail(new Error(data.message));return;}if(data.type!=='result')return;
     try{
      if(!Number.isInteger(data.width)||!Number.isInteger(data.height)||data.width<1||data.height<1||data.width>4096||data.height>4096||![1,3,4].includes(data.channels))throw new Error('The AI returned an unreadable mask.');
      const bytes=new Uint8Array(data.mask);if(bytes.length!==data.width*data.height*data.channels)throw new Error('Incomplete AI mask.');
      const maskCanvas=document.createElement('canvas');maskCanvas.width=data.width;maskCanvas.height=data.height;const maskCtx=maskCanvas.getContext('2d');const mask=maskCtx.createImageData(data.width,data.height);
      for(let i=0;i<data.width*data.height;i++){const alpha=bytes[i*data.channels];mask.data[i*4]=alpha;mask.data[i*4+1]=alpha;mask.data[i*4+2]=alpha;mask.data[i*4+3]=255;}maskCtx.putImageData(mask,0,0);
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(maskCanvas,0,0,canvas.width,canvas.height);const scaled=ctx.getImageData(0,0,canvas.width,canvas.height);
      for(let i=0;i<original.data.length;i+=4)original.data[i+3]=Math.round(original.data[i+3]*scaled.data[i]/255);
      ctx.putImageData(original,0,0);const bounds=foregroundBounds(original.data,canvas.width,canvas.height);const cutout=document.createElement('canvas');cutout.width=bounds.width;cutout.height=bounds.height;cutout.getContext('2d').drawImage(canvas,bounds.x,bounds.y,bounds.width,bounds.height,0,0,bounds.width,bounds.height);
      const result=new Image();result.src=cutout.toDataURL('image/png');await result.decode();if(active!==pending)return;clearTimeout(active.timer);active=null;resolve(result);
     }catch(error){fail(error);}
    };
    const pixels=new Uint8ClampedArray(original.data);worker.postMessage({type:'remove',pixels:pixels.buffer,width:canvas.width,height:canvas.height},[pixels.buffer]);
   }catch(error){fail(error);}
  });
 }
 return {removeBackground,cancel};
})();
