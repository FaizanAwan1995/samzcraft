import fs from 'node:fs';
const files={INDEX:'index.html',ADMIN:'admin.html',STYLE:'style.css',APP:'app.js',STUDIO:'studio.js',PHOTO:'photo.js'};
let content=Object.entries(files).map(([key,file])=>`export const ${key}=${JSON.stringify(fs.readFileSync(new URL(file,import.meta.url),'utf8'))};`).join('\n');
const assets={};for(const name of fs.readdirSync(new URL('assets/',import.meta.url)))if(/\.(jpg|png)$/.test(name))assets[name]=fs.readFileSync(new URL('assets/'+name,import.meta.url)).toString('base64');assets['profile.jpg']=fs.readFileSync(new URL('profile.jpg',import.meta.url)).toString('base64');
content+='\nexport const ASSETS='+JSON.stringify(assets)+';';fs.writeFileSync(new URL('bundle.mjs',import.meta.url),content);
const source=content.replaceAll('export const ','const ')+'\n'+fs.readFileSync(new URL('seo.mjs',import.meta.url),'utf8').replace(/^export /gm,'')+'\n'+fs.readFileSync(new URL('worker.mjs',import.meta.url),'utf8').replace(/^import.*\n/gm,'');fs.writeFileSync(new URL('deploy.mjs',import.meta.url),source);console.log('Built Worker:',source.length,'bytes');
