const {chromium}=require('playwright');
const path=require('path'),fs=require('fs'),assert=require('assert');
const extension=path.resolve(process.env.TBK_EXTENSION_PATH||'..'),out=path.resolve(process.env.TBK_TEST_OUTPUT||'.');fs.mkdirSync(out,{recursive:true});
const fixture=`<!doctype html><html><head><style>body{background:#101014;color:white;margin:0} .video-player{position:relative;margin:100px 20px;width:calc(100% - 300px);max-width:800px;height:450px;background:#000}.video-player video{width:100%;height:100%;object-fit:contain}.player-controls__right-control-group{position:absolute;bottom:8px;right:8px;display:flex;z-index:20}.theater{width:calc(100% - 300px);max-width:1000px;height:562px}.video-player:fullscreen{width:100%;height:100%;margin:0}</style></head><body><div class="video-player" data-a-target="player"><video muted autoplay playsinline></video><div class="player-controls__right-control-group" data-a-target="player-controls__right-control-group"><button id="fs">Full screen</button></div></div><aside class="chat-room" style="position:absolute;right:0;top:0;width:260px;height:700px;background:#18181b"><div class="chat-room__content"><div class="chat-scrollable-area__message-container"><p id="message">Readable chat</p></div><div class="chat-input"><input aria-label="Fixture chat input"></div></div></aside><script>
window.color='rgb(230,40,20)';const source=document.createElement('canvas');source.width=640;source.height=360;const ctx=source.getContext('2d');function paint(){ctx.fillStyle=window.color;ctx.fillRect(0,0,640,360);ctx.fillStyle='#000';ctx.fillRect(0,0,640,35);ctx.fillRect(0,325,640,35);requestAnimationFrame(paint)}paint();window.stream=source.captureStream(30);document.querySelector('video').srcObject=stream;document.querySelector('#fs').onclick=()=>document.querySelector('.video-player').requestFullscreen();
</script></body></html>`;
(async()=>{
 const results=[],errors=[];
 const context=await chromium.launchPersistentContext(path.join(out,'test-profile-'+Date.now()),{channel:'chromium',executablePath:process.env.TBK_BROWSER_EXECUTABLE||undefined,headless:true,viewport:{width:1280,height:850},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  await context.route('https://www.twitch.tv/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
  await context.route('https://player.twitch.tv/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page),contexts=[];
  cdp.on('Runtime.executionContextCreated',e=>contexts.push(e.context));await cdp.send('Runtime.enable');
  await page.goto('https://www.twitch.tv/tbk-fixture');
  await page.waitForSelector('.tbk-ambilight-gear');
  let isolated;
  async function locate(){for(const c of contexts){try{const r=await cdp.send('Runtime.evaluate',{contextId:c.id,expression:'typeof TBK',returnByValue:true});if(r.result.value==='object')isolated=c.id;}catch{}}assert(isolated,'MV3 isolated world');}
  await locate();
  const run=async expression=>{const r=await cdp.send('Runtime.evaluate',{contextId:isolated,expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+JSON.stringify(r.exceptionDetails.exception));return r.result.value;};
  const openSettings=async()=>{await page.locator('.tbk-ambilight-gear').click();await page.locator('details[data-section]').evaluateAll(items=>items.forEach(d=>d.open=true));};
  const diag=()=>run('__tbkTwitchAmbilight.engine.diagnostics()');
  const wait=async(fn)=>{for(let i=0;i<50;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out');};
  const check=(name,details)=>{results.push({name,passed:true,details});console.log('PASS',name,details||'');};
  await wait(async()=>(await diag()).frames>10);check('MV3 extension injection + captureStream rendering',await diag());
  assert.equal(await page.locator('.tbk-ambilight-gear').count(),1);
  await openSettings();await page.getByRole('dialog').waitFor({state:'visible'});check('Gear opens native shadow panel');await page.locator('details[data-section]').evaluateAll(items=>items.forEach(d=>d.open=true));
  await page.getByLabel('Рендерер',{exact:true}).selectOption('canvas');await wait(async()=>(await diag()).renderer==='Canvas 2D');
  await wait(async()=>(await diag()).crop[1]>0);check('Canvas2D and stable bar detection',await diag());
  const pixel=()=>run('Array.from(__tbkTwitchAmbilight.engine.ctx.getImageData(200,80,1,1).data)');
  const red=await pixel();await page.evaluate(()=>window.color='rgb(20,40,230)');await page.waitForTimeout(1100);const blue=await pixel();assert(red[0]>red[2]&&blue[2]>blue[0]);check('Actual frame colors and temporal smoothing',{red,blue});
  await page.getByLabel('Расширение включено',{exact:true}).uncheck();assert.equal((await diag()).pendingCallbacks,0);assert.equal(await page.locator('.tbk-ambilight-gear').count(),1);
  await page.getByLabel('Расширение включено',{exact:true}).check();check('Disable/enable keeps gear; stops callback');
  await page.getByLabel('Оформление чата включено',{exact:true}).check();
  await wait(async()=>await page.locator('.tbk-chat-backdrop').count()===1);
  await wait(async()=>(await diag()).chat.hasFrame);
  assert.equal(await page.locator('#message').evaluate(el=>getComputedStyle(el).opacity),'1');
  assert.equal(await page.locator('#message').evaluate(el=>getComputedStyle(el).filter),'none');
  await page.getByLabel('Непрозрачность фона чата',{exact:true}).fill('100');
  assert.equal(await page.locator('.tbk-chat-tint').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(24, 24, 27)');
  await page.getByLabel('Расширение включено',{exact:true}).uncheck();assert.equal((await diag()).pendingCallbacks,0);assert.equal(await page.locator('.tbk-chat-backdrop').count(),0);
  await page.getByLabel('Оформление чата включено',{exact:true}).uncheck();assert.equal(await page.locator('.tbk-chat-backdrop').count(),0);assert.equal((await diag()).pendingCallbacks,0);
  await page.getByLabel('Расширение включено',{exact:true}).check();check('Full OFF restores chat, tint opacity, sharp text and cleanup');
  await page.getByLabel('Яркость',{exact:true}).fill('137');await run('__tbkTwitchAmbilight.settings.flush()');
  await page.keyboard.press('Escape');assert(await page.getByRole('dialog').isHidden());check('Escape closes panel');
  await page.evaluate(()=>document.querySelector('video').pause());await page.waitForTimeout(200);assert.equal((await diag()).pendingCallbacks,0);
  await page.evaluate(()=>document.querySelector('video').play());await wait(async()=>(await diag()).pendingCallbacks===1);check('Pause cancels loop and play resumes one callback');
  await page.evaluate(()=>{history.pushState({},'','/videos/123-fixture');const old=document.querySelector('video'),v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;v.srcObject=stream;old.replaceWith(v);v.play();});
  await wait(async()=>(await diag()).route==='/videos/123-fixture');assert.equal(await page.locator('.tbk-ambilight-glow').count(),1);assert.equal(await page.locator('.tbk-ambilight-gear').count(),1);check('SPA + replacement video: exactly one engine/overlay',await diag());
  await page.evaluate(()=>document.querySelector('.player-controls__right-control-group').remove());await page.waitForTimeout(300);assert(await page.locator('.tbk-ambilight-gear').getAttribute('data-fallback')!==null);
  await page.evaluate(()=>{const d=document.createElement('div');d.className='player-controls__right-control-group';document.querySelector('.video-player').append(d);});await page.waitForTimeout(300);assert(await page.locator('.player-controls__right-control-group .tbk-ambilight-gear').count());check('Controls replacement and fallback migration');
  await page.evaluate(()=>document.querySelector('.video-player').classList.add('persistent-player--theatre','theater'));await wait(async()=>(await diag()).mode==='theater');
  await openSettings();await page.getByLabel('Яркость',{exact:true}).fill('95');await run('__tbkTwitchAmbilight.settings.flush()');assert.equal(await run('__tbkTwitchAmbilight.settings.effective("normal").brightness'),137);check('Independent theater profile');
  await page.keyboard.press('Escape');await page.evaluate(()=>document.querySelector('.video-player').requestFullscreen());await wait(async()=>(await diag()).mode==='fullscreen');
  await openSettings();await page.getByLabel('Уменьшение видео для полей',{exact:true}).fill('10');
  const box=await page.getByRole('dialog').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=1281&&box.y+box.height<=851);assert(await page.evaluate(()=>document.fullscreenElement.contains(document.querySelector('.tbk-ambilight-glow'))));check('Fullscreen panel bounds and glow host',box);
  await page.screenshot({path:'fullscreen.png'});
  await page.getByLabel('Рендерер',{exact:true}).selectOption('webgl');await wait(async()=>(await diag()).renderer==='WebGL');check('Real WebGL context draws',await diag());
  await run('__tbkTwitchAmbilight.engine.renderer.projector.gl.getExtension("WEBGL_lose_context").loseContext()');await wait(async()=>(await diag()).renderer==='Canvas 2D');assert((await diag()).warning);check('WebGL context-loss fallback uses fresh canvas',await diag());
  // Simulate browser readback denial; this verifies handling, not actual Twitch CORS policy.
  await run('__tbkTwitchAmbilight.engine.probe.sample=()=>{throw new DOMException("Test blocked read","SecurityError")};__tbkTwitchAmbilight.engine.refresh()');
  assert((await diag()).error.includes('CORS'));assert.equal((await diag()).pendingCallbacks,0);await page.getByRole('button',{name:'Повторить запуск'}).click();await wait(async()=>(await diag()).frames>2&&!(await diag()).error);check('SecurityError stops loop; explicit retry recovers');
  await page.evaluate(()=>document.exitFullscreen());await page.waitForTimeout(250);await run('__tbkTwitchAmbilight.settings.flush()');
  await page.reload();await page.waitForSelector('.tbk-ambilight-gear');await locate();assert.equal(await run('__tbkTwitchAmbilight.settings.effective("normal").brightness'),137);assert.equal(await run('__tbkTwitchAmbilight.settings.effective("theater").brightness'),95);check('chrome.storage.local survives reload');
  await openSettings();await page.screenshot({path:'settings.png'});await page.keyboard.press('Escape');
  const oldDraws=(await diag()).frames;await page.waitForTimeout(5000);assert((await diag()).frames>oldDraws);assert.equal((await diag()).pendingCallbacks,1);assert.equal(await page.locator('.tbk-ambilight-glow').count(),1);check('5-second loop stability',await diag());
  await page.evaluate(()=>document.querySelector('.video-player').remove());await page.waitForTimeout(300);assert.equal(await page.locator('.tbk-ambilight-glow').count(),0);assert.equal(await run('__tbkTwitchAmbilight.engine'),null);check('Player removal cleanup');
  // Cross-origin player frame: real manifest all_frames injection, no page-side fake API.
  await page.goto('https://www.twitch.tv/embed-fixture');await page.evaluate(()=>{document.querySelector('.video-player').remove();const f=document.createElement('iframe');f.src='https://player.twitch.tv/?channel=fixture&parent=www.twitch.tv';f.style='width:1100px;height:750px';document.body.append(f);});
  const frame=page.frameLocator('iframe');await frame.locator('.tbk-ambilight-gear').waitFor();await frame.locator('.tbk-ambilight-gear').click();await frame.getByRole('dialog').waitFor({state:'visible'});check('Actual all_frames injection into cross-origin player.twitch.tv fixture');
  assert.deepEqual(errors,[]);check('No uncaught page JS errors');
 }catch(e){results.push({name:'FAIL',passed:false,error:e.stack});console.error(e);process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({browser:context.browser()?.version(),executable:process.env.TBK_BROWSER_EXECUTABLE||'Playwright Chromium',extension,environment:'Actual unpacked MV3 extension, synthetic Twitch-shaped pages fulfilled locally. Not live Twitch.',results,errors},null,2));await context.close();}
})();
