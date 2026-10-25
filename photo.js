'use strict';
// Shared by studio upload preview and regression tests. No external AI service.
function photoLayout(width,height,rotation=0){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('This photo has no readable dimensions.');
 const turn=((rotation%4)+4)%4,sw=turn%2?height:width,sh=turn%2?width:height;
 const frameWidth=1200,frameHeight=1500,padding=54,scale=Math.min((frameWidth-padding*2)/sw,(frameHeight-padding*2)/sh);
 return {frameWidth,frameHeight,turn,drawWidth:width*scale,drawHeight:height*scale};
}
function photoTone(value){return Math.min(255,Math.max(0,Math.round(value+7*Math.sin(Math.PI*value/255))));}
function encodePhoto(canvas){
 for(const quality of [.88,.8,.72,.64,.54]){const value=canvas.toDataURL('image/jpeg',quality);if(value.startsWith('data:image/jpeg;base64,')&&value.length<=640000)return value;}
 throw new Error('This photo is too detailed. Try a smaller photo or crop the background in your Photos app.');
}
function originalPhoto(image){
 const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const context=canvas.getContext('2d');if(!context)throw new Error('Photo editing is unavailable in this browser.');context.fillStyle='#fffdf8';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return encodePhoto(canvas);
}
function preparePhoto(image,{rotation=0,enhance=true}={}){
 const layout=photoLayout(image.naturalWidth,image.naturalHeight,rotation),canvas=document.createElement('canvas');canvas.width=layout.frameWidth;canvas.height=layout.frameHeight;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Photo editing is unavailable in this browser.');
 context.fillStyle='#fcf7ef';context.fillRect(0,0,canvas.width,canvas.height);context.save();context.translate(canvas.width/2,canvas.height/2);context.rotate(layout.turn*Math.PI/2);context.drawImage(image,-layout.drawWidth/2,-layout.drawHeight/2,layout.drawWidth,layout.drawHeight);context.restore();
 // Gentle tonal lift on the photograph only; keep hue, stitches and the matte unchanged.
 if(enhance){const width=Math.round(layout.turn%2?layout.drawHeight:layout.drawWidth),height=Math.round(layout.turn%2?layout.drawWidth:layout.drawHeight),x=Math.max(0,Math.round((canvas.width-width)/2)),y=Math.max(0,Math.round((canvas.height-height)/2));const pixels=context.getImageData(x,y,width,height);for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]=photoTone(pixels.data[i]);pixels.data[i+1]=photoTone(pixels.data[i+1]);pixels.data[i+2]=photoTone(pixels.data[i+2]);}context.putImageData(pixels,x,y);}
 return encodePhoto(canvas);
}
