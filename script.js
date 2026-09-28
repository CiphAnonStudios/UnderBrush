/* =========================================================================
   ECOSYSTEM & ADAPTIVE PREDATOR 2D PIXEL-ART SURVIVAL GAME
   Pure HTML5 Canvas + Vanilla JavaScript
   ========================================================================= */

// --- Web Audio Synthesizer (Zero external dependencies) ---
const AudioEngine = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  },
  play(type) {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'jump') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'land') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'throw') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'impact') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'rustle') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(70 + Math.random() * 40, now);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'roar') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.linearRampToValueAtTime(45, now + 0.45);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'hurt') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.2);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }
};

window.addEventListener('keydown', () => AudioEngine.init(), { once: true });
window.addEventListener('mousedown', () => AudioEngine.init(), { once: true });

// --- Game Engine Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const VIEW_W = 960;
const VIEW_H = 540;
const WORLD_W = 2800;
const WORLD_H = 800;
const GRAVITY = 0.48;

// --- Input Manager ---
const Input = {
  keys: {},
  mousePos: { x: 0, y: 0 },
  mouseDown: false,
  init() {
    window.addEventListener('keydown', e => {
      this.keys[e.key.toLowerCase()] = true;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => {
      this.keys[e.key.toLowerCase()] = false;
    });
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      this.mousePos.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      this.mousePos.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) {
        this.mouseDown = true;
        Player.throwHeldObject();
      }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
  },
  isDown(k) { return !!this.keys[k]; }
};
Input.init();

// --- Particle and Sound Disturbance System ---
const SoundSystem = {
  disturbances: [],
  emit(x, y, radius, intensity, source = 'player') {
    this.disturbances.push({
      x, y, radius, maxRadius: radius, intensity, source, life: 1.0
    });
    // Alert nearby creatures
    Ecosystem.alertToSound(x, y, radius, intensity, source);
  },
  update() {
    for (let i = this.disturbances.length - 1; i >= 0; i--) {
      const d = this.disturbances[i];
      d.life -= 0.025;
      if (d.life <= 0) this.disturbances.splice(i, 1);
    }
  },
  draw(ctx, camX, camY) {
    ctx.save();
    for (const d of this.disturbances) {
      const r = d.maxRadius * (1 - d.life * 0.5);
      ctx.beginPath();
      ctx.arc(d.x - camX, d.y - camY, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${d.life * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
    }
    ctx.restore();
  }
};

const Particles = {
  pool: [],
  spawn(x, y, color, count = 5, speed = 2, size = 3) {
    for (let i = 0; i < count; i++) {
      this.pool.push({
        x, y,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: (Math.random() - 0.7) * speed * 2,
        color,
        size: Math.random() * size + 1,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.03
      });
    }
  },
  update() {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life -= p.decay;
      if (p.life <= 0) this.pool.splice(i, 1);
    }
  },
  draw(ctx, camX, camY) {
    for (const p of this.pool) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
    }
    ctx.globalAlpha = 1.0;
  }
};

// --- World Geometry & Environment ---
const World = {
  platforms: [
    // Bottom ground
    { x: 0, y: 720, w: WORLD_W, h: 80, type: 'rock' },

    // Area 1: Left hollow & burrows
    { x: 120, y: 620, w: 260, h: 20, type: 'wood' },
    { x: 280, y: 520, w: 220, h: 20, type: 'wood' },
    { x: 80, y: 430, w: 240, h: 20, type: 'rock' },

    // Area 2: Mid-tier canopy & pillars
    { x: 580, y: 640, w: 200, h: 20, type: 'wood' },
    { x: 740, y: 560, w: 240, h: 20, type: 'rock' },
    { x: 920, y: 460, w: 300, h: 24, type: 'rock' },
    { x: 620, y: 380, w: 220, h: 20, type: 'wood' },
    { x: 980, y: 320, w: 240, h: 20, type: 'wood' },

    // Area 3: Center ancient arch & drop
    { x: 1300, y: 630, w: 220, h: 24, type: 'rock' },
    { x: 1450, y: 510, w: 260, h: 24, type: 'rock' },
    { x: 1240, y: 410, w: 260, h: 20, type: 'wood' },
    { x: 1600, y: 350, w: 320, h: 24, type: 'rock' },

    // Area 4: High branches & cave
    { x: 1800, y: 620, w: 340, h: 24, type: 'rock' },
    { x: 2040, y: 500, w: 240, h: 20, type: 'wood' },
    { x: 2240, y: 400, w: 300, h: 24, type: 'rock' },
    { x: 1950, y: 300, w: 320, h: 20, type: 'wood' },
    { x: 2400, y: 240, w: 360, h: 24, type: 'rock' }
  ],
  vines: [
    { x: 200, y: 430, h: 290 },
    { x: 440, y: 340, h: 300 },
    { x: 840, y: 320, h: 320 },
    { x: 1160, y: 320, h: 400 },
    { x: 1540, y: 350, h: 280 },
    { x: 1920, y: 300, h: 420 },
    { x: 2360, y: 240, h: 480 }
  ],
  hidingSpots: [
    { id: 'bush_1', x: 220, y: 680, w: 70, h: 40, name: 'Dense Ferns' },
    { id: 'cave_1', x: 40, y: 390, w: 60, h: 40, name: 'Cliff Crevice' },
    { id: 'bush_2', x: 800, y: 520, w: 65, h: 40, name: 'Bramble Thick' },
    { id: 'bush_3', x: 1360, y: 590, w: 70, h: 40, name: 'Moss Hollow' },
    { id: 'bush_4', x: 1720, y: 310, w: 65, h: 40, name: 'High Shrub' },
    { id: 'bush_5', x: 2150, y: 680, w: 80, h: 40, name: 'Swamp Reeds' }
  ],
  waterPools: [
    { x: 1040, y: 700, w: 220, h: 30 },
    { x: 2400, y: 705, w: 300, h: 25 }
  ],
  traps: [
    { x: 950, y: 710, w: 50, h: 10, armed: true, triggered: false, type: 'spike_thorn' },
    { x: 1750, y: 610, w: 50, h: 10, armed: true, triggered: false, type: 'snare_vine' }
  ],

  draw(ctx, camX, camY) {
    // Parallax background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Distant cave silhouettes
    ctx.fillStyle = '#1e293b';
    for (let i = 0; i < 8; i++) {
      const px = (i * 420 - camX * 0.2) % 3200 - 100;
      ctx.beginPath();
      ctx.moveTo(px, 540);
      ctx.lineTo(px + 140, 220);
      ctx.lineTo(px + 280, 540);
      ctx.fill();
    }

    // Midground roots
    ctx.fillStyle = '#151e2e';
    for (let i = 0; i < 10; i++) {
      const rx = (i * 320 - camX * 0.5) % 3000 - 100;
      ctx.fillRect(rx, 180, 28, 400);
    }

    // Vines
    for (const v of this.vines) {
      const sx = v.x - camX;
      const sy = v.y - camY;
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      for (let y = 0; y < v.h; y += 15) {
        const sway = Math.sin((y + Date.now() * 0.003) * 0.1) * 3;
        ctx.lineTo(sx + sway, sy + y);
      }
      ctx.stroke();

      // Leaves along vine
      ctx.fillStyle = '#22c55e';
      for (let y = 10; y < v.h; y += 24) {
        ctx.fillRect(sx - 7, sy + y, 5, 4);
        ctx.fillRect(sx + 4, sy + y + 8, 5, 4);
      }
    }

    // Platforms
    for (const p of this.platforms) {
      const px = p.x - camX;
      const py = p.y - camY;
      if (px + p.w < 0 || px > VIEW_W || py + p.h < 0 || py > VIEW_H) continue;

      if (p.type === 'rock') {
        ctx.fillStyle = '#334155';
        ctx.fillRect(px, py, p.w, p.h);
        // Top moss border
        ctx.fillStyle = '#15803d';
        ctx.fillRect(px, py, p.w, 4);
        // Pixel stone detailing
        ctx.fillStyle = '#1e293b';
        for (let x = 8; x < p.w - 10; x += 32) {
          ctx.fillRect(px + x, py + 8, 12, 6);
        }
      } else {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(px, py, p.w, p.h);
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(px, py, p.w, 3);
        ctx.fillStyle = '#451a03';
        for (let x = 12; x < p.w - 10; x += 40) {
          ctx.fillRect(px + x, py + 6, 8, 4);
        }
      }
    }

    // Water Pools
    for (const w of this.waterPools) {
      const wx = w.x - camX;
      const wy = w.y - camY;
      ctx.fillStyle = 'rgba(14, 116, 144, 0.65)';
      ctx.fillRect(wx, wy, w.w, w.h);
      ctx.fillStyle = '#38bdf8';
      for (let x = 0; x < w.w; x += 20) {
        const ripple = Math.sin((x + Date.now() * 0.005) * 0.2) * 2;
        ctx.fillRect(wx + x, wy + ripple, 12, 2);
      }
    }

    // Traps
    for (const t of this.traps) {
      const tx = t.x - camX;
      const ty = t.y - camY;
      if (t.armed) {
        ctx.fillStyle = '#b45309';
        ctx.fillRect(tx, ty, t.w, t.h);
        // Spikes
        ctx.fillStyle = '#f87171';
        for (let x = 4; x < t.w; x += 10) {
          ctx.beginPath();
          ctx.moveTo(tx + x, ty);
          ctx.lineTo(tx + x + 4, ty - 8);
          ctx.lineTo(tx + x + 8, ty);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#475569';
        ctx.fillRect(tx, ty + 5, t.w, 5);
      }
    }

    // Hiding Spots
    for (const h of this.hidingSpots) {
      const hx = h.x - camX;
      const hy = h.y - camY;
      ctx.fillStyle = '#14532d';
      ctx.fillRect(hx, hy, h.w, h.h);
      ctx.fillStyle = '#16a34a';
      // Leafy tufts
      for (let x = 4; x < h.w - 4; x += 12) {
        ctx.fillRect(hx + x, hy - 4, 10, 8);
        ctx.fillRect(hx + x + 2, hy + 8, 8, 6);
      }
      // Bush name tag
      ctx.fillStyle = '#86efac';
      ctx.font = '8px monospace';
      ctx.fillText(h.name, hx, hy - 8);
    }
  }
};

// --- Collectible & Throwable Objects ---
class GameObject {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.w = 14;
    this.h = 14;
    this.type = type; // 'rock', 'stick', 'berry'
    this.grounded = false;
    this.held = false;
  }

  update() {
    if (this.held) return;

    this.vy += GRAVITY;
    this.x += this.vx;
    this.y += this.vy;

    // Platform collisions
    for (const p of World.platforms) {
      if (
        this.x + this.w > p.x &&
        this.x < p.x + p.w &&
        this.y + this.h > p.y &&
        this.y + this.h < p.y + p.h + 12 &&
        this.vy >= 0
      ) {
        this.y = p.y - this.h;
        this.vy = -this.vy * 0.35;
        this.vx *= 0.75;
        if (Math.abs(this.vy) < 0.6) this.vy = 0;
        this.grounded = true;

        if (Math.abs(this.vx) > 1.5) {
          SoundSystem.emit(this.x, this.y, 160, 0.8, 'distraction');
          AudioEngine.play('impact');
        }
      }
    }

    // World bounds
    if (this.x < 0) this.x = 0;
    if (this.x > WORLD_W - this.w) this.x = WORLD_W - this.w;
  }

  draw(ctx, camX, camY) {
    if (this.held) return;
    const dx = Math.round(this.x - camX);
    const dy = Math.round(this.y - camY);

    if (this.type === 'rock') {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(dx + 2, dy + 2, 10, 8);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(dx + 3, dy + 3, 4, 3);
      ctx.fillStyle = '#475569';
      ctx.fillRect(dx + 6, dy + 7, 5, 2);
    } else if (this.type === 'stick') {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(dx, dy + 6, 14, 4);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(dx + 3, dy + 4, 3, 3);
    } else if (this.type === 'berry') {
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(dx + 7, dy + 7, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(dx + 6, dy + 1, 2, 3);
    }
  }
}

// Populate initial scattered objects
const worldObjects = [
  new GameObject(260, 600, 'rock'),
  new GameObject(340, 500, 'stick'),
  new GameObject(150, 410, 'berry'),
  new GameObject(640, 620, 'rock'),
  new GameObject(960, 440, 'berry'),
  new GameObject(1020, 300, 'stick'),
  new GameObject(1340, 610, 'rock'),
  new GameObject(1480, 490, 'berry'),
  new GameObject(1880, 600, 'rock'),
  new GameObject(2100, 480, 'stick'),
  new GameObject(2300, 380, 'rock')
];

// --- Player Character ---
const Player = {
  x: 180,
  y: 660,
  w: 20,
  h: 26,
  vx: 0,
  vy: 0,
  speed: 3.2,
  jumpForce: 10.4,
  facing: 1, // 1: right, -1: left
  grounded: false,
  crouching: false,
  climbing: false,
  hiddenIn: null, // spot id or null
  health: 100,
  stamina: 100,
  heldObject: null,
  animTick: 0,
  lastPositions: [], // Track route history for predator AI

  update() {
    this.animTick++;

    // Track position history periodically for adaptive interception
    if (this.animTick % 30 === 0) {
      this.lastPositions.push({ x: this.x, y: this.y, t: Date.now() });
      if (this.lastPositions.length > 20) this.lastPositions.shift();
    }

    // Check Vine Climbing
    let onVine = false;
    for (const v of World.vines) {
      if (Math.abs(this.x + this.w / 2 - v.x) < 16 && this.y >= v.y - 10 && this.y <= v.y + v.h) {
        onVine = true;
        break;
      }
    }

    if (onVine && (Input.isDown('w') || Input.isDown('arrowup') || Input.isDown('s') || Input.isDown('arrowdown'))) {
      this.climbing = true;
    }
    if (!onVine) this.climbing = false;

    // Movement on vine
    if (this.climbing) {
      this.vy = 0;
      this.vx = 0;
      if (Input.isDown('w') || Input.isDown('arrowup')) this.vy = -2.5;
      if (Input.isDown('s') || Input.isDown('arrowdown')) this.vy = 2.5;
      if (Input.isDown('a') || Input.isDown('arrowleft')) this.vx = -1.5;
      if (Input.isDown('d') || Input.isDown('arrowright')) this.vx = 1.5;

      // Jump off vine
      if (Input.isDown(' ') || Input.isDown('k')) {
        this.climbing = false;
        this.vy = -this.jumpForce * 0.8;
        AudioEngine.play('jump');
      }
    } else {
      // Normal Horizontal Motion
      this.crouching = Input.isDown('s') || Input.isDown('arrowdown');
      const curSpeed = this.crouching ? this.speed * 0.45 : this.speed;

      if (Input.isDown('a') || Input.isDown('arrowleft')) {
        this.vx = -curSpeed;
        this.facing = -1;
      } else if (Input.isDown('d') || Input.isDown('arrowright')) {
        this.vx = curSpeed;
        this.facing = 1;
      } else {
        this.vx *= 0.6;
        if (Math.abs(this.vx) < 0.2) this.vx = 0;
      }

      // Jumping
      if ((Input.isDown('w') || Input.isDown(' ') || Input.isDown('arrowup')) && this.grounded && !this.crouching) {
        if (this.stamina >= 10) {
          this.vy = -this.jumpForce;
          this.grounded = false;
          this.stamina -= 12;
          AudioEngine.play('jump');
          SoundSystem.emit(this.x, this.y, 110, 0.4, 'player');
        }
      }

      // Gravity
      this.vy += GRAVITY;
    }

    // Step Physics
    this.x += this.vx;
    this.y += this.vy;

    // Stamina recovery
    if (this.stamina < 100) this.stamina = Math.min(100, this.stamina + 0.35);

    // Collision with platforms
    this.grounded = false;
    for (const p of World.platforms) {
      if (
        this.x + this.w > p.x &&
        this.x < p.x + p.w &&
        this.y + this.h >= p.y &&
        this.y + this.h <= p.y + p.h + 10 &&
        this.vy >= 0
      ) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.grounded = true;
      }
    }

    // Hiding Logic
    let nearHidingSpot = null;
    for (const h of World.hidingSpots) {
      if (
        this.x + this.w > h.x &&
        this.x < h.x + h.w &&
        this.y + this.h > h.y &&
        this.y < h.y + h.h + 10
      ) {
        nearHidingSpot = h;
        break;
      }
    }

    if (nearHidingSpot && (Input.isDown('c') || (this.crouching && Math.abs(this.vx) < 0.2))) {
      if (this.hiddenIn !== nearHidingSpot.id) {
        this.hiddenIn = nearHidingSpot.id;
        AudioEngine.play('rustle');
        SoundSystem.emit(this.x, this.y, 40, 0.1, 'player');
        AdaptivePredator.recordPlayerHiding(nearHidingSpot.id);
      }
    } else {
      if (this.hiddenIn && Math.abs(this.vx) > 0.8) {
        this.hiddenIn = null;
      }
    }

    // Running noise
    if (this.grounded && Math.abs(this.vx) > 1.8 && this.animTick % 20 === 0) {
      SoundSystem.emit(this.x, this.y, 90, 0.3, 'player');
    }

    // Water slow down
    for (const w of World.waterPools) {
      if (this.x + this.w > w.x && this.x < w.x + w.w && this.y + this.h > w.y) {
        this.vx *= 0.6;
        if (this.animTick % 18 === 0) {
          Particles.spawn(this.x + this.w / 2, w.y + 4, '#38bdf8', 3, 1.2);
          SoundSystem.emit(this.x, this.y, 140, 0.5, 'water_splash');
        }
      }
    }

    // Interact / Pickup Key [E]
    if (Input.isDown('e')) {
      this.interact();
      Input.keys['e'] = false; // debounce
    }

    // Throw Key [F]
    if (Input.isDown('f')) {
      this.throwHeldObject();
      Input.keys['f'] = false;
    }

    // Update Held Object Position
    if (this.heldObject) {
      this.heldObject.x = this.facing === 1 ? this.x + 14 : this.x - 8;
      this.heldObject.y = this.y + 4;
    }

    // Bounds check
    this.x = Math.max(0, Math.min(WORLD_W - this.w, this.x));
    if (this.y > WORLD_H + 50) {
      this.health = 0; // Fallen into the abyss
    }
  },

  interact() {
    if (this.heldObject) {
      // Eat berry or drop
      if (this.heldObject.type === 'berry') {
        this.health = Math.min(100, this.health + 30);
        this.stamina = 100;
        Particles.spawn(this.x + 10, this.y + 10, '#ec4899', 8);
        AudioEngine.play('rustle');
        const idx = worldObjects.indexOf(this.heldObject);
        if (idx !== -1) worldObjects.splice(idx, 1);
        this.heldObject = null;
        return;
      }
      // Drop current item
      this.heldObject.held = false;
      this.heldObject.vx = this.facing * 1.5;
      this.heldObject.vy = -1;
      this.heldObject = null;
      return;
    }

    // Find nearby item to pick up
    for (const obj of worldObjects) {
      if (obj.held) continue;
      const dist = Math.hypot(this.x - obj.x, this.y - obj.y);
      if (dist < 36) {
        this.heldObject = obj;
        obj.held = true;
        AudioEngine.play('rustle');
        break;
      }
    }
  },

  throwHeldObject() {
    if (!this.heldObject) return;
    const obj = this.heldObject;
    obj.held = false;
    this.heldObject = null;

    // Throw towards cursor if within canvas, otherwise forward
    const camX = Camera.x;
    const camY = Camera.y;
    const targetWorldX = Input.mousePos.x + camX;
    const targetWorldY = Input.mousePos.y + camY;
    const angle = Math.atan2(targetWorldY - this.y, targetWorldX - this.x);

    const power = 9.5;
    obj.vx = Math.cos(angle) * power;
    obj.vy = Math.sin(angle) * power - 2;

    AudioEngine.play('throw');
    Particles.spawn(this.x + 10, this.y + 10, '#94a3b8', 4, 1.5);
    AdaptivePredator.recordPlayerThrow(this.x, this.y);
  },

  draw(ctx, camX, camY) {
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);

    ctx.save();

    // Semi-transparent if hidden
    if (this.hiddenIn) {
      ctx.globalAlpha = 0.45;
    }

    // Pixel Creature Rendering
    ctx.translate(px + this.w / 2, py + this.h / 2);
    ctx.scale(this.facing, 1);

    const bob = this.grounded && Math.abs(this.vx) > 0.5 ? Math.sin(this.animTick * 0.4) * 2 : 0;
    const crouchOffset = this.crouching ? 5 : 0;

    // Body (warm creature with ears and tail)
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-8, -10 + bob + crouchOffset, 16, 18 - crouchOffset);

    // Belly
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(-4, -4 + bob + crouchOffset, 10, 10 - crouchOffset);

    // Large sensitive ears
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-6, -16 + bob, 4, 7);
    ctx.fillRect(2, -15 + bob, 4, 6);

    // Big eye
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(2, -8 + bob + crouchOffset, 4, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, -8 + bob + crouchOffset, 2, 2);

    // Tail
    ctx.fillStyle = '#d97706';
    const tailWiggle = Math.sin(this.animTick * 0.25) * 3;
    ctx.fillRect(-12, 0 + bob + tailWiggle, 5, 4);

    // Feet
    ctx.fillStyle = '#78350f';
    if (!this.grounded) {
      ctx.fillRect(-6, 8, 4, 4);
      ctx.fillRect(2, 6, 4, 4);
    } else {
      ctx.fillRect(-6, 8 + crouchOffset, 4, 3);
      ctx.fillRect(2, 8 + crouchOffset, 4, 3);
    }

    ctx.restore();
  }
};

// --- Ecosystem Autonomous Fauna ---
class Fauna {
  constructor(x, y, kind) {
    this.x = x;
    this.y = y;
    this.w = kind === 'scavenger' ? 14 : 24;
    this.h = kind === 'scavenger' ? 12 : 18;
    this.kind = kind; // 'scavenger' (passive small runner) or 'grazer' (territorial herbivore)
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.state = 'wander';
    this.timer = Math.floor(Math.random() * 120);
    this.health = 25;
    this.alertTimer = 0;
  }

  update() {
    this.timer--;
    this.vy += GRAVITY;

    // Distance to player
    const distPlayer = Math.hypot(this.x - Player.x, this.y - Player.y);
    const distPredator = Math.hypot(this.x - AdaptivePredator.x, this.y - AdaptivePredator.y);

    // React to predator proximity
    if (distPredator < 180) {
      this.state = 'flee';
      this.facing = this.x > AdaptivePredator.x ? 1 : -1;
      this.vx = this.facing * (this.kind === 'scavenger' ? 3.4 : 2.5);
    } else if (distPlayer < 100 && !Player.hiddenIn) {
      if (this.kind === 'scavenger') {
        this.state = 'flee';
        this.facing = this.x > Player.x ? 1 : -1;
        this.vx = this.facing * 2.8;
      } else if (this.kind === 'grazer' && distPlayer < 50) {
        // Grazer charges if you get too close
        this.state = 'defend';
        this.facing = this.x < Player.x ? 1 : -1;
        this.vx = this.facing * 3.0;
        if (distPlayer < 24) {
          Player.health -= 0.4;
          AudioEngine.play('hurt');
        }
      }
    } else if (this.timer <= 0) {
      // Periodic decision making
      this.timer = 80 + Math.floor(Math.random() * 140);
      const roll = Math.random();
      if (roll < 0.45) {
        this.state = 'wander';
        this.facing = Math.random() > 0.5 ? 1 : -1;
        this.vx = this.facing * 1.2;
      } else if (roll < 0.8) {
        this.state = 'graze';
        this.vx = 0;
      } else {
        // Look for nearby berry
        for (const obj of worldObjects) {
          if (obj.type === 'berry' && Math.hypot(this.x - obj.x, this.y - obj.y) < 220) {
            this.state = 'forage';
            this.facing = obj.x > this.x ? 1 : -1;
            this.vx = this.facing * 1.6;
            break;
          }
        }
      }
    }

    // Platform collisions
    this.x += this.vx;
    this.y += this.vy;

    for (const p of World.platforms) {
      if (
        this.x + this.w > p.x &&
        this.x < p.x + p.w &&
        this.y + this.h >= p.y &&
        this.y + this.h <= p.y + p.h + 10 &&
        this.vy >= 0
      ) {
        this.y = p.y - this.h;
        this.vy = 0;
      }
    }

    // Bounds
    this.x = Math.max(40, Math.min(WORLD_W - 80, this.x));
  }

  draw(ctx, camX, camY) {
    const fx = Math.round(this.x - camX);
    const fy = Math.round(this.y - camY);
    if (fx + this.w < -20 || fx > VIEW_W + 20) return;

    ctx.save();
    ctx.translate(fx + this.w / 2, fy + this.h / 2);
    ctx.scale(this.facing, 1);

    if (this.kind === 'scavenger') {
      // Little beetle / critter
      ctx.fillStyle = '#065f46';
      ctx.fillRect(-6, -4, 12, 8);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(2, -3, 3, 3);
      // Legs
      ctx.fillStyle = '#022c22';
      ctx.fillRect(-5, 4, 2, 3);
      ctx.fillRect(2, 4, 2, 3);
    } else {
      // Armored herbivore
      ctx.fillStyle = '#4c1d95';
      ctx.fillRect(-10, -8, 20, 14);
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(-4, -10, 8, 4);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(5, -6, 3, 3);
      // Horns
      ctx.fillStyle = '#c4b5fd';
      ctx.fillRect(7, -12, 4, 5);
      // Legs
      ctx.fillStyle = '#2e1065';
      ctx.fillRect(-8, 6, 4, 4);
      ctx.fillRect(4, 6, 4, 4);
    }

    ctx.restore();
  }
}

// --- Adaptive Boss Predator AI ---
const AdaptivePredator = {
  x: 2300,
  y: 650,
  w: 42,
  h: 34,
  vx: 0,
  vy: 0,
  facing: -1,
  speed: 4.3,
  health: 100,
  active: true,

  // Finite State Machine
  // 'STALK', 'PATROL', 'SEARCH', 'CHASE', 'AMBUSH', 'INVESTIGATE', 'STUNNED'
  state: 'PATROL',
  stateTimer: 180,

  // Adaptive Learning Memory Structures
  memory: {
    hidingSpotFrequencies: {}, // { bush_1: count, ... }
    interceptBias: 0,          // -1 (left biased), +1 (right biased)
    distractionFatigue: 0,     // 0 to 1.0 (how resistant it is to sound tricks)
    lastKnownPlayerX: 300,
    lastKnownPlayerY: 600,
    suspicionLevel: 0,
    searchTargets: []
  },

  animTick: 0,
  minions: [],

  init() {
    World.hidingSpots.forEach(h => {
      this.memory.hidingSpotFrequencies[h.id] = 0;
    });
  },

  recordPlayerHiding(spotId) {
    if (!this.memory.hidingSpotFrequencies[spotId]) {
      this.memory.hidingSpotFrequencies[spotId] = 0;
    }
    this.memory.hidingSpotFrequencies[spotId]++;

    // If player abuses the same bush, predator learns to anticipate & flush it!
    if (this.memory.hidingSpotFrequencies[spotId] >= 3) {
      const spot = World.hidingSpots.find(s => s.id === spotId);
      if (spot) {
        this.memory.searchTargets.unshift({ x: spot.x, y: spot.y, flushSpot: spotId });
        this.state = 'INVESTIGATE';
        this.stateTimer = 220;
      }
    }
  },

  recordPlayerThrow(throwerX, throwerY) {
    // If repeatedly distracted, it starts hunting the source of the projectile!
    this.memory.distractionFatigue += 0.28;
    if (this.memory.distractionFatigue > 0.6) {
      // Instead of chasing the sound, stalk towards where the player threw it from!
      this.memory.searchTargets.unshift({ x: throwerX, y: throwerY, flushSpot: null });
      this.state = 'STALK';
      this.stateTimer = 180;
    }
  },

  onSoundDisturbance(x, y, intensity, source) {
    if (this.state === 'CHASE' || this.state === 'STUNNED') return;

    // Check if adaptation ignores cheap distractions
    if (source === 'distraction' && Math.random() < this.memory.distractionFatigue) {
      // Ignored! It senses a fake distraction
      return;
    }

    this.memory.searchTargets.push({ x, y, flushSpot: null });
    this.state = 'INVESTIGATE';
    this.stateTimer = 140;
  },

  update() {
    this.animTick++;
    this.stateTimer--;
    this.vy += GRAVITY;

    // Gradual fatigue decay
    if (this.animTick % 300 === 0 && this.memory.distractionFatigue > 0) {
      this.memory.distractionFatigue = Math.max(0, this.memory.distractionFatigue - 0.1);
    }

    // Line of sight to player
    const distToPlayer = Math.hypot(this.x - Player.x, this.y - Player.y);
    const hasLineOfSight = distToPlayer < 380 && !Player.hiddenIn;

    if (hasLineOfSight) {
      this.memory.lastKnownPlayerX = Player.x;
      this.memory.lastKnownPlayerY = Player.y;

      // Calculate player running direction bias
      if (Player.lastPositions.length > 5) {
        const oldest = Player.lastPositions[0];
        const newest = Player.lastPositions[Player.lastPositions.length - 1];
        this.memory.interceptBias = newest.x > oldest.x ? 1 : -1;
      }

      if (this.state !== 'CHASE') {
        AudioEngine.play('roar');
        SoundSystem.emit(this.x, this.y, 220, 0.9, 'predator');
        this.state = 'CHASE';
        this.stateTimer = 260;
        this.summonMinionsIfNeeded();
      }
    }

    // FSM Execution
    switch (this.state) {
      case 'PATROL': {
        this.vx = this.facing * 1.8;
        if (this.stateTimer <= 0) {
          this.stateTimer = 160 + Math.floor(Math.random() * 120);
          this.facing *= -1;
          // Occasionally choose an ambush spot
          if (Math.random() < 0.3) {
            this.state = 'AMBUSH';
            this.stateTimer = 200;
          }
        }
        break;
      }

      case 'CHASE': {
        // Adaptive Interception: Instead of directly trailing, predict where the player is heading!
        let targetX = Player.x;
        if (Math.abs(Player.vx) > 1.0) {
          // Lead target by 80 pixels ahead
          targetX += this.memory.interceptBias * 85;
        }

        this.facing = this.x < targetX ? 1 : -1;
        this.vx = this.facing * (this.speed + (this.health < 50 ? 0.8 : 0));

        // Jump over obstacles or gaps
        if (Math.abs(this.vx) < 0.5 && this.onGround) {
          this.vy = -9.5;
        }

        // Deal damage on touch
        if (distToPlayer < 36 && !Player.hiddenIn) {
          Player.health -= 0.8;
          AudioEngine.play('hurt');
          Particles.spawn(Player.x + 10, Player.y + 10, '#e11d48', 5);
        }

        if (this.stateTimer <= 0 || Player.hiddenIn) {
          // Lost sight: switch to searching the area
          this.state = 'SEARCH';
          this.stateTimer = 220;
          this.memory.searchTargets.push({
            x: this.memory.lastKnownPlayerX,
            y: this.memory.lastKnownPlayerY
          });
        }
        break;
      }

      case 'INVESTIGATE':
      case 'SEARCH': {
        if (this.memory.searchTargets.length > 0) {
          const target = this.memory.searchTargets[0];
          const distT = Math.abs(this.x - target.x);
          this.facing = this.x < target.x ? 1 : -1;
          this.vx = this.facing * 2.4;

          if (distT < 30) {
            // Reached target! If it's a known hiding spot, actively flush it!
            if (target.flushSpot) {
              const spot = World.hidingSpots.find(s => s.id === target.flushSpot);
              if (spot && Player.hiddenIn === spot.id) {
                // Flushed the player out!
                Player.hiddenIn = null;
                Player.vy = -6;
                Player.vx = this.facing * 5;
                Player.health -= 15;
                AudioEngine.play('hurt');
                AudioEngine.play('roar');
                this.state = 'CHASE';
                this.stateTimer = 200;
              }
            }
            this.memory.searchTargets.shift();
          }
        } else {
          this.vx *= 0.8;
          if (this.stateTimer <= 0) {
            this.state = 'PATROL';
            this.stateTimer = 200;
          }
        }
        break;
      }

      case 'AMBUSH': {
        // Lurk still on high platform or bush, ready to drop
        this.vx = 0;
        if (distToPlayer < 200) {
          this.state = 'CHASE';
          this.stateTimer = 240;
          AudioEngine.play('roar');
        }
        if (this.stateTimer <= 0) {
          this.state = 'PATROL';
          this.stateTimer = 180;
        }
        break;
      }

      case 'STUNNED': {
        this.vx *= 0.8;
        if (this.stateTimer <= 0) {
          this.state = 'CHASE';
          this.stateTimer = 180;
        }
        break;
      }
    }

    // Step physics
    this.x += this.vx;
    this.y += this.vy;

    // Platform collisions
    this.onGround = false;
    for (const p of World.platforms) {
      if (
        this.x + this.w > p.x &&
        this.x < p.x + p.w &&
        this.y + this.h >= p.y &&
        this.y + this.h <= p.y + p.h + 12 &&
        this.vy >= 0
      ) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
      }
    }

    // Check Traps Interaction
    for (const trap of World.traps) {
      if (
        trap.armed &&
        this.x + this.w > trap.x &&
        this.x < trap.x + trap.w &&
        Math.abs(this.y + this.h - trap.y) < 14
      ) {
        trap.armed = false;
        this.state = 'STUNNED';
        this.stateTimer = 150;
        this.health -= 35;
        AudioEngine.play('hurt');
        Particles.spawn(this.x + 20, this.y + 15, '#f43f5e', 20, 3);
        SoundSystem.emit(this.x, this.y, 250, 1.0, 'trap_snap');
      }
    }

    // Bounds
    this.x = Math.max(50, Math.min(WORLD_W - 90, this.x));

    // Update Minions
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      m.update();
      if (m.dead) this.minions.splice(i, 1);
    }
  },

  summonMinionsIfNeeded() {
    if (this.minions.length < 2 && Math.random() < 0.6) {
      this.minions.push(new Minion(this.x - 40, this.y - 10));
      this.minions.push(new Minion(this.x + 40, this.y - 10));
      Particles.spawn(this.x, this.y, '#991b1b', 12);
    }
  },

  draw(ctx, camX, camY) {
    const px = Math.round(this.x - camX);
    const py = Math.round(this.y - camY);

    // Minions
    for (const m of this.minions) {
      m.draw(ctx, camX, camY);
    }

    ctx.save();
    ctx.translate(px + this.w / 2, py + this.h / 2);
    ctx.scale(this.facing, 1);

    // Stunned vibration
    if (this.state === 'STUNNED') {
      ctx.translate((Math.random() - 0.5) * 4, 0);
    }

    // Menacing pixel beast body
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(-18, -12, 36, 22);

    // Armored spine plates
    ctx.fillStyle = '#b91c1c';
    for (let i = -14; i < 16; i += 8) {
      ctx.fillRect(i, -16, 5, 5);
    }

    // Glowing predator eye
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(8, -8, 6, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, -7, 2, 2);

    // Fangs & jaw
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(14, -2, 3, 5);
    ctx.fillRect(10, 2, 3, 4);

    // Prowling limbs
    ctx.fillStyle = '#0c0a09';
    const stride = Math.sin(this.animTick * 0.3) * 6;
    ctx.fillRect(-14 + stride, 8, 7, 9);
    ctx.fillRect(7 - stride, 8, 7, 9);

    // Tail with barb
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-24, -4, 8, 4);
    ctx.fillRect(-28, -8, 5, 5);

    ctx.restore();
  }
};

// --- Minion Stalkers ---
class Minion {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 18;
    this.h = 16;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.dead = false;
    this.timer = 300;
  }

  update() {
    this.timer--;
    if (this.timer <= 0) this.dead = true;

    this.vy += GRAVITY;

    // Flush or flank the player
    const distToPlayer = Math.hypot(this.x - Player.x, this.y - Player.y);
    this.facing = this.x < Player.x ? 1 : -1;
    this.vx = this.facing * 3.6;

    this.x += this.vx;
    this.y += this.vy;

    // Platform collision
    for (const p of World.platforms) {
      if (
        this.x + this.w > p.x &&
        this.x < p.x + p.w &&
        this.y + this.h >= p.y &&
        this.y + this.h <= p.y + p.h + 10 &&
        this.vy >= 0
      ) {
        this.y = p.y - this.h;
        this.vy = 0;
      }
    }

    if (distToPlayer < 24) {
      Player.health -= 0.3;
      AudioEngine.play('hurt');
    }
  }

  draw(ctx, camX, camY) {
    const mx = Math.round(this.x - camX);
    const my = Math.round(this.y - camY);
    ctx.save();
    ctx.translate(mx + this.w / 2, my + this.h / 2);
    ctx.scale(this.facing, 1);
    ctx.fillStyle = '#450a0a';
    ctx.fillRect(-8, -6, 16, 12);
    ctx.fillStyle = '#f87171';
    ctx.fillRect(2, -4, 4, 3);
    ctx.restore();
  }
}

// --- Ecosystem Manager ---
const Ecosystem = {
  fauna: [
    new Fauna(320, 600, 'scavenger'),
    new Fauna(500, 500, 'scavenger'),
    new Fauna(780, 540, 'grazer'),
    new Fauna(1400, 600, 'scavenger'),
    new Fauna(1900, 600, 'grazer'),
    new Fauna(2200, 480, 'scavenger')
  ],

  alertToSound(x, y, radius, intensity, source) {
    AdaptivePredator.onSoundDisturbance(x, y, intensity, source);
    for (const f of this.fauna) {
      if (Math.hypot(f.x - x, f.y - y) < radius) {
        f.state = 'flee';
        f.facing = f.x > x ? 1 : -1;
        f.vx = f.facing * 3.2;
      }
    }
  },

  update() {
    for (const f of this.fauna) f.update();
  },

  draw(ctx, camX, camY) {
    for (const f of this.fauna) f.draw(ctx, camX, camY);
  }
};

// --- Camera Viewport ---
const Camera = {
  x: 0,
  y: 0,
  update() {
    // Smooth track player
    const targetX = Player.x - VIEW_W / 2;
    const targetY = Player.y - VIEW_H / 2;
    this.x += (targetX - this.x) * 0.08;
    this.y += (targetY - this.y) * 0.08;

    // Clamp inside world boundaries
    this.x = Math.max(0, Math.min(WORLD_W - VIEW_W, this.x));
    this.y = Math.max(0, Math.min(WORLD_H - VIEW_H, this.y));
  }
};

// --- UI / HUD Synchronizer ---
function updateHUD() {
  document.getElementById('health-bar').style.width = Math.max(0, Player.health) + '%';
  document.getElementById('stamina-bar').style.width = Math.max(0, Player.stamina) + '%';
  document.getElementById('stealth-bar').style.width = Player.hiddenIn ? '100%' : '0%';

  const heldName = Player.heldObject ? Player.heldObject.type.toUpperCase() : 'NONE';
  document.getElementById('held-item-name').innerText = heldName;

  const stateBadge = document.getElementById('predator-state-badge');
  stateBadge.innerText = `PREDATOR: ${AdaptivePredator.state}`;

  const statusText = document.getElementById('status-text');
  if (Player.hiddenIn) {
    statusText.innerText = 'CONCEALED IN FOLIAGE';
    statusText.style.color = '#34d399';
  } else if (AdaptivePredator.state === 'CHASE') {
    statusText.innerText = 'HUNTED BY APEX PREDATOR!';
    statusText.style.color = '#f87171';
  } else {
    statusText.innerText = 'SURVIVING ECOSYSTEM';
    statusText.style.color = '#38bdf8';
  }

  // End Game conditions
  if (Player.health <= 0) {
    showEndScreen(false, 'The predator or the hazards of the ecosystem claimed you.');
  } else if (AdaptivePredator.health <= 0) {
    showEndScreen(true, 'You used the environment and traps to outsmart and defeat the apex predator!');
  }
}

function showEndScreen(victory, reason) {
  const overlay = document.getElementById('screen-overlay');
  const title = document.getElementById('overlay-title');
  const desc = document.getElementById('overlay-desc');
  overlay.classList.remove('hidden');

  if (victory) {
    title.innerText = 'VICTORY';
    title.style.color = '#22c55e';
    desc.innerText = reason;
  } else {
    title.innerText = 'CONSUMED';
    title.style.color = '#e11d48';
    desc.innerText = reason;
  }
}

// --- Main Game Loop ---
AdaptivePredator.init();

function gameLoop() {
  // Update Logic
  Player.update();
  AdaptivePredator.update();
  Ecosystem.update();
  for (const obj of worldObjects) obj.update();
  SoundSystem.update();
  Particles.update();
  Camera.update();
  updateHUD();

  // Render Pass
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  World.draw(ctx, Camera.x, Camera.y);
  for (const obj of worldObjects) obj.draw(ctx, Camera.x, Camera.y);
  Ecosystem.draw(ctx, Camera.x, Camera.y);
  Player.draw(ctx, Camera.x, Camera.y);
  AdaptivePredator.draw(ctx, Camera.x, Camera.y);
  SoundSystem.draw(ctx, Camera.x, Camera.y);
  Particles.draw(ctx, Camera.x, Camera.y);

  if (Player.health > 0 && AdaptivePredator.health > 0) {
    requestAnimationFrame(gameLoop);
  }
}

requestAnimationFrame(gameLoop);

