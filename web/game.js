/* Original offline training client. Simulation is local; see README for C++ core. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
try {
if (!window.THREE || !window.RetroAssets) throw new Error('Не найдены файлы игры. Распакуйте весь ZIP и откройте START_GAME.html.');
const T = THREE, DT = 1 / 30;
const touch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', touch);
const canvas = $('game');
const renderer = new T.WebGLRenderer({canvas, antialias: !touch, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.4 : 1.7));
renderer.shadowMap.enabled = !touch;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.setClearColor(0xc5d9dd);
renderer.autoClear = false;
renderer.info.autoReset = false;
const scene = new T.Scene();
scene.background = new T.Color(0xc5d9dd);
scene.fog = new T.Fog(0xc5d9dd, 40, 100);
scene.add(new T.HemisphereLight(0xe7f4ff, 0x887b69, 1.65));
const sun = new T.DirectionalLight(0xffe4c0, 3.2);
sun.position.set(-22, 32, 16); sun.castShadow = !touch;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera, {left:-30,right:30,top:30,bottom:-30,near:1,far:100});
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.001; scene.add(sun);
const map = RetroAssets.createWorld(scene);
const camera = new T.PerspectiveCamera(75, 1, .05, 120);
camera.rotation.order = 'YXZ';
const viewScene = new T.Scene(), viewCamera = new T.PerspectiveCamera(65,1,.025,10);
viewScene.add(new T.HemisphereLight(0xffffff,0x6e6658,2.5));
const viewLight = new T.DirectionalLight(0xffe6c4,3); viewLight.position.set(-1,3,2); viewScene.add(viewLight);
const weaponDefs = [
 {kind:'rifle',name:'AR-7 · АВТОМАТ',size:30,reserve:150,damage:32,pellets:1,interval:.1,reload:2.2,spread:.004,recoil:.016,auto:true},
 {kind:'pistol',name:'P-12 · ПИСТОЛЕТ',size:12,reserve:72,damage:28,pellets:1,interval:.234,reload:1.5,spread:.006,recoil:.023,auto:false},
 {kind:'shotgun',name:'SG-8 · ДРОБОВИК',size:8,reserve:40,damage:12,pellets:8,interval:.8,reload:2.4,spread:.06,recoil:.043,auto:false},
 {kind:'sniper',name:'SR-5 · ВИНТОВКА',size:5,reserve:30,damage:105,pellets:1,interval:1.1,reload:2.8,spread:.001,recoil:.05,auto:false}
];
const models = weaponDefs.map(d => {
 const m = RetroAssets.createWeapon(d.kind); viewScene.add(m); m.visible=false; m.scale.setScalar(.82);
 const flash = new T.Mesh(new T.ConeGeometry(.075,.22,6),new T.MeshBasicMaterial({color:0xffd573,transparent:true,opacity:.9}));
 flash.rotation.x=-Math.PI/2; flash.visible=false;
 (m.userData.muzzle || m).add(flash); m.userData.flash=flash; m.userData.magazineY=m.userData.magazine?.position.y || 0;
 return m;
});
const player = {pos:map.spawn.clone(),vel:new T.Vector3(),yaw:0,pitch:0,crouch:false,grounded:true,health:100,armor:50,slot:0,eye:1.65,kick:0};
let weapons=[],bots=[],state='menu',started=false,elapsed=0,kills=0,deaths=0,shotCount=0,switchTime=0,damageTime=-100,spawnShield=3,respawnTime=0,fireEdge=false,flashTime=0,hitTime=0;
const keys=new Set(), input={fire:false,jump:false,crouch:false,aim:false,forward:0,strafe:0};
let fireBuffer=0;
let jumpHeld=false, mouseHeld=false, pointerFallback=false, walkingTime=0,feedUntil=0,accumulator=0,hudClock=0,navClock=0;
let joystickId=null,joystickOrigin={x:0,y:0},lookId=null,lookLast;
let audio;
const effects=[];
const ray=new T.Ray(), hitPoint=new T.Vector3();
function sound(frequency,duration,volume,noise=false) {
 if (!$('sound').checked) return;
 try {
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  if(audio.state==='suspended') audio.resume();
  const gain=audio.createGain();gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);gain.connect(audio.destination);
  let source;
  if(noise){const buf=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate);const data=buf.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);source=audio.createBufferSource();source.buffer=buf;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=frequency;source.connect(filter);filter.connect(gain);}
  else {source=audio.createOscillator();source.frequency.setValueAtTime(frequency,audio.currentTime);source.frequency.exponentialRampToValueAtTime(frequency*.4,audio.currentTime+duration);source.connect(gain);}
  source.start();source.stop(audio.currentTime+duration);
 } catch(_) { /* Audio is optional. */ }
}
const height=()=>player.crouch?1.1:1.8;
function bounds(pos,h=1.8,r=.3){return new T.Box3(new T.Vector3(pos.x-r,pos.y,pos.z-r),new T.Vector3(pos.x+r,pos.y+h,pos.z+r));}
function overlap(a,b){return a.min.x<b.max.x&&a.max.x>b.min.x&&a.min.y<b.max.y&&a.max.y>b.min.y&&a.min.z<b.max.z&&a.max.z>b.min.z;}
function blocked(pos,h=1.8,r=.3){const box=bounds(pos,h,r);return map.colliders.some(s=>overlap(box,s));}
function moveBody(pos,vel,dt,h=1.8,r=.3){
 let grounded=false;
 for(const axis of ['x','z','y']){
  let travel=vel[axis]*dt;const box=bounds(pos,h,r);
  const other=['x','y','z'].filter(a=>a!==axis);
  for(const s of map.colliders){
   if(other.some(a=>box.min[a]>=s.max[a]||box.max[a]<=s.min[a]))continue;
   if(travel>0&&box.max[axis]<=s.min[axis])travel=Math.min(travel,s.min[axis]-box.max[axis]);
   else if(travel<0&&box.min[axis]>=s.max[axis])travel=Math.max(travel,s.max[axis]-box.min[axis]);
  }
  if(travel!==vel[axis]*dt){if(axis==='y'&&vel.y<0)grounded=true;vel[axis]=0;}
  pos[axis]+=travel;
 }
 if(pos.y<=0){pos.y=0;vel.y=0;grounded=true;}
 return grounded;
}
function wallDistance(origin,direction,max=100){
 ray.set(origin,direction);let distance=max;
 for(const box of map.colliders){if(box.containsPoint(origin))return 0;const hit=ray.intersectBox(box,hitPoint);if(hit)distance=Math.min(distance,origin.distanceTo(hit));}
 return distance;
}
function sight(a,b){const dir=b.clone().sub(a),length=dir.length();return length<.01||wallDistance(a,dir.normalize(),length+.01)>=length-.05;}
// A shared, low resolution flow field allows bots to find their way around cover.
const nav={minX:-22,minZ:-24,width:45,depth:49,open:[],distance:[]};
for(let z=0;z<nav.depth;z++)for(let x=0;x<nav.width;x++)nav.open.push(!blocked(new T.Vector3(x+nav.minX,0,z+nav.minZ),1.8,.4));
function cell(pos){const x=Math.round(pos.x-nav.minX),z=Math.round(pos.z-nav.minZ);return x<0||z<0||x>=nav.width||z>=nav.depth?-1:z*nav.width+x;}
function neighbors(index){const x=index%nav.width,z=Math.floor(index/nav.width),out=[];if(x>0)out.push(index-1);if(x<nav.width-1)out.push(index+1);if(z>0)out.push(index-nav.width);if(z<nav.depth-1)out.push(index+nav.width);return out;}
function rebuildNav(){nav.distance.fill(Infinity);let start=cell(player.pos);if(start<0)return;if(!nav.open[start])start=neighbors(start).find(i=>nav.open[i]);if(start===undefined)return;const queue=[start];nav.distance[start]=0;for(let n=0;n<queue.length;n++){const at=queue[n];for(const next of neighbors(at))if(nav.open[next]&&nav.distance[next]===Infinity){nav.distance[next]=nav.distance[at]+1;queue.push(next);}}}
nav.distance=new Array(nav.open.length).fill(Infinity);
function tracer(from,to,color=0xffe3a1){const geometry=new T.BufferGeometry().setFromPoints([from,to]);const material=new T.LineBasicMaterial({color,transparent:true,opacity:.6});const line=new T.Line(geometry,material);scene.add(line);effects.push({object:line,life:.065,max:.065});}
function impact(pos){const m=new T.Mesh(new T.IcosahedronGeometry(.055,0),new T.MeshBasicMaterial({color:0xe8cda1}));m.position.copy(pos);scene.add(m);effects.push({object:m,life:.13,max:.13});}
function feed(text){$('feed').textContent=text;feedUntil=elapsed+2.5;}
function safeBotSpawn(index){
 const candidates=map.botSpawns.slice().sort((a,b)=>b.distanceTo(player.pos)-a.distanceTo(player.pos));
 return (candidates[index%candidates.length] || map.spawn).clone();
}
function spawnBot(bot,index){bot.pos.copy(safeBotSpawn(index));bot.health=100;bot.dead=0;bot.shotDelay=1.2+Math.random();bot.model.position.copy(bot.pos);bot.model.visible=true;bot.model.rotation.set(0,0,0);bot.model.scale.setScalar(1);}
function reset(){
 for(const b of bots)scene.remove(b.model);
 bots=map.botSpawns.slice(0,5).map((p,i)=>{const model=RetroAssets.createCharacter(i);scene.add(model);return{model,pos:p.clone(),vel:new T.Vector3(),health:100,dead:0,shotDelay:1.5+i*.3,phase:i*1.7};});
 weapons=weaponDefs.map(d=>({ammo:d.size,reserve:d.reserve,cooldown:0,reload:0,burst:0,idle:0}));
 Object.assign(player,{yaw:0,pitch:0,crouch:false,health:100,armor:50,slot:0,eye:1.65,kick:0,grounded:true});
 player.pos.copy(map.spawn);player.vel.set(0,0,0);elapsed=0;kills=0;deaths=0;shotCount=0;spawnShield=3;respawnTime=0;switchTime=0;damageTime=-100;fireEdge=false;jumpHeld=false;
 bots.forEach((b,i)=>spawnBot(b,i));
 for(const effect of effects){scene.remove(effect.object);effect.object.geometry.dispose();effect.object.material.dispose();}effects.length=0;
 $('round-message').textContent='';$('feed').textContent='';$('results').hidden=true;feedUntil=0;
 rebuildNav();selectWeapon(0);updateHUD();
}
function clearInput(){keys.clear();Object.assign(input,{fire:false,jump:false,crouch:false,aim:false,forward:0,strafe:0});mouseHeld=false;fireEdge=false;fireBuffer=0;jumpHeld=false;joystickId=null;lookId=null;$('stick').style.transform='translate(-50%, -50%)';}
function pause(){if(state!=='playing')return;state='paused';clearInput();document.body.classList.remove('playing');$('menu').hidden=false;$('start').textContent='ПРОДОЛЖИТЬ';if($('restart'))$('restart').hidden=false;document.exitPointerLock?.();}
function play(){
 if(!started||state==='ended'){reset();started=true;}
 state='playing';accumulator=0;clearInput();$('menu').hidden=true;document.body.classList.add('playing');
 sound(160,.08,.02);
 if(!touch){try{const result=canvas.requestPointerLock();if(result?.catch)result.catch(()=>{pointerFallback=true;feed('Для обзора удерживайте левую кнопку мыши');});}catch(_){pointerFallback=true;}}
}
$('start').addEventListener('click',play);
$('pause-button').addEventListener('click',pause);
$('restart')?.addEventListener('click',()=>{state='ended';play();});
document.addEventListener('pointerlockchange',()=>{if(!touch&&state==='playing'&&document.pointerLockElement!==canvas&&!pointerFallback)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('blur',pause);
function selectWeapon(slot){if(slot<0||slot>=weapons.length)return;player.slot=slot;switchTime=.25;models.forEach((m,i)=>m.visible=i===slot);input.fire=false;fireEdge=false;updateHUD();}
function reload(){const w=weapons[player.slot],d=weaponDefs[player.slot];if(!w||w.reload||w.ammo>=d.size||w.reserve<=0||respawnTime>0)return;w.reload=d.reload;sound(550,.09,.035);}
function look(dx,dy){const sensitivity=input.aim?.0011:.0023;player.yaw-=dx*sensitivity;player.pitch=T.MathUtils.clamp(player.pitch-dy*sensitivity,-1.48,1.48);}
document.addEventListener('mousemove',e=>{if(state==='playing'&&document.pointerLockElement===canvas)look(e.movementX,e.movementY);});
// Listen above overlays too: Windows hybrid touchscreens can target the look layer.
// Buffer short presses so a down/up pair between 30 Hz ticks is never lost.
document.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&state==='playing'&&document.pointerLockElement!==canvas&&mouseHeld)look(e.movementX,e.movementY);});
function mouseButtonDown(e){
 if(state!=='playing'||e.target.closest?.('button,select,input,#menu'))return;
 if(e.button===0){input.fire=true;mouseHeld=true;fireBuffer=.3;}
 if(e.button===2)input.aim=true;
 e.preventDefault();
}
document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')mouseButtonDown(e);},true);
document.addEventListener('mousedown',mouseButtonDown);
document.addEventListener('pointerup',e=>{if(e.pointerType==='mouse'){if(e.button===0){input.fire=false;mouseHeld=false;}if(e.button===2)input.aim=false;}},true);
document.addEventListener('pointercancel',e=>{if(e.pointerType==='mouse'){input.fire=false;mouseHeld=false;input.aim=false;}},true);
document.addEventListener('pointerlockerror',()=>{pointerFallback=true;feed('Обзор: удерживайте ЛКМ и двигайте мышь');});
window.addEventListener('mouseup',e=>{if(e.button===0){input.fire=false;mouseHeld=false;}if(e.button===2)input.aim=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
 if(e.code==='Escape'){pause();return;}if(state!=='playing')return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
 keys.add(e.code);if(e.repeat)return;
 if(e.code==='KeyR')reload();if(e.code==='KeyQ')selectWeapon((player.slot+1)%4);
 if(/^Digit[1-4]$/.test(e.code))selectWeapon(Number(e.code.slice(-1))-1);
});
document.addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('wheel',e=>{if(state==='playing'){e.preventDefault();selectWeapon((player.slot+(e.deltaY>0?1:3))%4);}},{passive:false});
const joystick=$('joystick'),stick=$('stick');
joystick.addEventListener('pointerdown',e=>{if(state!=='playing'||joystickId!==null)return;e.preventDefault();joystickId=e.pointerId;joystick.setPointerCapture(e.pointerId);const r=joystick.getBoundingClientRect();joystickOrigin={x:r.left+r.width/2,y:r.top+r.height/2};setJoystick(e);});
function setJoystick(e){let dx=e.clientX-joystickOrigin.x,dy=e.clientY-joystickOrigin.y;const radius=joystick.clientWidth*.32,len=Math.hypot(dx,dy);if(len>radius){dx*=radius/len;dy*=radius/len;}input.strafe=dx/radius;input.forward=-dy/radius;stick.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;}
joystick.addEventListener('pointermove',e=>{if(e.pointerId===joystickId)setJoystick(e);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(name,e=>{if(e.pointerId!==joystickId)return;joystickId=null;input.strafe=input.forward=0;stick.style.transform='translate(-50%, -50%)';});
const lookZone=$('look-zone');
lookZone.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;if(state!=='playing'||lookId!==null)return;e.preventDefault();lookId=e.pointerId;lookLast={x:e.clientX,y:e.clientY};lookZone.setPointerCapture(e.pointerId);});
lookZone.addEventListener('pointermove',e=>{if(e.pointerId!==lookId)return;look((e.clientX-lookLast.x)*1.5,(e.clientY-lookLast.y)*1.5);lookLast={x:e.clientX,y:e.clientY};});
for(const name of ['pointerup','pointercancel','lostpointercapture'])lookZone.addEventListener(name,e=>{if(e.pointerId===lookId)lookId=null;});
for(const button of document.querySelectorAll('[data-action]')){
 const action=button.dataset.action;
 button.addEventListener('pointerdown',e=>{if(state!=='playing')return;e.preventDefault();button.setPointerCapture(e.pointerId);if(action==='reload')reload();else if(action==='switch')selectWeapon((player.slot+1)%4);else {input[action]=true;if(action==='fire')fireBuffer=.3;}button.classList.add('pressed');});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>{if(action in input)input[action]=false;button.classList.remove('pressed');});
}
function shoot(){
 const d=weaponDefs[player.slot],w=weapons[player.slot];
 if(respawnTime>0||switchTime>0||w.reload||w.cooldown>1e-5||w.ammo<=0)return false;
 --w.ammo;++shotCount;w.cooldown=d.interval;w.burst=Math.min(12,w.burst+1);w.idle=0;
 const origin=player.pos.clone().add(new T.Vector3(0,player.eye,0));
 const direction=new T.Vector3(0,0,-1).applyEuler(new T.Euler(player.pitch,player.yaw,0,'YXZ'));
 const right=new T.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
 const up=new T.Vector3().crossVectors(right,direction).normalize();
 const speed=Math.hypot(player.vel.x,player.vel.z);
 const spread=(d.spread+speed*.003+(player.grounded?0:.04)+w.burst*.0012)*(player.crouch?.65:1)*(input.aim?.55:1);
 for(let i=0;i<d.pellets;i++){
  const angle=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*spread;
  const dir=direction.clone().addScaledVector(right,Math.cos(angle)*r).addScaledVector(up,Math.sin(angle)*r).normalize();
  let nearest=wallDistance(origin,dir,100),target=null;ray.set(origin,dir);
  for(const bot of bots){if(bot.health<=0)continue;const hit=ray.intersectBox(bounds(bot.pos,1.8,.32),hitPoint);if(hit){const distance=origin.distanceTo(hit);if(distance<nearest){nearest=distance;target=bot;}}}
  const end=origin.clone().addScaledVector(dir,nearest);tracer(origin.clone().addScaledVector(right,.18).add(new T.Vector3(0,-.18,0)),end);
  if(target){target.health-=d.damage;hitTime=.16;sound(800,.035,.012);if(target.health<=0){target.dead=3.5;kills++;w.reserve=Math.min(d.reserve,w.reserve+10);feed('ЦЕЛЬ ПОРАЖЕНА  +1');sound(1100,.09,.03);}}else if(nearest<100)impact(end);
 }
 player.pitch=Math.min(1.48,player.pitch+d.recoil*(player.crouch?.75:1));player.yaw+=(Math.sin(w.burst*1.8)*.003);player.kick=1;flashTime=.055;
 sound(d.kind==='sniper'?700:d.kind==='shotgun'?900:1500,.12,.16,true);return true;
}
function damage(amount){if(spawnShield>0||respawnTime>0)return;const absorb=Math.min(player.armor,Math.ceil(amount*.5));player.armor-=absorb;player.health=Math.max(0,player.health-(amount-absorb));damageTime=elapsed;sound(90,.1,.06);
 if(player.health===0){deaths++;respawnTime=3;input.fire=false;$('round-message').textContent='ВОЗВРАЩЕНИЕ ЧЕРЕЗ 3';}
}
function updateBots(dt){
 const difficulty=$('difficulty').value==='easy'?.55:1;
 for(let i=0;i<bots.length;i++){
  const b=bots[i];
  if(b.health<=0){b.dead-=dt;b.model.userData.animate?.(elapsed,0,true);if(b.dead<=0)spawnBot(b,i);continue;}
  const delta=player.pos.clone().sub(b.pos),dist=delta.length(),eye=b.pos.clone().add(new T.Vector3(0,1.5,0)),targetEye=player.pos.clone().add(new T.Vector3(0,player.eye,0));
  const visible=sight(eye,targetEye);let dx=0,dz=0;
  if(dist>7||!visible){const index=cell(b.pos);if(index>=0){let best=index;for(const n of neighbors(index))if(nav.distance[n]<nav.distance[best])best=n;if(best!==index){dx=best%nav.width+nav.minX-b.pos.x;dz=Math.floor(best/nav.width)+nav.minZ-b.pos.z;}}if(visible&&dist>7){dx=delta.x;dz=delta.z;}}
  else if(dist>3){dx=Math.cos(elapsed*.7+b.phase)*.7;dz=Math.sin(elapsed*.7+b.phase)*.7;}
  const length=Math.hypot(dx,dz);b.vel.set(length?dx/length*1.65:0,-1,length?dz/length*1.65:0);moveBody(b.pos,b.vel,dt);
  b.model.position.copy(b.pos);b.model.rotation.y=Math.atan2(delta.x,delta.z);b.model.userData.animate?.(elapsed+b.phase,Math.hypot(b.vel.x,b.vel.z),false);
  b.model.userData.firing=Math.max(0,(b.model.userData.firing||0)-dt);b.shotDelay-=dt;
  if(visible&&dist<25&&b.shotDelay<=0&&respawnTime<=0){b.model.userData.firing=.12;b.shotDelay=(.75+Math.random()*.6)/difficulty;tracer(eye,targetEye,0xff8359);if(Math.random()<.46*difficulty)damage(10);}
 }
}
function update(dt){
 elapsed+=dt;spawnShield=Math.max(0,spawnShield-dt);switchTime=Math.max(0,switchTime-dt);flashTime=Math.max(0,flashTime-dt);hitTime=Math.max(0,hitTime-dt);player.kick=Math.max(0,player.kick-dt*7);
 if(elapsed>=180){state='ended';document.exitPointerLock?.();clearInput();document.body.classList.remove('playing');$('menu').hidden=false;$('start').textContent='ЕЩЁ ОДИН РАУНД';$('results').hidden=false;$('results').textContent=`Раунд завершён · ${kills} целей · ${deaths} возрождений`;return;}
 for(let i=0;i<weapons.length;i++){const w=weapons[i];w.cooldown=Math.max(0,w.cooldown-dt);w.idle+=dt;if(w.idle>.45)w.burst=0;if(w.reload>0){w.reload=Math.max(0,w.reload-dt);if(w.reload===0){const n=Math.min(weaponDefs[i].size-w.ammo,w.reserve);w.ammo+=n;w.reserve-=n;sound(650,.05,.025);}}}
 if(respawnTime>0){respawnTime-=dt;$('round-message').textContent=`ВОЗВРАЩЕНИЕ ЧЕРЕЗ ${Math.ceil(respawnTime)}`;if(respawnTime<=0){player.pos.copy(map.spawn);player.vel.set(0,0,0);player.health=100;player.armor=50;spawnShield=3;player.yaw=player.pitch=0;weapons.forEach((w,i)=>{w.ammo=weaponDefs[i].size;w.reserve=weaponDefs[i].reserve;w.reload=0;});$('round-message').textContent='';}}
 else {
  const crouch=input.crouch||keys.has('ControlLeft')||keys.has('KeyC');if(crouch)player.crouch=true;else if(!blocked(player.pos,1.8))player.crouch=false;
  let forward=input.forward+(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
  let strafe=input.strafe+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  const length=Math.hypot(forward,strafe);if(length>1){forward/=length;strafe/=length;}
  const speed=player.crouch?2.7:input.aim?3.4:5.2,accel=(player.grounded?60:20)*dt;
  const vx=(Math.cos(player.yaw)*strafe-Math.sin(player.yaw)*forward)*speed,vz=(-Math.sin(player.yaw)*strafe-Math.cos(player.yaw)*forward)*speed;
  player.vel.x+=T.MathUtils.clamp(vx-player.vel.x,-accel,accel);player.vel.z+=T.MathUtils.clamp(vz-player.vel.z,-accel,accel);
  const jump=input.jump||keys.has('Space');if(jump&&!jumpHeld&&player.grounded){player.vel.y=6.8;player.grounded=false;sound(160,.1,.025);}jumpHeld=jump;
  player.vel.y=Math.max(-50,player.vel.y-20*dt);player.grounded=moveBody(player.pos,player.vel,dt,height());
  if(player.pos.y< -10)player.pos.copy(map.spawn);
  const w=weapons[player.slot];if((weaponDefs[player.slot].auto&&input.fire)||fireBuffer>0){if(shoot())fireBuffer=0;if(w.ammo===0&&!w.reload)reload();}fireBuffer=Math.max(0,fireBuffer-dt);fireEdge=input.fire;
  if(elapsed-damageTime>7&&player.health<100)player.health=Math.min(100,player.health+dt*5);
 }
 navClock-=dt;if(navClock<=0){navClock=.65;rebuildNav();}updateBots(dt);
 for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;e.object.material.opacity=Math.max(0,e.life/e.max);if(e.life<=0){scene.remove(e.object);e.object.geometry.dispose();e.object.material.dispose();effects.splice(i,1);}}
 hudClock-=dt;if(hudClock<=0){hudClock=.1;updateHUD();}
}
function updateHUD(){if(!weapons.length)return;const w=weapons[player.slot];$('health').textContent=Math.ceil(player.health);$('armor').textContent=player.armor;$('ammo').textContent=w.ammo;$('reserve').textContent=w.reserve;$('weapon-name').textContent=weaponDefs[player.slot].name;$('kills').textContent=String(kills).padStart(2,'0');const left=Math.max(0,180-Math.floor(elapsed));$('timer').textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;$('status').textContent=w.reload?`ПЕРЕЗАРЯДКА ${w.reload.toFixed(1)}с`:spawnShield>0?'ЗАЩИТА ПРИ ВОЗРОЖДЕНИИ':player.crouch?'ПРИСЕДАНИЕ':input.aim?'ПРИЦЕЛИВАНИЕ':'ТРЕНИРОВКА С БОТАМИ';if(elapsed>feedUntil)$('feed').textContent='';}
function render(dt){
 const speed=Math.hypot(player.vel.x,player.vel.z);if(state==='playing')walkingTime+=dt*speed;
 player.eye=T.MathUtils.lerp(player.eye,(player.crouch?.95:1.65),Math.min(1,dt*14));
 camera.position.copy(player.pos).add(new T.Vector3(0,player.eye+(player.grounded?Math.sin(walkingTime*2.5)*Math.min(speed*.003,.018):0),0));camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
 camera.fov=T.MathUtils.lerp(camera.fov,input.aim?(player.slot===3?32:55):75,Math.min(1,dt*12));camera.updateProjectionMatrix();
 const weapon=models[player.slot],w=weapons[player.slot];
 if(w){const progress=w.reload?1-w.reload/weaponDefs[player.slot].reload:0;const tilt=Math.sin(progress*Math.PI);weapon.position.set((input.aim?.06:.26)+Math.sin(walkingTime*2)*speed*.0018,-.27-tilt*.21-switchTime*.45,-.48+player.kick*.075);weapon.rotation.set(player.kick*.09-tilt*.45,tilt*.2,tilt*.5+Math.sin(walkingTime)*speed*.002);weapon.userData.flash.visible=flashTime>0;weapon.visible=respawnTime<=0;
 if(weapon.userData.magazine)weapon.userData.magazine.position.y=weapon.userData.magazineY-Math.sin(progress*Math.PI)*.13;}
 $('hitmarker').style.opacity=hitTime>0?'1':'0';$('damage').style.opacity=String(Math.max(0,.65-(elapsed-damageTime)*1.2));
 $('crosshair').style.transform=`translate(-50%, -50%) scale(${input.aim?.65:1+speed*.045})`;
 renderer.info.reset();renderer.clear();renderer.render(scene,camera);renderer.clearDepth();if(started&&respawnTime<=0)renderer.render(viewScene,viewCamera);
}
function resize(){const width=innerWidth,height=innerHeight;renderer.setSize(width,height,false);camera.aspect=viewCamera.aspect=width/height;camera.updateProjectionMatrix();viewCamera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('error').hidden=false;$('error').textContent='Графический контекст потерян. Перезагрузите страницу.';});
reset();let last=performance.now();
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(state==='playing'){accumulator+=dt;let steps=0;while(accumulator>=DT&&steps<4&&state==='playing'){update(DT);accumulator-=DT;steps++;}if(steps===4)accumulator=0;}render(dt);requestAnimationFrame(frame);}
requestAnimationFrame(frame);
if(new URLSearchParams(location.search).has('test'))window.__retroTest={
 snapshot:()=>({state,pos:player.pos.toArray(),yaw:player.yaw,pitch:player.pitch,health:player.health,armor:player.armor,kills,deaths,elapsed,slot:player.slot,ammo:weapons[player.slot].ammo,reserve:weapons[player.slot].reserve,reloading:weapons[player.slot].reload,crouch:player.crouch,grounded:player.grounded,shotCount,bots:bots.map(b=>({pos:b.pos.toArray(),health:b.health})),drawCalls:renderer.info.render.calls,touch}),
 setPosition:(x,y,z)=>{player.pos.set(x,y,z);player.vel.set(0,0,0);},
 aimAtBot:index=>{const b=bots[index],d=b.pos.clone().add(new T.Vector3(0,1.1,0)).sub(player.pos.clone().add(new T.Vector3(0,player.eye,0)));player.yaw=Math.atan2(-d.x,-d.z);player.pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));},
 positionBot:(index,x,y,z)=>{bots[index].pos.set(x,y,z);bots[index].model.position.copy(bots[index].pos);},
 colliders:()=>map.colliders.map(b=>({min:b.min.toArray(),max:b.max.toArray()})),
 freezeBots:()=>{updateBots=()=>{};},step:n=>{for(let i=0;i<n;i++)update(DT);},damage,renderer:()=>renderer.info.render,
};
} catch(error){console.error(error);const message=$('error');if(message){message.hidden=false;message.textContent='Не удалось открыть игру: '+error.message+' Попробуйте актуальный Chrome или Edge с аппаратным ускорением.';}}
})();
