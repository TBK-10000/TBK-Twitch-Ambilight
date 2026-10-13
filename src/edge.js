/* MIT, Copyright (c) 2026 TheBigKotovski (TBK).
 * A feathered continuation OUTSIDE the picture. The video element is untouched. */
(() => {
  const weight=t=>{t=Math.max(0,Math.min(1,t));return 1-t*t*(3-2*t);};
  class EdgeTransition {
    constructor(){this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d');this.mask=document.createElement('canvas');this.maskCtx=this.mask.getContext('2d');this.field=document.createElement('canvas');this.fieldCtx=this.field.getContext('2d');}
    prepare(picture,extent){
      this.extent=extent;
      if(!extent||!picture.width||!picture.height)return;
      const scale=Math.min(1,512/picture.width,512/picture.height),w=Math.max(2,Math.round(picture.width*scale)),h=Math.max(2,Math.round(picture.height*scale));
      const pad=Math.max(1,Math.ceil(extent*scale)),width=w+pad*2,height=h+pad*2,key=[w,h,pad].join(':');
      if(this.key!==key){
        this.key=key;this.canvas.width=this.mask.width=width;this.canvas.height=this.mask.height=height;
        const pixels=this.maskCtx.createImageData(width,height);
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
          const dx=Math.max(pad-x,0,x-(pad+w-1)),dy=Math.max(pad-y,0,y-(pad+h-1));
          pixels.data[(y*width+x)*4+3]=(dx||dy)?Math.round(255*weight((Math.hypot(dx,dy)/pad-.25)/.75)):0;
        }
        this.maskCtx.putImageData(pixels,0,0);
      }
      // CSS extent matches the quantized canvas padding exactly.
      this.xPad=pad*picture.width/w;this.yPad=pad*picture.height/h;
    }
    draw(source,picture,extent,options={}){
      this.prepare(picture,extent);
      if(!extent||!picture.width||!picture.height)return;
      const width=this.canvas.width,height=this.canvas.height,c=this.ctx;
      const [w,h,pad]=this.key.split(':').map(Number),sw=source.width,sh=source.height;
      if(this.field.width!==width)this.field.width=width;if(this.field.height!==height)this.field.height=height;
      const f=this.fieldCtx;
      // Mirror broad edge bands, not a single row/column. Details are softened
      // together in the next pass, avoiding individual blurred-strip seams.
      const bx=Math.min(sw,Math.max(2,Math.round(sw*Math.max(.025,extent/picture.width*.5))));
      const by=Math.min(sh,Math.max(2,Math.round(sh*Math.max(.025,extent/picture.height*.5))));
      f.clearRect(0,0,width,height);
      const patch=(sx,sy,cw,ch,dx,dy,dw,dh,flipX=false,flipY=false)=>{
        f.save();f.translate(dx+(flipX?dw:0),dy+(flipY?dh:0));f.scale(flipX?-1:1,flipY?-1:1);
        f.drawImage(source,sx,sy,cw,ch,0,0,dw,dh);f.restore();
      };
      patch(0,0,sw,sh,pad,pad,w,h);
      patch(0,0,sw,by,pad,0,w,pad,false,true);
      patch(0,sh-by,sw,by,pad,pad+h,w,pad,false,true);
      patch(0,0,bx,sh,0,pad,pad,h,true,false);
      patch(sw-bx,0,bx,sh,pad+w,pad,pad,h,true,false);
      for(const [sx,sy,dx,dy]of [[0,0,0,0],[sw-bx,0,pad+w,0],[0,sh-by,0,pad+h],[sw-bx,sh-by,pad+w,pad+h]])patch(sx,sy,bx,by,dx,dy,pad,pad,true,true);
      // Reuse the temporally smoothed ambient frame, never stretch single-pixel strips.
      // Blur before masking so the final feather stays strictly outside the picture.
      const scale=width/(picture.width+2*this.xPad);
      const blur=Math.max(2,extent*.16,Math.min((options.blur||0)*.35,extent*.4))*scale;
      c.clearRect(0,0,width,height);c.globalCompositeOperation='source-over';
      const strength=(options.edgeStrength??100)/100;
      c.globalAlpha=Math.min(1,strength);
      c.filter=`blur(${blur}px) saturate(${options.saturation??100}%) brightness(${(options.brightness??100)*Math.max(1,strength)}%) contrast(${options.contrast??100}%)`;
      c.drawImage(this.field,0,0,width,height);
      c.globalAlpha=1;c.filter='none';c.globalCompositeOperation='destination-in';c.drawImage(this.mask,0,0);c.globalCompositeOperation='source-over';
    }
    destroy(){this.canvas.width=this.canvas.height=this.mask.width=this.mask.height=this.field.width=this.field.height=1;}
  }
  Object.assign(TBK,{EdgeTransition,edgeWeight:weight});
})();
