(() => {
  class Engine {
    frameId=null; frameKind=''; generation=0; lastTime=0; draws=0; fps=0; cost=0; blocked=false; error=''; lastProbe=0;
    constructor(video,root,settings){
      this.video=video;this.root=root;this.settings=settings;this.abort=new AbortController();
      this.glow=document.createElement('div');this.glow.className='tbk-ambilight-glow';this.glow.setAttribute('aria-hidden','true');
      this.probe=new TBK.FrameProbe();this.blend=document.createElement('canvas');this.ctx=this.blend.getContext('2d',{alpha:false});
      this.effects=new TBK.AmbientEffects();
      this.edge=new TBK.EdgeTransition();this.edge.canvas.className='tbk-edge-transition';this.glow.append(this.edge.canvas);this.layers=[];this.originalTransform=video.style.transform || "";this.appliedTransform=null;
      for(const name of ['play','playing','pause','ended','loadeddata','loadedmetadata','seeked','emptied','resize','enterpictureinpicture','leavepictureinpicture'])video.addEventListener(name,()=>{
        if(['loadeddata','emptied'].includes(name)){this.blocked=false;this.error='';this.lastTime=0;this.probe.destroy();this.probe=new TBK.FrameProbe();}
        this.refresh();
      },{signal:this.abort.signal});
      this.unsubscribe=settings.subscribe(()=>this.refresh());
      this.resizeObserver=new ResizeObserver(()=>this.refresh());this.resizeObserver.observe(video);this.resizeObserver.observe(root);
      this.chat=new TBK.ChatBackdrop();this.foreground=new TBK.Foreground(root);this.foreground.reconcile();this.refresh();
    }
    get mode(){return TBK.player.mode(this.root);}
    get options(){const s=this.settings.effective(this.mode);return {...s,pluginEnabled:s.enabled,chatEnabled:s.enabled&&s.chatEnabled,enabled:s.enabled&&(!document.pictureInPictureElement||s.pipEnabled)};}
    cancel(){this.generation++;if(this.frameId!==null){if(this.frameKind==='video')this.video.cancelVideoFrameCallback(this.frameId);else cancelAnimationFrame(this.frameId);}this.frameId=null;}
    restoreTransform(){if(this.appliedTransform!==null&&this.video.style.transform===this.appliedTransform)this.video.style.transform=this.originalTransform;this.appliedTransform=null;}
    refresh(){
      if(this.destroyed)return;this.cancel();const s=this.options;
      if(this.choice!==s.renderer){this.renderer?.destroy();try{this.renderer=new TBK.Renderer(s.renderer);this.choice=s.renderer;}catch(e){this.error=e.message;this.blocked=true;}}
      if(s.enabled&&s.inset){const value=`${this.originalTransform === 'none' ? '' : this.originalTransform} scale(${1-s.inset/100})`.trim();this.video.style.transform=value;this.appliedTransform=value;}else this.restoreTransform();
      while(this.layers.length<s.layers){const c=document.createElement('canvas');this.glow.append(c);this.layers.push(c);}
      while(this.layers.length>s.layers)this.layers.pop().remove();
      this.glow.append(this.edge.canvas);this.edge.canvas.hidden=!s.edgeTransition;
      if(s.enabled)this.foreground.reconcile();else this.foreground.destroy();this.layout();this.chat.reconcile(s);
      if(!(s.enabled||s.chatEnabled)||(document.hidden&&s.pauseBackground)||this.video.ended||this.video.readyState<2||this.blocked){this.glow.hidden=true;this.foreground.hide();return;}
      this.draw(performance.now(),true);
      this.schedule();
    }
    layout(){
      if(this.destroyed)return;
      this.lastLayout=performance.now();
      const fullscreen=document.fullscreenElement;
      const host=fullscreen&&fullscreen.tagName!=='VIDEO'?fullscreen:document.body;
      if(this.glow.parentElement!==host)host.append(this.glow);
      const s=this.options,r=TBK.player.pictureRect(this.video);
      this.edge.prepare(r,s.edgeTransition);
      const pad=Math.max(s.spread+s.blur*2,s.edgeTransition?Math.max(this.edge.xPad||0,this.edge.yPad||0)+2:0);
      if(s.edgeTransition)Object.assign(this.edge.canvas.style,{left:`${pad-this.edge.xPad}px`,top:`${pad-this.edge.yPad}px`,width:`${r.width+2*this.edge.xPad}px`,height:`${r.height+2*this.edge.yPad}px`,filter:'none',opacity:'1'});
      const w=r.width+2*pad,h=r.height+2*pad;
      const css={left:`${r.left-pad}px`,top:`${r.top-pad}px`,width:`${w}px`,height:`${h}px`};
      for(const [k,v]of Object.entries(css))if(this.glow.style[k]!==v)this.glow.style[k]=v;
      // Keep page-level ambient light outside the picture AND all foreground UI.
      // These holes use union subtraction so intersecting video/panel/chat stay clear.
      const bounds={left:r.left-pad,top:r.top-pad,right:r.left+r.width+pad,bottom:r.top+r.height+pad};
      const protectedRects=[{left:r.left,top:r.top,right:r.left+r.width,bottom:r.top+r.height}];
      const protect=(el,margin=2)=>{
        if(!TBK.player.isVisibleUI(el))return;
        const box=el.getBoundingClientRect();
        if(box.width<=0||box.height<=0)return;
        // Include borders, antialiasing and focus outlines at the protected edge.
        protectedRects.push({left:box.left-margin,top:box.top-margin,right:box.left+box.width+margin,bottom:box.top+box.height+margin});
      };
      this.foreground.layout(r,{...s,enabled:s.enabled&&!this.blocked&&this.video.readyState>=2&&!this.video.ended&&!(document.hidden&&s.pauseBackground)});
      for(const [el,entry] of this.foreground.entries){if(entry.control&&!entry.plane.hidden){const b=entry.box;protectedRects.push({left:b.left,top:b.top,right:b.left+b.width,bottom:b.top+b.height});}else protect(el,0);}
      protect(this.settingsPanel);
      for(const el of document.querySelectorAll('.right-column,.stream-chat,.chat-room,.video-chat,[data-a-target="chat-room-component"]'))protect(el);
      for(const el of TBK.player.foregroundElements(this.root))if(![...this.foreground.entries.keys()].some(host=>host.contains(el)))protect(el);
      const clip=TBK.geometry.clipPath(bounds,protectedRects);
      if(this.glow.style.clipPath!==clip)this.glow.style.clipPath=clip;
      this.glow.style.opacity=String(Math.min(1,s.opacity/100*s.intensity/100));
      for(const [i,c]of this.layers.entries()){
        const spread=s.spread*(1-i/(s.layers+1));
        Object.assign(c.style,{left:`${pad-spread}px`,top:`${pad-spread}px`,width:`${r.width+spread*2}px`,height:`${r.height+spread*2}px`,filter:`blur(${s.blur}px) saturate(${s.saturation}%) brightness(${s.brightness}%) contrast(${s.contrast}%)`,opacity:String(1/(i+1))});
      }
      this.rect=r;
    }
    schedule(){
      if(this.destroyed||this.frameId!==null||this.blocked||!(this.options.enabled||this.options.chatEnabled)||this.video.paused||this.video.ended||(document.hidden&&this.options.pauseBackground))return;
      const generation=this.generation;
      const callback=now=>{if(generation!==this.generation||this.destroyed)return;this.frameId=null;
        const s=this.options;if(!(s.enabled||s.chatEnabled)||(document.hidden&&s.pauseBackground))return;
        if(now-this.lastTime>=1000/(s.fps==='video'?120:Number(s.fps))-1)this.draw(now);
        this.schedule();};
      if(this.video.requestVideoFrameCallback){this.frameKind='video';this.frameId=this.video.requestVideoFrameCallback(callback);}
      else{this.frameKind='raf';this.frameId=requestAnimationFrame(callback);}
    }
    draw(now,force=false){
      if(this.video.readyState<2||this.blocked||!this.renderer)return;
      const s=this.options,start=performance.now();
      try{
        // Resize, scroll, settings and DOM reconciliation still update immediately.
        // Economy avoids recalculating unchanged DOM geometry on every video frame.
        if(force||!this.settings.data.economyEnabled||now-(this.lastLayout||0)>250)this.layout();
        if(force||now-this.lastProbe>350){this.probe.sample(this.video,s.detectBars);this.lastProbe=now;}
        const width=Math.round(128+s.quality*3.84),height=Math.max(2,Math.round(width*this.video.videoHeight/this.video.videoWidth));
        const source=this.renderer.draw(this.video,s.detectBars?this.probe.crop:[0,0,0,0],width,height);
        let resized=false;if(this.blend.width!==width||this.blend.height!==height){this.blend.width=width;this.blend.height=height;resized=true;}
        const dt=Math.max(1,Math.min(250,now-this.lastTime));
        const tau=s.smoothness*5*(1.5-s.responsiveness/100);
        this.ctx.globalAlpha=resized||!this.lastTime||tau===0?1:1-Math.exp(-dt/Math.max(1,tau));
        const lift=1+s.darkBoost/100*Math.max(0,1-(this.probe.luma||0)*4);
        // Average-luminance cap; not a medical anti-flash guarantee.
        const cap=Math.min(1,(s.flashLimit/100)/Math.max(.001,(this.probe.luma||0)*lift*s.brightness/100));
        this.ctx.filter=`brightness(${lift*cap})`;this.ctx.drawImage(source,0,0);this.ctx.globalAlpha=1;this.ctx.filter='none';
        const ambient=s.enabled?this.effects.draw(this.blend,s,now):this.blend;
        for(const c of this.layers){if(c.width!==width)c.width=width;if(c.height!==height)c.height=height;c.getContext('2d',{alpha:false}).drawImage(ambient,0,0);}
        this.edge.draw(this.blend,this.rect,s.edgeTransition,s);
        this.ambient=ambient;this.foreground.draw(ambient,this.edge);this.chat.draw(this.blend,{...s,frameLuma:Math.min(1,(this.probe.chatLuma??this.probe.luma)*lift*cap)},now);this.glow.hidden=!s.enabled;this.error='';this.draws++;this.cost=performance.now()-start;
        if(!this.fpsStart)this.fpsStart=now;
        this.fpsCount=(this.fpsCount||0)+1;
        if(now-this.fpsStart>=1000){this.fps=Math.round(this.fpsCount*1000/(now-this.fpsStart));this.fpsCount=0;this.fpsStart=now;}
        this.lastTime=now;
      }catch(e){
        if(e.name==='InvalidStateError')return;
        this.error=e.name==='SecurityError'?'Браузер запретил чтение кадров (CORS/защита видео). Подсветка остановлена.':`${e.name}: ${e.message}`;
        this.blocked=true;this.glow.hidden=true;this.foreground.hide();this.cancel();console.warn('[TBK Ambilight]',this.error);
      }
    }
    retry(){this.blocked=false;this.error='';this.probe.destroy();this.probe=new TBK.FrameProbe();this.effects.destroy();this.effects=new TBK.AmbientEffects();this.refresh();}
    diagnostics(){return {version:'3.0.2',economy:this.settings.data.economyEnabled,effect:this.options.effect,actualEffect:this.effects.actual,chat:this.chat.diagnostics(),mode:this.mode,renderer:this.renderer?.kind,warning:[this.renderer?.warning,this.effects.warning].filter(Boolean).join('; '),error:this.error,video:`${this.video.videoWidth}×${this.video.videoHeight}`,paused:this.video.paused,readyState:this.video.readyState,pendingCallbacks:this.frameId===null?0:1,frames:this.draws,fps:this.fps,frameMs:Number(this.cost.toFixed(2)),crop:this.probe.crop,frameHost:location.hostname,route:location.pathname,storageError:this.settings.error};}
    destroy(){this.destroyed=true;this.cancel();this.abort.abort();this.resizeObserver.disconnect();this.unsubscribe();this.restoreTransform();this.glow.remove();this.edge.destroy();this.foreground.destroy();this.chat.destroy();this.effects.destroy();this.renderer?.destroy();this.probe.destroy();this.blend.width=this.blend.height=1;for(const c of this.layers)c.width=c.height=1;}
  }
  TBK.Engine=Engine;
})();
