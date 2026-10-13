/* Verify the final separately extracted installation archive. */
const {chromium}=require('playwright'),path=require('path'),fs=require('fs'),assert=require('node:assert/strict'),fixture=require('./fixture-v3.cjs');
const reportPath=path.resolve(process.env.TBK_PACKAGE_REPORT||'../../../artifacts/package/package-report.json'),out=path.dirname(reportPath),pack=JSON.parse(fs.readFileSync(reportPath,'utf8').replace(/^\uFEFF/,''));
(async()=>{
 const context=await chromium.launchPersistentContext(path.join(out,'smoke-profile-'+Date.now()),{channel:'chromium',executablePath:process.env.TBK_BROWSER_EXECUTABLE||undefined,headless:true,args:[`--disable-extensions-except=${pack.extracted}`,`--load-extension=${pack.extracted}`,'--no-sandbox']});
 const report={archiveSha256:pack.sha256,browserTarget:pack.browserTarget,browser:context.browser()?.version(),extension:pack.extracted,status:'PENDING',errors:[]};
 try{
  await context.route('https://www.twitch.tv/**',r=>r.fulfill({contentType:'text/html',body:fixture}));const page=await context.newPage(),cdp=await context.newCDPSession(page),contexts=[];page.on('pageerror',e=>report.errors.push(e.message));cdp.on('Runtime.executionContextCreated',e=>contexts.push(e.context));await cdp.send('Runtime.enable');await page.goto('https://www.twitch.tv/tbk-install-check');await page.locator('.tbk-ambilight-gear').waitFor();let isolated;
  for(const c of contexts){try{const r=await cdp.send('Runtime.evaluate',{contextId:c.id,expression:'typeof TBK',returnByValue:true});if(r.result.value==='object')isolated=c.id;}catch{}}assert(isolated);
  const diag=async()=>(await cdp.send('Runtime.evaluate',{contextId:isolated,expression:'__tbkTwitchAmbilight.engine.diagnostics()',returnByValue:true})).result.value;
  for(let i=0;i<50&&(await diag()).frames<3;i++)await page.waitForTimeout(100);report.diagnostics=await diag();assert.equal(report.diagnostics.version,pack.version);assert(report.diagnostics.frames>=3);assert.equal(report.diagnostics.error,'');
  await page.getByRole('switch',{name:'Включить расширение TBK',exact:true}).click();assert.equal((await diag()).pendingCallbacks,0);await page.locator('.tbk-ambilight-gear').click();assert(await page.locator('details[data-section]').count()>=5);assert(await page.getByLabel('Расширение включено',{exact:true}).isVisible());assert.deepEqual(report.errors,[]);report.status='PASS';
 }catch(e){report.status='FAIL';report.failure=e.message;throw e;}
 finally{if(report.status==='PASS'){pack.browserInstall='PASS';fs.writeFileSync(reportPath,JSON.stringify(pack,null,2));}fs.writeFileSync(path.join(out,'install-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await context.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
