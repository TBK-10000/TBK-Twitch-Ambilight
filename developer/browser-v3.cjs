/* Actual unpacked MV3. Synthetic pages, separate disposable profile. */
const {chromium}=require('playwright'),path=require('path'),fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto');
const fixture=require('./fixture-v3.cjs');
const browserName=process.env.TBK_BROWSER_NAME||(process.env.TBK_BROWSER_EXECUTABLE?'opera':'chromium');if(!/^[a-z0-9-]+$/.test(browserName))throw Error('Invalid browser report name');const out=path.resolve(process.env.TBK_TEST_OUTPUT||'../../../artifacts/v3');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const extension=path.resolve(process.env.TBK_EXTENSION_PATH||'..');
 const context=await chromium.launchPersistentContext(path.join(out,'profile-'+Date.now()),{channel:'chromium',executablePath:process.env.TBK_BROWSER_EXECUTABLE||undefined,headless:true,viewport:{width:1280,height:850},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[],errors=[],check=(name,details)=>{results.push({name,passed:true,details});console.log('PASS',name);};
 try{
  await context.route('https://www.twitch.tv/**',r=>r.fulfill({contentType:'text/html',body:fixture}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  const cdp=await context.newCDPSession(page),contexts=[];cdp.on('Runtime.executionContextCreated',e=>contexts.push(e.context));await cdp.send('Runtime.enable');await cdp.send('Performance.enable');
  await page.goto('https://www.twitch.tv/tbk-v3-fixture');await page.locator('.tbk-ambilight-gear').waitFor();
  let isolated;for(const c of contexts){try{const r=await cdp.send('Runtime.evaluate',{contextId:c.id,expression:'typeof TBK',returnByValue:true});if(r.result.value==='object')isolated=c.id;}catch{}}
  assert(isolated,'Actual extension isolated world');
  const run=async expression=>{const r=await cdp.send('Runtime.evaluate',{contextId:isolated,expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const diag=()=>run('__tbkTwitchAmbilight.engine.diagnostics()');
  const wait=async fn=>{for(let i=0;i<60;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Condition timed out');};
  await wait(async()=>(await diag()).frames>5);
  const power=page.getByRole('switch',{name:'Включить расширение TBK',exact:true});await power.click();assert.equal(await power.getAttribute('aria-checked'),'false');assert.equal((await diag()).pendingCallbacks,0);await power.click();check('One-click full OFF/ON and persistent settings access');
  await page.locator('.tbk-ambilight-gear').click();assert.equal(await page.locator('details[data-section][open]').count(),0);await page.locator('details[data-section]').evaluateAll(ds=>ds.forEach(d=>d.open=true));check('Themed sections initially collapsed and accessible');
  await page.getByLabel('Яркость',{exact:true}).fill('137');await page.getByRole('button',{name:'Добавить пресет'}).click();
  await page.getByRole('switch',{name:'Включить пресет Пресет 1'}).check();await page.getByLabel('Яркость',{exact:true}).fill('115');
  await page.locator('.preset-block').getByRole('button',{name:'Переименовать'}).click();await page.getByLabel('Название пресета Пресет 1').fill('Вечер');await page.getByLabel('Название пресета Пресет 1').press('Enter');
  assert.equal(await page.getByRole('switch',{name:'Включить пресет Вечер'}).count(),1);
  const presetSwitch=page.getByRole('switch',{name:'Включить пресет Вечер'});await presetSwitch.focus();await page.keyboard.press('Space');assert.equal(await page.locator('.tbk-ambilight-ui').evaluate(el=>el.shadowRoot.activeElement?.getAttribute('role')),'switch');await page.keyboard.press('Space');check('Preset keyboard toggle retains focus');
  await page.getByRole('button',{name:'Добавить пресет'}).click();assert.equal(await page.locator('.preset-block').count(),2);check('Add, activate, rename and autosave preset using UI');
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.locator('.preset-block').first().getByRole('button',{name:'Копировать',exact:true}).click();await page.waitForTimeout(100);await page.locator('.preset-block').last().getByRole('button',{name:'Вставить',exact:true}).click();await page.waitForTimeout(100);assert.equal(await run('__tbkTwitchAmbilight.settings.data.presets[1].base.brightness'),115);assert.equal(await run('__tbkTwitchAmbilight.settings.data.presets[1].name'),'Пресет 2');check('Clipboard copies parameters into another preset without renaming it');
  await page.locator('.preset-block').last().getByRole('button',{name:'Переименовать'}).click();await page.getByLabel('Название пресета Пресет 2').fill('Копия');await page.locator('.preset-block').last().getByRole('button',{name:'Удалить'}).click();assert.equal(await page.locator('.preset-block').count(),1);check('Rename blur does not swallow adjacent Delete click');
  await page.getByLabel('Экономичный режим',{exact:true}).check();assert.equal((await diag()).economy,true);assert.equal(await run('__tbkTwitchAmbilight.settings.effective("normal").layers'),1);
  await page.getByRole('button',{name:'Редактировать экономичный режим',exact:true}).click();await page.getByLabel('Яркость',{exact:true}).fill('90');assert.equal((await diag()).economy,true);await page.getByRole('button',{name:'Завершить редактирование экономии'}).click();await page.getByLabel('Экономичный режим',{exact:true}).uncheck();assert.equal(await page.getByLabel('Яркость',{exact:true}).inputValue(),'115');
  await page.getByLabel('Экономичный режим',{exact:true}).check();await page.getByLabel('Яркость',{exact:true}).fill('120');assert.equal((await diag()).economy,false);check('Economy edit mode, restore, and automatic exit on ordinary parameter change');
  await page.getByLabel('Оформление чата включено',{exact:true}).check();await wait(async()=>await page.locator('.tbk-chat-backdrop').count()===1);
  for(const selector of ['[data-a-target="viewer-card"]','[data-a-target="chat-viewers-list"]','.chat-announcement'])assert.notEqual(await page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.getByLabel('Стиль окон',{exact:true}).selectOption('matte');await wait(async()=>await page.locator('[role="menu"]').evaluate(el=>getComputedStyle(el).backdropFilter.includes('blur')));
  const menu=page.locator('[role="menu"]');await page.evaluate(()=>document.querySelector('video').pause());await page.keyboard.press('Escape');
  const matte=await menu.screenshot({path:path.join(out,'glass-matte.png')});assert.equal(await menu.locator('button').evaluate(el=>getComputedStyle(el).filter),'none');
  await run('__tbkTwitchAmbilight.settings.change("windowStyle","refract")');await page.waitForTimeout(200);const refract=await menu.screenshot({path:path.join(out,'glass-refract.png')});assert.notDeepEqual(matte,refract,'Refraction changes actual composited pixels');check('Readable popups and real backdrop refraction, text remains sharp');
  await power.click();assert.equal(await page.locator('.tbk-window-surface,.tbk-window-clear,.tbk-chat-root,.tbk-foreground-surface').count(),0);assert.equal((await diag()).pendingCallbacks,0);await power.click();await page.evaluate(()=>document.querySelector('video').play());
  await run('__tbkTwitchAmbilight.settings.change("chatEnabled",false);__tbkTwitchAmbilight.settings.change("renderer","webgl");__tbkTwitchAmbilight.settings.change("motionSpeed",0)');
  const hashes={};for(const effect of ['classic','soft','directional','flow','rays','waves']){
    await run(`__tbkTwitchAmbilight.settings.change('effect',${JSON.stringify(effect)})`);await wait(async()=>(await diag()).actualEffect===effect);await page.waitForTimeout(300);
    const pixels=await page.locator('.tbk-ambilight-glow canvas').nth(1).evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));hashes[effect]=crypto.createHash('sha256').update(Buffer.from(pixels)).digest('hex');
    await page.screenshot({path:path.join(out,'effect-'+effect+'.png')});
  }assert.equal(new Set(Object.values(hashes)).size,6);check('Six effects produce distinct real rendered pixels',hashes);
  const phase=await run('__tbkTwitchAmbilight.engine.effects.phase');await page.waitForTimeout(400);assert.equal(await run('__tbkTwitchAmbilight.engine.effects.phase'),phase);await run('__tbkTwitchAmbilight.settings.change("motionSpeed",60)');await page.waitForTimeout(400);assert(await run('__tbkTwitchAmbilight.engine.effects.phase')>phase);check('Motion slider stops independent motion at zero');
  await run('__tbkTwitchAmbilight.settings.change("renderer","canvas")');await wait(async()=>(await diag()).actualEffect==='classic');assert((await diag()).warning.includes('Canvas'));check('Explicit Canvas mode has explained safe effect fallback');
  // Actual video PiP. No extra floating-window UI or video processing is requested.
  await page.locator('#pip').click();await wait(async()=>await page.evaluate(()=>!!document.pictureInPictureElement));assert.equal(await page.locator('.tbk-ambilight-glow').evaluate(el=>el.hidden),true);await run('__tbkTwitchAmbilight.settings.change("pipEnabled",true)');assert.equal(await page.locator('.tbk-ambilight-glow').evaluate(el=>el.hidden),false);await page.evaluate(()=>document.exitPictureInPicture());check('PiP option controls source-page light, entry/exit works');
  await run('__tbkTwitchAmbilight.settings.selectPreset(null);__tbkTwitchAmbilight.settings.change("renderer","canvas");__tbkTwitchAmbilight.settings.change("effect","classic");__tbkTwitchAmbilight.settings.change("chatEnabled",false)');
  const task=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  await run('__tbkTwitchAmbilight.settings.resetEconomy()');
  const measurements=[];for(const mode of ['off','normal','economy']){await run(`__tbkTwitchAmbilight.settings.change('enabled',${mode!=='off'});__tbkTwitchAmbilight.settings.setEconomy(${mode==='economy'})`);await page.waitForTimeout(500);const a=await task(),before=await diag();await page.waitForTimeout(3000);const b=await task(),after=await diag();measurements.push({mode,taskSeconds:b.TaskDuration-a.TaskDuration,frames:after.frames-before.frames,frameMs:after.frameMs});}
  check('Synthetic CPU task measurements captured (not Opera hardware benchmark)',measurements);
  await run('__tbkTwitchAmbilight.settings.flush()');await page.locator('.tbk-ambilight-gear').click();await page.screenshot({path:path.join(out,'settings-v3.png')});
  assert.deepEqual(errors,[]);check('No uncaught page errors');
 }catch(e){results.push({name:'FAIL',passed:false,error:e.stack});console.error(e);process.exitCode=1;}
 finally{const report={browserTarget:browserName,browser:context.browser()?.version(),executable:process.env.TBK_BROWSER_EXECUTABLE||'Playwright Chromium',extension,environment:'Actual MV3 on synthetic fixture; software GPU; not live Twitch',results,errors};fs.writeFileSync(path.join(out,'browser-v3-results.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,browserName+'-results.json'),JSON.stringify(report,null,2));await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
