/* Adapted from Wessel Kroos, youtube-ambilight/scripts/libs/projector-2d.js.
 * Copyright (c) 2017 Wessel Kroos
 * MIT License: ../../LICENSES/youtube-ambilight-MIT.txt
 * Original repository: https://github.com/WesselKroos/youtube-ambilight
 * TBK: removed YouTube/shadow/listener dependencies; explicit resource ownership;
 * retained the source-space cropping and scaled drawImage projector path.
 */
(() => {
  class Projector2d {
    constructor(){this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d',{alpha:false,desynchronized:true});if(!this.ctx)throw Error('Canvas 2D недоступен');this.kind='Canvas 2D';}
    resize(width,height){if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;}
    draw(src,crop=[0,0,0,0]){
      const srcWidth=src.videoWidth||src.width,srcHeight=src.videoHeight||src.height;
      const [left,top,right,bottom]=crop;
      this.ctx.drawImage(src,srcWidth*left,srcHeight*top,srcWidth*(1-left-right),srcHeight*(1-top-bottom),0,0,this.canvas.width,this.canvas.height);
    }
    destroy(){this.canvas.width=this.canvas.height=1;this.canvas.remove();}
  }
  TBK.Projector2d=Projector2d;
})();
