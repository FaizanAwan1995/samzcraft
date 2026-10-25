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

test('fabric cleanup removes cloth inside colourful loops while preserving small pale beads and pale products',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../photo-ai.js',import.meta.url),'utf8'),c);const w=100,h=100,data=new Uint8ClampedArray(w*h*4);const pixel=(x,y,r,g,b,a)=>data.set([r,g,b,a],(y*w+x)*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)pixel(x,y,210,205,200,0);for(let y=20;y<80;y++)for(let x=20;x<80;x++)pixel(x,y,10,85,100,255);for(let y=30;y<70;y++)for(let x=30;x<70;x++)pixel(x,y,190,185,180,255);for(let y=22;y<25;y++)for(let x=22;x<25;x++)pixel(x,y,230,228,225,255);assert.ok(c.fabricCleanup(data,w,h)>=900);assert.equal(data[(50*w+50)*4+3],0);assert.equal(data[(23*w+23)*4+3],255);assert.equal(data[(25*w+25)*4+3],255);
 const pale=new Uint8ClampedArray(w*h*4);for(let k=0;k<w*h;k++)pale.set([200,198,195,k%w>20&&k%w<80&&k/w>20&&k/w<80?255:0],k*4);const before=new Uint8ClampedArray(pale);assert.equal(c.fabricCleanup(pale,w,h),0);assert.deepEqual(pale,before);
});
test('tap cleanup removes only connected matching patches and refuses a selection that erases most of the item',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../photo-ai.js',import.meta.url),'utf8'),c);const w=40,h=40,data=new Uint8ClampedArray(w*h*4);for(let k=0;k<w*h;k++)data.set([10,80,100,255],k*4);for(let y=10;y<20;y++)for(let x=10;x<20;x++)data.set([210,205,200,255],(y*w+x)*4);assert.equal(c.eraseBackgroundPatch(data,w,h,15,15),100);assert.equal(data[(15*w+15)*4+3],0);assert.equal(data[(5*w+5)*4+3],255);assert.throws(()=>c.eraseBackgroundPatch(data,w,h,5,5),/too large/);assert.equal(data[(5*w+5)*4+3],255);assert.equal(c.eraseBackgroundPatch(data,w,h,-1,0),0);
});
test('touch-up coordinates follow the full photo through all four rotations',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../photo.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../photo-ai.js',import.meta.url),'utf8'),c);for(const rotation of [0,1,2,3]){const w=800,h=1000,layout=c.photoLayout(w,h,rotation),angle=rotation*Math.PI/2,x=200,y=350,dx=(x/w-.5)*layout.drawWidth,dy=(y/h-.5)*layout.drawHeight,px=(600+Math.cos(angle)*dx-Math.sin(angle)*dy)/1200,py=(750+Math.sin(angle)*dx+Math.cos(angle)*dy)/1500,point=c.previewPhotoPoint(px,py,w,h,rotation);assert.ok(Math.abs(point.x-x)<.001);assert.ok(Math.abs(point.y-y)<.001);}
});
