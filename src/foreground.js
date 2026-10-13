/* Local background planes keep native content above ambient light without lifting
 * whole Twitch stacking contexts or changing their interactive layout. */
(() => {
  const pageSelectors='.channel-info-content,.channel-info-bar,.channel-root__info,.channel-panels,.about-section,.channel-page__about-content,[data-a-target="channel-info-bar"],[data-test-selector="channel-info-bar"]';
  const controlSelectors='.player-controls,[data-a-target="player-controls"],.player-controls__right-control-group';
  class Foreground {
    constructor(root){this.root=root;this.entries=new Map();}
    controlHost(el){
      let overlay=null;
      for(let node=el.parentElement;node;node=node.parentElement){
        if(node.matches?.('.video-player__container'))return node;
        if(node.matches?.('.video-player__overlay'))overlay=node;
        if(node===this.root)break;
      }
      return overlay||el.parentElement||el;
    }
    reconcile(){
      const controls=new Set(this.root.querySelectorAll(controlSelectors));
      const candidates=[...document.querySelectorAll(pageSelectors),...controls].filter(el=>!el.contains(this.root));
      // One background per outermost region, not one per button or nested wrapper.
      const selected=new Set(candidates.filter(el=>!candidates.some(other=>other!==el&&other.contains(el))));
      for(const [el,entry] of this.entries)if(!selected.has(el)||!el.isConnected||(entry.control&&this.controlHost(el)!==entry.host)){this.release(el,entry);this.entries.delete(el);}
      for(const el of selected)if(!this.entries.has(el)){
        const plane=document.createElement('div');plane.className='tbk-foreground-light';plane.setAttribute('aria-hidden','true');
        const positioned=getComputedStyle(el).position==='static';
        el.classList.add('tbk-foreground-surface');if(positioned)el.classList.add('tbk-foreground-position');
        const control=controls.has(el),host=control?this.controlHost(el):el;
        const hostPositioned=control&&host&&getComputedStyle(host).position==='static';
        if(hostPositioned)host.classList.add('tbk-controls-host-position');
        if(control){host.classList.add('tbk-controls-stable-host');plane.classList.add('tbk-controls-light');el.classList.add('tbk-controls-over-light');}
        let overlay=null;if(control)for(let n=el.parentElement;n&&n!==host;n=n.parentElement)if(n.matches?.('.video-player__overlay')){overlay=n;break;}
        (host||el).prepend(plane);this.entries.set(el,{plane,canvases:[],positioned,surfaces:new Set(),control,overlay,element:el,host:host||el,hostPositioned});
      }
      for(const entry of this.entries.values())entry.surfaceDirty=true;
    }
    updateSurfaces(el,entry,enabled){
      // Only neutral opaque wrapper backgrounds hide the ambient plane. Keep
      // coloured accents, images and interactive controls in their native form.
      const popups=TBK.windowSelectors||'[role="dialog"],[role="menu"],[role="tooltip"]';
      for(const node of entry.surfaces)if(!enabled||!el.contains(node)||node.closest(popups)){node.classList.remove('tbk-foreground-clear');entry.surfaces.delete(node);}
      if(!enabled)return;
      for(const node of el.querySelectorAll('div,section,article')){
        if(entry.surfaces.has(node))continue;
        if(node===entry.plane||entry.plane.contains(node)||node.getAttribute?.('role')||node.closest?.('button,a,input,[role="button"],[role="progressbar"],.tbk-ambilight-ui,'+popups))continue;
        const style=getComputedStyle(node),rgb=(style.backgroundColor||'').match(/[\d.]+/g)?.map(Number);
        if(rgb&&rgb.length>=3&&(rgb.length<4||rgb[3]>0)&&Math.max(...rgb.slice(0,3))-Math.min(...rgb.slice(0,3))<16&&Math.max(...rgb.slice(0,3))<90&&(!style.backgroundImage||style.backgroundImage==='none')){
          node.classList.add('tbk-foreground-clear');entry.surfaces.add(node);
        }
      }
    }
    layout(picture,options){
      this.picture=picture;this.options=options;
      for(const [el,entry] of this.entries){
        // React may replace className without replacing the DOM node.
        const ensure=(node,name)=>{if(!node.classList.contains(name))node.classList.add(name);};
        ensure(el,'tbk-foreground-surface');if(entry.positioned)ensure(el,'tbk-foreground-position');
        if(entry.control){ensure(el,'tbk-controls-over-light');ensure(entry.host,'tbk-controls-stable-host');if(entry.overlay)ensure(entry.overlay,'tbk-controls-native-overlay');if(entry.hostPositioned)ensure(entry.host,'tbk-controls-host-position');}
        if(entry.plane.parentElement!==entry.host)entry.host.prepend(entry.plane);
        entry.plane.hidden=!options.enabled||!TBK.player.isVisibleUI(entry.control?entry.host:el);
        const activeControl=entry.control&&options.enabled;
        if(activeControl&&!el.classList.contains('tbk-controls-active'))el.classList.add('tbk-controls-active');
        if(!activeControl&&el.classList.contains('tbk-controls-active'))el.classList.remove('tbk-controls-active');
        if(entry.surfaceEnabled!==options.enabled||entry.surfaceDirty){this.updateSurfaces(el,entry,options.enabled);entry.surfaceEnabled=options.enabled;entry.surfaceDirty=false;}
        const region=entry.control?entry.host:el;entry.region=region;
        const box=region.getBoundingClientRect();entry.box=box;
        if(entry.control){
          const parent=entry.host.getBoundingClientRect(),px=entry.host.offsetWidth?parent.width/entry.host.offsetWidth:1,py=entry.host.offsetHeight?parent.height/entry.host.offsetHeight:1;
          Object.assign(entry.plane.style,{left:`${(box.left-parent.left)/(px||1)-(entry.host.clientLeft||0)}px`,top:`${(box.top-parent.top)/(py||1)-(entry.host.clientTop||0)}px`,width:`${box.width/(px||1)}px`,height:`${box.height/(py||1)}px`,right:'auto',bottom:'auto'});
        }
        // Map viewport geometry into the local padding box, including borders/scale.
        const sx=region.offsetWidth?box.width/region.offsetWidth:1,sy=region.offsetHeight?box.height/region.offsetHeight:1;
        const left=box.left+(region.clientLeft||0)*sx,top=box.top+(region.clientTop||0)*sy;
        while(entry.canvases.length<options.layers){const canvas=document.createElement('canvas');entry.plane.append(canvas);entry.canvases.push(canvas);}
        while(entry.canvases.length>options.layers)entry.canvases.pop().remove();
        entry.plane.style.opacity=String(Math.min(1,options.opacity/100*options.intensity/100));
        for(const [i,canvas]of entry.canvases.entries()){
          const spread=options.spread*(1-i/(options.layers+1));
          Object.assign(canvas.style,{left:`${(picture.left-spread-left)/(sx||1)}px`,top:`${(picture.top-spread-top)/(sy||1)}px`,width:`${(picture.width+spread*2)/(sx||1)}px`,height:`${(picture.height+spread*2)/(sy||1)}px`,filter:`blur(${options.blur}px) saturate(${options.saturation}%) brightness(${options.brightness}%) contrast(${options.contrast}%)`,opacity:String(1/(i+1))});
        }
        // Controls may overlap video: preserve the un-tinted picture there too.
        const bounds={left:0,top:0,right:box.width/(sx||1),bottom:box.height/(sy||1)};
        const hole={left:(picture.left-left)/(sx||1),top:(picture.top-top)/(sy||1),right:(picture.left+picture.width-left)/(sx||1),bottom:(picture.top+picture.height-top)/(sy||1)};
        entry.plane.style.clipPath=TBK.geometry.clipPath(bounds,[hole]);
      }
    }
    draw(source,edge){
      for(const entry of this.entries.values()){
        if(entry.plane.hidden)continue;
        if(edge?.extent){
          if(!entry.edge){entry.edge=document.createElement('canvas');entry.plane.append(entry.edge);}
          entry.edge.hidden=false;entry.plane.append(entry.edge);
          const picture=this.picture,box=entry.box,el=entry.region;
          const sx=el.offsetWidth?box.width/el.offsetWidth:1,sy=el.offsetHeight?box.height/el.offsetHeight:1;
          Object.assign(entry.edge.style,{left:`${(picture.left-edge.xPad-box.left-(el.clientLeft||0)*sx)/(sx||1)}px`,top:`${(picture.top-edge.yPad-box.top-(el.clientTop||0)*sy)/(sy||1)}px`,width:`${(picture.width+edge.xPad*2)/(sx||1)}px`,height:`${(picture.height+edge.yPad*2)/(sy||1)}px`,filter:'none'});
          if(entry.edge.width!==edge.canvas.width)entry.edge.width=edge.canvas.width;if(entry.edge.height!==edge.canvas.height)entry.edge.height=edge.canvas.height;
          const ctx=entry.edge.getContext('2d');ctx.clearRect(0,0,entry.edge.width,entry.edge.height);ctx.drawImage(edge.canvas,0,0);
        }else if(entry.edge)entry.edge.hidden=true;
        // No second video decode, readback or animation callback.
        for(const canvas of entry.canvases){
          if(canvas.width!==source.width)canvas.width=source.width;if(canvas.height!==source.height)canvas.height=source.height;
          canvas.getContext('2d',{alpha:false}).drawImage(source,0,0);
        }
      }
    }
    hide(){for(const entry of this.entries.values())entry.plane.hidden=true;}
    release(el,entry){if(entry.overlay)entry.overlay.classList.remove('tbk-controls-native-overlay');el.classList.remove('tbk-controls-over-light','tbk-controls-active');if(entry.control)entry.host.classList.remove('tbk-controls-stable-host');if(entry.hostPositioned)entry.host.classList.remove('tbk-controls-host-position');for(const node of entry.surfaces)node.classList.remove('tbk-foreground-clear');entry.surfaces.clear();entry.plane.remove();el.classList.remove('tbk-foreground-surface');if(entry.positioned)el.classList.remove('tbk-foreground-position');for(const c of entry.canvases)c.width=c.height=1;if(entry.edge)entry.edge.width=entry.edge.height=1;}
    destroy(){for(const [el,entry]of this.entries)this.release(el,entry);this.entries.clear();}
  }
  TBK.Foreground=Foreground;
})();
