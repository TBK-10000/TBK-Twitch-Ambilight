const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const memory={},listeners=new Set();
const sandbox={console,structuredClone,setTimeout,clearTimeout,chrome:{storage:{local:{get:async k=>({[k]:memory[k]}),set:async obj=>{Object.assign(memory,structuredClone(obj));}},sync:{get:async()=>({})},onChanged:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)}}}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('../src/settings.js','utf8'),sandbox);
const T=vm.runInContext('TBK',sandbox);
const tests=[];
async function test(name,fn){await fn();tests.push(name);console.log('PASS',name);}
(async()=>{
 await test('Version 2 exports migrate without losing normal or fullscreen settings',()=>{
  const settings=new T.Settings();
  settings.import(JSON.stringify({schema:2,enabled:false,base:{brightness:137},profiles:{fullscreen:{brightness:95}}}));
  assert.equal(settings.data.schema,3);assert.equal(settings.effective('normal').brightness,137);assert.equal(settings.effective('fullscreen').brightness,95);assert.equal(settings.effective('normal').enabled,false);settings.destroy();
 });
 await test('Presets autosave independent mode settings, paste keeps target name, deletion returns base',()=>{
  const s=new T.Settings();s.change('brightness',137);
  const first=s.createPreset();s.renamePreset(first,'Первый');s.selectPreset(first);s.change('brightness',95,'fullscreen');
  const second=s.createPreset();s.renamePreset(second,'Второй');s.selectPreset(second);s.change('brightness',80);
  s.pastePreset(second,s.copyPreset(first));assert.equal(s.data.presets.find(p=>p.id===second).name,'Второй');assert.equal(s.effective('normal').brightness,137);assert.equal(s.effective('fullscreen').brightness,95);
  s.deletePreset(second);assert.equal(s.data.activePreset,null);assert.equal(s.effective('normal').brightness,137);
  assert.throws(()=>s.pastePreset(first,'{}'));s.destroy();
 });
 await test('Economy restores presets, explicit editing persists, plus copies current economy values',()=>{
  const s=new T.Settings();s.change('brightness',137);const id=s.createPreset();s.selectPreset(id);
  s.setEconomy(true);assert.equal(s.effective('normal').fps,'15');assert.equal(s.effective('normal').layers,1);assert.equal(s.effective('normal').renderer,'canvas');
  const copy=s.createPreset();assert.equal(s.preset(copy).base.fps,'15');
  s.setEconomyEditing(true);s.change('brightness',90);assert.equal(s.data.economyEnabled,true);s.setEconomyEditing(false);s.setEconomy(false);assert.equal(s.effective('normal').brightness,137);
  s.setEconomy(true);assert.equal(s.effective('normal').brightness,90);s.change('brightness',120);assert.equal(s.data.economyEnabled,false);assert.equal(s.preset(id).base.brightness,120);
  s.setEconomy(true);s.selectPreset(copy);assert.equal(s.data.economyEnabled,false);s.destroy();
 });
 await test('Invalid pasted parameter types leave the target preset untouched',()=>{
  const s=new T.Settings();s.change('brightness',137);const id=s.createPreset(),before=s.copyPreset(id);
  const invalid=JSON.parse(before);invalid.base.brightness='garbage';assert.throws(()=>s.pastePreset(id,JSON.stringify(invalid)));assert.equal(s.copyPreset(id),before);
  for(const value of [null,false,0,'']){const malformed=JSON.parse(before);malformed.profiles.theater=value;assert.throws(()=>s.pastePreset(id,JSON.stringify(malformed)));assert.equal(s.copyPreset(id),before);}s.destroy();
 });
 await test('Active preset, full OFF and economy survive storage reload; edit mode is temporary',async()=>{
  const s=new T.Settings();const id=s.createPreset();s.selectPreset(id);s.change('brightness',95,'fullscreen');s.setEconomyEditing(true);s.change('blur',20);s.change('enabled',false);await s.flush();
  const copy=new T.Settings();await copy.init();assert.equal(copy.data.activePreset,id);assert.equal(copy.data.economyEnabled,true);assert.equal(copy.effective('normal').enabled,false);assert.equal(copy.effective('normal').blur,20);assert(!copy.economyEditing);copy.setEconomy(false);assert.equal(copy.effective('fullscreen').brightness,95);s.destroy();copy.destroy();
 });
 fs.writeFileSync('settings-v3-results.json',JSON.stringify({passed:tests.length,tests},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
