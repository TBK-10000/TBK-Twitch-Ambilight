/* Live-observed Twitch notice structure; anonymous content, real CSS and pixels. */
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.TBK_EXTENSION_PATH||'..');
const out=path.resolve(process.env.TBK_TEST_OUTPUT||'../../../artifacts/chat-notices-regression');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chromium',headless:true,executablePath:process.env.TBK_BROWSER_EXECUTABLE||undefined});
 const results=[],pass=name=>{results.push(name);console.log('PASS',name);};
 try{
  const page=await browser.newPage();
  await page.setContent(`<style>
   body{margin:0;background:#18181b;color:#efeff1}.stream-chat{position:relative;width:340px;height:420px}
   .chat-room__content{position:relative}.notice-stack{position:absolute;top:40px;left:20px;width:300px;z-index:10}
   .community-highlight{position:relative;height:80px;background:#18181b;color:#efeff1}
   .community-highlight-stack__backlog-card{position:absolute;top:8px;left:-4px;width:308px;height:80px;background:#18181b;color:#efeff1;z-index:-1}
   .highlight__header{height:80px;background:#18181b}.marker{position:absolute;top:12px;left:12px;width:10px;height:10px;background:white}
   .chat-list--default{height:360px}.chat-line__message-highlight{height:160px;background:linear-gradient(90deg,#ff0000 50%,#0000ff 50%)}
   .chat-input{height:60px;background:#18181b}button{background:#444;color:inherit}
   body.light{color:#0e0e10}.light .community-highlight,.light .community-highlight-stack__backlog-card{background:white;color:#0e0e10}
   .light .highlight__header{background:white}
   svg{display:block}
  </style><aside class="stream-chat"><div class="chat-room__content">
   <div class="notice-stack"><div class="community-highlight-stack__backlog-card"></div><div class="community-highlight-stack__card"><div class="tw-transition-group"><div class="tw-transition">
    <div class="community-highlight"><div class="dropsHighlight--fixture"><div class="highlight highlight__collapsed"><div class="highlight__header" data-test-selector="header-content"><span class="marker"></span><button id="notice-action">Drops</button><button class="ScButtonIcon-fixture" style="color:#0e0e10">Close</button><button id="primary-action" style="color:white;background:#9146ff">Watch</button></div></div></div></div>
   </div></div></div></div>
   <div class="chat-list--default"><div data-a-target="chat-scroller"><div class="chat-scrollable-area__message-container"><div class="chat-line__message"><div class="chat-line__message-highlight"><span class="text-fragment">Ordinary message</span></div></div></div></div></div>
   <div class="chat-input"></div><div class="chat-room__viewer-card" data-a-target="viewer-card"></div>
  </div></aside>`);
  await page.addStyleTag({path:path.join(root,'style.css')});
  for(const name of ['settings.js','chat.js','windows.js'])await page.addScriptTag({path:path.join(root,'src',name)});
  await page.evaluate(()=>{
   window.chat=new TBK.ChatBackdrop();window.windows=new TBK.WindowSurfaces();
   window.options={...TBK.normalize().base,enabled:true,chatEnabled:true,chatColor:'#234c7d',chatOpacity:100,chatIntensity:0,chatGrain:0,windowStyle:'native'};
   window.refresh=()=>{chat.reconcile(options);windows.reconcile(options);};refresh();
   document.querySelector('#notice-action').onclick=()=>window.clicked=true;
  });
  const background=selector=>page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor);
  const colour=selector=>page.locator(selector).evaluate(el=>getComputedStyle(el).color);
  const pixels=async()=>PNG.sync.read(await page.locator('.community-highlight').screenshot());
  const rgb=(png,x,y)=>[...png.data.slice((y*png.width+x)*4,(y*png.width+x)*4+3)];
  assert.equal(await background('.community-highlight'),'rgb(35, 76, 125)','Drops must share chat colour over an opaque background');
  let png=await pixels();assert.deepEqual(rgb(png,60,60),[35,76,125]);assert.deepEqual(rgb(png,230,60),[35,76,125]);
  assert.deepEqual(rgb(png,16,16),[255,255,255]);pass('Drops covers messages while foreground stays sharp');
  assert.equal(await colour('.ScButtonIcon-fixture'),'rgb(239, 239, 241)');assert.equal(await colour('#primary-action'),'rgb(255, 255, 255)');assert.equal(await background('#primary-action'),'rgb(145, 70, 255)');pass('Icon controls follow contrast while primary button colours remain native');
  assert.equal(await background('.community-highlight-stack__backlog-card'),'rgb(35, 76, 125)');
  assert.equal(await page.locator('.notice-stack').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
  assert.equal(await page.locator('.chat-room__viewer-card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');pass('Backlog retains a background without painting empty overlay hosts');
  await page.locator('#notice-action').click();assert.equal(await page.evaluate(()=>window.clicked),true);pass('Notification controls remain clickable');
  await page.evaluate(()=>{
   const card=document.querySelector('.community-highlight');card.className='community-highlight';
   card.innerHTML='<div class="pinned-chat__highlight-card"><div class="highlight"><div class="highlight__header"><div class="pinned-chat__scrollable-area"><p class="pinned-chat__message">Pinned message</p><span class="marker"></span></div></div></div></div>';refresh();
  });
  assert.equal(await background('.community-highlight'),'rgb(35, 76, 125)');pass('Dynamically replaced pinned card retains a readable background');
  for(const theme of ['dark','light'])for(const style of ['native','matte','refract']){
   await page.evaluate(({theme,style})=>{document.body.className=theme==='light'?'light':'';Object.assign(options,{windowStyle:style,windowOpacity:75,windowBlur:20});refresh();},{theme,style});
   const expected='rgb(239, 239, 241)';
   assert.equal(await colour('.community-highlight'),expected);assert.equal(await colour('.pinned-chat__message'),expected);
   assert.notEqual(await background('.community-highlight'),'rgba(0, 0, 0, 0)');
   const filter=await page.locator('.community-highlight').evaluate(el=>getComputedStyle(el).backdropFilter);
   assert.equal(filter,'none','Chat notices must use chat styling instead of window glass');
   png=await pixels();assert.deepEqual(rgb(png,16,16),[255,255,255],'Notice foreground must not be blurred');
  }pass('Chat styling takes precedence over all window styles in either Twitch theme');
  await page.evaluate(()=>{Object.assign(options,{chatColor:'#ffffff',chatGrain:20,chatBlur:8});refresh();});
  assert.equal(await colour('.pinned-chat__message'),'rgb(24, 24, 27)');
  assert.equal(await background('.community-highlight'),'rgb(255, 255, 255)');
  assert.equal(await page.locator('.community-highlight .tbk-chat-grain').evaluate(el=>getComputedStyle(el).opacity),'0.06');
  assert.equal(await page.locator('.community-highlight canvas').evaluate(el=>getComputedStyle(el).filter),'blur(8px)');pass('Chat colour, contrast, blur and grain update together');
  await page.evaluate(()=>{
   Object.assign(options,{chatColor:'#234c7d',chatOpacity:0,chatIntensity:0,chatBlur:0,chatGrain:0});refresh();
  });
  png=await pixels();assert.deepEqual(rgb(png,60,60),[35,76,125]);assert.deepEqual(rgb(png,230,60),[35,76,125]);pass('Zero chat opacity still blocks underlying messages');
  await page.evaluate(()=>{
   Object.assign(options,{chatIntensity:100,chatSmoothness:0});refresh();
   window.frame=document.createElement('canvas');frame.width=640;frame.height=360;frame.getContext('2d').fillStyle='#ff0000';frame.getContext('2d').fillRect(0,0,640,360);chat.draw(frame,{...options,frameLuma:.2126},1000);
  });
  png=await pixels();assert.deepEqual(rgb(png,60,60),[255,0,0]);assert.deepEqual(rgb(png,230,60),[255,0,0]);
  await page.evaluate(()=>{frame.getContext('2d').fillStyle='#0000ff';frame.getContext('2d').fillRect(0,0,640,360);chat.draw(frame,{...options,frameLuma:.0722},2000);});
  png=await pixels();assert.deepEqual(rgb(png,60,60),[0,0,255]);assert.deepEqual(rgb(png,16,16),[255,255,255]);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelector('.community-highlight canvas').getContext('2d').getImageData(0,0,1,1).data]),await page.evaluate(()=>[...chat.ctx.getImageData(0,0,1,1).data]));pass('Notice lighting reuses the smoothed chat frame without blurring foreground');
  await page.evaluate(()=>{const popup=document.createElement('div');popup.role='menu';popup.style.cssText='background:#18181b;color:#efeff1';popup.textContent='Notice action menu';document.querySelector('.community-highlight').append(popup);refresh();});
  assert.equal(await page.locator('[role="menu"]').evaluate(el=>el.classList.contains('tbk-window-surface')),true);
  assert.notEqual(await background('[role="menu"]'),'rgba(0, 0, 0, 0)');
  assert.equal(await page.locator('[role="menu"]').evaluate(el=>el.classList.contains('tbk-chat-notice-clear')),false);pass('Nested popup menus retain their separate readable window style');
  await page.evaluate(()=>{document.querySelector('.community-highlight').remove();refresh();});assert.equal(await page.locator('.tbk-chat-notice').count(),1);
  await page.evaluate(()=>{const card=document.createElement('div');card.className='community-highlight';card.innerHTML='<div class="highlight__header"><p class="pinned-chat__message">New pinned message</p></div>';document.querySelector('.tw-transition').append(card);refresh();refresh();});
  assert.equal(await page.locator('.community-highlight .tbk-chat-notice-backdrop').count(),1);pass('Removed and newly mounted cards clean up and keep a single backdrop');
  await page.evaluate(()=>{options.chatEnabled=false;refresh();});
  assert.equal(await page.locator('.tbk-chat-notice-backdrop').count(),0);
  assert.notEqual(await background('.community-highlight'),'rgba(0, 0, 0, 0)');
  assert.equal(await page.locator('.community-highlight').evaluate(el=>getComputedStyle(el).backdropFilter.includes('url(')),true);pass('Disabling chat restores the selected window style');
  await page.evaluate(()=>{chat.destroy();options.enabled=false;windows.reconcile(options);});
  assert.equal(await page.locator('[class*="tbk-chat"],[class*="tbk-window"]').count(),0);assert.equal(await background('.community-highlight'),'rgb(255, 255, 255)');
  assert.equal(await colour('.pinned-chat__message'),'rgb(14, 14, 16)');pass('OFF restores native notice background and text');
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results},null,2));await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
