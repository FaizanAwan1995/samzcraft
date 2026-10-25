import { INDEX, ADMIN, STYLE, APP, STUDIO, PHOTO, PHOTO_AI, PHOTO_AI_WORKER, PHOTO_TOOL, PHOTO_TOOL_APP, PHOTO_CREDITS, ASSETS } from './bundle.mjs';
import { SITE, productPath, renderSeo, sitemapXml, infoPages, collections } from './seo.mjs';
const admins=env=>String(env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
const ISSUER='https://samz-crafts-admin.cloudflareaccess.com';
const AUD='31460c46af36ea6a764abf288efc919dff8d8da37448de958e6d597cf82ac339';
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(self), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
const json=(data,status=200)=>Response.json(data,{status,headers:{...headers,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;
const un64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function body(req,max=20000){
 const reader=req.body?.getReader();if(!reader)fail('Missing request body');let n=0,chunks=[];
 while(true){let {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();fail('Request too large',413);}chunks.push(value);}
 const bytes=new Uint8Array(n);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('Invalid JSON');}
}
async function admin(req,env){
 const token=req.headers.get('Cf-Access-Jwt-Assertion');if(!token)fail('Please sign in through the admin link.',401);
 try{
  const parts=token.split('.');if(parts.length!==3)fail('Invalid sign-in',401);
  const h=JSON.parse(new TextDecoder().decode(un64(parts[0]))),p=JSON.parse(new TextDecoder().decode(un64(parts[1])));
  if(h.alg!=='RS256'||p.iss!==ISSUER||!(Array.isArray(p.aud)?p.aud:[p.aud]).includes(AUD)||(!Number.isFinite(p.exp)||p.exp<=Date.now()/1000)||p.nbf>Date.now()/1000)fail('Sign-in expired',401);
  const r=await fetch(ISSUER+'/cdn-cgi/access/certs',{cf:{cacheTtl:3600,cacheEverything:true}});if(!r.ok)fail('Sign-in unavailable',503);
  const jwks=await r.json(),jwk=jwks.keys.find(k=>k.kid===h.kid);if(!jwk)fail('Invalid sign-in',401);
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,un64(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))fail('Invalid sign-in',401);
  if(!admins(env).includes(p.email?.toLowerCase()))fail('This account cannot manage the shop.',403);return p.email.toLowerCase();
 }catch(e){if(e.status)throw e;fail('Please sign in again.',401);}
}
function withPhotos(p){let extra=[];try{extra=JSON.parse(p.gallery||'[]');}catch{}const images=[...new Set([p.image,...(Array.isArray(extra)?extra:[])].filter(x=>typeof x==='string'&&/^\/images\/[a-zA-Z0-9_.-]+$/.test(x)))].slice(0,3);return {...p,images};}
async function config(env){return Object.fromEntries((await env.DB.prepare('SELECT key,value FROM settings').all()).results.map(r=>[r.key,r.value]));}
async function limited(req,env,route,max){
 const raw=(req.headers.get('CF-Connecting-IP')||'unknown')+':'+route+':'+Math.floor(Date.now()/3600000);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));const key=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
 const row=await env.DB.prepare('INSERT INTO rate_limits(key,hits,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,Date.now()+7200000).first();
 if(row.hits>max)fail('Please try again later or message us on Messenger.',429);
}
function mailStatements(env,ref,to,subject,content){return [...new Set(to)].map(recipient=>env.DB.prepare('INSERT INTO outbox(id,ref,recipient,subject,body) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),ref,recipient,subject,content));}
async function sendPending(env){
 if(!env.EMAIL_API_KEY||!env.EMAIL_FROM)return;
 const rows=(await env.DB.prepare("SELECT * FROM outbox WHERE status IN('pending','failed') AND attempts<5 ORDER BY created_at LIMIT 15").all()).results;
 for(const r of rows){
  const claim=await env.DB.prepare("UPDATE outbox SET status='sending',attempts=attempts+1 WHERE id=? AND status IN('pending','failed') RETURNING id").bind(r.id).first();if(!claim)continue;
  try{const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.EMAIL_API_KEY,'Content-Type':'application/json','Idempotency-Key':r.id},body:JSON.stringify({from:env.EMAIL_FROM,to:[r.recipient],reply_to:admins(env)[0],subject:r.subject,text:r.body})});if(!res.ok)throw new Error('Email provider HTTP '+res.status);
   await env.DB.prepare("UPDATE outbox SET status='sent',last_error=NULL WHERE id=?").bind(r.id).run();
  }catch(e){await env.DB.prepare("UPDATE outbox SET status='failed',last_error=? WHERE id=?").bind(text(e.message,200),r.id).run();}
 }
}
async function log(env,email,action){await env.DB.prepare('INSERT INTO activity(id,email,action) VALUES(?,?,?)').bind(crypto.randomUUID(),email,action).run();}
async function handle(req,env,ctx){
 const u=new URL(req.url),p=u.pathname;
 // Consolidate public URLs without redirecting POST bodies or admin sessions.
 const publicRead=['GET','HEAD'].includes(req.method)&&!p.startsWith('/admin')&&!p.startsWith('/api/');
 if(publicRead&&['www.samzcrafts.com','samz-crafts.faizan-awan.workers.dev','samzcrafts.com'].includes(u.hostname)&&(u.origin!==SITE))return Response.redirect(SITE+p+u.search,301);
 if(publicRead&&(Object.hasOwn(infoPages,p+'/')||collections.some(c=>p==='/collections/'+c.key)))return Response.redirect(SITE+p+'/',301);

 if(!['GET','HEAD'].includes(req.method)&&req.headers.get('Origin')!==u.origin)fail('Please submit from the shop website.',403);
 if(p==='/api/catalog'&&req.method==='GET'){const settings=await config(env);return json({products:(await env.DB.prepare("SELECT * FROM products WHERE status IN('active','showcase') ORDER BY created_at DESC").all()).results.map(withPhotos),settings:{announcement:settings.announcement,story:settings.story,whatsapp:settings.whatsapp,messenger:settings.messenger,checkout_enabled:settings.checkout_enabled==='true'&&!!env.EMAIL_API_KEY&&!!env.EMAIL_FROM}});}
 if(p==='/api/order'&&req.method==='POST'){
  const b=await body(req);if(b.website)fail('Invalid request');
  const name=text(b.name,120),email=text(b.email,254).toLowerCase(),phone=text(b.phone,40),notes=text(b.notes,1500),address=text(b.address,600),fulfilment=text(b.fulfilment,20),key=text(b.key,80);
  if(!name||!validEmail(email)||!['delivery','collection'].includes(fulfilment)||!(/^[a-zA-Z0-9-]{20,80}$/.test(key)))fail('Please check your name, email and delivery preference.');
  const existing=await env.DB.prepare('SELECT id,total FROM orders WHERE request_key=?').bind(key).first();if(existing)return json({id:existing.id,total:existing.total});
  const settings=await config(env);if(settings.checkout_enabled!=='true'||!env.EMAIL_API_KEY||!env.EMAIL_FROM)fail('Online orders are not open yet. Please message us to order.',503);
  if(fulfilment==='delivery'&&!address)fail('Please enter your delivery address.');
  if(!Array.isArray(b.items)||!b.items.length||b.items.length>20)fail('Please check your basket.');
  const items=b.items.map(i=>({id:text(i?.id,100),quantity:Number(i?.quantity)}));
  if(new Set(items.map(i=>i.id)).size!==items.length||items.some(i=>!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>20))fail('Please check the item quantities.');
  await limited(req,env,'order',5);
  const products=[];for(const i of items){const product=await env.DB.prepare("SELECT * FROM products WHERE id=? AND status='active'").bind(i.id).first();if(!product||!product.price||product.stock<i.quantity)fail('An item is no longer available. Please refresh your basket.',409);products.push({...product,quantity:i.quantity});}
  const id='SAMZ-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
  const total=products.reduce((s,i)=>s+i.price*i.quantity,0);
  const message=`Thank you for supporting Samz Crafts!\n\nOrder request: ${id}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${products.map(i=>`${i.title} × ${i.quantity} — AUD ${(i.price*i.quantity/100).toFixed(2)}`).join('\n')}\n\nItems subtotal: AUD ${(total/100).toFixed(2)}\nDelivery preference: ${fulfilment}\n${address}\nNotes: ${notes}\n\nThis is an order request, not a payment receipt. We will confirm availability, delivery costs and payment details before you pay. No payment has been taken.`;
  const statements=[env.DB.prepare('INSERT INTO orders(id,request_key,name,email,phone,fulfilment,address,notes) VALUES(?,?,?,?,?,?,?,?)').bind(id,key,name,email,phone,fulfilment,address,notes),...products.map(i=>env.DB.prepare('INSERT INTO order_items(order_id,product_id,title,price,quantity) VALUES(?,?,?,?,?)').bind(id,i.id,i.title,i.price,i.quantity)),...mailStatements(env,id,[email,...admins(env)],'Samz Crafts · Order request '+id,message)];
  try{await env.DB.batch(statements);}catch{const old=await env.DB.prepare('SELECT id,total FROM orders WHERE request_key=?').bind(key).first();if(old)return json(old);fail('An item changed while checking out. Refresh your basket and try again.',409);}
  ctx.waitUntil(sendPending(env));return json({id,total},201);
 }
 if(p==='/api/quote'&&req.method==='POST'){
  const b=await body(req),name=text(b.name,120),email=text(b.email,254).toLowerCase(),key=text(b.key,80),phone=text(b.phone,40),notes=text(b.notes,1500),address=text(b.address,600),fulfilment=text(b.fulfilment,20);
  if(b.website||!name||!validEmail(email)||!(/^[a-zA-Z0-9-]{20,80}$/.test(key))||!['delivery','collection'].includes(fulfilment))fail('Please check your contact details and delivery preference.');
  if(fulfilment==='delivery'&&!address)fail('Please add your delivery address so we can quote postage.');
  const existing=await env.DB.prepare('SELECT id FROM quote_requests WHERE request_key=?').bind(key).first();if(existing)return json({id:existing.id,kind:'quote'});
  if(!Array.isArray(b.items)||!b.items.length||b.items.length>20)fail('Please check your cart.');
  const items=b.items.map(i=>({id:text(i?.id,100),quantity:Number(i?.quantity)}));
  if(new Set(items.map(i=>i.id)).size!==items.length||items.some(i=>!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>20))fail('Please check the item quantities.');
  await limited(req,env,'quote',5);
  const lines=[];for(const i of items){const product=await env.DB.prepare("SELECT * FROM products WHERE id=? AND status IN('active','showcase')").bind(i.id).first();if(!product)fail('An item is no longer listed. Remove it from your cart and try again.',409);lines.push(`${product.title} × ${i.quantity} — ${product.price?'listed unit price AUD '+(product.price/100).toFixed(2):'price to be confirmed'}`);}
  const id='SAMZ-Q-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
  const message=`Quote request ${id}\n\n${lines.join('\n')}\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nDelivery preference: ${fulfilment}\n${address}\nNotes: ${notes}\n\nThis is a quote request. Prices, availability, timing and delivery costs will be confirmed before an order is agreed. No stock is reserved and no payment has been taken.`;
  try{await env.DB.batch([env.DB.prepare('INSERT INTO quote_requests(id,request_key) VALUES(?,?)').bind(id,key),env.DB.prepare('INSERT INTO inquiries(id,name,email,message) VALUES(?,?,?,?)').bind(id,name,email,message),...mailStatements(env,id,[email,...admins(env)],'Samz Crafts · Quote request '+id,message)]);}catch(e){const old=await env.DB.prepare('SELECT id FROM quote_requests WHERE request_key=?').bind(key).first();if(old)return json({id:old.id,kind:'quote'});throw e;}
  ctx.waitUntil(sendPending(env));return json({id,kind:'quote',email_ready:!!env.EMAIL_API_KEY&&!!env.EMAIL_FROM},201);
 }
 if(p==='/api/contact'&&req.method==='POST'){
  const b=await body(req),name=text(b.name,120),email=text(b.email,254).toLowerCase(),message=text(b.message,2500);
  if(b.website||!name||!validEmail(email)||message.length<5)fail('Please add your name, email and a short message.');await limited(req,env,'contact',5);
  const id='ENQ-'+crypto.randomUUID().slice(0,8).toUpperCase();await env.DB.batch([env.DB.prepare('INSERT INTO inquiries(id,name,email,message) VALUES(?,?,?,?)').bind(id,name,email,message),...mailStatements(env,id,admins(env),'Samz Crafts · New enquiry '+id,`From ${name} (${email})\n\n${message}`)]);ctx.waitUntil(sendPending(env));return json({id,email_ready:!!env.EMAIL_API_KEY&&!!env.EMAIL_FROM},201);
 }
 if(p.startsWith('/images/')&&req.method==='GET'){
  const id=p.slice(8),staticAsset=ASSETS[id];if(staticAsset)return new Response(Uint8Array.from(atob(staticAsset),c=>c.charCodeAt(0)),{headers:{...headers,'Content-Type':id.endsWith('.png')?'image/png':'image/jpeg','Cache-Control':'public,max-age=86400'}});
  const img=await env.DB.prepare('SELECT data,mime FROM images WHERE id=?').bind(id).first();if(!img)return new Response('Not found',{status:404});return new Response((img.data instanceof ArrayBuffer?img.data:new Uint8Array(img.data)),{headers:{...headers,'Content-Type':img.mime,'Cache-Control':'public,max-age=86400'}});
 }
 if(p==='/admin'||p.startsWith('/admin/')){
  const email=await admin(req,env);
  if(req.method==='GET'&&(p==='/admin'||p==='/admin/'))return new Response(ADMIN,{headers:{...headers,'Content-Type':'text/html;charset=UTF-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
  if(p==='/admin/api/data'&&req.method==='GET')return json({email,products:(await env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC').all()).results.map(withPhotos),orders:(await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all()).results,items:(await env.DB.prepare('SELECT * FROM order_items WHERE order_id IN(SELECT id FROM orders ORDER BY created_at DESC LIMIT 200)').all()).results,inquiries:(await env.DB.prepare('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 100').all()).results,outbox:(await env.DB.prepare('SELECT id,ref,recipient,subject,status,attempts,last_error FROM outbox ORDER BY created_at DESC LIMIT 200').all()).results,activity:(await env.DB.prepare('SELECT * FROM activity ORDER BY created_at DESC LIMIT 50').all()).results,settings:await config(env),email_ready:!!env.EMAIL_API_KEY&&!!env.EMAIL_FROM});
  if(p==='/admin/api/product'&&req.method==='POST'){
   const b=await body(req),id=text(b.id,100)||crypto.randomUUID(),title=text(b.title,140),description=text(b.description,2500),category=text(b.category,60)||'Accessories',status=text(b.status,20),stock=Number(b.stock),price=b.price===null||b.price===''?null:Number(b.price),image=text(b.image,150),source=text(b.source,300);
   if(!title||!['draft','active','showcase','archived'].includes(status)||!Number.isInteger(stock)||stock<0||stock>10000||(price!==null&&(!Number.isInteger(price)||price<100||price>1000000))||(status==='active'&&!price))fail('Please check title, price, stock and listing status.');
   if(image&&!/^\/images\/[a-zA-Z0-9_.-]+$/.test(image))fail('Please upload a product photo.');if(source&&!/^https:\/\/www.instagram.com\/samz_crafts\//.test(source))fail('Use a Samz Crafts Instagram link.');
   let photos;
   if(b.images!==undefined){if(!Array.isArray(b.images)||b.images.length>3||b.images.some(x=>typeof x!=='string'||!/^\/images\/[a-zA-Z0-9_.-]+$/.test(x))||new Set(b.images).size!==b.images.length)fail('Choose up to three different product photos.');photos=b.images;}
   else {const previous=await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(id).first();photos=[...new Set([image,...(previous?withPhotos(previous).images.slice(1):[])].filter(Boolean))].slice(0,3);}
   for(const path of photos){if(!ASSETS[path.slice(8)]&&!await env.DB.prepare('SELECT id FROM images WHERE id=?').bind(path.slice(8)).first())fail('A photo is missing. Please upload it again.');}
   await env.DB.prepare('INSERT INTO products(id,title,description,category,price,stock,status,image,gallery,source) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,price=excluded.price,stock=excluded.stock,status=excluded.status,image=excluded.image,gallery=excluded.gallery,source=excluded.source').bind(id,title,description,category,price,stock,status,photos[0]||null,JSON.stringify(photos),source||null).run();await log(env,email,'Saved listing: '+title);return json({id});
  }
  if(p==='/admin/api/photo-source'&&req.method==='GET'){const image=u.searchParams.get('image')||'';if(!/^\/images\/[a-zA-Z0-9_.-]+$/.test(image))fail('Invalid photo path');const source=await env.DB.prepare('SELECT original_id FROM image_sources WHERE image_id=?').bind(image.slice(8)).first();return json({image:source?'/images/'+source.original_id:image});}
  if(p==='/admin/api/upload'&&req.method==='POST'){
   const b=await body(req,1400000);const decode=value=>{if(typeof value!=='string'||value.length>650000)fail('Please choose a smaller photo.');let data;try{data=un64(value);}catch{fail('Invalid photo');}if(data[0]!==255||data[1]!==216||data[2]!==255)fail('Please upload a JPEG photo.');return data;};const data=decode(b.data),original=b.original?decode(b.original):null,id=crypto.randomUUID()+'.jpg',originalId=original?crypto.randomUUID()+'.jpg':null;
   const writes=[env.DB.prepare('INSERT INTO images(id,data) VALUES(?,?)').bind(id,data.buffer)];if(original)writes.push(env.DB.prepare('INSERT INTO images(id,data) VALUES(?,?)').bind(originalId,original.buffer),env.DB.prepare('INSERT INTO image_sources(image_id,original_id) VALUES(?,?)').bind(id,originalId));await env.DB.batch(writes);await log(env,email,'Uploaded prepared photo');return json({image:'/images/'+id});
  }
  if(p==='/admin/api/settings'&&req.method==='POST'){
   const b=await body(req),whatsapp=text(b.whatsapp,16).replace(/[ +()-]/g,''),messenger=text(b.messenger,80),story=text(b.story,1800),announcement=text(b.announcement,150),enabled=b.checkout_enabled===true;
   if(whatsapp&&!/^[1-9][0-9]{7,14}$/.test(whatsapp))fail('Use the WhatsApp number with country code, for example 614…');if(!/^[a-zA-Z0-9.]{2,80}$/.test(messenger))fail('Use the Facebook page ID or username only.');if(enabled&&(!env.EMAIL_API_KEY||!env.EMAIL_FROM))fail('Configure the email sender before opening checkout.');
   await env.DB.batch(Object.entries({whatsapp,messenger,story,announcement,checkout_enabled:String(enabled)}).map(([k,v])=>env.DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k,v)));await log(env,email,'Updated shop settings');return json({ok:true});
  }
  if(p==='/admin/api/order'&&req.method==='POST'){
   const b=await body(req),status=text(b.status,20),id=text(b.id,100);if(!['new','confirmed','making','ready','completed','cancelled'].includes(status))fail('Invalid order status');const existing=await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();if(!existing)fail('Order not found',404);if(existing.status==='cancelled'&&status!=='cancelled')fail('Cancelled orders cannot be reopened.');await env.DB.prepare('UPDATE orders SET status=? WHERE id=?').bind(status,id).run();await log(env,email,`Order ${id}: ${status}`);return json({ok:true});
  }
  if(p==='/admin/api/retry-email'&&req.method==='POST'){if(!env.EMAIL_API_KEY||!env.EMAIL_FROM)fail('Email sender is not configured.');await sendPending(env);return json({ok:true});}
  fail('Not found',404);
 }
 if(req.method!=='GET'&&req.method!=='HEAD')fail('Method not allowed',405);
 if(p==='/photo-ai-worker.js')return new Response(req.method==='HEAD'?null:PHOTO_AI_WORKER,{headers:{...headers,'Content-Type':'text/javascript;charset=UTF-8','Cache-Control':'no-cache','X-Robots-Tag':'noindex','Content-Security-Policy':"default-src 'none'; script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'; connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.hf.co https://*.huggingface.co; worker-src 'none'"}});
 if(p==='/photo-studio/'||p==='/photo-credits/')return new Response(req.method==='HEAD'?null:p==='/photo-studio/'?PHOTO_TOOL:PHOTO_CREDITS,{headers:{...headers,'Content-Type':'text/html;charset=UTF-8','Cache-Control':'no-cache','X-Robots-Tag':'noindex'}});
 if(p==='/robots.txt')return new Response(req.method==='HEAD'?null:'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: '+SITE+'/sitemap.xml\n',{headers:{...headers,'Content-Type':'text/plain;charset=UTF-8','Cache-Control':'public,max-age=300'}});
 if(p==='/'||p==='/sitemap.xml'||p.startsWith('/products/')||p.startsWith('/collections/')||Object.hasOwn(infoPages,p)){
  const products=(await env.DB.prepare("SELECT * FROM products WHERE status IN('active','showcase') ORDER BY created_at DESC").all()).results.map(withPhotos);
  if(p==='/sitemap.xml')return new Response(req.method==='HEAD'?null:sitemapXml(products),{headers:{...headers,'Content-Type':'application/xml;charset=UTF-8','Cache-Control':'no-cache'}});
  if(p.startsWith('/products/')){const suffix=p.slice('/products/'.length).replace(/\/$/,'');const pos=suffix.lastIndexOf('--');let id='';try{id=decodeURIComponent(suffix.slice(pos+2));}catch{}const item=pos>=0?products.find(x=>x.id===id):null;if(item&&p!==productPath(item))return Response.redirect(SITE+productPath(item),301);}
  const settings=await config(env);settings.checkout_enabled=settings.checkout_enabled==='true'&&!!env.EMAIL_API_KEY&&!!env.EMAIL_FROM;
  const page=renderSeo(INDEX,p,products,settings);
  if(page)return new Response(req.method==='HEAD'?null:page,{headers:{...headers,'Content-Type':'text/html;charset=UTF-8','Cache-Control':'no-cache'}});
 }
 const asset={'/style.css':[STYLE,'text/css'],'/app.js':[APP,'text/javascript'],'/studio.js':[STUDIO,'text/javascript'],'/photo.js':[PHOTO,'text/javascript'],'/photo-ai.js':[PHOTO_AI,'text/javascript'],'/photo-tool.js':[PHOTO_TOOL_APP,'text/javascript']}[p];

 if(!asset)return new Response(req.method==='HEAD'?null:'<!doctype html><html lang="en-AU"><meta name="robots" content="noindex"><title>Page not found | Samz Crafts</title><h1>That piece of the thread is missing.</h1><p><a href="/">Browse Samz Crafts</a> or <a href="/custom-crochet-orders/">ask about a custom piece</a>.</p></html>',{status:404,headers:{...headers,'Content-Type':'text/html;charset=UTF-8','X-Robots-Tag':'noindex'}});return new Response(req.method==='HEAD'?null:asset[0],{headers:{...headers,'Content-Type':asset[1]+';charset=UTF-8','Cache-Control':'no-cache'}});
}
export default {async fetch(req,env,ctx){try{return await handle(req,env,ctx);}catch(e){if(!e.status)console.error(JSON.stringify({event:'request_failed',path:new URL(req.url).pathname,error:e.name}));return json({error:e.status?e.message:'Something went wrong. Please try again.'},e.status||500);}},async scheduled(event,env,ctx){ctx.waitUntil((async()=>{await env.DB.prepare('DELETE FROM rate_limits WHERE expires<?').bind(Date.now()).run();await sendPending(env);})());}};
