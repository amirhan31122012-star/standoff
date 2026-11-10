/*
Browser regression checks. Start the repository with:
  python3 -m http.server 8080 --bind 127.0.0.1
Then run (Playwright installed separately):
  NODE_PATH=/path/to/node_modules node tools/test-web.cjs
Optional: PLAYWRIGHT_MODULE, CHROMIUM_PATH, WEB_BASE_URL.
No browser binaries or npm dependencies are required by the game itself.
*/
'use strict';
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WEB_BASE_URL || 'http://127.0.0.1:8080';
const errors = [], externalRequests = [];
const snapshot = page => page.evaluate(() => window.__retroTest.snapshot());
const step = (page, count) => page.evaluate(n => window.__retroTest.step(n), count);
const distance = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
async function start(page) {
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== new URL(base).origin) {
      externalRequests.push(route.request().url()); return route.abort();
    }
    return route.continue();
  });
  await page.goto(base + '/web/index.html?test');
  await page.waitForFunction(() => !!window.__retroTest);
  assert.equal(await page.locator('#error').isVisible(), false);
  await page.locator('.sound-label').click();
  assert.equal(await page.locator('#sound').isChecked(), false, 'sound label toggles audio');
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__retroTest.snapshot().state === 'playing');
  const initial = await snapshot(page);
  await step(page, 30);
  assert((await snapshot(page)).bots.some((b,i) => distance(b.pos,initial.bots[i].pos)>.2), 'bots navigate toward player');
  await page.evaluate(() => window.__retroTest.freezeBots());
}
async function desktop(browser) {
  const context = await browser.newContext({viewport:{width:960,height:640}});
  const page = await context.newPage();
  await start(page);
  await page.evaluate(() => window.__retroTest.setPosition(0,0,18));
  let before = await snapshot(page);
  await page.keyboard.down('w'); await step(page, 15); await page.keyboard.up('w');
  let after = await snapshot(page);
  assert(after.pos[2] < before.pos[2] - 1, 'W moves forward');
  await page.keyboard.down('Space'); await step(page, 5);
  assert((await snapshot(page)).pos[1] > .3, 'Space jumps');
  await page.keyboard.up('Space'); await step(page, 50);
  assert((await snapshot(page)).grounded, 'jump lands on ground');
  await page.keyboard.down('c'); await step(page, 1);
  assert((await snapshot(page)).crouch, 'C crouches');
  await page.keyboard.up('c'); await step(page, 1);
  assert(!(await snapshot(page)).crouch, 'release stands with headroom');
  // Perimeter wall is physical: repeated movement cannot leave the arena.
  await page.evaluate(() => window.__retroTest.setPosition(20,0,0));
  await page.keyboard.down('d'); await step(page, 90); await page.keyboard.up('d');
  assert((await snapshot(page)).pos[0] <= 21.201, 'wall prevents tunneling');
  await page.evaluate(() => window.__retroTest.setPosition(0,0,18));
  await step(page, 10);
  before = await snapshot(page);
  await page.locator('#game').dispatchEvent('mousedown', {button:0});
  await step(page, 10);
  await page.mouse.up();
  after = await snapshot(page);
  assert(after.ammo < before.ammo && after.shotCount > before.shotCount, 'fire consumes ammo');
  const total = after.ammo + after.reserve;
  await page.keyboard.press('r');
  assert((await snapshot(page)).reloading > 0, 'R begins timed reload');
  await step(page, 70);
  after = await snapshot(page);
  assert.equal(after.ammo,30,'reload fills rifle magazine');
  assert.equal(after.ammo+after.reserve,total,'reload conserves ammo');
  await page.keyboard.press('2'); await step(page,10);
  assert.equal((await snapshot(page)).slot,1,'number selects pistol');
  before = await snapshot(page);
  await page.locator('#game').dispatchEvent('mousedown',{button:0});
  await step(page,30); await page.mouse.up();
  assert.equal((await snapshot(page)).ammo,before.ammo-1,'held pistol fires once');
  // A complete down/up between simulation ticks must still generate one shot.
  await step(page, 10);
  before = await snapshot(page);
  await page.evaluate(() => {
    const canvas=document.getElementById('game');
    canvas.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}));
    window.dispatchEvent(new MouseEvent('mouseup',{button:0,bubbles:true}));
    window.__retroTest.step(1);
  });
  assert.equal((await snapshot(page)).shotCount,before.shotCount+1,'sub-tick click is buffered');
  await step(page, 10);
  before=await snapshot(page);
  await page.mouse.click(480,320,{delay:1});
  await page.waitForFunction(n=>window.__retroTest.snapshot().shotCount>n,before.shotCount);
  // Force the touch overlay on a hybrid Windows-style device, then use a real mouse.
  await step(page,10);
  await page.evaluate(()=>document.exitPointerLock());
  await page.waitForFunction(()=>window.__retroTest.snapshot().state==='paused');
  await page.evaluate(()=>{document.getElementById('game').requestPointerLock=()=>Promise.reject(new Error('test denied'));});
  await page.locator('#start').click();
  await page.waitForFunction(()=>window.__retroTest.snapshot().state==='playing');
  await page.evaluate(()=>document.body.classList.add('touch'));
  before=await snapshot(page);
  await page.mouse.click(650,160,{delay:1});
  await page.waitForFunction(n=>window.__retroTest.snapshot().shotCount>n,before.shotCount);
  await page.evaluate(()=>document.body.classList.remove('touch'));
  // Position a target in a clear lane and use the real input/fire path.
  await page.keyboard.press('4'); await step(page,10);
  await page.evaluate(() => {
    window.__retroTest.setPosition(0,0,18);
    window.__retroTest.positionBot(0,0,0,14);
    window.__retroTest.aimAtBot(0);
  });
  before = await snapshot(page);
  await page.locator('#game').dispatchEvent('mousedown',{button:0});
  await step(page,1); await page.mouse.up();
  assert.equal((await snapshot(page)).kills,before.kills+1,'hitscan kills the aimed target');
  // Central supply crate occludes the route to the north courtyard.
  await step(page,40);
  await page.evaluate(() => {
    window.__retroTest.setPosition(-2.3,0,6);
    window.__retroTest.positionBot(1,-2.3,0,-8);
    window.__retroTest.aimAtBot(1);
  });
  before = await snapshot(page);
  await page.locator('#game').dispatchEvent('mousedown',{button:0});
  await step(page,1); await page.mouse.up();
  assert.equal((await snapshot(page)).bots[1].health,before.bots[1].health,'cover blocks hitscan');
  await page.evaluate(() => window.__retroTest.damage(20));
  after = await snapshot(page);
  assert(after.health<100 && after.armor<50, 'damage consumes armor and health');
  await page.evaluate(() => window.__retroTest.damage(500));
  assert.equal((await snapshot(page)).health,0,'lethal damage kills player');
  await step(page,95);
  assert.equal((await snapshot(page)).health,100,'respawn restores player health');
  await page.evaluate(() => document.getElementById('pause-button').click());
  before = await snapshot(page);
  assert.equal(before.state,'paused');
  await page.waitForTimeout(200);
  assert.equal((await snapshot(page)).elapsed,before.elapsed,'pause stops simulation');
  assert(await page.locator('#menu').isVisible(),'pause menu visible');
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__retroTest.snapshot().state==='playing');
  await step(page,6000);
  assert.equal((await snapshot(page)).state,'ended','three-minute round ends');
  assert(await page.locator('#results').isVisible(),'end result is visible in menu');
  await page.locator('#start').click();
  assert((await snapshot(page)).elapsed<2,'restart resets clock');
  assert.equal((await snapshot(page)).kills,0,'restart resets score');
  console.log('PASS desktop: movement, collision, jump, crouch, weapons, reload, hits, cover, pause, restart');
  await context.close();
}
async function mobile(browser) {
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();
  await start(page);
  assert((await snapshot(page)).touch,'touch device detected');
  assert(await page.locator('#touch-controls').isVisible(),'touch controls visible');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile page fits horizontally');
  const cdp=await context.newCDPSession(page);
  const send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const point=(x,y)=>({x,y,id:1,radiusX:4,radiusY:4,force:1});
  const stick=await page.locator('#joystick').boundingBox();
  const center={x:stick.x+stick.width/2,y:stick.y+stick.height/2};
  await page.evaluate(()=>window.__retroTest.setPosition(0,0,18));
  let before=await snapshot(page);
  await send('touchStart',[point(center.x,center.y)]);
  await send('touchMove',[point(center.x,center.y-35)]);
  await step(page,15);
  await send('touchEnd',[]);
  assert((await snapshot(page)).pos[2]<before.pos[2]-1,'joystick moves player');
  await step(page,10);before=await snapshot(page);await step(page,10);
  assert(distance((await snapshot(page)).pos,before.pos)<.01,'joystick release stops movement');
  before=await snapshot(page);
  await send('touchStart',[point(550,140)]);
  await send('touchMove',[point(600,140)]);
  await send('touchEnd',[]);
  assert(Math.abs((await snapshot(page)).yaw-before.yaw)>.02,'right gesture rotates camera');
  const fire=await page.locator('[data-action="fire"]').boundingBox();
  before=await snapshot(page);
  await send('touchStart',[point(fire.x+fire.width/2,fire.y+fire.height/2)]);
  await step(page,10);
  await send('touchEnd',[]);
  assert((await snapshot(page)).ammo<before.ammo,'touch fire shoots');
  await page.locator('[data-action="reload"]').tap();
  assert((await snapshot(page)).reloading>0,'touch reload works');
  await page.locator('[data-action="switch"]').tap();
  assert.equal((await snapshot(page)).slot,1,'touch weapon switch works');
  await page.locator('#pause-button').tap();
  assert.equal((await snapshot(page)).state,'paused','touch pause works');
  console.log('PASS touch: layout, joystick, release, look, fire, reload, switch, pause');
  await context.close();
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {await desktop(browser);await mobile(browser);assert.deepEqual(errors,[],'no browser exceptions');assert.deepEqual(externalRequests,[],'all game assets are local');console.log('PASS self-contained assets and browser error checks');}
 finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
