import {applyRuntimeContext, updateDynamicContext} from './runtime/context.js';
import {createRouter} from './navigation/router.js';
import {initCatalog} from './features/catalog.js';

const app=document.querySelector('.mn-app');

if(!app){
  throw new Error('MISS NAILS: no se encontró .mn-app.');
}

applyRuntimeContext(app);
createRouter(app);
initCatalog();

let frame=0;
function refreshContext(){
  if(frame) return;
  frame=requestAnimationFrame(()=>{
    frame=0;
    updateDynamicContext(app);
  });
}
window.addEventListener('resize',refreshContext,{passive:true});
window.addEventListener('orientationchange',refreshContext,{passive:true});
