(() => {
  const css=`:host{font:13px/1.4 system-ui,sans-serif;color:#efeff1;color-scheme:dark}*{box-sizing:border-box} [hidden]{display:none!important} .panel{pointer-events:auto;position:absolute;right:12px;top:12px;width:min(355px,calc(100% - 24px));max-height:calc(100% - 66px);overflow:auto;background:#18181bf5;border:1px solid #55515e;border-radius:10px;box-shadow:0 8px 30px #0009;padding:16px}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}h2{font-size:16px;margin:0}button,select,input{font:inherit}button,select{border:1px solid #58525f;border-radius:5px;color:inherit;background:#29262e;padding:6px 9px;cursor:pointer}button:hover{background:#403747}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #c2a4f5;outline-offset:2px}label{display:block;margin:10px 0}label span{display:flex;justify-content:space-between;gap:8px}input[type=range]{display:block;width:100%;accent-color:#af91d6}input[type=checkbox]{accent-color:#af91d6;margin-right:8px}output{color:#c6b4df;white-space:nowrap}select{width:100%;margin-top:4px}nav{display:flex;gap:5px;margin:12px 0}nav button{flex:1;font-size:12px;padding:6px 3px}nav button[aria-pressed=true]{background:#594275;border-color:#c2a4f5}.tools{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.note{font-size:11px;color:#bab5c2;margin:8px 0}.status{white-space:pre-wrap;font-size:11px;overflow-wrap:anywhere}.monitor{position:absolute;left:12px;top:12px;padding:8px;background:#141218db;color:#e4d6f8;white-space:pre;font:11px/1.4 monospace;border-radius:5px;pointer-events:none}summary{cursor:pointer;margin:12px 0}hr{border:0;border-top:1px solid #45404c}textarea{width:100%;height:110px;background:#111;color:white}.credits a{color:#c9b1ec;text-decoration:underline}.credits pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.5 monospace}.credits{font-size:12px;margin-top:16px}`;
  const node=(tag,attrs={},text)=>{const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;};
  const download=(name,text)=>{const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=node('a',{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  class UI {
    constructor(root,settings,engine){
      this.root=root;this.settings=settings;this.engine=engine;this.mode=engine.mode;this.abort=new AbortController();
      this.oldPosition=root.style.position;if(getComputedStyle(root).position==='static'){root.style.position='relative';this.changedPosition=true;}
      this.host=node('div',{class:'tbk-ambilight-ui'});this.shadow=this.host.attachShadow({mode:'open'});this.shadow.append(node('style',{},css));
      this.shadow.append(node('style',{},'details[data-section]{border:1px solid #45414b;border-radius:7px;margin:8px 0;padding:0 10px}details[data-section]>summary{font-weight:600;padding:10px 0;margin:0}.preset-block{border:1px solid #55515e;border-radius:7px;padding:10px;margin:9px 0}.preset-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.preset-heading strong{overflow-wrap:anywhere}.preset-actions button{font-size:11px;padding:3px 5px}.preset-block input[type=text]{width:100%;margin-top:8px;background:#242127;color:#efeff1;border:1px solid #888;border-radius:4px;padding:5px}.add-preset{width:100%;font-size:20px}.panel{width:min(385px,calc(100% - 24px))}'));
      this.panel=node('section',{class:'panel',role:'dialog','aria-label':'Настройки TBK Ambilight',hidden:''});
      this.engine.settingsPanel=this.panel;this.engine.resizeObserver.observe(this.panel);
      this.shadow.append(this.panel);this.monitor=node('div',{class:'monitor',hidden:''});this.shadow.append(this.monitor);root.append(this.host);
      this.gear=node('button',{class:'tbk-ambilight-gear',type:'button',title:'TBK Ambilight — настройки','aria-label':'Настройки TBK Ambilight','aria-expanded':'false'});
      this.gear.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M9 2h6l.5 3 2 .9 2.5-1 3 5-2.4 1.9v2.4l2.4 1.9-3 5-2.5-1-2 .9L15 24H9l-.5-3-2-.9-2.5 1-3-5 2.4-1.9v-2.4L1 9l3-5 2.5 1 2-.9Z" transform="translate(1 0) scale(.92)" stroke="currentColor" stroke-width="1.4"/><g stroke="currentColor" stroke-width="1.3"><rect x="8" y="8" width="8" height="8" rx="1"/><path d="M12 5v2m0 10v2M5 12h2m10 0h2M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2"/></g></svg>';
      this.quick=node('div',{class:'tbk-quick-controls'});
      this.power=node('button',{class:'tbk-power-switch',type:'button',role:'switch','aria-label':'Включить расширение TBK'});
      this.power.innerHTML='<span class="tbk-switch-label"></span><span class="tbk-switch-thumb" aria-hidden="true"></span>';
      this.power.onclick=e=>{e.preventDefault();e.stopPropagation();this.settings.change('enabled',!this.settings.data.enabled);};
      this.quick.append(this.power,this.gear);
      for(const event of ['pointerdown','pointerup','keydown','keyup','dblclick'])this.quick.addEventListener(event,e=>e.stopPropagation());
      this.gear.onclick=e=>{e.preventDefault();e.stopPropagation();this.toggle();};
      // Block bubbling to player click/keyboard shortcuts without preventing form defaults.
      for(const event of ['click','dblclick','pointerdown','pointerup','keydown','keyup','wheel'])this.panel.addEventListener(event,e=>e.stopPropagation());
      this.panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();this.close();}});
      document.addEventListener('keydown',e=>{if(!this.panel.hidden&&e.key==='Escape'){e.preventDefault();e.stopPropagation();this.close();}},{capture:true,signal:this.abort.signal});
      document.addEventListener('pointerdown',e=>{if(!this.panel.hidden&&!e.composedPath().includes(this.host)&&!e.composedPath().includes(this.gear))this.close(false);},{signal:this.abort.signal});
      this.unsubscribe=settings.subscribe(()=>{if(!this.editing)this.sync();});this.ensure();this.build();this.timer=setInterval(()=>this.status(),750);
    }
    ensure(){const target=TBK.player.controls(this.root)||this.root;if(this.quick.parentElement!==target)target.append(this.quick);this.quick.toggleAttribute('data-fallback',target===this.root);this.gear.toggleAttribute('data-fallback',target===this.root);if(!this.host.isConnected)this.root.append(this.host);}
    toggle(){if(this.panel.hidden){this.mode=this.engine.mode;this.build();this.panel.hidden=false;this.gear.setAttribute('aria-expanded','true');this.panel.querySelector('button').focus();this.engine.layout();}else this.close();}
    close(focus=true){this.panel.hidden=true;this.gear.setAttribute('aria-expanded','false');if(focus)this.gear.focus();this.settings.flush();this.engine.layout();}
    build(){
      const expanded=new Set([...this.panel.querySelectorAll('details[data-section][open]')].map(el=>el.dataset.section));
      this.panel.replaceChildren();const header=node('header');header.append(node('h2',{},'TBK Ambilight'));
      const close=node('button',{type:'button','aria-label':'Закрыть настройки'},'×');close.onclick=()=>this.close();header.append(close);this.panel.append(header);
      this.target=this.panel;this.addCheck('enabled','Расширение включено');
      const eco=node('label'),ecoInput=node('input',{type:'checkbox','data-economy':''});ecoInput.onchange=()=>{this.settings.setEconomy(ecoInput.checked);this.sync();};eco.append(ecoInput,document.createTextNode('Экономичный режим'));this.panel.append(eco);
      const ecoTools=node('div',{class:'tools'});this.ecoEdit=node('button',{type:'button'},'Редактировать экономичный режим');this.ecoEdit.onclick=()=>{this.settings.setEconomyEditing(!this.settings.economyEditing);this.sync();};
      const ecoReset=node('button',{type:'button'},'Сброс экономии');ecoReset.onclick=()=>{this.settings.resetEconomy();this.sync();};ecoTools.append(this.ecoEdit,ecoReset);
      const nav=node('nav',{'aria-label':'Профиль настроек'});
      for(const[mode,title]of [['normal','Обычный'],['theater','Кинотеатр'],['fullscreen','Полный экран']]){const b=node('button',{type:'button','aria-pressed':String(this.mode===mode)},title);b.onclick=()=>{this.mode=mode;this.build();};nav.append(b);}this.panel.append(nav);
      this.panel.append(node('p',{class:'note'},'Изменения применяются и сохраняются автоматически. Профиль выбирается по режиму плеера.'));
      const section=(id,title)=>{const d=node('details',{'data-section':id});d.open=expanded.has(id);d.append(node('summary',{},title));this.panel.append(d);this.target=d;return d;};
      const choose=key=>{const[k,title,choices]=TBK.choices.find(x=>x[0]===key),label=node('label',{},title),select=node('select',{'data-key':k,'aria-label':title});for(const[v,t]of choices)select.append(node('option',{value:v},t));select.onchange=()=>this.update(k,select.value);label.append(select);this.target.append(label);};
      section('effect','Эффект подсветки');choose('effect');this.addSliders(TBK.sliders.filter(x=>['intensity','spread','edgeTransition','edgeStrength','blur','layers','inset'].includes(x[0])));
      section('colour','Цвет и плавность');this.addSliders(TBK.sliders.filter(x=>['saturation','brightness','contrast','opacity','responsiveness','smoothness','darkBoost','flashLimit'].includes(x[0])));
      const motion=section('motion','Движение эффекта');motion.setAttribute('data-motion','');this.addSliders(TBK.effectSliders);
      section('performance','Производительность и PiP');this.target.append(ecoTools);choose('fps');choose('renderer');this.addSliders(TBK.sliders.filter(x=>x[0]==='quality'));for(const[k,title]of TBK.checks)this.addCheck(k,title);
      this.panel.append(node('p',{class:'note'},'«Мягкий переход у края»: ширина размытой внешней зоны подсветки; 0 — выключено. «Выраженность перехода» усиливает его отдельно: 100% — базовый уровень, 0% — выключено. Видео не размывается. «Уменьшение видео» создаёт поля для света, в том числе в fullscreen. Лимит яркости ограничивает среднюю яркость кадра, а не все вспышки.'));
      section('chat','Оформление чата');
      this.addCheck('chatEnabled','Оформление чата включено');
      const colorLabel=node('label',{},'Цвет фона чата'),color=node('input',{type:'color','data-key':'chatColor','aria-label':'Цвет фона чата'});
      color.oninput=()=>this.update('chatColor',color.value);color.onchange=()=>this.settings.flush();colorLabel.append(color);this.target.append(colorLabel);
      this.addSliders(TBK.chatSliders);
      this.target.append(node('p',{class:'note'},'Меняется только фон, текст остаётся резким. Полный OFF возвращает обычный Twitch.'));
      section('windows','Окна и стекло');choose('windowStyle');this.addSliders(TBK.windowSliders);
      section('presets','Пресеты и перенос настроек');
      const tools=node('div',{class:'tools'});
      const button=(text,fn)=>{const b=node('button',{type:'button'},text);b.onclick=fn;tools.append(b);};
      button('Сброс профиля',()=>{this.settings.reset(this.mode);this.sync();});
      button('Экспорт',()=>download('TBK-Twitch-settings.json',this.settings.export()));
      const file=node('input',{type:'file',accept:'.json,application/json',hidden:''});file.onchange=async()=>{try{if(!file.files[0])return;if(file.files[0].size>1000000)throw Error('Файл слишком большой');this.settings.import(await file.files[0].text());this.build();}catch(e){this.notice=e.message;this.status();}file.value='';};
      button('Импорт',()=>file.click());this.target.append(tools,file);this.presetList=node('div',{class:'preset-list'});this.presetRows=new Map();this.target.append(this.presetList);
      const add=node('button',{type:'button','aria-label':'Добавить пресет',class:'add-preset'},'+');add.onclick=()=>{try{this.settings.createPreset();this.build();}catch(e){this.notice=e.message;this.status();}};this.target.append(add);
      this.clipboardBox=node('div',{hidden:''});this.clipboardText=node('textarea',{'aria-label':'Данные пресета для копирования или вставки'});const apply=node('button',{type:'button'},'Вставить в пресет');apply.onclick=()=>{try{this.settings.pastePreset(this.pasteTarget,this.clipboardText.value);this.build();}catch(e){this.notice=e.message;this.status();}};this.clipboardBox.append(this.clipboardText,apply);this.target.append(this.clipboardBox);
      section('diagnostics','Диагностика');const retry=node('button',{type:'button'},'Повторить запуск');retry.onclick=()=>this.engine.retry();const diag=node('button',{type:'button'},'Скачать диагностику');diag.onclick=()=>download('TBK-Twitch-diagnostics.json',JSON.stringify(this.engine.diagnostics(),null,2));this.target.append(retry,diag);
      this.message=node('p',{class:'status',role:'status'});this.panel.append(this.message);this.addCredits();this.sync();
    }
    addCredits(){
      const c=TBK.credits,details=node('details',{class:'credits'});
      details.append(node('summary',{},'Open-source acknowledgements'));
      details.append(node('p',{},'TBK Twitch Ambilight · Copyright (c) 2026 TheBigKotovski (TBK) · MIT'));
      details.append(node('p',{},'Содержит адаптированный код исходного проекта:'));
      for(const text of [c.name,c.author+' — original repository',c.repository]){
        const line=node('p');line.append(node('a',{href:c.repository,target:'_blank',rel:'noopener noreferrer'},text));details.append(line);
      }
      details.append(node('p',{},'Отдельный проект TBK. Автор оригинала не заявлен автором или сопровождающим этой версии; официальная связь и поддержка не заявляются.'));
      const upstream=node('details');upstream.append(node('summary',{},'MIT License — исходный проект'),node('pre',{},c.license));details.append(upstream);
      const own=node('details');own.append(node('summary',{},'MIT License — новый код TBK'),node('pre',{},c.ownLicense));details.append(own);
      this.panel.append(details);
    }
    addSliders(list){
      for(const[k,title,min,max,,unit]of list){const label=node('label',{'data-control':k}),line=node('span'),output=node('output',{'data-output':k});line.append(node('b',{},title),output);const input=node('input',{type:'range',min,max,step:1,'data-key':k,'aria-label':title});input.oninput=()=>{output.value=input.value+unit;this.update(k,Number(input.value));};input.onchange=()=>this.settings.flush();label.append(line,input);this.target.append(label);}
    }
    addCheck(k,title){const label=node('label'),input=node('input',{type:'checkbox','data-key':k});input.onchange=()=>this.update(k,input.checked);label.append(input,document.createTextNode(title));this.target.append(label);}
    update(k,value){this.editing=true;try{this.settings.change(k,value,this.mode);}finally{this.editing=false;}this.sync();}
    presets(){
      if(!this.presetList)return;
      const ids=new Set(this.settings.data.presets.map(p=>p.id));for(const[id,row]of this.presetRows)if(!ids.has(id)){row.block.remove();this.presetRows.delete(id);}
      for(const p of this.settings.data.presets){
        const row=this.presetRows.get(p.id);if(row){row.name.textContent=p.name;row.toggle.checked=this.settings.data.activePreset===p.id;row.toggle.setAttribute('aria-label','Включить пресет '+p.name);row.rename.setAttribute('aria-label','Название пресета '+p.name);if(this.shadow.activeElement!==row.rename)row.rename.value=p.name;continue;}
        const block=node('div',{class:'preset-block','data-preset':p.id}),heading=node('div',{class:'preset-heading'}),name=node('strong',{},p.name),toggle=node('input',{type:'checkbox',role:'switch','aria-label':'Включить пресет '+p.name});toggle.checked=this.settings.data.activePreset===p.id;toggle.onchange=()=>this.settings.selectPreset(toggle.checked?p.id:null);heading.append(name,toggle);block.append(heading);
        const actions=node('div',{class:'tools preset-actions'}),button=(title,fn)=>{const b=node('button',{type:'button'},title);b.onclick=fn;actions.append(b);};
        const rename=node('input',{type:'text',maxlength:'80','aria-label':'Название пресета '+p.name,hidden:''});rename.value=p.name;
        const saveName=()=>{this.settings.renamePreset(p.id,rename.value);rename.hidden=true;};rename.onchange=saveName;rename.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();saveName();actions.querySelector('button').focus();}};
        button('Переименовать',()=>{rename.hidden=false;rename.focus();rename.select();});button('Удалить',()=>this.settings.deletePreset(p.id));
        button('Копировать',async()=>{const text=this.settings.copyPreset(p.id);try{await navigator.clipboard.writeText(text);this.notice='Пресет скопирован';}catch{this.clipboardBox.hidden=false;this.clipboardText.value=text;this.clipboardText.focus();this.clipboardText.select();this.notice='Скопируйте выделенный текст: Ctrl+C';}this.status();});
        button('Вставить',async()=>{try{const text=await navigator.clipboard.readText();this.settings.pastePreset(p.id,text);this.notice='Параметры пресета вставлены';}catch(e){this.pasteTarget=p.id;this.clipboardBox.hidden=false;this.clipboardText.value='';this.clipboardText.focus();this.notice='Вставьте данные сюда через Ctrl+V и нажмите «Вставить в пресет»';}this.status();});
        block.append(actions,rename);this.presetRows.set(p.id,{block,name,toggle,rename});this.presetList.append(block);
      }
    }
    sync(){const s=this.settings.effective(this.mode);for(const input of this.panel.querySelectorAll('[data-key]')){const key=input.dataset.key;if(input.type==='checkbox')input.checked=s[key];else input.value=String(s[key]);const output=this.panel.querySelector(`[data-output="${key}"]`);if(output)output.value=String(s[key])+([...TBK.sliders,...TBK.chatSliders,...TBK.effectSliders,...TBK.windowSliders].find(x=>x[0]===key)?.[5]||'');}
      this.power.setAttribute('aria-checked',String(this.settings.data.enabled));this.power.querySelector('.tbk-switch-label').textContent=this.settings.data.enabled?'ON':'OFF';this.power.title=this.settings.data.enabled?'Выключить TBK':'Включить TBK';
      const eco=this.panel.querySelector('[data-economy]');if(eco)eco.checked=this.settings.data.economyEnabled;
      if(this.ecoEdit)this.ecoEdit.textContent=this.settings.economyEditing?'Завершить редактирование экономии':'Редактировать экономичный режим';
      const motion=this.panel.querySelector('[data-motion]');if(motion)motion.hidden=!['flow','rays','waves'].includes(s.effect);
      for(const k of ['windowOpacity','windowBlur','windowRefraction','windowHighlights']){const el=this.panel.querySelector(`[data-control="${k}"]`);if(el)el.hidden=s.windowStyle==='native'||(k==='windowRefraction'&&s.windowStyle!=='refract');}
      this.panel.style.backgroundColor=s.windowStyle==='native'?'#18181bf5':`rgba(24,24,27,${s.windowOpacity/100})`;this.panel.style.backdropFilter=s.windowStyle==='native'?'none':`blur(${s.windowBlur}px)`;
      this.presets();this.status();}
    status(){const d=this.engine.diagnostics(),s=this.engine.options;this.monitor.hidden=!s.pluginEnabled||!s.showMonitor;this.monitor.textContent=`TBK · ${d.renderer||'—'} · ${d.mode}\n${d.video} · ${d.paused?'пауза':d.fps+' FPS'} · ${d.frameMs} ms\ncallbacks ${d.pendingCallbacks}${d.error?'\n'+d.error:''}`;if(this.message)this.message.textContent=[this.notice,`Активный режим: ${{normal:'обычный',theater:'кинотеатр',fullscreen:'полный экран'}[d.mode]}`,this.settings.economyEditing?'Редактируется экономичная преднастройка':this.settings.data.economyEnabled?'Экономичный режим':null,d.error,d.warning,d.storageError].filter(Boolean).join('\n');}
    destroy(){this.engine.resizeObserver.unobserve(this.panel);if(this.engine.settingsPanel===this.panel)this.engine.settingsPanel=null;clearInterval(this.timer);this.abort.abort();this.unsubscribe();this.quick.remove();this.host.remove();if(this.changedPosition&&this.root.style.position==='relative')this.root.style.position=this.oldPosition;}
  }
  TBK.UI=UI;
})();
