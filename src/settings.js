/* TBK Twitch Ambilight. Copyright (c) 2026 TheBigKotovski (TBK).
 * SPDX-License-Identifier: MIT — see ../LICENSE for TBK contributions.
 * Upstream attribution: ../THIRD-PARTY-NOTICES.md.
 * Isolated-world namespace, no page script injection. */
const TBK = {};
(() => {
  const KEY = 'tbk.twitch.ambilight.v2';
  const sliders = [
    ['intensity','Интенсивность',0,150,72,'%'], ['spread','Распространение',0,180,70,' px'],
    ['edgeTransition','Мягкий переход у края',0,300,0,' px'],
    ['edgeStrength','Выраженность перехода',0,300,180,'%'],
    ['blur','Размытие',0,100,42,' px'], ['saturation','Насыщенность',0,250,125,'%'],
    ['brightness','Яркость',30,180,110,'%'], ['contrast','Контраст',50,180,108,'%'],
    ['opacity','Непрозрачность',0,100,82,'%'], ['layers','Слои',1,4,2,''],
    ['responsiveness','Скорость реакции',0,100,78,'%'], ['smoothness','Сглаживание',0,100,58,'%'],
    ['quality','Качество',25,100,50,'%'], ['darkBoost','Усиление теней',0,50,12,'%'],
    ['flashLimit','Максимальная яркость кадра',20,100,88,'%'],
    ['inset','Уменьшение видео для полей',0,20,0,'%']
  ];
  const chatSliders = [
    ['chatIntensity','Интенсивность подсветки чата',0,100,55,'%'],
    ['chatOpacity','Непрозрачность фона чата',0,100,65,'%'],
    ['chatBlur','Матовое стекло — размытие',0,100,32,' px'],
    ['chatGrain','Шершавое стекло — зернистость',0,100,12,'%'],
    ['chatSmoothness','Плавность цвета чата',0,100,75,'%']
  ];
  const effectSliders=[['motionSpeed','Скорость движения',0,100,35,'%']];
  const windowSliders=[['windowOpacity','Плотность фона окон',65,100,85,'%'],['windowBlur','Размытие окон',0,40,18,' px'],['windowRefraction','Преломление',0,20,6,' px'],['windowHighlights','Блики',0,15,3,'%']];
  const allSliders = [...sliders,...chatSliders,...effectSliders,...windowSliders];
  const choices = [
    ['fps','Частота',[['15','15 FPS'],['24','24 FPS'],['30','30 FPS'],['60','60 FPS'],['video','По видеокадрам']]],
    ['renderer','Рендерер',[['auto','Автоматически'],['canvas','Canvas 2D'],['webgl','WebGL']]],
    ['effect','Эффект',[['classic','Классический'],['soft','Мягкое свечение'],['directional','Направленное свечение'],['flow','Растекание цвета'],['rays','Световые лучи'],['waves','Волны']]],
    ['windowStyle','Стиль окон',[['native','Обычный'],['matte','Матовое стекло'],['refract','Стекло с преломлением']]]
  ];
  const checks = [['detectBars','Определять чёрные полосы'],['pauseBackground','Пауза в фоновой вкладке'],['pipEnabled','Подсветка страницы при PiP'],['showMonitor','Монитор производительности']];
  const defaults = Object.fromEntries(allSliders.map(([key,,, ,value]) => [key,value]));
  Object.assign(defaults,{fps:'30',renderer:'auto',effect:'classic',windowStyle:'native',detectBars:true,pauseBackground:true,pipEnabled:false,showMonitor:false,chatEnabled:false,chatColor:'#18181b'});
  const sanitize = (input, partial = false) => {
    const out = partial ? {} : {...defaults};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
    for (const [k,,min,max] of allSliders) if (typeof input[k] === 'number' && Number.isFinite(input[k])) out[k] = Math.round(Math.max(min,Math.min(max,input[k])));
    for (const [k,,values] of choices) if (values.some(([v])=>v===input[k])) out[k]=input[k];
    for (const [k] of checks) if(typeof input[k]==='boolean') out[k]=input[k];
    if(typeof input.chatEnabled==='boolean')out.chatEnabled=input.chatEnabled;
    if(typeof input.chatColor==='string' && /^#[0-9a-f]{6}$/i.test(input.chatColor))out.chatColor=input.chatColor.toLowerCase();
    return out;
  };
  const bundle = raw => ({base:sanitize(raw?.base),profiles:Object.fromEntries(['theater','fullscreen'].map(mode=>[mode,sanitize(raw?.profiles?.[mode],true)]))});
  const validateBundle=raw=>{
    const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
    const check=(value,partial)=>{if(!object(value))throw Error('Неверная структура параметров пресета');const clean=sanitize(value,partial);if(Object.keys(value).some(k=>!(k in defaults)||value[k]!==clean[k])||(!partial&&Object.keys(defaults).some(k=>!(k in value))))throw Error('Неверные параметры пресета');};
    check(raw.base,false);if(!object(raw.profiles)||Object.keys(raw.profiles).some(k=>!['theater','fullscreen'].includes(k)))throw Error('Неверные профили пресета');for(const mode of ['theater','fullscreen'])check(raw.profiles[mode]===undefined?{}:raw.profiles[mode],true);
  };
  const economyDefaults=()=>bundle({base:{...defaults,renderer:'canvas',quality:25,fps:'15',layers:1,blur:32,smoothness:70,pauseBackground:true}});
  const presetName = name => (typeof name==='string'?name.trim().slice(0,80):'')||'Пресет';
  const normalize = raw => {
    const seen=new Set(),presets=[];
    for(const p of (Array.isArray(raw?.presets)?raw.presets:[]).slice(0,32)){
      if(typeof p?.id!=='string'||!p.id||p.id.length>80||seen.has(p.id))continue;
      seen.add(p.id);presets.push({id:p.id,name:presetName(p.name),...bundle(p)});
    }
    return {schema:3,enabled:raw?.enabled!==false,...bundle(raw),presets,activePreset:seen.has(raw?.activePreset)?raw.activePreset:null,economyEnabled:raw?.economyEnabled===true,economy:raw?.economy?bundle(raw.economy):economyDefaults()};
  };
  class Settings {
    data = normalize(); listeners = new Set(); saveChain = Promise.resolve(); error = ''; revision = 0; savedRevision = 0;
    async init() {
      try {
        const result = await chrome.storage.local.get(KEY);
        if(result[KEY]) this.data=normalize(result[KEY]);
        else {
          const legacy = (await chrome.storage.sync.get('tbkAmbilight_twitch')).tbkAmbilight_twitch;
          if(legacy) this.data=normalize({enabled:legacy.enabled,base:legacy,profiles:legacy.profiles});
        }
      } catch(e) { this.error='Не удалось прочитать настройки: '+e.message; }
      this.onStorage=(changes,area)=>{
        if(area!=='local'||!changes[KEY]||this.savedRevision!==this.revision) return;
        const next=normalize(changes[KEY].newValue);
        if(JSON.stringify(next)===JSON.stringify(this.data)) return;
        this.data=next;this.emit();
      };
      chrome.storage.onChanged.addListener(this.onStorage);
    }
    normalBundle(){
      if(this.cachedData!==this.data||this.cachedPreset!==this.data.activePreset){this.cachedData=this.data;this.cachedPreset=this.data.activePreset;this.cachedBundle=this.data.presets.find(p=>p.id===this.data.activePreset)||this.data;}
      return this.cachedBundle;
    }
    workingBundle(){return this.data.economyEnabled?this.data.economy:this.normalBundle();}
    effective(mode) {const b=this.workingBundle();return {...b.base,...b.profiles[mode],enabled:this.data.enabled};}
    subscribe(fn) {this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
    emit() {for(const fn of this.listeners)fn();}
    change(key,value,mode='normal') {
      if(key==='enabled')this.data.enabled=!!value;
      else {
        if(this.data.economyEnabled&&!this.economyEditing)this.data.economyEnabled=false;
        const b=this.workingBundle();
        if(mode==='normal')b.base=sanitize({...b.base,[key]:value});
        else if(['theater','fullscreen'].includes(mode))b.profiles[mode]=sanitize({...b.profiles[mode],[key]:value},true);
      }
      this.changed();
    }
    changed(){this.revision++;this.emit();clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),180);}
    flush() {
      clearTimeout(this.timer);
      const data=structuredClone(this.data),revision=this.revision;
      this.saveChain=this.saveChain.then(async()=>{
        try{await chrome.storage.local.set({[KEY]:data});this.savedRevision=revision;this.error='';}
        catch(e){this.error='Не удалось сохранить настройки: '+e.message;}
      });return this.saveChain;
    }
    createPreset(){
      if(this.data.presets.length>=32)throw Error('Можно сохранить до 32 пресетов');
      let id;do{id='p'+Date.now().toString(36)+(this.presetSerial=(this.presetSerial||0)+1).toString(36);}while(this.data.presets.some(p=>p.id===id));
      this.data.presets.push({id,name:'Пресет '+(this.data.presets.length+1),...bundle(this.workingBundle())});this.changed();return id;
    }
    preset(id){const p=this.data.presets.find(p=>p.id===id);if(!p)throw Error('Пресет не найден');return p;}
    selectPreset(id){if(id!==null)this.preset(id);this.data.activePreset=id;this.data.economyEnabled=false;this.economyEditing=false;this.changed();}
    setEconomy(enabled){this.data.economyEnabled=!!enabled;if(!enabled)this.economyEditing=false;this.changed();}
    setEconomyEditing(enabled){this.economyEditing=!!enabled;if(enabled)this.data.economyEnabled=true;this.changed();}
    resetEconomy(){this.data.economy=economyDefaults();this.changed();}
    renamePreset(id,name){this.preset(id).name=presetName(name);this.changed();}
    deletePreset(id){this.preset(id);this.data.presets=this.data.presets.filter(p=>p.id!==id);if(this.data.activePreset===id)this.data.activePreset=null;this.changed();}
    copyPreset(id){return JSON.stringify({format:'tbk-preset',schema:3,...bundle(this.preset(id))},null,2);}
    pastePreset(id,text){
      if(typeof text!=='string'||text.length>1000000)throw Error('Пресет слишком большой');
      const raw=JSON.parse(text);if(raw.format!=='tbk-preset'||raw.schema!==3||!raw.base||typeof raw.base!=='object'||Array.isArray(raw.base))throw Error('В буфере нет пресета TBK 3');
      validateBundle(raw);Object.assign(this.preset(id),bundle(raw));this.changed();
    }
    reset(mode){if(this.data.economyEnabled&&!this.economyEditing)this.data.economyEnabled=false;const b=this.workingBundle();if(mode==='normal')b.base={...defaults};else if(['theater','fullscreen'].includes(mode))b.profiles[mode]={};this.changed();}
    export(){return JSON.stringify(this.data,null,2);}
    import(text){if(typeof text!=='string'||text.length>1000000)throw Error('Файл слишком большой');const raw=JSON.parse(text);if(![2,3].includes(raw?.schema)||!raw.base||typeof raw.base!=='object'||Array.isArray(raw.base))throw Error('Нужен файл настроек TBK Twitch версии 2 или 3');this.data=normalize(raw);this.economyEditing=false;this.changed();}
    destroy(){clearTimeout(this.timer);chrome.storage.onChanged.removeListener(this.onStorage);this.listeners.clear();}
  }
  Object.assign(TBK,{Settings,sliders,chatSliders,effectSliders,windowSliders,choices,checks,normalize});
})();
