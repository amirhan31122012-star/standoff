/* Original procedural map, operator and view-model assets. No external art files. */
(function () {
  'use strict';
  const T = window.THREE;
  const materials = new Map();
  const boxGeometry = new T.BoxGeometry(1, 1, 1);
  function mat(color, extra) {
    const key = String(color) + JSON.stringify(extra || {});
    if (!materials.has(key)) materials.set(key, new T.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra)));
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
    const colliders = [];
    const world = new T.Group(); world.name = 'Sand courtyard'; scene.add(world);
    const sand = 0xc8aa76, pale = 0xdcc79a, darkSand = 0xb5986c, teal = 0x32696a;
    function solid(x, y, z, sx, sy, sz, color) {
      const m = box(world, x, y, z, sx, sy, sz, color);
      colliders.push(new T.Box3(new T.Vector3(x - sx / 2, y - sy / 2, z - sz / 2), new T.Vector3(x + sx / 2, y + sy / 2, z + sz / 2)));
      return m;
    }
    box(world, 0, -0.15, 0, 120, 0.3, 120, 0xc6b38c);
    // A slightly broken tile pattern gives readable speed and scale without textures.
    for (let x = -20; x <= 20; x += 4) for (let z = -22; z <= 22; z += 4) {
      flatMark(world, x, z, 3.94, 3.94, ((x + z) % 8 === 0) ? 0xc4b28f : 0xcbb994);
    }
    // Boundary walls are full physical AABBs; decorative roofs stay outside the paths.
    solid(-22, 2.5, 0, 1, 5, 49, sand); solid(22, 2.5, 0, 1, 5, 49, sand);
    solid(0, 2.5, -24, 45, 5, 1, pale); solid(0, 2.5, 24, 45, 5, 1, darkSand);
    for (let z = -22; z <= 22; z += 4) {
      box(world, -21.85, 2.8, z, 1.1, 5.6, 0.65, pale);
      box(world, 21.85, 2.8, z, 1.1, 5.6, 0.65, pale);
    }
    for (let x = -20; x <= 20; x += 4) {
      box(world, x, 5.15, -24, 1.5, 0.5, 1.2, sand);
      box(world, x, 5.15, 24, 1.5, 0.5, 1.2, sand);
    }
    function building(x, z, sx, sz, height, color, front) {
      solid(x, height / 2, z, sx, height, sz, color);
      box(world, x, height + .16, z, sx + .32, .32, sz + .32, pale);
      box(world, x, .18, z, sx + .12, .36, sz + .12, darkSand);
      for (let dx = -sx / 2 + 1; dx < sx / 2; dx += 2.2) {
        const wz = z + front * (sz / 2 + .025);
        box(world, x + dx, height * .65, wz, .92, 1.35, .08, teal);
        box(world, x + dx, height * .65, wz + front * .055, .07, 1.42, .03, 0x90aaa0);
        box(world, x + dx, height * .65, wz + front * .065, 1, .07, .03, 0x90aaa0);
        box(world, x + dx, height * .65 - .75, wz, 1.17, .15, .3, pale);
      }
      // Water tanks, chimneys and antennas create a low-poly skyline.
      cylinder(world, x + .8, height + .7, z, .75, 1.05, 0x9f9c86, 10);
      cylinder(world, x - sx * .3, height + 1.2, z + .5, .045, 2.2, 0x454d48, 6);
      box(world, x - sx * .3, height + 1.9, z + .5, 1.1, .04, .04, 0x454d48);
    }
    building(-15, -15, 12, 12, 6.2, sand, 1);
    building(15, -16, 12, 10, 7.2, pale, 1);
    building(-16, 15.5, 10, 14, 5.5, darkSand, -1);
    building(16, 16, 10, 13, 5.8, sand, -1);
    sign(world, 'DEPOT 07', 0, 3.7, -23.45, 7, 1.6);
    sign(world, 'SAND YARD', 0, 3.6, 23.45, 7, 1.5, Math.PI);
    // South gate with a painted shutter, creating a memorable player spawn.
    box(world, 0, 1.45, 23.42, 6.5, 2.9, .12, teal);
    for (let y = .25; y < 2.9; y += .28) box(world, 0, y, 23.33, 6.4, .035, .07, 0x244a4c);
    // The central cargo unit splits the main sightline; three lanes remain open.
    solid(-2.3, 1.45, -1.5, 5.4, 2.9, 8.5, teal);
    for (let z = -5.5; z <= 2.5; z += .55) {
      box(world, -5.03, 1.45, z, .08, 2.7, .09, 0x275555);
      box(world, .43, 1.45, z, .08, 2.7, .09, 0x437b79);
    }
    box(world, -2.3, 2.94, -1.5, 5.55, .11, 8.65, 0x467a75);
    sign(world, '07', -2.3, 1.65, 2.78, 2, 1.2);
    function crate(x, z, size = 1.8, height = size, color = 0x9b7950) {
      solid(x, height / 2, z, size, height, size, color);
      box(world, x, .12, z, size + .12, .18, size + .12, 0x695744);
      box(world, x, height - .12, z, size + .12, .18, size + .12, 0x695744);
      box(world, x - size * .33, height / 2, z + size / 2 + .025, .12, height, .06, 0xb89b6e);
      box(world, x + size * .33, height / 2, z + size / 2 + .025, .12, height, .06, 0xb89b6e);
      box(world, x, height / 2, z + size / 2 + .055, size * .55, height * .24, .02, pale);
    }
    crate(-9, 5.5, 2.2); crate(-11.5, 4.7, 1.7); crate(6.8, -9, 2.5);
    crate(10, -7.7, 1.7); crate(5.5, 9, 2.2, 1.2); crate(-5.8, -13, 1.7);
    // Waist-high stone shelter on the right and a fabric market canopy.
    solid(12.8, .65, .5, 4.5, 1.3, 3.5, pale);
    solid(14.6, 1.1, -1.3, .3, 2.2, .3, 0x6d614e);
    solid(11, 1.1, -1.3, .3, 2.2, .3, 0x6d614e);
    solid(14.6, 1.1, 2.3, .3, 2.2, .3, 0x6d614e);
    solid(11, 1.1, 2.3, .3, 2.2, .3, 0x6d614e);
    for (let i = 0; i < 8; i++) {
      const roof = box(world, 10.8 + i * .57, 3.2, .5, .59, .09, 4.15, i % 2 ? 0xe6c67f : 0xa35437);
      roof.rotation.x = .08;
    }
    sign(world, 'A', 12.8, 1.7, 2.29, .65, .65);
    // Ground stripes and objective ring, inlaid rather than floating UI.
    for (let z = 6; z <= 18; z += 2.3) flatMark(world, -.4, z, .13, 1.1, 0xf0d68d, .85);
    for (let x = 7; x <= 17; x += 2) flatMark(world, x, -13, 1, .13, 0xf0d68d, .85);
    const ring = new T.Mesh(new T.RingGeometry(2.3, 2.4, 40), mat(0xe1b85c, { side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(7, .024, -2); world.add(ring);
    function barrel(x, z, color) {
      // Matching square collider intentionally approximates the low-poly barrel.
      colliders.push(new T.Box3(new T.Vector3(x - .43, 0, z - .43), new T.Vector3(x + .43, 1.25, z + .43)));
      cylinder(world, x, .62, z, .43, 1.25, color, 10);
      cylinder(world, x, .22, z, .445, .085, 0x484a42, 10);
      cylinder(world, x, 1.02, z, .445, .085, 0x484a42, 10);
    }
    barrel(-19, -1, 0x567e72); barrel(-18, -1.7, 0x8e6646); barrel(19, 7, 0x567e72);
    // Plants sit at the perimeter outside all practical lanes.
    function palm(x, z, height) {
      cylinder(world, x, height / 2, z, .23, height, 0x7c6749, 7);
      for (let k = 0; k < 7; k++) {
        const leaf = new T.Mesh(new T.ConeGeometry(.52, 3.4, 3), mat(k % 2 ? 0x587b57 : 0x728d62));
        leaf.position.set(x + Math.sin(k) * 1.1, height, z + Math.cos(k) * 1.1);
        leaf.rotation.set(Math.cos(k) * .95, k, -Math.sin(k) * .95); world.add(leaf);
      }
    }
    palm(-25, -9, 8.5); palm(26, 7, 9.2); palm(-25, 22, 7.8); palm(27, -22, 9.8);
    // Distant silhouette: low enough to keep the sky visible and the arena readable.
    for (let i = 0; i < 15; i++) {
      const angle = i / 15 * Math.PI * 2;
      const hill = new T.Mesh(new T.ConeGeometry(8 + i % 4 * 2, 8 + i % 3 * 3, 5), mat(0xb6a78a));
      hill.position.set(Math.sin(angle) * 60, 2, Math.cos(angle) * 60); hill.rotation.y = i; world.add(hill);
    }
    const flag = new T.Group(); flag.position.set(-15, 6.4, -15); world.add(flag);
    cylinder(flag, 0, 1.5, 0, .045, 3, 0x52584f, 6);
    box(flag, .65, 2.35, 0, 1.3, .75, .03, teal);
    box(flag, .16, 2.35, -.025, .25, .75, .04, 0xe7c578);
    // Static cubes share geometry/material: batch them into instanced draws for phones.
    world.updateMatrixWorld(true);
    const batches = new Map();
    world.traverse(function (object) {
      if (!object.isMesh || object.geometry !== boxGeometry) return;
      if (!batches.has(object.material)) batches.set(object.material, []);
      batches.get(object.material).push(object);
    });
    batches.forEach(function (meshes, material) {
      if (meshes.length < 3) return;
      const batch = new T.InstancedMesh(boxGeometry, material, meshes.length);
      batch.castShadow = true; batch.receiveShadow = true;
      meshes.forEach(function (mesh, index) { batch.setMatrixAt(index, mesh.matrixWorld); mesh.parent.remove(mesh); });
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
      world.add(batch);
    });
    return { colliders, spawn: new T.Vector3(0, 0, 18), botSpawns: [new T.Vector3(0, 0, -18), new T.Vector3(17, 0, -6), new T.Vector3(-17, 0, -4), new T.Vector3(7, 0, 4)], mapName: 'Песчаный двор' };
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
