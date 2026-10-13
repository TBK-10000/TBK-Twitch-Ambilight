(() => {
  class WebGLProjector {
    constructor(){
      this.canvas=document.createElement('canvas');this.kind='WebGL';
      const gl=this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
      if(!gl)throw Error('WebGL недоступен');
      const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(message);}return s;};
      const vs=shader(gl.VERTEX_SHADER,'attribute vec2 p; varying vec2 uv; uniform vec4 crop; void main(){gl_Position=vec4(p,0.,1.);vec2 q=(p+1.)*.5;uv=vec2(mix(crop.x,1.-crop.z,q.x),mix(crop.w,1.-crop.y,q.y));}');
      const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec2 uv; uniform sampler2D frame; void main(){gl_FragColor=texture2D(frame,uv);}');
      const program=this.program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)){this.destroy();throw Error('Ошибка WebGL shader');}gl.useProgram(program);
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
      for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
      for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.uniform1i(gl.getUniformLocation(program,'frame'),0);this.crop=gl.getUniformLocation(program,'crop');
      this.onLost=e=>{e.preventDefault();this.lost=true;};this.canvas.addEventListener('webglcontextlost',this.onLost);
    }
    resize(w,h){if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;}
    draw(src,crop){const g=this.gl;if(this.lost||g.isContextLost())throw Error('Контекст WebGL потерян');g.viewport(0,0,this.canvas.width,this.canvas.height);g.uniform4fv(this.crop,crop);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,src);const error=g.getError();if(error!==g.NO_ERROR)throw Error('WebGL upload: '+error);g.drawArrays(g.TRIANGLE_STRIP,0,4);}
    destroy(){const g=this.gl;if(g){if(this.texture)g.deleteTexture(this.texture);if(this.buffer)g.deleteBuffer(this.buffer);if(this.program)g.deleteProgram(this.program);g.getExtension('WEBGL_lose_context')?.loseContext();}this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.width=this.canvas.height=1;}
  }
  class Renderer {
    constructor(choice){this.warning='';if(choice!=='canvas'){try{this.projector=new WebGLProjector();}catch(e){this.warning=e.message+' → Canvas 2D';}}
      if(!this.projector)this.projector=new TBK.Projector2d();
    }
    draw(src,crop,w,h){
      try{this.projector.resize(w,h);this.projector.draw(src,crop);}
      catch(e){if(e.name==='SecurityError'||this.projector.kind==='Canvas 2D')throw e;
        this.warning=e.message+' → Canvas 2D';this.projector.destroy();this.projector=new TBK.Projector2d();this.projector.resize(w,h);this.projector.draw(src,crop);
      }return this.projector.canvas;
    }
    get kind(){return this.projector.kind;}
    destroy(){this.projector.destroy();}
  }
  // Small independent probe: never scan an already cropped output (avoids feedback).
  class FrameProbe {
    constructor(){this.canvas=document.createElement('canvas');this.canvas.width=96;this.canvas.height=54;this.ctx=this.canvas.getContext('2d',{willReadFrequently:true});this.crop=[0,0,0,0];this.candidate='';this.repeats=0;}
    sample(video,detectBars){
      const w=96,h=54;this.ctx.drawImage(video,0,0,w,h);const data=this.ctx.getImageData(0,0,w,h).data;
      let sum=0,chatSum=0,chatCount=0;for(let i=0;i<data.length;i+=4){sum+=(data[i]+data[i+1]+data[i+2])/3;if((i/4)%w>=Math.floor(w*.82)){chatSum+=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;chatCount++;}}
      this.luma=sum/(w*h*255);
      this.chatLuma=chatSum/(chatCount*255);
      if(!detectBars){this.crop=[0,0,0,0];return;}
      const dark=(axis,line)=>{let bright=0,total=0;for(let p=2;p<(axis==='x'?h:w)-2;p+=2){const i=axis==='x'?(p*w+line)*4:(line*w+p)*4;if(Math.max(data[i],data[i+1],data[i+2])>20)bright++;total++;}return bright/total<.04;};
      const edge=(axis,reverse)=>{const limit=axis==='x'?w:h;let n=0;while(n<Math.floor(limit*.20)&&dark(axis,reverse?limit-1-n:n))n++;return n/limit;};
      let next=[edge('x',false),edge('y',false),edge('x',true),edge('y',true)];
      // Reject fades to black and require approximately symmetric bars.
      if(this.luma<.045)return;
      if(Math.abs(next[0]-next[2])>.025)next[0]=next[2]=0;
      if(Math.abs(next[1]-next[3])>.04)next[1]=next[3]=0;
      const key=next.join(',');this.repeats=key===this.candidate?this.repeats+1:1;this.candidate=key;if(this.repeats>=3)this.crop=next;
    }
    destroy(){this.canvas.width=this.canvas.height=1;}
  }
  Object.assign(TBK,{Renderer,FrameProbe});
})();
