/* Deterministic logic tests. Canvas and DOM are doubles: NOT browser evidence. */
const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
const root='../';const tests=[];
const memory={},changes=new Set(),frames=new Map();let serial=0,now=1000;
class Element extends EventTarget{
 constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.style={setProperty(k,v){this[k]=v;},getPropertyValue(k){return this[k]||'';},removeProperty(k){delete this[k];}};this.children=[];this.width=96;this.height=54;this.hidden=false;this.isConnected=true;this.attrs={};this.classes=new Set();this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v)};}
 querySelectorAll(selector){if(selector==='.community-highlight,.community-highlight-stack__backlog-card')return (this.candidates||[]).filter(el=>el.classList.contains('community-highlight')||el.classList.contains('community-highlight-stack__backlog-card'));return this.candidates||[];}
 prepend(el){el.remove();this.children.unshift(el);el.parentElement=this;}
 toDataURL(){return 'data:image/png;base64,fixture';}
 setAttribute(k,v){this.attrs[k]=v;}
 append(...els){for(const e of els){e.remove();this.children.push(e);e.parentElement=this;}}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(e=>e!==this);this.parentElement=null;}
 contains(el){return this===el||this.children.some(e=>e.contains(el));}
 closest(){return this.root||null;}
 getBoundingClientRect(){return {left:100,top:100,width:800,height:450,right:900,bottom:550};}
 getContext(kind){if(kind==='webgl')return null;if(!this.context)this.context={globalAlpha:1,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(data){this.lastPixels=data;},save(){},restore(){},translate(){},scale(){},clearRect(){},drawImage(...args){this.lastDraw=args;},getImageData:()=>({data:this.pixels||new Uint8ClampedArray(96*54*4).fill(100)})};return this.context;}
}
class Video extends Element{
 constructor(){super('video');this.videoWidth=640;this.videoHeight=360;this.paused=false;this.ended=false;this.readyState=4;}
 requestVideoFrameCallback(fn){const id=++serial;frames.set(id,fn);return id;}
 cancelVideoFrameCallback(id){frames.delete(id);}
}
const document=new Element('document');document.body=new Element('body');document.createElement=tag=>new Element(tag);document.fullscreenElement=null;document.hidden=false;document.querySelector=()=>null;
const sandbox={console,Event,EventTarget,DOMException,AbortController,structuredClone,Uint8ClampedArray,Float32Array,document,location:{hostname:'www.twitch.tv',pathname:'/fixture'},getComputedStyle:()=>({objectFit:'contain'}),performance:{now:()=>now},requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{observe(){}disconnect(){this.disconnected=true;}},setTimeout,clearTimeout,chrome:{storage:{local:{get:async key=>({[key]:memory[key]}),set:async obj=>{Object.assign(memory,structuredClone(obj));for(const fn of changes)fn(Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,{newValue:structuredClone(v)}])),'local');}},sync:{get:async()=>({})},onChanged:{addListener:fn=>changes.add(fn),removeListener:fn=>changes.delete(fn)}}}};
vm.createContext(sandbox);for(const file of ['src/settings.js','src/player.js','src/vendor/projector-2d.js','src/renderers.js','src/effects.js','src/chat.js','src/foreground.js','src/edge.js','src/engine.js'])vm.runInContext(fs.readFileSync(root+file,'utf8'),sandbox,{filename:file});
const T=vm.runInContext('TBK',sandbox);
function test(name,fn){return Promise.resolve().then(fn).then(()=>{tests.push({name,passed:true});console.log('PASS',name);});}
(async()=>{
await test('Overlapping picture, panel and chat masks subtract their union without lit intersections',()=>{
 const bounds={left:0,top:0,right:1000,bottom:800};
 const cuts=[{left:100,top:50,right:750,bottom:700},{left:600,top:20,right:900,bottom:760},{left:850,top:0,right:1000,bottom:800}];
 const pieces=T.geometry.subtractRects(bounds,cuts),inside=(r,x,y)=>x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom;
 for(let x=5;x<1000;x+=10)for(let y=5;y<800;y+=10){assert.equal(pieces.some(r=>inside(r,x,y)),!cuts.some(r=>inside(r,x,y)));}
 assert(pieces.every(r=>r.right>r.left&&r.bottom>r.top));
});
await test('Mask is stable for 0/8/14 percent insets and wide/tall pictures',()=>{
 const bounds={left:-100,top:-50,right:1200,bottom:900};
 const panel={left:650,top:30,right:940,bottom:790},chat={left:960,top:0,right:1300,bottom:900};
 for(const inset of [0,.08,.14])for(const width of [480,900]){
  const pic={left:100+width*inset/2,top:100+600*inset/2,right:100+width*(1-inset/2),bottom:100+600*(1-inset/2)};
  const pieces=T.geometry.subtractRects(bounds,[pic,panel,chat]);
  for(const r of pieces)for(const cut of [pic,panel,chat])assert(!(r.left<cut.right&&r.right>cut.left&&r.top<cut.bottom&&r.bottom>cut.top));
 }
});
await test('Controls wrapper does not cut a full-width black strip; only its widgets are protected',()=>{
 const toolbar=new Element(),button=new Element('button'),slider=new Element('input'),root=new Element();
 toolbar.querySelectorAll=()=>[button,slider];root.querySelectorAll=selector=>selector.includes('.player-controls,')?[toolbar]:[];
 const foreground=[...T.player.foregroundElements(root)];assert.equal(foreground.length,2);assert(!foreground.includes(toolbar));
 const bounds={left:0,top:0,right:1000,bottom:700};
 const pieces=T.geometry.subtractRects(bounds,[{left:900,top:650,right:940,bottom:690}]);
 assert(pieces.some(r=>r.left<=400&&r.right>400&&r.top<=670&&r.bottom>670));
});
await test('Hidden and faded controls do not leave holes in the light',()=>{
 const parent=new Element(),button=new Element('button');parent.append(button);const previous=sandbox.getComputedStyle;
 sandbox.getComputedStyle=el=>el.testStyle||{};
 try{assert(T.player.isVisibleUI(button));parent.testStyle={opacity:'0'};assert(!T.player.isVisibleUI(button));parent.testStyle={visibility:'hidden'};assert(!T.player.isVisibleUI(button));parent.testStyle={};parent.hidden=true;assert(!T.player.isVisibleUI(button));parent.hidden=false;assert(T.player.isVisibleUI(button));}finally{sandbox.getComputedStyle=previous;}
});
await test('Mask coordinates are local to the glow including negative viewport origins',()=>{
 const path=T.geometry.clipPath({left:-25,top:-30,right:75,bottom:70},[]);
 assert.equal(path,'path("M0 0H100V100H0Z")');
 assert.equal(T.geometry.subtractRects({left:0,top:0,right:10,bottom:10},[{left:-1,top:-1,right:11,bottom:11}]).length,0);
});
await test('Local foreground plane keeps one outer region and cleans classes/canvases on replacement',()=>{
 const page=new Element(),nested=new Element(),controls=new Element(),root=new Element();page.append(nested);
 const previous=document.querySelectorAll;document.querySelectorAll=()=>[page,nested];root.querySelectorAll=()=>[controls];
 try{
  const manager=new T.Foreground(root);manager.reconcile();assert.equal(manager.entries.size,2);assert(manager.entries.has(page));assert(!manager.entries.has(nested));
  const options={...T.normalize().base,enabled:true};manager.layout({left:100,top:100,width:800,height:450},options);manager.draw(new Element('canvas'));
  const entry=manager.entries.get(page);assert.equal(entry.canvases.length,2);assert.equal(entry.plane.parentElement,page);assert(page.classList.contains('tbk-foreground-surface'));
  manager.reconcile();assert.equal(manager.entries.get(page),entry);
  document.querySelectorAll=()=>[];manager.reconcile();assert(!page.classList.contains('tbk-foreground-surface'));assert.equal(entry.plane.parentElement,null);assert.equal(entry.canvases[0].width,1);
  manager.destroy();assert(!controls.classList.contains('tbk-foreground-surface'));assert.equal(manager.entries.size,0);
 }finally{document.querySelectorAll=previous;}
});
await test('Foreground layout hides disabled light while keeping native content untouched',()=>{
 const root=new Element(),region=new Element(),previous=document.querySelectorAll;document.querySelectorAll=()=>[region];
 try{const manager=new T.Foreground(root);manager.reconcile();manager.layout({left:0,top:0,width:640,height:360},{...T.normalize().base,enabled:false});assert(manager.entries.get(region).plane.hidden);assert.equal(region.style.opacity,undefined);assert.equal(region.style.zIndex,undefined);manager.destroy();}finally{document.querySelectorAll=previous;}
});
await test('Controls light remains under native gradient when controls fade, with reversible cleanup',()=>{
 const root=new Element(),host=new Element(),controls=new Element(),previous=document.querySelectorAll;
 root.append(host);host.append(controls);root.querySelectorAll=()=>[controls];document.querySelectorAll=()=>[];
 const manager=new T.Foreground(root),picture={left:200,top:150,width:600,height:330},options={...T.normalize().base,enabled:true};
 try{manager.reconcile();manager.layout(picture,options);const entry=manager.entries.get(controls);
 assert.equal(entry.plane.parentElement,host);assert.equal(controls.parentElement,host);assert(controls.classList.contains('tbk-controls-active'));
 controls.hidden=true;manager.layout(picture,options);assert.equal(entry.plane.hidden,false);assert.equal(controls.style.opacity,undefined);assert.equal(controls.style.backgroundImage,undefined);
 manager.layout(picture,{...options,enabled:false});assert(entry.plane.hidden);assert(!controls.classList.contains('tbk-controls-active'));
 manager.destroy();assert.equal(entry.plane.parentElement,null);assert(!controls.classList.contains('tbk-controls-over-light'));
 }finally{manager.destroy();document.querySelectorAll=previous;}
});
await test('Twitch zero-height opacity transition cannot hide the controls light; React classes recover',()=>{
 const root=new Element(),overlay=new Element(),transition=new Element(),controls=new Element(),previous=document.querySelectorAll,computed=sandbox.getComputedStyle;
 root.append(overlay);overlay.append(transition);transition.append(controls);overlay.matches=selector=>selector==='.video-player__overlay';
 root.querySelectorAll=()=>[controls];document.querySelectorAll=()=>[];
 sandbox.getComputedStyle=node=>({position:node===overlay?'absolute':'static',opacity:node===transition?'0':'1'});
 const manager=new T.Foreground(root),picture={left:200,top:150,width:600,height:330},options={...T.normalize().base,enabled:true};
 try{manager.reconcile();manager.layout(picture,options);const entry=manager.entries.get(controls);
 assert.equal(entry.host,overlay);assert.equal(entry.plane.parentElement,overlay);assert.equal(entry.plane.hidden,false);assert.equal(controls.parentElement,transition);
 controls.classes.clear();overlay.classes.clear();manager.reconcile();manager.layout(picture,options);
 assert(controls.classList.contains('tbk-foreground-surface'));assert(controls.classList.contains('tbk-controls-over-light'));assert(overlay.classList.contains('tbk-controls-stable-host'));assert.equal(manager.entries.get(controls),entry);
 assert.equal(transition.style.position,undefined);manager.destroy();assert(!overlay.classList.contains('tbk-controls-stable-host'));
 }finally{manager.destroy();document.querySelectorAll=previous;sandbox.getComputedStyle=computed;}
});
await test('Player ambient plane covers the entire container without a toolbar-sized seam',()=>{
 const root=new Element(),container=new Element(),overlay=new Element(),transition=new Element(),controls=new Element(),previous=document.querySelectorAll;
 root.append(container);container.append(overlay);overlay.append(transition);transition.append(controls);
 container.matches=q=>q==='.video-player__container';overlay.matches=q=>q==='.video-player__overlay';
 container.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600,right:1000,bottom:600});
 controls.getBoundingClientRect=()=>({left:0,top:550,width:1000,height:50,right:1000,bottom:600});
 root.querySelectorAll=()=>[controls];document.querySelectorAll=()=>[];
 const manager=new T.Foreground(root);try{manager.reconcile();manager.layout({left:100,top:60,width:800,height:480},{...T.normalize().base,enabled:true});
 const e=manager.entries.get(controls);assert.equal(e.host,container);assert.equal(e.plane.parentElement,container);assert.equal(e.box.height,600);assert.equal(e.plane.style.height,'600px');assert.equal(e.plane.style.top,'0px');assert(overlay.classList.contains('tbk-controls-native-overlay'));assert.equal(controls.parentElement,transition);
 manager.destroy();assert(!overlay.classList.contains('tbk-controls-native-overlay'));
 }finally{manager.destroy();document.querySelectorAll=previous;}
});
await test('Edge feather is smooth, monotonic, fully fades and never paints the video interior',()=>{
 assert.equal(T.edgeWeight(0),1);assert.equal(T.edgeWeight(1),0);assert.equal(T.edgeWeight(.5),.5);
 for(let i=1;i<=100;i++)assert(T.edgeWeight(i/100)<=T.edgeWeight((i-1)/100));
 const e=new T.EdgeTransition(),video=new Video();e.draw(video,{width:100,height:80},20);const pixels=e.maskCtx.lastPixels.data,w=e.mask.width;
 for(let y=20;y<100;y++)for(let x=20;x<120;x++)assert.equal(pixels[(y*w+x)*4+3],0);
 assert.equal(pixels[(40*w+0)*4+3],0);assert(pixels[(40*w+19)*4+3]>250);
 assert.equal(video.style.filter,undefined);e.destroy();assert.equal(e.canvas.width,1);
});
await test('Edge mirrors broad ambient bands with moderate blur and shared colour settings',()=>{
 const e=new T.EdgeTransition(),source=new Element('canvas'),calls=[],patches=[];
 e.fieldCtx.drawImage=(...args)=>patches.push(args);
 e.ctx.drawImage=function(...args){calls.push({args,filter:this.filter});};
 e.draw(source,{width:800,height:450},40,{blur:24,saturation:130,brightness:80,contrast:110});
 assert.equal(calls.length,2);assert.equal(calls[0].args[0],e.field);assert.equal(patches.length,9);for(const args of patches){assert.equal(args[0],source);assert(args[3]>=2&&args[4]>=2);}assert(Number(calls[0].filter.match(/blur\(([\d.]+)/)[1])<40*.4);assert.equal(calls[0].args.length,5);
 assert.match(calls[0].filter,/blur\([\d.]+px\) saturate\(130%\) brightness\(80%\) contrast\(110%\)/);
 assert.equal(calls[1].filter,'none');assert.equal(e.ctx.globalCompositeOperation,'source-over');e.destroy();
});
await test('Neutral wrapper backgrounds reveal light and restore on disable without repeated mutations',()=>{
 const page=new Element(),neutral=new Element(),accent=new Element(),root=new Element();page.append(neutral,accent);page.candidates=[neutral,accent];
 const query=document.querySelectorAll,computed=sandbox.getComputedStyle;
 document.querySelectorAll=()=>[page];sandbox.getComputedStyle=node=>({backgroundColor:node===accent?'rgb(180, 20, 40)':'rgb(24, 24, 27)',backgroundImage:'none'});
 const manager=new T.Foreground(root),picture={left:0,top:0,width:800,height:450},options={...T.normalize().base,enabled:true};
 try{manager.reconcile();manager.layout(picture,options);assert(neutral.classList.contains('tbk-foreground-clear'));assert(!accent.classList.contains('tbk-foreground-clear'));
 let removals=0;const remove=neutral.classList.remove;neutral.classList.remove=(...args)=>{removals++;remove(...args);};
 manager.reconcile();manager.layout(picture,options);assert.equal(removals,0);
 manager.layout(picture,{...options,enabled:false});assert(!neutral.classList.contains('tbk-foreground-clear'));assert.equal(removals,1);
 }finally{manager.destroy();document.querySelectorAll=query;sandbox.getComputedStyle=computed;}
});
await test('Chat backdrop selects outer stream chat so the header shares its background',()=>{
 const outer=new Element(),inner=new Element(),old=document.querySelectorAll;outer.append(inner);
 document.querySelectorAll=selector=>selector==='.stream-chat'?[outer]:[inner];
 const chat=new T.ChatBackdrop();try{assert.equal(chat.find(),outer);}finally{chat.destroy();document.querySelectorAll=old;}
});
await test('Chat header wrappers become transparent while buttons, accents and text stay native',()=>{
 const root=new Element(),card=new Element(),button=new Element(),accent=new Element(),late=new Element(),old=document.querySelectorAll,computed=sandbox.getComputedStyle;
 root.append(card,button,accent);button.closest=()=>button;
 root.querySelectorAll=selector=>selector==='.stream-chat-header div,.stream-chat-header section,.stream-chat-header header'?root.children.filter(n=>n!==chat.layer):[];
 document.querySelectorAll=()=>[root];sandbox.getComputedStyle=node=>({backgroundColor:node===accent?'rgb(160, 20, 200)':'rgb(24, 24, 27)',backgroundImage:'none'});
 const chat=new T.ChatBackdrop(),options={...T.normalize().base,chatEnabled:true};
 try{chat.reconcile(options);assert(card.classList.contains('tbk-chat-widget-surface'));assert(!button.classList.contains('tbk-chat-widget-surface'));assert(!accent.classList.contains('tbk-chat-widget-surface'));assert.equal(card.style.opacity,undefined);assert.equal(card.style.filter,undefined);
 root.append(late);chat.reconcile(options);assert(late.classList.contains('tbk-chat-widget-surface'));assert.equal(chat.layer.parentElement,root);
 card.remove();chat.reconcile(options);assert(!card.classList.contains('tbk-chat-widget-surface'));
 chat.reconcile({...options,chatEnabled:false});assert(!late.classList.contains('tbk-chat-widget-surface'));assert.equal(chat.layer.parentElement,null);
 }finally{chat.destroy();document.querySelectorAll=old;sandbox.getComputedStyle=computed;}
});
await test('Edge strength is independent, persists in profiles, and the near-edge zone stays dense',()=>{
 const settings=new T.Settings();assert.equal(settings.effective('normal').edgeStrength,180);
 settings.change('edgeStrength',240,'fullscreen');assert.equal(settings.effective('fullscreen').edgeStrength,240);assert.equal(settings.effective('normal').edgeStrength,180);assert.equal(T.normalize({base:{edgeStrength:999}}).base.edgeStrength,300);
 const e=new T.EdgeTransition(),source=new Element('canvas'),calls=[];e.ctx.drawImage=function(...args){calls.push({filter:this.filter,alpha:this.globalAlpha});};
 e.draw(source,{width:100,height:80},20,{edgeStrength:240,brightness:100});assert.match(calls[0].filter,/brightness\(240%\)/);
 const data=e.maskCtx.lastPixels.data;assert.equal(data[(40*e.mask.width+15)*4+3],255);
 e.draw(source,{width:100,height:80},20,{edgeStrength:0});assert.equal(calls[2].alpha,0);assert.equal(e.ctx.globalAlpha,1);e.destroy();settings.destroy();
});
await test('Edge option defaults off, validates width and saves in mode profiles',()=>{
 const settings=new T.Settings();assert.equal(settings.effective('normal').edgeTransition,0);settings.change('edgeTransition',42);settings.change('edgeTransition',90,'fullscreen');assert.equal(settings.effective('normal').edgeTransition,42);assert.equal(settings.effective('fullscreen').edgeTransition,90);assert.equal(T.normalize({base:{edgeTransition:999}}).base.edgeTransition,300);settings.destroy();
});
const settings=new T.Settings();await settings.init();
await test('Defaults, type validation, clamping, unknown keys excluded',()=>{const d=T.normalize({base:{quality:1000,spread:-99,renderer:'evil',detectBars:'yes',brightness:NaN,unknown:1}});assert.equal(d.base.quality,100);assert.equal(d.base.spread,0);assert.equal(d.base.renderer,'auto');assert.equal(d.base.detectBars,true);assert.equal(d.base.brightness,110);assert(!('unknown'in d.base));assert.equal(d.base.smoothness,58);});
await test('Profile isolation, reset, export/import and schema rejection',()=>{settings.change('brightness',132);settings.change('brightness',95,'theater');assert.equal(settings.effective('normal').brightness,132);assert.equal(settings.effective('theater').brightness,95);const saved=settings.export();settings.reset('theater');assert.equal(settings.effective('theater').brightness,132);settings.import(saved);assert.equal(settings.effective('theater').brightness,95);assert.throws(()=>settings.import('{"schema":1}'));});
await test('Queued saves keep latest value and persist on new instance',async()=>{settings.change('spread',81);const a=settings.flush();settings.change('spread',88);const b=settings.flush();await Promise.all([a,b]);const second=new T.Settings();await second.init();assert.equal(second.effective('normal').spread,88);second.destroy();});
await test('Source-space 2D crop maps correctly to drawImage',()=>{const p=new T.Projector2d();p.resize(320,180);p.draw({videoWidth:1920,videoHeight:1080},[.1,.05,.1,.05]);const args=p.ctx.lastDraw;assert.equal(args[1],192);assert.equal(args[2],54);assert.equal(args[3],1536);assert(Math.abs(args[4]-972)<.0001);assert.equal(args[7],320);p.destroy();});
await test('WebGL unavailable selects new Canvas2D projector',()=>{const p=new T.Renderer('webgl');assert.equal(p.kind,'Canvas 2D');assert(p.warning.includes('WebGL'));p.destroy();});
await test('Runtime WebGL failure falls back; security errors do not retry',()=>{const p=new T.Renderer('canvas');let destroyed=false;p.projector={kind:'WebGL',resize(){},draw(){throw Error('lost');},destroy(){destroyed=true;}};p.draw({width:100,height:100},[0,0,0,0],20,20);assert(destroyed);assert.equal(p.kind,'Canvas 2D');p.projector.draw=()=>{throw new DOMException('blocked','SecurityError');};assert.throws(()=>p.draw({},[],20,20),{name:'SecurityError'});p.destroy();});
await test('Black bars require 3 stable probes and ignore full-black fades',()=>{const p=new T.FrameProbe(),pixels=new Uint8ClampedArray(96*54*4);for(let y=0;y<54;y++)for(let x=0;x<96;x++){const i=(y*96+x)*4;pixels[i+3]=255;if(y>=6&&y<48)pixels[i]=pixels[i+1]=pixels[i+2]=180;}p.canvas.pixels=pixels;p.sample({},true);p.sample({},true);assert.equal(p.crop[1],0);p.sample({},true);assert.equal(p.crop[1],6/54);assert.equal(p.crop[3],6/54);p.canvas.pixels=new Uint8ClampedArray(96*54*4);p.sample({},true);assert.equal(p.crop[1],6/54);p.sample({},false);assert.equal(p.crop[1],0);p.destroy();});
const video=new Video(),player=new Element();video.root=player;player.append(video);settings.change('renderer','canvas');const engine=new T.Engine(video,player,settings);
await test('Engine mask updates immediately when the settings panel opens or closes',()=>{
 const original=engine.glow.style.clipPath,panel=new Element();panel.getBoundingClientRect=()=>({left:820,top:80,width:300,height:650});engine.settingsPanel=panel;engine.layout();
 assert.notEqual(engine.glow.style.clipPath,original);panel.hidden=true;engine.layout();assert.equal(engine.glow.style.clipPath,original);engine.settingsPanel=null;
});
await test('Repeated refresh never schedules more than one callback',()=>{for(let i=0;i<40;i++)engine.refresh();assert.equal(frames.size,1);assert.equal(engine.diagnostics().pendingCallbacks,1);});
await test('Stale callback cannot restart an old generation',()=>{const old=[...frames.values()][0];engine.refresh();old(now+100);assert.equal(frames.size,1);});
await test('Pause stops callback; play resumes',()=>{video.paused=true;video.dispatchEvent(new Event('pause'));assert.equal(frames.size,0);video.paused=false;video.dispatchEvent(new Event('playing'));assert.equal(frames.size,1);});
await test('Disable stops and hides; re-enable resumes',()=>{settings.change('enabled',false);assert.equal(frames.size,0);assert(engine.glow.hidden);settings.change('enabled',true);assert.equal(frames.size,1);assert.equal(engine.glow.hidden,false);});
await test('Chat defaults and validation are safe for old settings',()=>{const d=T.normalize({base:{chatColor:'red;display:none',chatOpacity:500,chatGrain:-5,chatEnabled:'yes'}}).base;assert.equal(d.chatColor,'#18181b');assert.equal(d.chatOpacity,100);assert.equal(d.chatGrain,0);assert.equal(d.chatEnabled,false);});
await test('Chat uses right edge, own smoothing and at most 15 updates/sec',()=>{const root=new Element(),surface=new Element();root.append(surface);root.candidates=[surface];document.candidates=[root];settings.change('chatEnabled',true);assert.equal(engine.chat.root,root);assert(surface.classList.contains('tbk-chat-surface'));const chat=engine.chat,last=chat.lastTime;chat.draw(engine.blend,engine.options,last+10);assert.equal(chat.lastTime,last);chat.draw(engine.blend,engine.options,last+100);const a=chat.ctx.lastDraw;assert.equal(a[1]+a[3],engine.blend.width);assert.equal(a[7],12);assert.equal(a[8],32);assert.equal(root.style.opacity,undefined);});
await test('Global OFF stops all light, restores chat and ON resumes saved chat setting',()=>{settings.change('enabled',false);assert(engine.glow.hidden);assert.equal(frames.size,0);assert.equal(engine.chat.root,null);assert(!document.candidates[0].classList.contains('tbk-chat-root'));assert(!document.candidates[0].candidates[0].classList.contains('tbk-chat-surface'));settings.change('enabled',true);assert(engine.chat.root);settings.change('chatEnabled',false);});
await test('Chat host replacement cleans up old root and surfaces',()=>{settings.change('chatEnabled',true);const old=engine.chat.root,other=new Element();document.candidates=[other];engine.chat.reconcile(engine.options);assert.equal(engine.chat.root,other);assert(!old.classList.contains('tbk-chat-root'));assert(!old.candidates[0].classList.contains('tbk-chat-surface'));assert.equal(engine.chat.layer.parentElement,other);settings.change('chatEnabled',false);document.candidates=[];});
await test('Chat settings survive save/reload and keep profile isolation',async()=>{settings.change('chatColor','#aBcD12');settings.change('chatOpacity',80,'theater');await settings.flush();const copy=new T.Settings();await copy.init();assert.equal(copy.effective('normal').chatColor,'#abcd12');assert.equal(copy.effective('normal').chatOpacity,65);assert.equal(copy.effective('theater').chatOpacity,80);copy.destroy();});
await test('Background pause and return',()=>{document.hidden=true;engine.refresh();assert.equal(frames.size,0);assert(engine.glow.hidden);document.hidden=false;engine.refresh();assert.equal(frames.size,1);});
await test('SecurityError stops permanently until retry',()=>{engine.probe.sample=()=>{throw new DOMException('blocked','SecurityError');};engine.refresh();assert.equal(frames.size,0);assert(engine.blocked);assert(engine.error.includes('CORS'));engine.retry();assert.equal(engine.blocked,false);assert.equal(frames.size,1);});
await test('Fullscreen uses fullscreen host and independent profile',()=>{document.fullscreenElement=player;settings.change('inset',10,'fullscreen');engine.refresh();assert.equal(engine.mode,'fullscreen');assert.equal(engine.glow.parentElement,player);assert.equal(video.style.transform,'scale(0.9)');});
await test('Destroy removes glow, cancels loop, releases observers and settings listener',()=>{const listenerCount=settings.listeners.size;engine.destroy();assert.equal(frames.size,0);assert.equal(engine.glow.parentElement,null);assert.equal(settings.listeners.size,listenerCount-1);assert(engine.resizeObserver.disconnected);});
settings.destroy();document.fullscreenElement=null;
const window=new EventTarget();sandbox.window=window;document.documentElement=new Element('html');
let observer,watchdog,selected={video:new Video(),root:new Element()};selected.video.root=selected.root;selected.root.append(selected.video);
sandbox.MutationObserver=class{constructor(fn){this.fn=fn;observer=this;}observe(){}disconnect(){this.disconnected=true;}};
sandbox.setInterval=fn=>{watchdog=fn;return 1;};sandbox.clearInterval=()=>{};
T.UI=class{constructor(){this.ensureCount=0;}ensure(){this.ensureCount++;}destroy(){this.destroyed=true;}};
T.WindowSurfaces=class{reconcile(){}destroy(){}};
T.player.find=()=>selected;
await vm.runInContext(fs.readFileSync(root+'src/main.js','utf8'),sandbox);
const state=sandbox.__tbkTwitchAmbilight;
const reconcile=async()=>{watchdog();await new Promise(resolve=>setTimeout(resolve,100));};
await test('Lifecycle keeps existing player without duplicating engine',async()=>{const first=state.engine;await reconcile();assert.equal(state.engine,first);assert.equal(frames.size,1);});
await test('SPA route change disposes previous engine even when video reused',async()=>{const first=state.engine;sandbox.location.pathname='/videos/123';await reconcile();assert(first.destroyed);assert.notEqual(state.engine,first);assert.equal(frames.size,1);});
await test('Video replacement disposes old callbacks and binds new video',async()=>{const first=state.engine;selected={video:new Video(),root:selected.root};await reconcile();assert(first.destroyed);assert.equal(state.engine.video,selected.video);assert.equal(frames.size,1);});
await test('Failed UI initialization releases engine and a later reconciliation recovers',async()=>{const original=T.UI;T.UI=class{constructor(){throw Error('Fixture initialization failure');}};selected={video:new Video(),root:new Element()};try{await reconcile();assert.equal(state.engine,null);assert.equal(frames.size,0);}finally{T.UI=original;}await reconcile();assert(state.engine);assert.equal(frames.size,1);});
await test('BFCache pagehide cancels and pageshow resumes callback',async()=>{const e=new Event('pagehide');e.persisted=true;window.dispatchEvent(e);assert.equal(frames.size,0);window.dispatchEvent(new Event('pageshow'));await new Promise(resolve=>setTimeout(resolve,100));assert.equal(frames.size,1);});
await test('Removing player disposes active controller and overlay',async()=>{const first=state.engine;selected=null;await reconcile();assert(first.destroyed);assert.equal(state.engine,null);assert.equal(frames.size,0);});
await test('Page teardown disconnects observer and settings listeners',()=>{window.dispatchEvent(new Event('pagehide'));assert(state.disposed);assert(observer.disconnected);assert.equal(changes.size,0);});
fs.writeFileSync('unit-results.json',JSON.stringify({type:'Node deterministic logic tests with mocked DOM/Canvas, not browser tests',tests},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
