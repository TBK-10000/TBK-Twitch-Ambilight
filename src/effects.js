/* MIT, Copyright (c) 2026 TheBigKotovski (TBK).
 * Two shared GPU passes per processed frame; no extra video reads or loop. */
(() => {
  const fragment=`precision mediump float;
  varying vec2 uv; uniform sampler2D image; uniform vec2 axis;
  uniform float pass; uniform float effect; uniform float phase;
  vec4 blurAt(vec2 q){
    vec4 c=texture2D(image,q)*.227027;
    c+=(texture2D(image,q+axis*1.384615)+texture2D(image,q-axis*1.384615))*.316216;
    c+=(texture2D(image,q+axis*3.230769)+texture2D(image,q-axis*3.230769))*.070270;
    return c;
  }
  void main(){
    vec2 q=uv; float gain=1.;
    if(pass>.5){
      vec2 p=uv-.5;float angle=atan(p.y,p.x);float distance=length(p);
      if(effect>2.5&&effect<3.5)q+=.055*vec2(sin(uv.y*8.+phase),cos(uv.x*8.-phase*.7));
      if(effect>3.5&&effect<4.5){q=.5+p*(.94+.06*sin(angle*12.+phase));gain=.72+.28*pow(.5+.5*cos(angle*18.+phase*.3),2.);}
      if(effect>4.5){q+=p*.04*sin(distance*24.-phase);gain=.8+.2*cos(distance*28.-phase*1.5);}
      if(effect>1.5&&effect<2.5)gain=.8+.25*max(abs(p.x),abs(p.y))*2.;
    }
    vec4 c=blurAt(clamp(q,vec2(0.),vec2(1.)));
    if(pass>.5&&effect<1.5)c.rgb=pow(max(c.rgb,vec3(0.)),vec3(.85))*1.08;
    gl_FragColor=vec4(c.rgb*gain,1.);
  }`;
  class AmbientEffects {
    constructor(){this.canvas=document.createElement('canvas');this.warning='';this.phase=0;this.actual='classic';}
    setup(){
      if(this.gl)return;
      const gl=this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
      if(!gl)throw Error('WebGL для эффекта недоступен');
      const shader=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(sh);gl.deleteShader(sh);throw Error(message);}return sh;};
      const vs=shader(gl.VERTEX_SHADER,'attribute vec2 position; varying vec2 uv; void main(){gl_Position=vec4(position,0.,1.);uv=(position+1.)*.5;}');
      const fs=shader(gl.FRAGMENT_SHADER,fragment);this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
      gl.useProgram(this.program);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(this.program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      this.locations=Object.fromEntries(['axis','pass','effect','phase'].map(k=>[k,gl.getUniformLocation(this.program,k)]));gl.uniform1i(gl.getUniformLocation(this.program,'image'),0);
      const texture=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);return t;};
      this.input=texture();this.intermediate=texture();this.framebuffer=gl.createFramebuffer();
      this.onLost=e=>{e.preventDefault();this.failed=true;this.warning='Контекст эффекта потерян → классический эффект';};this.canvas.addEventListener('webglcontextlost',this.onLost);
    }
    draw(source,s,now){
      const dt=this.lastTime?Math.max(0,Math.min(250,now-this.lastTime)):0;this.lastTime=now;
      this.phase+=dt/1000*(s.motionSpeed||0)/100*2;
      if(s.effect==='classic'){this.actual='classic';this.warning='';return source;}
      if(s.renderer==='canvas'){this.actual='classic';this.warning='Выбран Canvas 2D → классический эффект';return source;}
      try{
        if(this.failed)throw Error('Контекст эффекта потерян');this.setup();const g=this.gl;
        const w=source.width,h=source.height;if(this.size!==w+':'+h){this.size=w+':'+h;this.canvas.width=w;this.canvas.height=h;g.bindTexture(g.TEXTURE_2D,this.intermediate);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);}
        g.useProgram(this.program);g.viewport(0,0,w,h);g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D,this.input);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,source);
        const radius=(s.effect==='soft'?4:1.5)+s.blur*.1;
        g.bindFramebuffer(g.FRAMEBUFFER,this.framebuffer);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,this.intermediate,0);
        if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Недоступен буфер эффекта');
        g.uniform2f(this.locations.axis,radius/w,0);g.uniform1f(this.locations.pass,0);g.drawArrays(g.TRIANGLE_STRIP,0,4);
        g.bindFramebuffer(g.FRAMEBUFFER,null);g.bindTexture(g.TEXTURE_2D,this.intermediate);g.uniform2f(this.locations.axis,0,radius/h);g.uniform1f(this.locations.pass,1);g.uniform1f(this.locations.effect,['classic','soft','directional','flow','rays','waves'].indexOf(s.effect));g.uniform1f(this.locations.phase,this.phase);g.drawArrays(g.TRIANGLE_STRIP,0,4);
        if(g.getError()!==g.NO_ERROR)throw Error('Ошибка обработки эффекта');this.actual=s.effect;this.warning='';return this.canvas;
      }catch(e){if(e.name==='SecurityError')throw e;this.failed=true;this.actual='classic';this.warning=e.message+' → классический эффект';return source;}
    }
    destroy(){const g=this.gl;if(g){if(this.input)g.deleteTexture(this.input);if(this.intermediate)g.deleteTexture(this.intermediate);if(this.framebuffer)g.deleteFramebuffer(this.framebuffer);if(this.buffer)g.deleteBuffer(this.buffer);if(this.program)g.deleteProgram(this.program);g.getExtension('WEBGL_lose_context')?.loseContext();}if(this.onLost)this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.width=this.canvas.height=1;}
  }
  TBK.AmbientEffects=AmbientEffects;
})();
