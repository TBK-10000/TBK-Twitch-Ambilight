/* Chat backdrop uses the existing decoded frame; no second video/readback loop. */
(() => {
  const roots=['.stream-chat','.chat-room','[data-a-target="chat-room-component"]','.video-chat'];
  const notices='.community-highlight,.community-highlight-stack__backlog-card';
  const surfaces=['.chat-scrollable-area__message-container','.chat-list--default','.chat-list','.chat-input','.stream-chat-header','.chat-room__content','.chat-room__content-wrapper','.video-chat__message-list','[data-a-target="chat-scroller"]','[data-test-selector="chat-scrollable-area__message-container"]'];
  class ChatBackdrop {
    constructor(){
      this.surfaces=new Set();this.widgetSurfaces=new Set();this.widgetRoots=new Set();this.notices=new Map();this.lastTime=0;
      this.layer=document.createElement('div');this.layer.className='tbk-chat-backdrop';this.layer.setAttribute('aria-hidden','true');
      this.canvas=document.createElement('canvas');this.canvas.width=12;this.canvas.height=32;this.ctx=this.canvas.getContext('2d');
      this.tint=document.createElement('div');this.tint.className='tbk-chat-tint';
      this.grain=document.createElement('div');this.grain.className='tbk-chat-grain';
      this.layer.append(this.canvas,this.tint,this.grain);
      const noise=document.createElement('canvas');noise.width=noise.height=96;
      const ctx=noise.getContext('2d'),pixels=ctx.createImageData(96,96);
      let seed=973;
      for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=seed>>>24;pixels.data[i+3]=255;}
      ctx.putImageData(pixels,0,0);this.grain.style.backgroundImage=`url(${noise.toDataURL()})`;
    }
    find(){
      for(const selector of roots)for(const el of document.querySelectorAll(selector)){
        const r=el.getBoundingClientRect();if(r.width>80&&r.height>100&&getComputedStyle(el).visibility!=='hidden')return el;
      }
      return null;
    }
    detach(){
      if(this.root){if(this.previousText)this.root.style.setProperty('--tbk-chat-text',this.previousText);else this.root.style.removeProperty('--tbk-chat-text');}
      this.layer.remove();this.root?.classList.remove('tbk-chat-root','tbk-chat-position');
      for(const el of this.surfaces)el.classList.remove('tbk-chat-surface');
      for(const el of this.widgetSurfaces)el.classList.remove('tbk-chat-widget-surface');
      for(const el of this.widgetRoots)el.classList.remove('tbk-chat-widget-root');
      for(const[el,entry]of this.notices)this.releaseNotice(el,entry);this.notices.clear();
      this.widgetRoots.clear();this.widgetSurfaces.clear();this.surfaces.clear();this.root=null;
    }
    reconcile(s){
      const root=s.chatEnabled?this.find():null;
      if(root!==this.root){this.detach();if(root){this.root=root;this.previousText=root.style.getPropertyValue('--tbk-chat-text');root.classList.add('tbk-chat-root');if(getComputedStyle(root).position==='static')root.classList.add('tbk-chat-position');root.prepend(this.layer);}}
      if(!root)return;
      if(this.layer.parentElement!==root)root.prepend(this.layer);
      // Only known chat surfaces and their paths to the host become transparent.
      // Message text, badges, menus, notices and buttons retain their own styles.
      for(const candidate of root.querySelectorAll(surfaces.join(','))){
        if(candidate.closest(TBK.windowSelectors||'[role="dialog"],[role="menu"],[role="tooltip"]'))continue;
        for(let el=candidate;el&&el!==root;el=el.parentElement){if(!el.classList.contains('tbk-chat-surface'))el.classList.add('tbk-chat-surface');this.surfaces.add(el);}
      }
      for(const el of this.surfaces)if(!root.contains(el)){el.classList.remove('tbk-chat-surface');this.surfaces.delete(el);}
      // Only known header wrappers share the backdrop. Neutral colours alone
      // cannot distinguish a layout wrapper from a user card or announcement.
      const excluded='button,a,input,textarea,select,[role="button"],[role="dialog"],[role="menu"],[role="tooltip"],[role="progressbar"],.chat-line__message,.chat-line__status,.chat-scrollable-area__message-container,.tbk-chat-backdrop'+(TBK.windowSelectors?','+TBK.windowSelectors:'');
      const widgetCandidates=new Set(root.querySelectorAll('.stream-chat-header div,.stream-chat-header section,.stream-chat-header header'));
      const carouselNodes=new Set(),widgetRoots=new Set(),scrollers='.chat-list,.chat-list--default,[data-a-target="chat-scroller"],.chat-scrollable-area__message-container';
      // Twitch mounts the rotating leaderboard and other header cards before
      // the message list, outside stream-chat-header. Share only their neutral
      // wrapper backgrounds; never scan messages, input or popup overlay hosts.
      for(const content of root.querySelectorAll('.chat-room__content'))for(const group of content.children){
        if(group.matches(scrollers)||group.querySelector(scrollers))break;
        if(group.matches('.chat-input,.chat-room__viewer-card,.chat-room__notifications')||group.closest(excluded))continue;
        // Community notices use the same transition wrapper as the leaderboard,
        // but overlay messages: their card background and contrast must survive.
        if(group.matches('.community-highlight')||group.querySelector('.community-highlight,.community-highlight-stack__card'))continue;
        if(!group.querySelector('.tw-transition-group,[data-test-selector="leaderboard-item-name-test-selector"],[class*="channelLeaderboardHeader"]'))continue;
        widgetRoots.add(group);
        for(const node of [group,...group.querySelectorAll('div,section,header,article')]){widgetCandidates.add(node);carouselNodes.add(node);}
      }
      for(const group of this.widgetRoots)if(!widgetRoots.has(group))group.classList.remove('tbk-chat-widget-root');
      for(const group of widgetRoots)if(!group.classList.contains('tbk-chat-widget-root'))group.classList.add('tbk-chat-widget-root');
      this.widgetRoots=widgetRoots;
      for(const el of this.widgetSurfaces)if(!root.contains(el)||!widgetCandidates.has(el)||el.closest(excluded)){
        el.classList.remove('tbk-chat-widget-surface');this.widgetSurfaces.delete(el);
      }else if(!el.classList.contains('tbk-chat-widget-surface'))el.classList.add('tbk-chat-widget-surface');
      for(const el of widgetCandidates){
        if(this.widgetSurfaces.has(el)||this.surfaces.has(el)||el===this.layer||this.layer.contains(el)||el.closest(excluded))continue;
        const style=getComputedStyle(el),rgb=(style.backgroundColor||'').match(/[\d.]+/g)?.map(Number);
        // Thin neutral bars are slide/progress indicators, not card backgrounds.
        if(carouselNodes.has(el)&&Number.parseFloat(style.height)<16)continue;
        if(rgb&&rgb.length>=3&&(rgb.length<4||rgb[3]>0)&&Math.max(...rgb.slice(0,3))-Math.min(...rgb.slice(0,3))<20&&(!style.backgroundImage||style.backgroundImage==='none')){
          el.classList.add('tbk-chat-widget-surface');this.widgetSurfaces.add(el);
        }
      }
      this.canvas.style.opacity=String(s.chatIntensity/100);
      this.canvas.style.filter=`blur(${s.chatBlur}px)`;
      const rgb=s.chatColor.match(/\w\w/g).map(x=>parseInt(x,16));
      this.tint.style.backgroundColor=`rgba(${rgb.join(',')},${s.chatOpacity/100})`;
      this.underLuma=this.backgroundLuma();
      this.textContrast(s,this.lastLuma??.5);
      this.grain.style.opacity=String(s.chatGrain/100*.3);
      this.reconcileNotices(s);
    }
    reconcileNotices(s){
      const selected=new Set(this.root.querySelectorAll(notices));
      for(const[el,entry]of this.notices)if(!selected.has(el)){this.releaseNotice(el,entry);this.notices.delete(el);}
      for(const el of selected){
        let entry=this.notices.get(el);
        if(!entry){
          const layer=this.layer.cloneNode(true),canvas=layer.querySelector('canvas');
          layer.classList.add('tbk-chat-notice-backdrop');
          entry={layer,canvas,ctx:canvas.getContext('2d'),clear:new Set(),original:new Map()};this.notices.set(el,entry);
        }
        if(!el.classList.contains('tbk-chat-notice'))el.classList.add('tbk-chat-notice');
        if(getComputedStyle(el).position==='static')el.classList.add('tbk-chat-notice-position');
        if(entry.layer.parentElement!==el)el.prepend(entry.layer);
        for(const key of ['--tbk-chat-notice-bg','--tbk-chat-text'])if(!entry.original.has(key))entry.original.set(key,[el.style.getPropertyValue(key),el.style.getPropertyPriority(key)]);
        const set=(key,value)=>{if(el.style.getPropertyValue(key)!==value)el.style.setProperty(key,value);};
        // An opaque base blocks messages underneath even with zero chat opacity.
        set('--tbk-chat-notice-bg',s.chatColor);set('--tbk-chat-text',this.noticeText(s,this.lastLuma??.5));
        entry.canvas.style.cssText=this.canvas.style.cssText;
        entry.layer.querySelector('.tbk-chat-tint').style.cssText=this.tint.style.cssText;
        entry.layer.querySelector('.tbk-chat-grain').style.cssText=this.grain.style.cssText;
        for(const node of entry.clear)if(!el.contains(node)){node.classList.remove('tbk-chat-notice-clear');entry.clear.delete(node);}
        for(const node of el.querySelectorAll('div,section,header,article')){
          if(node.closest('button,a,input,textarea,select,[role="button"],[role="progressbar"],[role="dialog"],[role="menu"],[role="tooltip"],.tw-balloon,.highlight__progress-bar,.tbk-chat-notice-backdrop'))continue;
          if(entry.clear.has(node)){if(!node.classList.contains('tbk-chat-notice-clear'))node.classList.add('tbk-chat-notice-clear');continue;}
          const style=getComputedStyle(node),rgb=style.backgroundColor?.match(/[\d.]+/g)?.map(Number);
          if(rgb&&rgb.length>=3&&Math.max(...rgb.slice(0,3))-Math.min(...rgb.slice(0,3))<20&&style.backgroundImage==='none'){node.classList.add('tbk-chat-notice-clear');entry.clear.add(node);}
        }
        this.drawNotice(entry);
      }
    }
    drawNotice(entry){entry.ctx.clearRect(0,0,12,32);entry.ctx.drawImage(this.canvas,0,0);}
    noticeText(s,luma){
      const rgb=s.chatColor.match(/\w\w/g).map(x=>parseInt(x,16)),tint=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255;
      const alpha=s.chatOpacity/100,source=s.chatIntensity/100;
      return tint*alpha+(luma*source+tint*(1-source))*(1-alpha)>.46?'#18181b':'#efeff1';
    }
    releaseNotice(el,entry){
      entry.layer.remove();el.classList.remove('tbk-chat-notice','tbk-chat-notice-position');
      for(const node of entry.clear)node.classList.remove('tbk-chat-notice-clear');
      for(const[key,[value,priority]]of entry.original){if(value)el.style.setProperty(key,value,priority);else el.style.removeProperty(key);}
    }
    draw(source,s,now){
      if(!s.chatEnabled||!this.root||now-this.lastTime<1000/15)return;
      const dt=this.lastTime?Math.min(1000,now-this.lastTime):0,tau=s.chatSmoothness*12;
      this.ctx.globalAlpha=!this.lastTime||!tau?1:1-Math.exp(-dt/tau);
      const edge=Math.max(1,Math.round(source.width*.18));
      const blendAlpha=this.ctx.globalAlpha;this.ctx.drawImage(source,source.width-edge,0,edge,source.height,0,0,12,32);
      this.ctx.globalAlpha=1;this.lastTime=now;
      const target=s.frameLuma??.5;this.lastLuma=this.lastLuma===undefined?target:this.lastLuma+(target-this.lastLuma)*blendAlpha;this.textContrast(s,this.lastLuma);
      const text=this.noticeText(s,this.lastLuma);
      for(const[el,entry]of this.notices){this.drawNotice(entry);if(el.style.getPropertyValue('--tbk-chat-text')!==text)el.style.setProperty('--tbk-chat-text',text);}
    }
    backgroundLuma(){
      let result=0,remaining=1;
      for(let el=this.root.parentElement;el&&remaining>.01;el=el.parentElement){
        const rgb=getComputedStyle(el).backgroundColor?.match(/[\d.]+/g)?.map(Number);if(!rgb||rgb.length<3)continue;
        const alpha=rgb.length>3?rgb[3]:1;result+=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255*alpha*remaining;remaining*=1-alpha;
      }
      const dark=getComputedStyle(document.documentElement||document.body).colorScheme?.includes('dark');return result+remaining*(dark ? .09 : 1);
    }
    textContrast(s,luma){
      if(!this.root)return;const rgb=s.chatColor.match(/\w\w/g).map(x=>parseInt(x,16)),alpha=s.chatOpacity/100;
      const sourceAlpha=s.chatIntensity/100,under=this.underLuma??.5;
      const tint=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255,light=tint*alpha+(luma*sourceAlpha+under*(1-sourceAlpha))*(1-alpha)>.46;
      const text=light?'#18181b':'#efeff1';if(this.root.style.getPropertyValue('--tbk-chat-text')!==text)this.root.style.setProperty('--tbk-chat-text',text);
    }
    diagnostics(){return {enabled:!!this.root,host:this.root?.className||null,hasFrame:!!this.lastTime};}
    destroy(){this.detach();this.canvas.width=this.canvas.height=1;}
  }
  TBK.ChatBackdrop=ChatBackdrop;
})();
