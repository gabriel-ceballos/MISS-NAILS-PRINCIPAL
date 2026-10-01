import {watch} from 'node:fs';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(fileURLToPath(new URL('.',import.meta.url)),'..');
const npmCommand=process.platform==='win32'?'npm.cmd':'npm';
const watchedFiles=['index.html','manifest.webmanifest'];
const watchedDirs=['app','styles','assets'];

let timer=null;
let running=false;
let pending=false;
let stopping=false;

function isRelevant(name){
  if(!name) return true;
  const value=String(name).replaceAll('\\','/');
  if(value.startsWith('.')) return false;
  return true;
}

function requestSync(reason){
  if(stopping) return;
  console.log(`\n[watch-sync] Cambio detectado: ${reason}`);
  pending=true;
  clearTimeout(timer);
  timer=setTimeout(runSync,800);
}

function runSync(){
  if(stopping || running || !pending) return;
  running=true;
  pending=false;
  console.log('[watch-sync] Sincronizando Web + Capacitor...');

const child=spawn(npmCommand,['run','sync:native'],{
  cwd:root,
  stdio:'inherit',
  windowsHide:false,
  shell:true
});

  child.on('error',error=>{
    console.error('[watch-sync] No se pudo ejecutar sync:native:',error.message);
    running=false;
    if(pending) requestSync('cambio pendiente');
  });

  child.on('exit',(code,signal)=>{
    running=false;
    if(code===0){
      console.log('[watch-sync] ✓ Web + Capacitor sincronizados.');
    }else{
      console.error(`[watch-sync] ✗ sync:native terminó con código ${code ?? 'null'}${signal ? ` (${signal})` : ''}.`);
    }
    if(pending) setTimeout(runSync,100);
  });
}

const watchers=[];
for(const file of watchedFiles){
  watchers.push(watch(join(root,file),()=>requestSync(file)));
}
for(const dir of watchedDirs){
  watchers.push(watch(join(root,dir),{recursive:true},(_event,name)=>{
    if(isRelevant(name)) requestSync(`${dir}/${name ?? ''}`);
  }));
}

function shutdown(){
  if(stopping) return;
  stopping=true;
  clearTimeout(timer);
  for(const watcher of watchers) watcher.close();
  console.log('\n[watch-sync] Finalizado.');
}

process.on('SIGINT',()=>{shutdown();process.exit(0);});
process.on('SIGTERM',()=>{shutdown();process.exit(0);});

console.log('MISS NAILS · sincronización automática');
console.log('Observando: index.html, manifest.webmanifest, app/, styles/, assets/');
console.log('Guardar o deshacer un cambio → build:web → Capacitor sync.');
console.log('Ctrl+C para detener.');
