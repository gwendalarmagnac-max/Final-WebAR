// ============================================================================
// AR-TARGET-LOADER : PNG uniquement (DEBUG VISUEL TÉLÉPHONE)
// ============================================================================

AFRAME.registerComponent('ar-target-loader', {
  schema: {
    pngPrefix: { type: 'string', default: '' },
    fps: { type: 'number', default: 12 },
    pad: { type: 'number', default: 3 },
    unitWidth: { type: 'number', default: 1 },
    fit: { type: 'string', default: 'width' }
  },

  init() {
    this.frames = [];
    this.currentFrame = 0;
    this.animationId = null;
    this.plane = null;
    this.isPlaying = false;
    
    // Créer l'overlay de debug
    this.createDebugOverlay();
    this.log('Init: ' + this.data.pngPrefix.split('/').pop());

    this.el.addEventListener('targetFound', this.onTargetFound.bind(this));
    this.el.addEventListener('targetLost', this.onTargetLost.bind(this));

    if (this.data.pngPrefix) {
      this.loadPNGAnimation();
    } else {
      this.log('❌ Pas de pngPrefix');
    }
  },

  createDebugOverlay() {
    // Créer seulement une fois (sur le premier composant)
    if (document.getElementById('ar-debug')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'ar-debug';
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      color: #0f0;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      z-index: 9999;
      max-height: 200px;
      overflow-y: auto;
      border-radius: 5px;
      pointer-events: none;
    `;
    document.body.appendChild(overlay);
  },

  log(message) {
    const overlay = document.getElementById('ar-debug');
    if (!overlay) return;
    
    const time = new Date().toLocaleTimeString();
    overlay.innerHTML += `[${time}] ${message}<br>`;
    overlay.scrollTop = overlay.scrollHeight;
  },

  async loadPNGAnimation() {
    const prefix = this.data.pngPrefix;
    const pad = this.data.pad;
    
    this.log(`Cherche: ${prefix}...`);
    
    let frameIndex = 0;
    const maxAttempts = 500;
    
    while (frameIndex < maxAttempts) {
      const framePath = `${prefix}${String(frameIndex).padStart(pad, '0')}.png`;
      
      try {
        const exists = await this.checkImageExists(framePath);
        if (!exists) break;
        
        this.frames.push(framePath);
        frameIndex++;
      } catch (e) {
        break;
      }
    }

    if (this.frames.length === 0) {
      this.log(`❌ 0 frames: ${prefix}000.png`);
      return;
    }

    this.log(`✅ ${this.frames.length} frames OK`);
    this.createPlane();
  },

  checkImageExists(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  },

  createPlane() {
    this.plane = document.createElement('a-plane');
    this.plane.setAttribute('material', {
      src: this.frames[0],
      transparent: true,
      alphaTest: 0.01,
      shader: 'flat'
    });

    const w = this.data.unitWidth;
    const h = this.data.unitWidth;

    switch (this.data.fit) {
      case 'height':
        this.plane.setAttribute('height', h);
        this.plane.setAttribute('width', 'auto');
        break;
      case 'stretch':
        this.plane.setAttribute('width', w);
        this.plane.setAttribute('height', h);
        break;
      default:
        this.plane.setAttribute('width', w);
        this.plane.setAttribute('height', 'auto');
    }

    this.plane.setAttribute('visible', false);
    this.el.appendChild(this.plane);
    
    this.log('Plane créé');
  },

  onTargetFound() {
    this.log('🎯 CIBLE DETECTEE !');
    
    if (!this.plane) {
      this.log('❌ Pas de plane');
      return;
    }
    
    this.plane.setAttribute('visible', true);
    this.log('Plane visible');
    this.startAnimation();
  },

  onTargetLost() {
    this.log('Cible perdue');
    
    if (!this.plane) return;
    
    this.plane.setAttribute('visible', false);
    this.stopAnimation();
  },

  startAnimation() {
    if (this.isPlaying || this.frames.length === 0) return;
    
    this.log(`▶️ Anim: ${this.frames.length}f @ ${this.data.fps}fps`);
    this.isPlaying = true;
    this.currentFrame = 0;
    this.playLoop();
  },

  stopAnimation() {
    this.isPlaying = false;
    if (this.animationId) {
      clearTimeout(this.animationId);
      this.animationId = null;
    }
  },

  playLoop() {
    if (!this.isPlaying) return;

    this.plane.setAttribute('material', 'src', this.frames[this.currentFrame]);
    this.currentFrame = (this.currentFrame + 1) % this.frames.length;

    const interval = 1000 / this.data.fps;
    this.animationId = setTimeout(() => this.playLoop(), interval);
  },

  remove() {
    this.stopAnimation();
  }
});
```

## 📱 Ce que vous verrez maintenant :

**En haut à gauche de l'écran**, une boîte noire avec du texte vert qui affichera :
```
[14:23:45] Init: target0
[14:23:45] Cherche: ./animations/target0/frame_...
[14:23:46] ✅ 24 frames OK
[14:23:46] Plane créé
[14:23:50] 🎯 CIBLE DETECTEE !
[14:23:50] Plane visible
[14:23:50] ▶️ Anim: 24f @ 12fps
```

**OU des erreurs :**
```
[14:23:46] ❌ 0 frames: ./animations/target0/frame_000.png
[14:23:50] 🎯 CIBLE DETECTEE !
[14:23:50] ❌ Pas de plane
