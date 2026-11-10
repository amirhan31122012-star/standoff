/* Run against the same local server as test-web.cjs, with Playwright installed. */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.WEB_BASE_URL||'http://127.0.0.1:8080';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const test of [
   {name:'WebGL1 fallback',deny:['webgl2'],query:'test',api:'webgl'},
   {name:'no WebGL',deny:['webgl2','webgl','experimental-webgl'],query:'test',api:null},
   {name:'compatible mode',deny:[],query:'test&graphics=low',api:'webgl'}
  ]){
   const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
   await context.addInitScript(deny=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...rest){if(deny.includes(kind))return null;return original.call(this,kind,...rest);};
   },test.deny);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.goto(base+'/web/index.html?'+test.query);
   await page.waitForFunction(()=>!!window.__retroGraphicsStatus);
   const info=await page.evaluate(()=>window.__retroGraphicsStatus);
   assert.equal(info.api,test.api);
   if(!test.api){assert(await page.locator('#error').isVisible());assert(await page.locator('#start').isDisabled());assert(await page.locator('.graphics-retry').first().getAttribute('href').then(h=>h.includes('graphics=low')));assert(!await page.evaluate(()=>!!window.__retroTest));}
   else{
    assert(info.low);await page.locator('#start').click();await page.waitForFunction(()=>window.__retroTest?.snapshot().elapsed>.1);
    assert.equal((await page.evaluate(()=>window.__retroTest.snapshot())).state,'playing');
    assert.equal(await page.locator('#error').isVisible(),false);
    // Real WebGL1 renderer must produce a frame with the current PBR shaders.
    await page.waitForFunction(()=>window.__retroTest.snapshot().drawCalls>0);
   }
   assert.deepEqual(errors,[]);console.log('PASS '+test.name);await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
