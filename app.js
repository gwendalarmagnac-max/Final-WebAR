// ============================================================================
// AR-TARGET-LOADER : PNG uniquement (sans audio ni 3D)
// ============================================================================

AFRAME.registerComponent('ar-target-loader', {
  schema: {
    // PNG animation
    pngPrefix: { type: 'string', default: '' },
    fps: { type: 'number', default: 12 },
    pad: { type: 'number', default: 3 },
    
    // Sizing
    unitWidth: { type: 'number', default: 1 },
    fit: { type: 'string', default: 'width' } // 'width' | 'height' | 'stretch'
  },

  init() {
    this.frames = [];
    this.currentFrame = 0;
    this.animationId = null;
    this.plane = null;
    this.isPlaying = false;

    // Écouter les événements de tracking
    this.el.addEventListener('targetFound', this.onTargetFound.bind(this));
    this.el.addEventListener('targetLost', this.onTargetLost.bind(this));

    // Charger les PNGs
    if (this.data.pngPrefix) {
      this.loadPNGAnimation();
    }
  },

  async loadPNGAnimation() {
    const prefix = this.data.pngPrefix;
    const pad = this.data.pad;
    
    // Découvrir combien de frames existent
    let frameIndex = 0;
    const maxAttempts = 1000; // limite de sécurité
    
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
      console.warn(`Aucune frame PNG trouvée pour ${prefix}`);
      return;
    }

    console.log(`✅ ${this.frames.length} frames chargées pour ${prefix}`);
    
    // Créer le plane d'affichage
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
    // Créer le plane
    this.plane = document.createElement('a-plane');
    this.plane.setAttribute('material', {
      src: this.frames[0],
      transparent: true,
      alphaTest: 0.01,
      shader: 'flat'
    });

    // Sizing selon le fit
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
      default: // 'width'
        this.plane.setAttribute('width', w);
        this.plane.setAttribute('height', 'auto');
    }

    this.plane.setAttribute('visible', false);
    this.el.appendChild(this.plane);
  },

  onTargetFound() {
    if (!this.plane) return;
    
    this.plane.setAttribute('visible', true);
    this.startAnimation();
  },

  onTargetLost() {
    if (!this.plane) return;
    
    this.plane.setAttribute('visible', false);
    this.stopAnimation();
  },

  startAnimation() {
    if (this.isPlaying || this.frames.length === 0) return;
    
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

    // Mettre à jour la texture
    this.plane.setAttribute('material', 'src', this.frames[this.currentFrame]);

    // Frame suivante
    this.currentFrame = (this.currentFrame + 1) % this.frames.length;

    // Planifier la prochaine frame
    const interval = 1000 / this.data.fps;
    this.animationId = setTimeout(() => this.playLoop(), interval);
  },

  remove() {
    this.stopAnimation();
  }
});
