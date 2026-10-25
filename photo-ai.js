'use strict';
function foregroundBounds(data,width,height){
 let left=width,top=height,right=-1,bottom=-1,count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>24){count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(count<width*height*.001||count>width*height*.995)throw new Error('The AI could not clearly separate this item. Keep the original background or try a plainer surface.');
 const padding=Math.ceil(Math.max(width,height)*.025);left=Math.max(0,left-padding);top=Math.max(0,top-padding);right=Math.min(width-1,right+padding);bottom=Math.min(height-1,bottom+padding);return {x:left,y:top,width:right-left+1,height:bottom-top+1};
}
// Refine large neutral fabric remnants for colourful products; keep small pearls and pale products.
function fabricCleanup(data,width,height){
 const n=width*height;let background=0,neutral=0,foreground=0,colourful=0,red=0,green=0;
 const colour=i=>{const sum=data[i]+data[i+1]+data[i+2]||1;return [data[i]/sum,data[i+1]/sum,(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]))/sum];};
 for(let i=0;i<data.length;i+=4){if(data[i+3]<16){background++;const c=colour(i);if(c[2]<.12&&(data[i]+data[i+1]+data[i+2])/3>55){neutral++;red+=c[0];green+=c[1];}}else if(data[i+3]>150){foreground++;if(colour(i)[2]>.15)colourful++;}}
 if(neutral<50||neutral/Math.max(1,background)<.8||colourful/Math.max(1,foreground)<.25)return 0;
 red/=neutral;green/=neutral;
 // Protect pale beads and thread beside coloured stitches, even when they touch the cloth.
 const distance=new Float32Array(n);distance.fill(width+height);
 for(let k=0;k<n;k++)if(data[k*4+3]>16&&colour(k*4)[2]>.15)distance[k]=0;
 for(let k=0;k<n;k++){const x=k%width;if(x>0)distance[k]=Math.min(distance[k],distance[k-1]+1);if(k>=width)distance[k]=Math.min(distance[k],distance[k-width]+1);}
 for(let k=n-1;k>=0;k--){const x=k%width;if(x<width-1)distance[k]=Math.min(distance[k],distance[k+1]+1);if(k+width<n)distance[k]=Math.min(distance[k],distance[k+width]+1);}
 const protect=Math.max(3,Math.max(width,height)*.009),candidates=new Uint8Array(n),visited=new Uint8Array(n),queue=new Int32Array(n);let removed=0;
 for(let k=0;k<n;k++){const i=k*4,c=colour(i);if(data[i+3]>8&&c[2]<.12&&Math.hypot(c[0]-red,c[1]-green)<.045&&(data[i]+data[i+1]+data[i+2])/3>55)candidates[k]=1;}
 const minimum=Math.max(64,Math.round(n*.0005));
 for(let seed=0;seed<n;seed++){if(!candidates[seed]||visited[seed])continue;let head=0,tail=1;queue[0]=seed;visited[seed]=1;while(head<tail){const k=queue[head++],x=k%width;for(const next of [x>0?k-1:-1,x<width-1?k+1:-1,k-width,k+width])if(next>=0&&next<n&&candidates[next]&&!visited[next]){visited[next]=1;queue[tail++]=next;}}if(tail>=minimum)for(let j=0;j<tail;j++){const k=queue[j],strength=Math.max(0,Math.min(1,(distance[k]-protect)/(protect*.5)));if(strength>0){data[k*4+3]=Math.round(data[k*4+3]*(1-strength));removed++;}}}
 return removed;
}
function eraseBackgroundPatch(data,width,height,x,y){
 const seed=Math.floor(y)*width+Math.floor(x),n=width*height;if(x<0||y<0||x>=width||y>=height||data[seed*4+3]<16)return 0;
 const i=seed*4,sum=data[i]+data[i+1]+data[i+2]||1,r=data[i]/sum,g=data[i+1]/sum,light=sum/3,visited=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=1;queue[0]=seed;visited[seed]=1;
 while(head<tail){const k=queue[head++],col=k%width;for(const next of [col>0?k-1:-1,col<width-1?k+1:-1,k-width,k+width]){if(next<0||next>=n||visited[next])continue;visited[next]=1;const p=next*4,total=data[p]+data[p+1]+data[p+2]||1;if(data[p+3]>8&&Math.hypot(data[p]/total-r,data[p+1]/total-g)<.055&&Math.abs(total/3-light)<100)queue[tail++]=next;}}
 let opaque=0;for(let k=0;k<n;k++)if(data[k*4+3]>16)opaque++;if(tail>opaque*.65)throw new Error('That area is too large to remove safely. Tap a smaller leftover patch, or keep the original background.');
 for(let j=0;j<tail;j++)data[queue[j]*4+3]=0;return tail;
}
async function touchUpCutout(image,x,y){const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);const count=eraseBackgroundPatch(pixels.data,canvas.width,canvas.height,x,y);if(!count)return null;ctx.putImageData(pixels,0,0);const result=new Image();result.src=canvas.toDataURL('image/png');await result.decode();return result;}
function previewPhotoPoint(x,y,width,height,rotation=0){const layout=photoLayout(width,height,rotation),dx=x*1200-600,dy=y*1500-750,angle=layout.turn*Math.PI/2;return {x:((Math.cos(angle)*dx+Math.sin(angle)*dy)/layout.drawWidth+.5)*width,y:((-Math.sin(angle)*dx+Math.cos(angle)*dy)/layout.drawHeight+.5)*height};}
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
      fabricCleanup(original.data,canvas.width,canvas.height);ctx.putImageData(original,0,0);const bounds=foregroundBounds(original.data,canvas.width,canvas.height);const cutout=document.createElement('canvas');cutout.width=bounds.width;cutout.height=bounds.height;cutout.getContext('2d').drawImage(canvas,bounds.x,bounds.y,bounds.width,bounds.height,0,0,bounds.width,bounds.height);
      const result=new Image();result.src=cutout.toDataURL('image/png');await result.decode();if(active!==pending)return;clearTimeout(active.timer);active=null;resolve(result);
     }catch(error){fail(error);}
    };
    const pixels=new Uint8ClampedArray(original.data);worker.postMessage({type:'remove',pixels:pixels.buffer,width:canvas.width,height:canvas.height},[pixels.buffer]);
   }catch(error){fail(error);}
  });
 }
 return {removeBackground,cancel};
})();
