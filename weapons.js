/* Blender-built hard-surface models + original "Tidal Alloy" finish and articulated hands. */
(() => {
'use strict';const T=THREE;
const cache={};
function textureSet(type,color){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,512,512);
 let state=0x38a5;function rnd(){state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;}
 const im=g.getImageData(0,0,512,512);for(let i=0;i<im.data.length;i+=4){const noise=(rnd()-.5)*(type==='cloth'?24:12);for(let k=0;k<3;k++)im.data[i+k]+=noise;}g.putImageData(im,0,0);
 if(type==='cloth')for(let i=0;i<36;i++){g.fillStyle=['#293b33','#4a5847','#696b4f','#343d36'][i%4];const x=rnd()*512,y=rnd()*512;g.beginPath();for(let n=0;n<12;n++){const a=n/12*6.283,r=16+rnd()*35;g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r*.55);}g.closePath();g.fill();}
 if(type==='skin'){
  const gradient=g.createLinearGradient(0,0,400,512);gradient.addColorStop(0,'#112e43');gradient.addColorStop(.45,'#216b7b');gradient.addColorStop(1,'#061c31');g.fillStyle=gradient;g.fillRect(0,0,512,512);
  for(let i=-20;i<32;i++){g.strokeStyle=i%6===0?'#b9a16a':'rgba(99,211,213,.28)';g.lineWidth=i%6===0?2:1;g.beginPath();for(let y=0;y<=512;y+=8){const x=i*24+Math.sin(y*.008+i*.07)*100;if(y===0)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();}
 }else if(type==='cloth'||type==='grip'){
  for(let y=0;y<512;y+=5){g.fillStyle=y%10?'rgba(0,0,0,.22)':'rgba(255,255,255,.08)';g.fillRect(0,y,512,2);}for(let x=0;x<512;x+=5){g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x,0,2,512);}
 }
 // Fine abrasion is directional and sparse; the metal is not a flat color swatch.
 if(type!=='cloth')for(let i=0;i<650;i++){g.strokeStyle=`rgba(${i%3?'205,215,218':'20,25,28'},${rnd()*.2})`;g.lineWidth=rnd()*.6+.2;const x=rnd()*512,y=rnd()*512;g.beginPath();g.moveTo(x,y);g.lineTo(x+rnd()*32,y+rnd()*2);g.stroke();}
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;
 const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=512;const ng=normalCanvas.getContext('2d'),img=ng.createImageData(512,512);for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4,cloth=type==='cloth'||type==='grip';img.data[i]=128+(cloth?Math.sin(x*1.2)*19:(rnd()-.5)*5);img.data[i+1]=128+(cloth?Math.sin(y*1.2)*19:(rnd()-.5)*5);img.data[i+2]=255;img.data[i+3]=255;}ng.putImageData(img,0,0);const normal=new T.CanvasTexture(normalCanvas);normal.wrapS=normal.wrapT=T.RepeatWrapping;
 const roughCanvas=document.createElement('canvas');roughCanvas.width=roughCanvas.height=256;const rg=roughCanvas.getContext('2d');rg.fillStyle=type==='steel'?'#666':type==='skin'?'#888':'#bbb';rg.fillRect(0,0,256,256);for(let i=0;i<400;i++){rg.fillStyle=`rgba(255,255,255,${rnd()*.3})`;rg.fillRect(rnd()*256,rnd()*256,1+rnd()*20,1);}const rough=new T.CanvasTexture(roughCanvas);rough.wrapS=rough.wrapT=T.RepeatWrapping;
 return {map:tex,normalMap:normal,roughnessMap:rough};
}
function material(type){
 if(cache[type])return cache[type];
 const spec={steel:['#9ba4af',.93,.47],black:['#202b35',.8,.63],edge:['#56616a',.85,.55],skin:['#123d50',.65,.55],gold:['#b18c4e',.85,.46],grip:['#222b2b',.05,.9],rubber:['#141c22',.02,.94],cloth:['#394b43',.02,.95],glass:['#20475e',.98,.13]}[type];
 return cache[type]=new T.MeshStandardMaterial({...textureSet(type,spec[0]),metalness:spec[1],roughness:spec[2],normalScale:new T.Vector2(.22,.22)});
}
function decode(str){const data=atob(str),array=new Uint8Array(data.length);for(let i=0;i<data.length;i++)array[i]=data.charCodeAt(i);return new Float32Array(array.buffer);}
function label(group,text,pos,size,rotation){
 const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle='#bbc5be';g.font='bold 35px monospace';g.fillText(text,8,65);g.font='17px monospace';g.fillText('PRECISION SERIES  /  07',10,99);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
 const m=new T.Mesh(new T.PlaneGeometry(size[0],size[1]),new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.7,depthWrite:false}));m.position.set(...pos);m.rotation.y=rotation;group.add(m);
}
function capsule(group,a,b,r,mat,r2=r){
 const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);const mesh=new T.Mesh(new T.CylinderGeometry(r2,r,d.length(),16,1),mat);mesh.position.copy(va).addScaledVector(d,.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());group.add(mesh);
 const joint=new T.Mesh(new T.SphereGeometry(r,16,10),mat);joint.position.copy(va);group.add(joint);return mesh;
}
function hands(group,kind){
 const leather=material('grip'),cloth=material('cloth'),rubber=material('rubber'),accent=material('skin');
 const right=new T.Group();group.add(right);
 capsule(right,[.08,-.42,.48],[.055,-.20,.17],.083,cloth,.065);
 capsule(right,[.055,-.2,.17],[.03,-.135,.08],.061,leather,.056);
 const palm=new T.Mesh(new T.SphereGeometry(1,24,16),leather);palm.scale.set(.061,.080,.047);palm.position.set(.034,-.15,.09);palm.rotation.x=-.25;right.add(palm);
 // Individual curled fingers have proximal and distal segments and knuckle padding.
 for(let i=0;i<4;i++){
  const y=-.10-i*.032,z=.045+i*.014;
  capsule(right,[.07,y,z],[.032,y-.006,z-.035],.014,leather,.012);
  capsule(right,[.032,y-.006,z-.035],[-.008,y-.012,z-.019],.012,rubber,.011);
 }
 capsule(right,[.01,-.12,.13],[-.035,-.10,.075],.019,leather,.014);
 for(let i=0;i<3;i++){const pad=new T.Mesh(new T.SphereGeometry(1,16,8),rubber);pad.scale.set(.025,.012,.014);pad.position.set(.07,-.12-i*.032,.066+i*.013);right.add(pad);}
 const cuff=new T.Mesh(new T.TorusGeometry(.069,.008,8,32),accent);cuff.position.set(.06,-.22,.19);cuff.rotation.x=.8;right.add(cuff);
 if(kind==='pistol'){
  capsule(group,[-.24,-.39,.39],[-.10,-.20,.13],.075,cloth,.06);
  const palm2=new T.Mesh(new T.SphereGeometry(1,24,16),leather);palm2.scale.set(.05,.071,.06);palm2.position.set(-.047,-.16,.09);group.add(palm2);
  for(let i=0;i<3;i++)capsule(group,[-.074,-.12-i*.035,.08],[-.02,-.126-i*.035,.032],.014,leather,.011);
 }else{
  capsule(group,[-.27,-.36,.22],[-.11,-.16,-.29],.079,cloth,.06);
  const support=new T.Mesh(new T.SphereGeometry(1,24,16),leather);support.scale.set(.07,.055,.072);support.position.set(-.034,-.082,-.32);group.add(support);
  for(let i=0;i<4;i++){
   const z=-.38+i*.031;capsule(group,[-.069,-.08,z],[-.08,-.015,z],.013,leather,.012);capsule(group,[-.08,-.015,z],[-.048,.016,z],.012,leather,.01);
  }
  capsule(group,[.014,-.055,-.27],[.048,-.007,-.30],.018,leather,.013);
 }
}
function createWeapon(kind){
 const gun=new T.Group(),slide=new T.Group(),magazine=new T.Group();gun.add(slide,magazine);
 for(const data of RetroWeaponMeshes[kind]){
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(decode(data.p),3));geo.setAttribute('normal',new T.BufferAttribute(decode(data.n),3));geo.setAttribute('uv',new T.BufferAttribute(decode(data.uv),2));geo.computeBoundingSphere();
  const m=new T.Mesh(geo,material(data.mat));(data.part==='slide'?slide:data.part==='magazine'?magazine:gun).add(m);
 }
 // Side engravings and distinctive serials are original rather than copied artwork.
 label(gun,kind==='pistol'?'.50  /  AE':kind==='sniper'?'AW  /  MAGNUM':'M4  /  5.56',[.063,.045,kind==='pistol'?-.16:-.045],[.18,.045],Math.PI/2);
 label(gun,kind==='pistol'?'AE  /  .50':kind==='sniper'?'AW  /  MAGNUM':'M4  /  5.56',[-.063,.058,kind==='pistol'?-.16:-.045],[.18,.045],-Math.PI/2);
 hands(gun,kind);
 const muzzle=new T.Object3D();muzzle.position.set(0,.07,kind==='pistol'?-.43:kind==='sniper'?-1.03:kind==='shotgun'?-.96:-.84);gun.add(muzzle);
 gun.userData.muzzle=muzzle;gun.userData.magazine=magazine;
 gun.userData.animate=(kick,progress)=>{
  slide.position.z=kick*.045;
  magazine.rotation.x=Math.sin(progress*Math.PI)*.12;
  magazine.position.x=Math.sin(progress*Math.PI)*.025;
 };
 return gun;
}
function studio(renderer){
 const s=new T.Scene();s.background=new T.Color(.22,.24,.28);
 for(const [pos,size,color] of [[[0,3,0],[6,.1,5],0xdce9ff],[[-3,0,1],[.1,5,5],0xffffff],[[3,1,-2],[.1,3,4],0xffd2a0],[[0,0,4],[4,2,.1],0x4d677a]]){
  const m=new T.Mesh(new T.BoxGeometry(...size),new T.MeshBasicMaterial({color}));m.position.set(...pos);s.add(m);
 }
 const gen=new T.PMREMGenerator(renderer);const target=gen.fromScene(s,.06);gen.dispose();s.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});return target.texture;
}
window.RetroDetailedWeapons={createWeapon,studio,material};
})();
