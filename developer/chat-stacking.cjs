/* Pixel regression for Twitch's permanent, empty viewer-card overlay host. */
const {chromium}=require('playwright'),{PNG}=require('pngjs'),path=require('path'),fs=require('fs'),assert=require('node:assert/strict');const root=path.resolve(process.env.TBK_EXTENSION_PATH||'..'),out=path.resolve(process.env.TBK_TEST_OUTPUT||'../../../artifacts/chat-fix');fs.mkdirSync(out,{recursive:true});
const visibleMarker=buffer=>{const png=PNG.sync.read(buffer);let count=0;for(let i=0;i<png.data.length;i+=4)if(png.data[i]===17&&png.data[i+1]===255&&png.data[i+2]===31)count++;return count;};
(async()=>{
 const browser=await chromium.launch({channel:'chromium',headless:true,executablePath:process.env.TBK_BROWSER_EXECUTABLE||undefined});const report={browser:browser.version(),environment:'Real CSS/pixels, minimal native Twitch overlay structure',results:[]};
 try{
  // A block marker stays on integer pixels across platform font metrics.
  const page=await browser.newPage();await page.setContent('<style>body{margin:0;background:#18181b;color:#efeff1}.stream-chat{position:relative;width:340px;height:300px}.chat-room__content{position:relative;height:100%}.chat-room__viewer-card{position:absolute;inset:0;z-index:20;pointer-events:none}.chat-line__message{padding:20px}svg{display:block}</style><aside class="stream-chat"><div class="chat-room__content"><div class="chat-scrollable-area__message-container"><div class="chat-line__message"><svg width="20" height="20"><rect width="20" height="20" fill="rgb(17,255,31)"/></svg><span class="text-fragment">Visible chat message</span></div></div><div class="chat-room__viewer-card" data-a-target="viewer-card"></div></div></aside>');
  await page.addStyleTag({path:path.join(root,'style.css')});for(const file of ['settings.js','chat.js','windows.js'])await page.addScriptTag({path:path.join(root,'src',file)});
  const marker=page.locator('.chat-line__message svg'),before=visibleMarker(await marker.screenshot());
  await page.evaluate(()=>{window.windows=new TBK.WindowSurfaces();window.chat=new TBK.ChatBackdrop();const s={...TBK.normalize().base,enabled:true,chatEnabled:true};chat.reconcile(s);windows.reconcile(s);});const after=visibleMarker(await marker.screenshot());await page.screenshot({path:path.join(out,'minimal-stacking.png')});
  report.results.push({name:'Inactive viewer-card host must not cover messages or emotes',before,after,passed:before>350&&after===before});assert(before>350,'Baseline marker must be visibly painted');assert.equal(after,before,'Empty viewer-card host painted over chat message');
  for(const style of ['native','matte','refract']){
   await page.evaluate(style=>{const host=document.querySelector('.chat-room__viewer-card');host.innerHTML='<div data-a-target="chat-user-card" style="position:absolute;top:90px;padding:16px;color:#efeff1">User details</div>';windows.reconcile({...TBK.normalize().base,enabled:true,windowStyle:style});},style);
   assert.equal(await page.locator('.chat-room__viewer-card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');assert.equal(await page.locator('[data-a-target="chat-user-card"]').evaluate(el=>el.classList.contains('tbk-window-surface')),true);assert.equal(visibleMarker(await marker.screenshot()),before);
   report.results.push({name:'Actual user card styled without painting its full-size host: '+style,passed:true});console.log('PASS user card',style);
  }
  await page.evaluate(()=>{windows.destroy();chat.destroy();});assert.equal(await page.locator('.tbk-window-surface,.tbk-chat-surface,.tbk-chat-root').count(),0);assert.equal(visibleMarker(await marker.screenshot()),before);report.results.push({name:'OFF releases styles and retains message pixels',passed:true});console.log('PASS chat stacking and OFF');
 }catch(e){report.failure=e.message;throw e;}
 finally{fs.writeFileSync(path.join(out,'chat-stacking.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
