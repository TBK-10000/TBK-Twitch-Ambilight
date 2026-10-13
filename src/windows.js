/* MIT, Copyright (c) 2026 TheBigKotovski (TBK). Scoped, reversible popup styles. */
(() => {
  // chat-room__viewer-card is a permanent full-size overlay host, even when
  // no card is open. Paint the actual card inside it, never the empty host.
  const selectors='[role="dialog"],[role="menu"],[role="tooltip"],.viewer-card,.chat-announcement,.chat-viewers,.community-highlight,.community-highlight-stack__backlog-card,[data-a-target="viewer-card"],[data-a-target="chat-user-card"],[data-a-target="user-card"],[data-a-target="chat-viewers-list"],[data-a-target="player-settings-menu"],[data-test-selector="chat-announcement"],.tw-balloon';
  const protectedElements='button,a,input,textarea,select,[role="button"],[role="slider"],.tbk-ambilight-ui';
  const previewSelector='.online-side-nav-channel-tooltip__body';
  const previewHost=el=>{
    if(!el.matches('.react-modal__content'))return false;
    if(el.querySelector(previewSelector))return true;
    const box=el.getBoundingClientRect();return !box.width||!box.height;
  };
  class WindowSurfaces {
    constructor(){this.entries=new Map();this.id='tbk-glass-'+Math.random().toString(36).slice(2);}
    filter(){
      if(this.svg)return;
      const map=document.createElement('canvas');map.width=map.height=32;const ctx=map.getContext('2d'),pixels=ctx.createImageData(32,32);
      for(let y=0;y<32;y++)for(let x=0;x<32;x++){
        const px=(x-15.5)/15.5,py=(y-15.5)/15.5,edge=Math.pow(Math.max(Math.abs(px),Math.abs(py)),5),i=(y*32+x)*4;
        pixels.data[i]=128+px*edge*100;pixels.data[i+1]=128+py*edge*100;pixels.data[i+2]=128;pixels.data[i+3]=255;
      }
      ctx.putImageData(pixels,0,0);
      const ns='http://www.w3.org/2000/svg',make=(tag,attrs)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
      this.svg=make('svg',{width:'0',height:'0','aria-hidden':'true',class:'tbk-glass-filter'});this.svg.style.position='absolute';this.svg.style.pointerEvents='none';
      const defs=make('defs',{}),filter=make('filter',{id:this.id,x:'-10%',y:'-10%',width:'120%',height:'120%','color-interpolation-filters':'sRGB'});
      filter.append(make('feImage',{href:map.toDataURL(),x:'0',y:'0',width:'100%',height:'100%',preserveAspectRatio:'none',result:'map'}));
      this.displacement=make('feDisplacementMap',{in:'SourceGraphic',in2:'map',scale:'6',xChannelSelector:'R',yChannelSelector:'G'});filter.append(this.displacement);defs.append(filter);this.svg.append(defs);document.body.append(this.svg);
    }
    reconcile(s){
      if(!s.enabled){this.destroy();return;}
      // Sidebar previews are positioned inside an empty React dialog portal.
      // Release the old host before reading native backgrounds of its children.
      for(const[el,entry]of this.entries)if(previewHost(el)){this.release(el,entry);this.entries.delete(el);}
      const previewPanels=new Set();
      for(const body of document.querySelectorAll(previewSelector)){
        const host=body.closest('.react-modal__content');let panel=body;
        for(let node=body;host&&node&&node!==host;node=node.parentElement){
          const rgb=getComputedStyle(node).backgroundColor.match(/[\d.]+/g)?.map(Number);
          if(rgb&&rgb.length>=3&&(rgb.length<4||rgb[3]>0)){panel=node;break;}
        }
        previewPanels.add(panel);
      }
      // The host can also match data-a-target="viewer-card"; excluding just
      // its class from selectors is insufficient. Keep actual children eligible.
      const candidates=[...new Set([...document.querySelectorAll(selectors),...previewPanels])].filter(el=>!el.classList.contains('chat-room__viewer-card')&&!el.classList.contains('tbk-chat-notice')&&!previewHost(el)&&!el.closest('.tbk-ambilight-ui,.tbk-glass-filter'));
      const selected=new Set(candidates.filter(el=>!candidates.some(parent=>parent!==el&&parent.contains(el))));
      for(const[el,entry]of this.entries)if(!selected.has(el)||!el.isConnected){this.release(el,entry);this.entries.delete(el);}
      const glass=s.windowStyle!=='native';
      if(s.windowStyle==='refract'){this.filter();this.displacement.setAttribute('scale',String(s.windowRefraction));}
      for(const el of selected){
        if(previewPanels.has(el)){if(!el.classList.contains('tbk-sidebar-preview'))el.classList.add('tbk-sidebar-preview');}else if(el.classList.contains('tbk-sidebar-preview'))el.classList.remove('tbk-sidebar-preview');
        let entry=this.entries.get(el);
        if(!entry){
          entry={clear:new Set(),original:new Map()};this.entries.set(el,entry);
        }
        const themeRoot=el.closest('.tw-root--theme-light,.tw-root--theme-dark,[data-theme]');
        const themeKey=[document.documentElement.className,document.documentElement.getAttribute('data-theme'),document.body.className,getComputedStyle(document.body).color,themeRoot?.className,themeRoot?.getAttribute('data-theme'),el.parentElement?getComputedStyle(el.parentElement).color:'',el.style.color,[...el.classList].filter(c=>!c.startsWith('tbk-')).join(' ')].join('|');
        if(entry.themeKey!==themeKey){
          // Read the native colour only after removing our own override, and only
          // when theme context changes; repeated class writes would feed observers.
          el.classList.remove('tbk-window-surface');
          const rgb=getComputedStyle(el).color.match(/[\d.]+/g)?.map(Number)||[255,255,255];entry.light=rgb.slice(0,3).reduce((a,b)=>a+b,0)<380;entry.themeKey=themeKey;
        }
        const set=(key,value)=>{if(!entry.original.has(key))entry.original.set(key,[el.style.getPropertyValue(key),el.style.getPropertyPriority(key)]);if(el.style.getPropertyValue(key)!==value)el.style.setProperty(key,value);};
        if(!el.classList.contains('tbk-window-surface'))el.classList.add('tbk-window-surface');
        const opacity=glass?s.windowOpacity/100:1;
        set('--tbk-window-bg',entry.light?`rgba(245,245,248,${opacity})`:`rgba(24,24,27,${opacity})`);
        set('--tbk-window-fg',entry.light?'#18181b':'#efeff1');
        set('--tbk-window-filter',glass?`${s.windowStyle==='refract'?`url("#${this.id}") `:''}blur(${s.windowBlur}px) saturate(110%)`:'none');
        set('--tbk-window-highlight',glass?String(s.windowHighlights/100):'0');
        for(const node of entry.clear)if(!glass||!el.contains(node)){node.classList.remove('tbk-window-clear');entry.clear.delete(node);}
        if(glass)for(const node of el.querySelectorAll('div,section,header,article')){
          if(entry.clear.has(node)||node.closest(protectedElements))continue;
          const style=getComputedStyle(node),rgb=style.backgroundColor.match(/[\d.]+/g)?.map(Number);
          if(rgb&&rgb.length>=3&&Math.max(...rgb.slice(0,3))-Math.min(...rgb.slice(0,3))<20&&style.backgroundImage==='none'){node.classList.add('tbk-window-clear');entry.clear.add(node);}
        }
      }
    }
    release(el,entry){el.classList.remove('tbk-window-surface','tbk-sidebar-preview');for(const node of entry.clear)node.classList.remove('tbk-window-clear');for(const[k,[v,priority]]of entry.original){if(v)el.style.setProperty(k,v,priority);else el.style.removeProperty(k);}}
    destroy(){for(const[el,entry]of this.entries)this.release(el,entry);this.entries.clear();this.svg?.remove();this.svg=null;this.displacement=null;}
  }
  TBK.WindowSurfaces=WindowSurfaces;TBK.windowSelectors=selectors;
})();
