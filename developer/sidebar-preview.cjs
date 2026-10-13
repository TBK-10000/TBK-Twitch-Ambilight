/* Native-observed sidebar preview portal: actual panel inside a zero-size dialog host. */
const {chromium}=require('playwright'),{PNG}=require('pngjs'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.TBK_EXTENSION_PATH||'..'),out=path.resolve(process.env.TBK_TEST_OUTPUT||'../../../artifacts/sidebar-preview-regression');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chromium',headless:true,executablePath:process.env.TBK_BROWSER_EXECUTABLE||undefined});
 const results=[],pass=name=>{results.push(name);console.log('PASS',name);};
 try{
  const page=await browser.newPage();
  await page.setContent(`<style>
   body{margin:0;color:#0e0e10;background:linear-gradient(90deg,#000 50%,#fff 50%);width:600px;height:300px}
   .side-nav-card{width:80px;height:40px;background:#eee}.react-modal__content{position:fixed;left:0;top:0;width:0;height:0}
   .preview-panel{position:fixed;left:200px;top:80px;width:200px;height:90px;background-color:var(--color-background-float,white)!important;color:#0e0e10;border-radius:6px}
   .online-side-nav-channel-tooltip__body{padding:8px}.preview-title{color:var(--color-text-base,#0e0e10)}
   .marker{position:absolute;left:12px;top:40px;width:8px;height:8px;background:#00ff00}
   body.dark{color:#efeff1;--color-background-float:#18181b}.dark .preview-panel{color:#efeff1}.dark .preview-title{--color-text-base:#efeff1}
  </style><nav><a class="side-nav-card" href="#channel">Channel</a></nav><div class="tw-dialog-layer"><div class="react-modal__overlay"><div class="react-modal__content" role="dialog"><div class="tw-transition"><div><div class="preview-panel"><div><div class="online-side-nav-channel-tooltip__body"><p class="preview-title">Stream title</p><span class="marker"></span></div></div></div></div></div></div></div></div><div id="ordinary-popup" role="dialog" style="position:absolute;left:500px;top:200px;width:80px;height:40px;background:#18181b;color:#efeff1">Other popup</div>`);
  await page.addStyleTag({path:path.join(root,'style.css')});
  // Twitch injects its important background rule after manifest CSS.
  await page.addStyleTag({content:'.preview-panel{background-color:var(--color-background-float,white)!important}'});
  for(const name of ['settings.js','windows.js'])await page.addScriptTag({path:path.join(root,'src',name)});
  await page.evaluate(()=>{window.windows=new TBK.WindowSurfaces();window.options={...TBK.normalize().base,enabled:true,windowStyle:'matte',windowOpacity:85,windowBlur:18};windows.reconcile(options);});
  const bg=()=>page.locator('.preview-panel').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(await bg(),'rgba(245, 245, 248, 0.85)','Preview panel must retain its glass background over the stream');
  let png=PNG.sync.read(await page.locator('.preview-panel').screenshot({path:path.join(out,'preview.png')}));
  const rgb=(x,y)=>[...png.data.slice((y*png.width+x)*4,(y*png.width+x)*4+3)];
  assert(rgb(30,70)[0]>190,'Glass must cover dark content below');assert.deepEqual(rgb(15,43),[0,255,0],'Foreground must stay sharp');pass('Preview has a translucent readable background over the stream');
  assert.equal(await page.locator('.react-modal__content').evaluate(el=>el.classList.contains('tbk-window-surface')),false,'Empty dialog host must not be painted');
  assert.equal(await page.locator('.side-nav-card').evaluate(el=>el.classList.contains('tbk-window-surface')),false);pass('Only the actual preview panel is styled');
  assert.equal(await page.locator('#ordinary-popup').evaluate(el=>el.classList.contains('tbk-window-surface')&&!el.classList.contains('tbk-sidebar-preview')),true);pass('Ordinary popup dialogs retain their existing window styling');
  for(const theme of ['dark','light'])for(const style of ['native','matte','refract']){
   await page.evaluate(({theme,style})=>{document.body.className=theme==='dark'?'dark':'';options.windowStyle=style;windows.reconcile(options);},{theme,style});
   const fg=theme==='dark'?'rgb(239, 239, 241)':'rgb(24, 24, 27)';
   assert.equal(await page.locator('.preview-title').evaluate(el=>getComputedStyle(el).color),fg);
   const filter=await page.locator('.preview-panel').evaluate(el=>getComputedStyle(el).backdropFilter);assert.equal(filter.includes('blur(18px)'),style!=='native');assert.equal(filter.includes('url('),style==='refract');
   assert.notEqual(await bg(),'rgba(0, 0, 0, 0)');
  }pass('Title contrast and all window styles work in both themes');
  await page.evaluate(()=>{const panel=document.querySelector('.preview-panel');panel.className='preview-panel';windows.reconcile(options);windows.reconcile(options);});
  assert.equal(await page.locator('.tbk-sidebar-preview').count(),1);pass('React class replacement recovers a single preview surface');
  assert.equal(await page.evaluate(async()=>{let count=0;const observer=new MutationObserver(records=>count+=records.length);observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});windows.reconcile(options);windows.reconcile(options);await Promise.resolve();observer.disconnect();return count;}),0);pass('Stable reconciliation does not feed repeated class mutations');
  await page.evaluate(()=>{document.querySelector('.preview-panel').remove();windows.reconcile(options);});
  assert.equal(await page.locator('.react-modal__content').evaluate(el=>el.classList.contains('tbk-window-surface')),false);pass('Empty preview portal remains transparent after hover closes');
  await page.evaluate(()=>{const panel=document.createElement('div');panel.className='preview-panel';panel.innerHTML='<div><div class="online-side-nav-channel-tooltip__body"><p class="preview-title">Next stream</p></div></div>';document.querySelector('.react-modal__content').append(panel);windows.reconcile(options);});assert.notEqual(await bg(),'rgba(0, 0, 0, 0)');pass('Next hover creates a readable preview');
  await page.evaluate(()=>{const body=document.createElement('div');body.className='online-side-nav-channel-tooltip__body fallback';body.textContent='Standalone preview';document.body.append(body);windows.reconcile(options);});
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('tbk-window-surface')),false);assert.equal(await page.locator('.fallback').evaluate(el=>el.classList.contains('tbk-sidebar-preview')),true);pass('Unknown portal structure never styles the entire page');
  await page.evaluate(()=>{options.enabled=false;windows.reconcile(options);});assert.equal(await page.locator('.tbk-window-surface,.tbk-window-clear,.tbk-glass-filter').count(),0);assert.equal(await bg(),'rgb(255, 255, 255)');pass('OFF restores native preview and removes all glass styles');
 }finally{fs.writeFileSync(path.join(out,'sidebar-preview.json'),JSON.stringify({results},null,2));await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
