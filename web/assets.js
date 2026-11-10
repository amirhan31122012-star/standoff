/* Original procedural map, operator and view-model assets. No external art files. */
(function () {
  'use strict';
  const T = window.THREE;
  const materials = new Map();
  const bevelShape=new T.Shape();bevelShape.moveTo(-.48,-.48);bevelShape.lineTo(.48,-.48);bevelShape.lineTo(.48,.48);bevelShape.lineTo(-.48,.48);bevelShape.closePath();
  const boxGeometry = new T.ExtrudeGeometry(bevelShape,{depth:.96,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2,steps:1});boxGeometry.translate(0,0,-.48);
  function mat(color, extra) {
    const key = String(color) + JSON.stringify(extra || {});
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial(Object.assign({ color, roughness: .72, metalness: .12 }, extra)));
    return materials.get(key);
  }
  function box(parent, x, y, z, sx, sy, sz, color, extra) {
    const m = new T.Mesh(boxGeometry, mat(color, extra));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function cylinder(parent, x, y, z, radius, height, color, sides = 8, axis = 'y') {
    const m = new T.Mesh(new T.CylinderGeometry(radius, radius, height, sides), mat(color));
    m.position.set(x, y, z);
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function flatMark(parent, x, z, sx, sz, color, opacity = 1) {
    return box(parent, x, 0.012, z, sx, 0.009, sz, color, { transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
  }
  function label(text, color = '#f1e0b1', background = '#28484b', width = 512, height = 160) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.strokeRect(12, 12, width - 24, height - 24);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(height * 0.51) + 'px sans-serif'; ctx.fillText(text, width / 2, height / 2, width - 40);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({ map: texture });
  }
  function sign(parent, text, x, y, z, sx, sy, rotation = 0) {
    const m = new T.Mesh(new T.PlaneGeometry(sx, sy), label(text));
    m.position.set(x, y, z); m.rotation.y = rotation; parent.add(m); return m;
  }
  function createWorld(scene) {
    const colliders=[],world=new T.Group();scene.add(world);world.name='Alma old town';
    // Deterministic, embedded surface maps. All material detail remains offline.
    let seed=3719;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
    function surface(kind,base){
      const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,512,512);
      const im=g.getImageData(0,0,512,512);for(let i=0;i<im.data.length;i+=4){const n=(rand()-.5)*(kind==='plaster'?23:34);for(let k=0;k<3;k++)im.data[i+k]+=n;}g.putImageData(im,0,0);
      if(kind==='stone'||kind==='paving'){
        const row=kind==='stone'?64:128;
        for(let y=0;y<512;y+=row){g.strokeStyle='rgba(42,35,26,.38)';g.lineWidth=4;g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();
          for(let x=-128;x<512;x+=128){const xx=x+(y/row%2)*64;g.strokeStyle='rgba(40,34,27,.36)';g.strokeRect(xx,y,128,row);g.fillStyle=`rgba(255,244,215,${rand()*.09})`;g.fillRect(xx+4,y+4,120,row-8);g.strokeStyle='rgba(255,248,221,.22)';g.lineWidth=2;g.beginPath();g.moveTo(xx+3,y+row-3);g.lineTo(xx+3,y+3);g.lineTo(xx+125,y+3);g.stroke();}
        }
      }else if(kind==='wood'){
        for(let x=0;x<512;x+=64){g.fillStyle='rgba(20,12,6,.3)';g.fillRect(x,0,4,512);for(let i=0;i<26;i++){g.strokeStyle=`rgba(28,16,8,${rand()*.25})`;g.beginPath();const a=x+rand()*64;g.moveTo(a,0);g.bezierCurveTo(a+12,160,a-10,340,a+5,512);g.stroke();}}
      }else{for(let i=0;i<180;i++){g.fillStyle=`rgba(70,49,26,${rand()*.12})`;g.fillRect(rand()*512,rand()*512,rand()*35+2,rand()*8+1);}}
      const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;
      // Height-derived tangent-space normal map adds masonry edges under sunlight.
      const nc=document.createElement('canvas');nc.width=nc.height=512;const ng=nc.getContext('2d'),data=g.getImageData(0,0,512,512).data,ni=ng.createImageData(512,512);
      const value=(x,y)=>data[(((y+512)%512)*512+(x+512)%512)*4];
      for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4;ni.data[i]=128+(value(x-1,y)-value(x+1,y))*.8;ni.data[i+1]=128+(value(x,y-1)-value(x,y+1))*.8;ni.data[i+2]=250;ni.data[i+3]=255;}ng.putImageData(ni,0,0);
      const normal=new T.CanvasTexture(nc);normal.wrapS=normal.wrapT=T.RepeatWrapping;
      const roughCanvas=document.createElement('canvas');roughCanvas.width=roughCanvas.height=512;const roughCtx=roughCanvas.getContext('2d'),roughImage=roughCtx.createImageData(512,512);
      for(let i=0;i<data.length;i+=4){const rough=kind==='plaster'?180+data[i]*.25:160+data[i]*.3;roughImage.data[i]=roughImage.data[i+1]=roughImage.data[i+2]=rough;roughImage.data[i+3]=255;}roughCtx.putImageData(roughImage,0,0);const roughnessMap=new T.CanvasTexture(roughCanvas);roughnessMap.wrapS=roughnessMap.wrapT=T.RepeatWrapping;
      return new T.MeshStandardMaterial({map:tex,normalMap:normal,roughnessMap,normalScale:new T.Vector2(.75,.75),roughness:.96,color:0xffffff});
    }
    const plaster=surface('plaster','#c6b398'),rose=surface('plaster','#bd927b'),white=surface('plaster','#ddd3bc'),stone=surface('stone','#a99375'),paving=surface('paving','#aa9c81'),wood=surface('wood','#725137');
    const teal=new T.MeshStandardMaterial({color:0x356b68,roughness:.62}),iron=new T.MeshStandardMaterial({color:0x394443,metalness:.7,roughness:.47}),trim=new T.MeshStandardMaterial({color:0xd7c8aa,roughness:.9}),dark=new T.MeshStandardMaterial({color:0x253434,roughness:.6});
    const geoCache=new Map();
    function block(x,y,z,sx,sy,sz,material,physical=false){
      // Geometry carries world-scaled UVs so a large facade never stretches a tile.
      const key=[sx,sy,sz].join(',');if(!geoCache.has(key)){const geo=new T.BoxGeometry(sx,sy,sz);const uv=geo.attributes.uv;for(let f=0;f<6;f++){const u=[sz,sz,sx,sx,sx,sx][f]/3,v=[sy,sy,sz,sz,sy,sy][f]/3;for(let n=0;n<4;n++){const i=f*4+n;uv.setXY(i,uv.getX(i)*u,uv.getY(i)*v);}}geoCache.set(key,geo);}
      const m=new T.Mesh(geoCache.get(key),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;world.add(m);
      if(physical)colliders.push(new T.Box3(new T.Vector3(x-sx/2,y-sy/2,z-sz/2),new T.Vector3(x+sx/2,y+sy/2,z+sz/2)));return m;
    }
    block(0,-.15,0,110,.3,110,paving);
    // Outer urban perimeter, broken roofline and masonry plinth.
    for(const x of [-22,22]){block(x,3.5,0,1,7,49,stone,true);block(x,7.05,0,1.25,.25,49,trim);}
    for(const z of [-24,24]){block(0,3.5,z,45,7,1,stone,true);block(0,7.05,z,45,.25,1.25,trim);}
    function windowUnit(x,y,z,rotation=0){
      const group=new T.Group();world.add(group);group.position.set(x,y,z);group.rotation.y=rotation;
      function part(a,b,c,sx,sy,sz,m){const mesh=block(a,b,c,sx,sy,sz,m);group.add(mesh);}
      part(0,0,0,1.05,1.6,.12,dark);part(-.58,0,.05,.14,1.85,.22,trim);part(.58,0,.05,.14,1.85,.22,trim);part(0,.88,.05,1.3,.15,.22,trim);part(0,-.88,.12,1.4,.17,.45,trim);
      for(const side of [-1,1]){part(side*.32,0,.11,.51,1.55,.1,teal);for(let i=0;i<8;i++)part(side*.32,-.64+i*.18,.18,.48,.05,.06,dark);}
    }
    // Exposed aggregate, chipped plaster and branching hairline cracks have their own
    // alpha, normal and roughness response instead of being flat colored rectangles.
    const chipCanvas=document.createElement('canvas');chipCanvas.width=chipCanvas.height=512;const cg=chipCanvas.getContext('2d');
    cg.beginPath();for(let i=0;i<100;i++){const a=i/100*Math.PI*2,r=.5+rand()*.25;cg.lineTo(256+Math.cos(a)*r*220,256+Math.sin(a)*r*180);}cg.closePath();cg.fillStyle='#8a857a';cg.fill();cg.save();cg.clip();
    for(let i=0;i<22000;i++){const x=rand()*512,y=rand()*512,r=.3+rand()*2;cg.fillStyle=i%3?'rgba(39,40,36,.3)':'rgba(227,225,213,.5)';cg.beginPath();cg.ellipse(x,y,r,r*.7,rand()*3,0,6.3);cg.fill();}cg.restore();
    for(let i=0;i<7;i++){let x=256,y=256;cg.strokeStyle='rgba(52,45,36,.65)';cg.lineWidth=1+rand();cg.beginPath();cg.moveTo(x,y);const a=i/7*6.28;for(let j=0;j<8;j++){x+=Math.cos(a)*22+(rand()-.5)*18;y+=Math.sin(a)*22+(rand()-.5)*18;cg.lineTo(x,y);}cg.stroke();}
    const chipTexture=new T.CanvasTexture(chipCanvas);chipTexture.colorSpace=T.SRGBColorSpace;
    const chipMaterial=new T.MeshStandardMaterial({map:chipTexture,bumpMap:chipTexture,bumpScale:.055,transparent:true,roughness:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
    const chipGeo=new T.PlaneGeometry(1,1);
    function weatherPatch(x,y,z,w,h,rot=0){const m=new T.Mesh(chipGeo,chipMaterial);m.position.set(x,y,z);m.scale.set(w,h,1);m.rotation.y=rot;world.add(m);}
    function building(x,z,sx,sz,h,material){
      block(x,h/2,z,sx,h,sz,material,true);block(x,.38,z,sx+.08,.76,sz+.08,stone);block(x,3.5,z,sx+.2,.16,sz+.2,trim);block(x,h+.1,z,sx+.45,.22,sz+.45,trim);
      for(const side of [-1,1]){block(x+side*(sx/2-.12),h+.43,z,.24,.7,sz+.35,material);block(x,h+.43,z+side*(sz/2-.12),sx,.7,.24,material);}
      for(const face of [-1,1])for(let wx=x-sx/2+1.4;wx<x+sx/2-.7;wx+=2.6){windowUnit(wx,2,z+face*(sz/2+.03),face===1?0:Math.PI);if(h>6)windowUnit(wx,5.4,z+face*(sz/2+.03),face===1?0:Math.PI);}
      for(const side of [-1,1])for(let zz=z-sz/2+1.4;zz<z+sz/2-.7;zz+=2.6)windowUnit(x+side*(sx/2+.03),2,zz,side*Math.PI/2);
      for(const face of [-1,1]){
        weatherPatch(x-sx*.32,.75,z+face*(sz/2+.075),2.5,1.1,face===1?0:Math.PI);
        weatherPatch(x+sx*.25,3.95,z+face*(sz/2+.075),1.7,.9,face===1?0:Math.PI);
      }
      for(const side of [-1,1])weatherPatch(x+side*(sx/2+.075),.6,z,1.7,.9,side*Math.PI/2);
      // Drain pipes, AC units, water tanks and antenna wires are architectural scale cues.
      cylinder(world,x+sx/2+.08,h/2,z-sz/2+.35,.055,h,0x746f61,10);
      block(x+.6,h+.65,z,1.4,1.1,1.1,teal);block(x+.6,h+1.25,z,1.5,.14,1.2,iron);
      const unit=block(x-sx*.26,4,z+sz/2+.28,1.1,.7,.6,trim);cylinder(world,x-sx*.26,4,z+sz/2+.61,.26,.04,0x5a625e,16,'z');
      cylinder(world,x-sx*.3,h+1,z-.8,.035,2.1,0x4d514b,8);
    }
    // Two connected courtyards, side alleys and a covered cross passage.
    building(-16,-16,11,14,8.8,white);building(16,-16,11,14,7.6,rose);
    building(-16,16,11,13,8.1,rose);building(16,16,11,13,9.2,white);
    building(-9,3.5,7,7,6.6,plaster);building(10,3.5,7,7,7.6,white);
    // Usable vaulted passage. The opening is real geometry, not a painted doorway.
    function arch(x,z,width,spring,rotation=0){
      const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;world.add(g);const r=width/2,t=.52;
      const shape=new T.Shape();shape.moveTo(-r-t,0);shape.absarc(0,0,r+t,Math.PI,0,true);shape.lineTo(r,0);shape.absarc(0,0,r,0,Math.PI,false);shape.closePath();
      const a=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.85,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:24}),stone);a.position.set(0,spring,-.425);a.castShadow=a.receiveShadow=true;g.add(a);
      for(const side of [-1,1]){const px=x+Math.cos(rotation)*side*(r+t/2),pz=z-Math.sin(rotation)*side*(r+t/2);block(px,spring/2,pz,rotation?.9:t,spring,rotation?t:.9,stone,true);}
      // Wedge-shaped keystones articulate the curved arch rather than a square frame.
      for(let i=0;i<=12;i++){const angle=i/12*Math.PI;const k=new T.Mesh(new T.BoxGeometry(.19,.58,.94),trim);k.position.set(Math.cos(angle)*(r+t/2),spring+Math.sin(angle)*(r+t/2),0);k.rotation.z=angle-Math.PI/2;k.castShadow=true;g.add(k);}
    }
    arch(0,7.2,8,2.25);block(0,7.4,7.2,10,1.6,1.2,plaster);block(0,8.3,7.2,10.4,.22,1.55,trim);
    arch(-16,-2,5,2.25);arch(17,7,4.5,2.3);
    sign(world,'ALMA  /  OLD QUARTER',0,6.9,7.83,5,.55);
    // Central fountain: octagonal stone basin with a carved center and water surface.
    const basin=new T.Mesh(new T.CylinderGeometry(2.5,2.65,.7,12),stone);basin.position.set(0,.35,-6);basin.receiveShadow=basin.castShadow=true;world.add(basin);
    colliders.push(new T.Box3(new T.Vector3(-2.55,0,-8.55),new T.Vector3(2.55,.8,-3.45)));
    const water=new T.Mesh(new T.CircleGeometry(2.25,32),new T.MeshStandardMaterial({color:0x438c8c,metalness:.35,roughness:.16,transparent:true,opacity:.85}));water.rotation.x=-Math.PI/2;water.position.set(0,.72,-6);world.add(water);
    cylinder(world,0,1.4,-6,.43,1.5,0xc7b998,16);cylinder(world,0,2.2,-6,1.05,.2,0xc7b998,20);cylinder(world,0,2.55,-6,.19,.65,0xc7b998,16);
    colliders.push(new T.Box3(new T.Vector3(-.5,.7,-6.5),new T.Vector3(.5,2.9,-5.5)));
    function crate(x,z,s=1.8,h=s){block(x,h/2,z,s,h,s,wood,true);for(const y of [.12,h-.12])block(x,y,z,s+.1,.13,s+.1,iron);for(const side of [-1,1]){block(x+side*s*.4,h/2,z+s/2+.025,.08,h,.04,iron);}}
    crate(-5.5,-12,2.1);crate(6.8,-10,2.5);crate(9,-7.7,1.4);crate(5,12,2.2,1.15);crate(-7,12,1.7);crate(-2.3,-.4,2,2.2);
    // Market stalls have canvas roofs, timber counters, rugs, baskets and produce.
    for(const z of [-5,0,5]){
      block(-19,.65,z,3,1.3,1.45,wood,true);
      for(const dx of [-1.5,1.5])block(-19+dx,1.65,z-.65,.1,3.3,.1,wood);
      for(let stripe=0;stripe<10;stripe++){const roof=block(-20.6+stripe*.35,3.05,z,.36,.07,2.4,stripe%2?teal:trim);roof.rotation.x=.13;}
      for(let i=0;i<12;i++){const fruit=new T.Mesh(new T.SphereGeometry(.12,8,6),mat(i%3?0xb48c38:0x897b3b));fruit.position.set(-20.2+(i%6)*.45,1.37,z+Math.floor(i/6)*.3);world.add(fruit);}
    }
    // A low cover wall forms a second bomb-site-like courtyard with multiple entrances.
    block(16,.7,-3,7,1.4,.65,stone,true);block(19,.7,0,.65,1.4,5.4,stone,true);
    sign(world,'A  →',6.45,2.6,7.05,1.3,.7);sign(world,'←  B',-5.65,2.6,7.05,1.3,.7);
    for(const [x,z] of [[15,-12],[-16,12]]){const r=new T.Mesh(new T.RingGeometry(2.1,2.16,48),new T.MeshBasicMaterial({color:0xb78a44,transparent:true,opacity:.6}));r.rotation.x=-Math.PI/2;r.position.set(x,.018,z);world.add(r);}
    // Rugs, doors, chipped wall patches and scattered gravel break up clean surfaces.
    for(const [x,z] of [[-16,9.45],[16,-8.95]]){
      const door=block(x,1.3,z,1.8,2.6,.09,wood);block(x,.03,z+1.2,2.8,.025,2.1,teal);for(let i=0;i<6;i++)block(x-1.2+i*.48,.05,z+1.2,.07,.01,2,trim);
      for(const side of [-1,1])cylinder(world,x+side*1.4,.4,z+.6,.28,.8,0x9a6450,16);
    }
    const pebbleGeo=new T.DodecahedronGeometry(.06,0);
    for(let i=0;i<80;i++){const x=(rand()-.5)*41,z=(rand()-.5)*45;const pebble=new T.Mesh(pebbleGeo,stone);pebble.position.set(x,.025,z);pebble.scale.setScalar(.4+rand());pebble.scale.y*=.5;world.add(pebble);}
    // Overhead cables and street lanterns frame the skyline.
    for(const z of [-11,12]){
      const pts=[];for(let i=0;i<=20;i++){const t=i/20;pts.push(new T.Vector3(-21+42*t,8-Math.sin(t*Math.PI)*1.4,z));}
      world.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0x343c37})));
    }
    for(const x of [-21.3,21.3])for(const z of [-17,0,17]){block(x,3,z,.22,.48,.32,iron);const glass=block(x+(x<0?.15:-.15),3,z,.06,.3,.23,trim);}
    for(let i=0;i<18;i++){const angle=i/18*Math.PI*2;building(Math.sin(angle)*42,Math.cos(angle)*43,7+i%4,7,7+i%5*1.8,i%2?plaster:white);}
    // Batch repeated static geometry/material pairs while retaining independent collision boxes.
    world.updateMatrixWorld(true);const batches=new Map();world.traverse(o=>{if(o.isMesh&&!o.material.transparent){const k=o.geometry.uuid+o.material.uuid;if(!batches.has(k))batches.set(k,[]);batches.get(k).push(o);}});
    for(const meshes of batches.values()){if(meshes.length<3)continue;const inst=new T.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);inst.castShadow=inst.receiveShadow=true;meshes.forEach((m,i)=>{inst.setMatrixAt(i,m.matrixWorld);m.parent.remove(m);});inst.computeBoundingSphere();world.add(inst);}
    // Distant scenery must never participate in navigation/hits inside the arena.
    return {colliders,spawn:new T.Vector3(0,0,18),botSpawns:[new T.Vector3(0,0,-18),new T.Vector3(17,0,-6),new T.Vector3(-17,0,-4),new T.Vector3(5,0,4)],mapName:'Квартал Альма'};
  }
  function createCharacter(variant=0){
    const actor=new T.Group(),green=variant%2;
    const fabric=window.RetroDetailedWeapons.material('cloth').clone();fabric.color.setHex(green?0xd0dac8:0xdacbb1);
    const armor=new T.MeshStandardMaterial({color:0x283338,roughness:.83});
    const skin=new T.MeshStandardMaterial({color:0xb58d70,roughness:.85});
    const glass=new T.MeshStandardMaterial({color:0x263f4a,metalness:.65,roughness:.22});
    function ellipsoid(parent,pos,scale,material){const m=new T.Mesh(new T.SphereGeometry(1,24,16),material);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;parent.add(m);return m;}
    function limb(parent,pos,length,radius,material){const g=new T.Group();g.position.set(...pos);parent.add(g);const m=new T.Mesh(new T.CapsuleGeometry(radius,Math.max(.02,length-radius*2),5,16),material);m.position.y=-length/2;m.castShadow=true;g.add(m);return g;}
    const hips=ellipsoid(actor,[0,.84,0],[.225,.16,.15],fabric);
    const torso=new T.Group();torso.position.set(0,1.12,0);actor.add(torso);
    ellipsoid(torso,[0,.06,0],[.29,.32,.18],fabric);
    ellipsoid(torso,[0,.06,.08],[.27,.26,.155],armor);
    for(let i=-1;i<=1;i++){const p=box(torso,i*.14,-.015,.22,.12,.17,.075,0x475750);p.material=armor;}
    const strap1=limb(torso,[-.20,.32,.09],.35,.025,armor);strap1.rotation.z=.12;
    const strap2=limb(torso,[.20,.32,.09],.35,.025,armor);strap2.rotation.z=-.12;
    ellipsoid(torso,[0,.08,-.20],[.20,.24,.12],fabric);
    const head=new T.Group();head.position.set(0,1.57,0);actor.add(head);
    ellipsoid(head,[0,.02,.015],[.14,.19,.13],skin);
    const helmet=new T.Mesh(new T.SphereGeometry(.178,28,16,0,Math.PI*2,0,Math.PI*.58),armor);helmet.position.y=.095;helmet.scale.z=.95;helmet.castShadow=true;head.add(helmet);
    ellipsoid(head,[0,-.055,.10],[.135,.095,.06],fabric);
    for(const x of [-.065,.065]){ellipsoid(head,[x,.047,.134],[.066,.044,.026],armor);ellipsoid(head,[x,.05,.153],[.052,.029,.013],glass);}
    for(const x of [-.163,.163])ellipsoid(head,[x,.025,0],[.035,.075,.052],armor);
    const legs=[];
    for(const side of [-1,1]){
      const leg=limb(actor,[side*.135,.84,0],.41,.103,fabric);
      const shin=limb(leg,[0,-.40,0],.34,.075,fabric);ellipsoid(leg,[0,-.35,.067],[.09,.10,.06],armor);
      ellipsoid(shin,[0,-.31,.055],[.095,.075,.165],armor);legs.push(leg);
    }
    const arms=[];
    for(const side of [-1,1]){
      const arm=limb(actor,[side*.28,1.35,.01],.30,.092,fabric);arm.rotation.z=side*.13;
      const fore=limb(arm,[0,-.28,.02],.28,.072,fabric);fore.rotation.x=-1.05;
      ellipsoid(fore,[0,-.27,.01],[.067,.077,.055],armor);arms.push(arm);
    }
    const gun=new T.Group();gun.position.set(.13,1.035,.34);actor.add(gun);
    const receiver=box(gun,0,0,.10,.095,.13,.32,0x303b42);receiver.material=armor;
    cylinder(gun,0,.025,.4,.025,.35,0x424b50,20,'z');cylinder(gun,0,.025,.60,.032,.06,0x28323a,20,'z');
    const magazine=box(gun,0,-.13,.10,.065,.2,.10,0x303b42);magazine.rotation.x=-.16;
    const muzzle=new T.Object3D();muzzle.position.set(0,.025,.64);gun.add(muzzle);actor.userData.muzzle=muzzle;
    let died=null;
    actor.userData.animate=(time,speed,dead)=>{
      if(dead&&died===null)died=time;if(!dead)died=null;
      const a=dead?0:Math.min(1,speed/3),stride=Math.sin(time*10)*.52*a,firing=Math.max(0,actor.userData.firing||0)/.12;
      legs[0].rotation.x=stride;legs[1].rotation.x=-stride;torso.rotation.z=Math.sin(time*5)*.025*a;
      arms[0].rotation.x=-.25-stride*.09-firing*.1;arms[1].rotation.x=-.3+stride*.09-firing*.1;
      torso.position.y=1.12+Math.sin(time*2)*.008;gun.position.z=.34-firing*.045;gun.rotation.x=-firing*.09;
      const t=died===null?0:Math.min(1,Math.max(0,(time-died)/.4));actor.rotation.z=-Math.PI/2*t*t*(3-2*t);head.rotation.y=Math.sin(time*.9)*.03;
    };
    return actor;
  }
  function createWeapon(kind){return window.RetroDetailedWeapons.createWeapon(kind);}
  window.RetroAssets = { createWorld, createCharacter, createWeapon };
})();
