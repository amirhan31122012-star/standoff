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
      return new T.MeshStandardMaterial({map:tex,normalMap:normal,normalScale:new T.Vector2(.55,.55),roughness:.92,color:0xffffff});
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
    function building(x,z,sx,sz,h,material){
      block(x,h/2,z,sx,h,sz,material,true);block(x,.38,z,sx+.08,.76,sz+.08,stone);block(x,3.5,z,sx+.2,.16,sz+.2,trim);block(x,h+.1,z,sx+.45,.22,sz+.45,trim);
      for(const side of [-1,1]){block(x+side*(sx/2-.12),h+.43,z,.24,.7,sz+.35,material);block(x,h+.43,z+side*(sz/2-.12),sx,.7,.24,material);}
      for(const face of [-1,1])for(let wx=x-sx/2+1.4;wx<x+sx/2-.7;wx+=2.6){windowUnit(wx,2,z+face*(sz/2+.03),face===1?0:Math.PI);if(h>6)windowUnit(wx,5.4,z+face*(sz/2+.03),face===1?0:Math.PI);}
      for(const side of [-1,1])for(let zz=z-sz/2+1.4;zz<z+sz/2-.7;zz+=2.6)windowUnit(x+side*(sx/2+.03),2,zz,side*Math.PI/2);
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
  function createCharacter(variant = 0) {
    const actor = new T.Group();
    const uniform = variant % 2 ? 0x697e74 : 0xab7951;
    const cloth = variant % 2 ? 0x425750 : 0x735e49;
    const skin = 0xc99b79, armor = 0x303e40, accent = 0xe9ab56;
    const hips = box(actor, 0, .86, 0, .43, .22, .28, cloth);
    const torso = new T.Group(); torso.position.y = 1.13; actor.add(torso);
    box(torso, 0, .08, 0, .55, .48, .32, uniform);
    box(torso, 0, .08, .19, .46, .4, .13, armor);
    for (let i = -1; i <= 1; i++) box(torso, i * .135, .03, .28, .115, .2, .07, 0x53625c);
    box(torso, -.22, .2, .24, .07, .11, .07, accent);
    box(torso, 0, .08, -.24, .36, .43, .19, cloth);
    box(torso, 0, -.14, .015, .56, .075, .36, armor);
    const head = new T.Group(); head.position.set(0, 1.56, .01); actor.add(head);
    box(head, 0, .025, 0, .28, .3, .27, skin);
    box(head, 0, .13, -.012, .34, .14, .32, armor);
    box(head, 0, .21, -.012, .27, .065, .25, armor);
    box(head, 0, .08, .15, .3, .09, .04, 0x1c323c);
    box(head, 0, .08, .176, .23, .047, .012, 0x8ec6ca);
    box(head, 0, -.055, .15, .25, .13, .075, cloth);
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new T.Group(); leg.position.set(side * .14, .84, 0); actor.add(leg);
      box(leg, 0, -.32, 0, .2, .66, .22, uniform);
      box(leg, 0, -.37, .13, .18, .18, .07, armor);
      box(leg, 0, -.73, .055, .22, .18, .35, armor);
      legs.push(leg);
    }
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new T.Group(); arm.position.set(side * .345, 1.35, .01); actor.add(arm);
      box(arm, 0, -.17, 0, .18, .36, .2, uniform);
      box(arm, 0, -.36, .14, .17, .16, .37, uniform);
      box(arm, 0, -.35, .35, .17, .15, .16, armor);
      if (side === -1) box(arm, -.1, -.1, 0, .025, .13, .14, accent);
      arms.push(arm);
    }
    const gun = new T.Group(); gun.position.set(.15, 1.02, .38); actor.add(gun);
    box(gun, 0, 0, .14, .12, .17, .52, armor);
    box(gun, 0, -.1, .08, .1, .2, .14, cloth);
    cylinder(gun, 0, .035, .55, .035, .4, 0x293336, 6, 'z');
    const muzzle = new T.Object3D(); muzzle.position.set(0, .035, .78); gun.add(muzzle);
    actor.userData.muzzle = muzzle;
    let deathStarted = null;
    actor.userData.animate = function (time, speed, dead) {
      if (dead && deathStarted === null) deathStarted = time;
      if (!dead) deathStarted = null;
      const fall = deathStarted === null ? 0 : Math.min(1, Math.max(0, (time - deathStarted) / .35));
      const easedFall = fall * fall * (3 - 2 * fall);
      const firing = Math.min(1, Math.max(0, Number(actor.userData.firing || 0) / .12));
      const amount = dead ? 0 : Math.min(1, Math.abs(speed) / 4);
      const stride = Math.sin(time * 11) * .6 * amount;
      legs[0].rotation.x = stride; legs[1].rotation.x = -stride;
      hips.position.y = .86 + Math.abs(Math.sin(time * 11)) * .025 * amount;
      torso.rotation.z = Math.sin(time * 5.5) * .035 * amount;
      torso.position.y = 1.13 + Math.sin(time * 2.4) * .009;
      arms[0].rotation.x = -.14 - stride * .12; arms[1].rotation.x = -.08 + stride * .12;
      head.rotation.y = Math.sin(time * 1.2) * .035;
      actor.rotation.z = -Math.PI / 2 * easedFall;
      torso.rotation.x = firing * .065;
      arms[0].rotation.x -= firing * .11;
      arms[1].rotation.x -= firing * .11;
      gun.position.z = .38 - firing * .045;
      gun.rotation.x = Math.sin(time * 2.4) * .012 - firing * .12;
    };
    return actor;
  }
  function createWeapon(kind = 'rifle') {
    const gun = new T.Group();
    const metal = 0x29393c, steel = 0x526164, body = 0xb79a69, grip = 0x374644, trim = 0x6fb8af;
    const short = kind === 'pistol';
    const long = kind === 'sniper';
    const shotgun = kind === 'shotgun';
    const length = short ? .31 : long ? .68 : shotgun ? .59 : .52;
    box(gun, 0, 0, -.08, short ? .11 : .14, short ? .12 : .17, length, body);
    box(gun, 0, .085, -.11, short ? .105 : .13, .055, length * 1.03, metal);
    box(gun, .076, -.003, .01, .012, .07, .13, steel);
    box(gun, .084, .012, -.07, .009, .025, .11, trim);
    const rear = short ? .07 : .15;
    const handle = box(gun, 0, -.14, rear, .09, .23, .13, grip);
    handle.rotation.x = -.22;
    box(gun, 0, -.105, rear - .12, .08, .025, .14, metal);
    box(gun, 0, -.07, rear - .18, .08, .09, .025, metal);
    const magazine = box(gun, 0, -.2, -.1, short ? .07 : .105, short ? .1 : .27, short ? .09 : .15, metal);
    magazine.rotation.x = shotgun ? 0 : -.12;
    gun.userData.magazine = magazine;
    const barrelEnd = short ? -.36 : long ? -1.03 : shotgun ? -.94 : -.81;
    cylinder(gun, 0, .026, barrelEnd + .19, short ? .027 : .032, .4, steel, 8, 'z');
    cylinder(gun, 0, .026, barrelEnd, short ? .034 : .045, .07, metal, 8, 'z');
    cylinder(gun, 0, .026, barrelEnd - .038, short ? .021 : .029, .004, 0x101b20, 8, 'z');
    if (!short) {
      box(gun, 0, -.015, .37, .12, .18, .32, grip);
      box(gun, 0, -.025, .55, .14, .23, .06, metal);
      box(gun, 0, .025, -.38, .13, .14, .26, body);
      for (let i = 0; i < 6; i++) box(gun, 0, .12, -.3 + i * .065, .15, .016, .023, metal);
      for (let i = 0; i < 4; i++) box(gun, .072, .01, -.45 + i * .07, .012, .07, .022, metal);
    }
    if (long) {
      cylinder(gun, 0, .22, -.13, .075, .43, metal, 10, 'z');
      cylinder(gun, 0, .22, .1, .085, .055, steel, 10, 'z');
      cylinder(gun, 0, .22, .131, .066, .008, 0x426b78, 10, 'z');
      box(gun, 0, .15, -.1, .07, .13, .13, metal);
      cylinder(gun, .105, .25, -.14, .034, .07, steel, 8, 'x');
    } else {
      box(gun, 0, .14, short ? .02 : .14, .075, .06, .045, metal);
      box(gun, 0, .17, short ? .02 : .14, .022, .015, .02, trim);
      box(gun, 0, .13, short ? -.2 : -.48, .03, .07, .03, metal);
    }
    if (shotgun) {
      cylinder(gun, 0, -.05, -.65, .034, .52, metal, 8, 'z');
      box(gun, 0, -.045, -.53, .17, .13, .28, grip);
      for (let i = 0; i < 5; i++) box(gun, 0, -.12, -.65 + i * .055, .175, .015, .025, steel);
      magazine.visible = false;
    }
    // Two original fingerless tactical gloves, sleeves and a wrist display.
    const handColor = 0x344b4d, skin = 0xc89b7a, sleeve = 0x718879;
    const rightHand = box(gun, .045, -.15, .16, .13, .17, .19, handColor);
    rightHand.rotation.x = -.2;
    box(gun, .115, -.09, .085, .045, .07, .11, skin);
    const rightArm = box(gun, .1, -.29, .38, .18, .2, .42, sleeve); rightArm.rotation.x = -.3;
    if (!short) {
      box(gun, -.035, -.13, -.38, .19, .12, .18, handColor);
      for (let i = 0; i < 3; i++) box(gun, -.1 + i * .047, -.09, -.45, .035, .06, .075, skin);
      const leftArm = box(gun, -.2, -.29, -.11, .18, .19, .48, sleeve); leftArm.rotation.y = -.55; leftArm.rotation.x = .23;
      box(gun, -.17, -.19, -.26, .16, .055, .12, metal);
      box(gun, -.17, -.156, -.26, .1, .01, .075, trim);
    }
    const muzzle = new T.Object3D(); muzzle.position.set(0, .026, barrelEnd - .06); gun.add(muzzle);
    gun.userData.muzzle = muzzle;
    gun.userData.kind = kind;
    return gun;
  }
  window.RetroAssets = { createWorld, createCharacter, createWeapon };
})();
