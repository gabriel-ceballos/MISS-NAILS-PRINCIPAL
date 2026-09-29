import {cp, mkdir, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'www');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const file of ['index.html','manifest.webmanifest']) await cp(join(root,file),join(out,file));
for(const dir of ['app','styles','assets']) await cp(join(root,dir),join(out,dir),{recursive:true});
console.log('MISS NAILS web build: www generado desde la fuente única.');
