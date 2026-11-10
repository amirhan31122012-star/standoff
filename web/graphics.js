/* Context negotiation is separate so unsupported devices receive usable recovery UI. */
(() => {
'use strict';
const T=window.THREE;
function create(initialCanvas,{touch=false,forceLow=false}={}){
 const attempts=[];
 const profiles=forceLow?[
  {api:'webgl',aa:false,power:'default',low:true},
  {api:'webgl2',aa:false,power:'default',low:true},
  {api:'experimental-webgl',aa:false,power:'default',low:true}
 ]:[
  {api:'webgl2',aa:!touch,power:'default',low:touch},
  {api:'webgl2',aa:false,power:'low-power',low:true},
  {api:'webgl',aa:false,power:'default',low:true},
  {api:'experimental-webgl',aa:false,power:'default',low:true}
 ];
 let canvas=initialCanvas;
 for(let i=0;i<profiles.length;i++){
  const p=profiles[i];
  if(i){const next=initialCanvas.cloneNode(false);canvas.replaceWith(next);canvas=next;}
  let detail='',gl=null;
  const onError=e=>{detail=e.statusMessage||'context unavailable';};
  canvas.addEventListener('webglcontextcreationerror',onError);
  try{
   gl=canvas.getContext(p.api,{alpha:false,antialias:p.aa,depth:true,stencil:false,
    powerPreference:p.power,preserveDrawingBuffer:false,failIfMajorPerformanceCaveat:false});
   if(!gl){attempts.push({api:p.api,result:'unavailable',detail});continue;}
   const renderer=new T.WebGLRenderer({canvas,context:gl,antialias:p.aa,alpha:false,
    precision:p.low?'mediump':'highp',powerPreference:p.power});
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,p.low?1:1.7));
   canvas.removeEventListener('webglcontextcreationerror',onError);
   return {renderer,canvas,low:p.low,api:p.api,attempts};
  }catch(error){
   attempts.push({api:p.api,result:'failed',detail:error.message});
   gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }finally{canvas.removeEventListener('webglcontextcreationerror',onError);}
 }
 return {renderer:null,canvas,low:true,api:null,attempts};
}
function showFailure(attempts){
 const box=document.getElementById('error');if(!box)return;
 box.hidden=false;box.replaceChildren();
 const title=document.createElement('strong');title.textContent='Браузер не смог включить 3D-графику (WebGL).';box.append(title);
 const text=document.createElement('p');text.textContent='Откройте эту ссылку в отдельном окне Яндекс Браузера, Chrome или Safari. Закройте другие вкладки с играми, перезапустите браузер и обновите его. Встроенное окно мессенджера может не предоставлять WebGL.';box.append(text);
 const low=document.createElement('a');low.className='graphics-retry';low.textContent='Попробовать совместимый режим';const url=new URL(location.href);url.searchParams.set('graphics','low');low.href=url.href;box.append(low);
 const retry=document.createElement('button');retry.type='button';retry.className='graphics-retry';retry.textContent='Повторить запуск';retry.onclick=()=>location.reload();box.append(retry);
 const note=document.createElement('p');note.textContent='Если WebGL отключён браузером или недоступен на устройстве, переключение качества не сможет его включить.';box.append(note);
 const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Диагностика запуска';pre.textContent=attempts.map(x=>x.api+': '+x.result+(x.detail?' — '+x.detail:'')).join('\n');details.append(summary,pre);box.append(details);
 document.getElementById('start').disabled=true;
}
window.RetroGraphics={create,showFailure};
})();
