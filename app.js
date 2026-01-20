/************
 * Helpers
 ************/
const log = (m, ...r) => console.log(`[ar] ${m}`, ...r);

const waitEvent = (el, name, {once=true, timeoutMs=15000}={}) =>
  new Promise((res, rej) => {
    let to;
    const on = () => { if (to) clearTimeout(to); el.removeEventListener(name, on); res(); };
    el.addEventListener(name, on, {once});
    if (timeoutMs) to = setTimeout(() => { el.removeEventListener(name, on); rej(new Error(`timeout:${name}`)); }, timeoutMs);
  });

/********************************************
 * Composant : png-sequence (auto-count) + ready event
 ********************************************/
if (!AFRAME.components['png-sequence']) {
  AFRAME.registerComponent('png-sequence', {
    schema: {
      prefix:    { type: 'string' },        // ./animations/targetX/frame_
      fps:       { type: 'number', default: 12 },
      pad:       { type: 'int',    default: 3 },   // 000-999
      start:     { type: 'int',    default: 0 },
      max:       { type: 'int',    default: 300 },
      unitWidth: { type: 'number', default: 1 },
      fit:       { type: 'string', default: 'width' } // 'width' | 'height'
    },

    async init() {
      this.playing = false;
      this.frame = 0;
      this.elapsed = 0;
      this.duration = 1000 / this.data.fps;
      this.frames = [];
      this.ready = false;
      this.deferStart = false;

      await new Promise(res => (this.el.hasLoaded ? res() : this.el.addEventListener('loaded', res, { once: true })));

      const pad = n => n.toString().padStart(this.data.pad, '0');
      let i = this.data.start;

      while (i < this.data.max) {
        const url = `${this.data.prefix}${pad(i)}.png`;
        const ok = await new Promise(resolve => {
          const im = new Image();
          im.onload  = () => resolve(true);
          im.onerror = () => resolve(false);
          im.src = url;
        });
        if (ok) {
          if (this.frames.length === 0) {
            const im = new Image();
            await new Promise(resolve => { im.onload = resolve; im.src = url; });
            const iw = im.naturalWidth  || im.width  || 1;
            const ih = im.naturalHeight || im.height || 1;
            const ratio = ih / iw;

            if (this.data.fit === 'width') {
              const w = this.data.unitWidth, h = w * ratio;
              this.el.setAttribute('width', w);
              this.el.setAttribute('height', h);
            } else {
              const h = this.data.unitWidth, w = h / ratio;
              this.el.setAttribute('width', w);
              this.el.setAttribute('height', h);
            }
            this.el.setAttribute('material', 'transparent: true; alphaTest: 0.01; side: double');
            this.el.setAttribute('src', url); // anti flash blanc
          }
          this.frames.push(url);
          i++;
        } else {
          if (this.frames.length > 0) break;
          i++;
        }
      }

      if (!this.frames.length) {
        log('[png] aucune image trouvée pour', this.data.prefix);
        this.el.emit('png-sequence-ready', {ok:false});
        return;
      }

      // précharge non bloquant
      this.frames.forEach(u => { const im = new Image(); im.src = u; });

      this.ready = true;
      this.el.emit('png-sequence-ready', {ok:true, count:this.frames.length});
      if (this.deferStart) this._reallyStart();
    },

    _reallyStart() {
      if (!this.ready) { this.deferStart = true; return; }
      this.deferStart = false;
      this.playing = true;
      this.frame = 0;
      this.elapsed = 0;
      this.el.setAttribute('src', this.frames[0]);
    },

    start() { this._reallyStart(); },
    stop()  {
      this.playing = false;
      this.frame = 0;
      if (this.frames.length) this.el.setAttribute('src', this.frames[0]);
    },

    tick(t, dt) {
      if (!this.playing || !this.frames.length) return;
      this.elapsed += dt;
      if (this.elapsed >= this.duration) {
        this.elapsed = 0;
        this.frame = (this.frame + 1) % this.frames.length;
        this.el.setAttribute('src', this.frames[this.frame]);
      }
    }
  });
}

/******************************************************
 * Composant : ar-target-loader (PNG uniquement)
 ******************************************************/
if (!AFRAME.components['ar-target-loader']) {
  AFRAME.registerComponent('ar-target-loader', {
    schema: {
      // PNG uniquement
      pngPrefix:   { type: 'string', default: '' },
      fps:         { type: 'number', default: 12 },
      unitWidth:   { type: 'number', default: 1 },
      fit:         { type: 'string',  default: 'width' }
    },

    async init() {
      const root = this.el;
      this.assets = { png: null };

      // Préparer la promise de readiness pour le PNG
      const readyPromises = [];

      // PNG
      if (this.data.pngPrefix) {
        const img = document.createElement('a-image');
        img.setAttribute('visible', 'false');
        img.setAttribute('png-sequence',
          `prefix: ${this.data.pngPrefix}; fps: ${this.data.fps}; unitWidth: ${this.data.unitWidth}; fit: ${this.data.fit}`);
        root.appendChild(img);
        this.assets.png = img;
        // attendre l'événement "png-sequence-ready"
        readyPromises.push(waitEvent(img, 'png-sequence-ready').catch(() => {}));
      }

      // Quand tout est prêt
      this._allReady = false;
      Promise.all(readyPromises).then(() => {
        this._allReady = true;
        log('✅ PNG assets ready for target');
        if (this._wantStartOnReady) this._startAll();
      });

      // targetFound / targetLost
      root.addEventListener('targetFound', () => {
        this._isVisible = true;
        if (this._allReady) this._startAll();
        else this._wantStartOnReady = true;
      });

      root.addEventListener('targetLost', () => {
        this._isVisible = false;
        this._wantStartOnReady = false;
        this._stopAll();
      });
    },

    _startAll() {
      // PNG
      if (this.assets.png) {
        this.assets.png.setAttribute('visible', 'true');
        const comp = this.assets.png.components['png-sequence'];
        if (comp) comp.start();
      }
    },

    _stopAll() {
      if (this.assets.png) {
        const comp = this.assets.png.components['png-sequence'];
        if (comp) comp.stop();
        this.assets.png.setAttribute('visible', 'false');
      }
    }
  });
}
