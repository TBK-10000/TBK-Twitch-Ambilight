/* Real CSS/DOM regression fixture. Synthetic page, not live Twitch. */
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.TBK_EXTENSION_PATH||'..');
(async()=>{
 const browser=await chromium.launch({channel:'chromium',executablePath:process.env.TBK_BROWSER_EXECUTABLE||undefined,headless:true});
 try{
  const page=await browser.newPage();
  await page.setContent(`<style>body{background:white;color:white}.stream-chat{width:340px;height:650px;background:#18181b}.popup{background:#18181b;padding:16px}button{color:inherit}</style><aside class="stream-chat"><header class="stream-chat-header">Chat</header><div class="chat-room__content"><div class="chat-scrollable-area__message-container">Messages</div><div data-a-target="viewer-card" class="popup">User info</div><div data-a-target="chat-viewers-list" class="popup">Viewers</div><div class="chat-announcement popup">Announcement</div><div role="dialog" class="popup"><div class="popup">Dialog content</div></div></div></aside>`);
  await page.addStyleTag({path:path.join(root,'style.css')});
  for(const file of ['settings.js','chat.js']){
   let source=fs.readFileSync(path.join(root,'src',file),'utf8');
   if(process.argv.includes('--probe')&&file==='chat.js')source=source.replace("root.querySelectorAll('div,section,header,article')","[]");
   await page.addScriptTag({content:source});
  }
  await page.evaluate(()=>{window.backdrop=new TBK.ChatBackdrop();backdrop.reconcile({...TBK.normalize().base,enabled:true,chatEnabled:true});});
  for(const selector of ['[data-a-target="viewer-card"]','[data-a-target="chat-viewers-list"]','.chat-announcement','[role="dialog"] .popup']){
   const color=await page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor);
   assert.notEqual(color,'rgba(0, 0, 0, 0)',`${selector}: white text lost its opaque background`);
  }
  assert.equal(await page.locator('.stream-chat-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.evaluate(()=>backdrop.destroy());
  assert.equal(await page.locator('.tbk-chat-surface,.tbk-chat-widget-surface,.tbk-chat-root').count(),0);
  console.log('PASS Popup/announcement/viewer-list backgrounds remain readable; chat header and cleanup preserved');
  await page.addScriptTag({path:path.join(root,'src/windows.js')});
  await page.addStyleTag({content:'body.light{color:#18181b}body.light [role="dialog"] .popup{color:#18181b;background:white}'});
  await page.evaluate(()=>{window.surfaces=new TBK.WindowSurfaces();surfaces.reconcile({...TBK.normalize().base,enabled:true});document.body.classList.add('light');surfaces.reconcile({...TBK.normalize().base,enabled:true});});
  const bg=await page.locator('[role="dialog"]').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(bg,'rgb(245, 245, 248)','Light theme must refresh the background of an existing popup');
  await page.evaluate(()=>surfaces.destroy());assert.equal(await page.locator('.tbk-window-surface').count(),0);
  console.log('PASS Existing popup updates theme and releases all styles');
  await page.evaluate(()=>{const line=document.createElement('div');line.className='chat-line__message';line.innerHTML='<span class="text-fragment">Readable message</span>';document.querySelector('.stream-chat').append(line);backdrop.reconcile({...TBK.normalize().base,enabled:true,chatEnabled:true,chatColor:'#18181b',chatOpacity:85});});
  assert.equal(await page.locator('.chat-line__message .text-fragment').evaluate(el=>getComputedStyle(el).color),'rgb(239, 239, 241)','Dark chat tint must not leave light-theme black message text');
  await page.evaluate(()=>backdrop.destroy());assert.equal(await page.locator('.chat-line__message .text-fragment').evaluate(el=>getComputedStyle(el).color),'rgb(24, 24, 27)');
  console.log('PASS Chat text contrast adapts to dark tint and restores native theme on OFF');
  await page.evaluate(()=>{document.body.className='';document.body.style.background='#18181b';document.body.style.color='#efeff1';const s={...TBK.normalize().base,enabled:true,chatEnabled:true,chatOpacity:0,chatIntensity:0,frameLuma:1};backdrop.reconcile(s);const source=document.createElement('canvas');backdrop.draw(source,s,1000);});
  assert.equal(await page.locator('.chat-line__message .text-fragment').evaluate(el=>getComputedStyle(el).color),'rgb(239, 239, 241)','Invisible video must not turn text dark on native dark backdrop');
  console.log('PASS Zero-opacity layers retain readable text independent of invisible frame brightness');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
