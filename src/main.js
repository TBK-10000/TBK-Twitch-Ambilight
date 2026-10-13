(async()=>{
  if(globalThis.__tbkTwitchAmbilight) return;
  const settings=new TBK.Settings();await settings.init();
  const windows=TBK.WindowSurfaces?new TBK.WindowSurfaces():null;
  const state={settings,engine:null,ui:null,route:location.pathname,disposed:false};globalThis.__tbkTwitchAmbilight=state;
  let scheduled=null;
  const unbind=()=>{state.ui?.destroy();state.engine?.destroy();windows?.destroy();state.ui=state.engine=null;};
  function reconcile(){
    scheduled=null;if(state.disposed)return;
    const found=TBK.player.find(),route=location.pathname;
    if(!found){unbind();state.route=route;return;}
    if(state.engine?.video!==found.video||state.engine?.root!==found.root||state.route!==route){
      unbind();state.route=route;
      try{state.engine=new TBK.Engine(found.video,found.root,settings);state.ui=new TBK.UI(found.root,settings,state.engine);}
      catch(e){unbind();console.error('[TBK Ambilight] Initialization:',e);return;}
    }else{
      const mode=state.engine.mode,pip=!!document.pictureInPictureElement;if(state.mode!==mode||state.pip!==pip){state.engine.refresh();state.mode=mode;state.pip=pip;}
      state.ui.ensure();if(state.engine.options.enabled)state.engine.foreground.reconcile();else state.engine.foreground.destroy();state.engine.layout();state.engine.foreground.draw(state.engine.ambient||state.engine.blend,state.engine.edge);state.engine.chat.reconcile(state.engine.options);
    }
    windows?.reconcile(settings.effective(state.engine.mode));
  }
  const request=()=>{if(scheduled===null&&!state.disposed)scheduled=setTimeout(reconcile,80);};
  const stopSettings=settings.subscribe(()=>{windows?.reconcile(settings.effective(state.engine?.mode||'normal'));request();});
  const observer=new MutationObserver(records=>{
    if(records.some(record=>!record.target.closest?.('.tbk-ambilight-glow,.tbk-ambilight-ui,.tbk-quick-controls,.tbk-chat-backdrop,.tbk-foreground-light,.tbk-glass-filter')&&
      (record.type==='attributes'||[...record.addedNodes,...record.removedNodes].some(n=>n.nodeType===1&&!n.matches?.('.tbk-ambilight-glow,.tbk-ambilight-ui,.tbk-quick-controls,.tbk-chat-backdrop,.tbk-foreground-light,.tbk-glass-filter')))))request();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-pressed','src']});
  const abort=new AbortController(),opts={signal:abort.signal};
  document.addEventListener('visibilitychange',()=>{state.engine?.refresh();request();},opts);
  document.addEventListener('fullscreenchange',()=>{state.engine?.refresh();request();},opts);
  window.addEventListener('resize',()=>{state.engine?.layout();request();},opts);
  window.addEventListener('scroll',()=>{state.engine?.layout();request();},{...opts,capture:true,passive:true});
  window.addEventListener('popstate',request,opts);
  if(window.navigation)window.navigation.addEventListener('navigatesuccess',request,opts);
  // Safety net for pushState in older Chromium and DOM changes outside observed attributes.
  const watchdog=setInterval(request,1200);
  window.addEventListener('pagehide',e=>{settings.flush();if(e.persisted){state.engine?.cancel();return;}state.disposed=true;clearTimeout(scheduled);clearInterval(watchdog);observer.disconnect();abort.abort();stopSettings();unbind();settings.destroy();},{once:false});
  window.addEventListener('pageshow',()=>{state.engine?.refresh();request();},opts);
  reconcile();
})();
