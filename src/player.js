(() => {
  const ROOT = '[data-a-target="player"],.video-player,.video-player__container';
  function findPlayer() {
    const candidates=[...document.querySelectorAll('video')].map(video=>{
      const rect=video.getBoundingClientRect(),style=getComputedStyle(video);
      const root=video.closest(ROOT);
      if(!root||!video.isConnected||rect.width<120||rect.height<70||style.visibility==='hidden'||style.display==='none'||style.opacity==='0')return null;
      if(document.fullscreenElement&&!document.fullscreenElement.contains(video))return null;
      const visible=Math.max(0,Math.min(rect.right,innerWidth)-Math.max(rect.left,0))*Math.max(0,Math.min(rect.bottom,innerHeight)-Math.max(rect.top,0));
      return visible ? {video,root,score:visible*(video.paused?1:1.2)} : null;
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
    return candidates[0]||null;
  }
  function mode(root) {
    if(document.fullscreenElement?.contains(root)||root?.contains(document.fullscreenElement))return 'fullscreen';
    if(root?.closest('.persistent-player--theatre')||document.querySelector('.persistent-player--theatre,[data-a-target="player-theatre-mode-button"][aria-pressed="true"]'))return 'theater';
    return 'normal';
  }
  function controls(root) {
    return root.querySelector('[data-a-target="player-controls__right-control-group"],.player-controls__right-control-group') || root.querySelector('[data-a-target="player-settings-button"]')?.parentElement?.parentElement;
  }
  // Convert the CSS video box to the actual contain-fitted image rectangle.
  function pictureRect(video) {
    const r=video.getBoundingClientRect();
    if(!video.videoWidth||!video.videoHeight||getComputedStyle(video).objectFit==='fill')return r;
    const ratio=Math.min(r.width/video.videoWidth,r.height/video.videoHeight);
    const width=video.videoWidth*ratio,height=video.videoHeight*ratio;
    return {left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2,width,height,right:r.left+(r.width+width)/2,bottom:r.top+(r.height+height)/2};
  }
  TBK.player={find:findPlayer,mode,controls,pictureRect};
})();

// Subtract the union of protected rectangles. Unlike an even-odd mask, overlapping
// exclusions cannot turn the light back on (e.g. settings crossing the video edge).
(() => {
  function subtractRects(bounds, exclusions) {
    let pieces = [bounds];
    for (const cut of exclusions) {
      if (![cut.left,cut.top,cut.right,cut.bottom].every(Number.isFinite)) continue;
      const next=[];
      for(const r of pieces){
        const l=Math.max(r.left,cut.left),t=Math.max(r.top,cut.top),b=Math.min(r.bottom,cut.bottom),right=Math.min(r.right,cut.right);
        if(l>=right||t>=b){next.push(r);continue;}
        if(r.top<t)next.push({left:r.left,top:r.top,right:r.right,bottom:t});
        if(b<r.bottom)next.push({left:r.left,top:b,right:r.right,bottom:r.bottom});
        if(r.left<l)next.push({left:r.left,top:t,right:l,bottom:b});
        if(right<r.right)next.push({left:right,top:t,right:r.right,bottom:b});
      }
      pieces=next;
    }
    return pieces;
  }
  function clipPath(bounds, exclusions){
    const local=n=>Number(n.toFixed(3));
    const path=subtractRects(bounds,exclusions).map(r=>{
      const l=local(r.left-bounds.left),t=local(r.top-bounds.top),right=local(r.right-bounds.left),b=local(r.bottom-bounds.top);
      return `M${l} ${t}H${right}V${b}H${l}Z`;
    }).join('');
    return `path("${path||'M0 0H0V0Z'}")`;
  }
  TBK.geometry={subtractRects,clipPath};
})();

// Protect actual foreground widgets, never the full-width empty controls wrapper.
(() => {
  function isVisibleUI(el){
    if(!el||!el.isConnected)return false;
    for(let node=el;node;node=node.parentElement){
      if(node.hidden)return false;
      const style=getComputedStyle(node);
      if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||style.opacity==='0')return false;
    }
    return true;
  }
  function foregroundElements(root){
    const elements=new Set(root.querySelectorAll('[data-a-target="player-settings-menu"],.player-settings-menu,[role="dialog"],[role="menu"],.tbk-ambilight-gear'));
    for(const group of root.querySelectorAll('.player-controls,.player-controls__right-control-group,[data-a-target="player-controls"]')){
      for(const el of group.querySelectorAll('button,input,[role="button"],[role="slider"]'))elements.add(el);
    }
    return elements;
  }
  Object.assign(TBK.player,{isVisibleUI,foregroundElements});
})();
