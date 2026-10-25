import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const scope=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../photo.js',import.meta.url),'utf8'),scope);
test('photo framing includes the full subject for portrait, landscape, square and rotated images',()=>{
 for(const [w,h] of [[300,1600],[1600,300],[800,800],[4032,3024]])for(const rotation of [0,1,2,3]){
 const frame=scope.photoLayout(w,h,rotation);assert.equal(frame.frameWidth/frame.frameHeight,.8);const width=rotation%2?frame.drawHeight:frame.drawWidth,height=rotation%2?frame.drawWidth:frame.drawHeight;assert.ok(width<=1092+.01);assert.ok(height<=1392+.01);assert.ok(Math.abs(frame.drawWidth/frame.drawHeight-w/h)<.00001);
 }
 assert.throws(()=>scope.photoLayout(0,100));assert.throws(()=>scope.photoLayout(10,NaN));
});
test('gentle photo lift preserves black and white, neutral colours and tonal order',()=>{
 assert.equal(scope.photoTone(0),0);assert.equal(scope.photoTone(255),255);let last=0;for(let n=0;n<=255;n++){const value=scope.photoTone(n);assert.ok(value>=last);assert.ok(value>=n&&value<=n+7);last=value;}
});
test('photo encoding stays inside upload limit or fails rather than uploading an oversized file',()=>{
 const qualities=[];const canvas={toDataURL(_mime,quality){qualities.push(quality);return 'data:image/jpeg;base64,'+'a'.repeat(quality>.72?650000:600000);}};assert.ok(scope.encodePhoto(canvas).length<=640000);assert.equal(qualities.length,3);assert.throws(()=>scope.encodePhoto({toDataURL:()=> 'data:image/jpeg;base64,'+'a'.repeat(650000)}),/too detailed/);
});

test('AI cutout bounds preserve item margins and reject masks that lose or retain the entire background',()=>{
 const context=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../photo-ai.js',import.meta.url),'utf8'),context);const width=100,height=100,pixels=new Uint8ClampedArray(width*height*4);for(let y=20;y<80;y++)for(let x=30;x<70;x++)pixels[(y*width+x)*4+3]=255;const result=context.foregroundBounds(pixels,width,height);assert.deepEqual({...result},{x:27,y:17,width:46,height:66});assert.throws(()=>context.foregroundBounds(new Uint8ClampedArray(width*height*4),width,height),/separate/);const opaque=new Uint8ClampedArray(width*height*4).fill(255);assert.throws(()=>context.foregroundBounds(opaque,width,height),/separate/);
});
