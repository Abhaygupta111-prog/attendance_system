/**
 * Advanced Liveness Detection
 *
 * Detects 4 types of real human movement:
 *  1. 👁  Blink        — EAR drops then rises
 *  2. 😊  Smile        — Mouth width increases (MAR ratio)
 *  3. ↩️  Head Turn    — Nose tip moves left/right significantly
 *  4. 🔼  Head Nod     — Nose tip moves up/down significantly
 *
 * PASS: any 2 of the 4 signals detected = REAL (fires instantly)
 * FAIL: time runs out with fewer than 2 signals = PROXY
 */

function dist(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/** Eye Aspect Ratio — left eye: 36-41, right eye: 42-47 */
export function computeEAR(lm: { x: number; y: number }[]): number {
  const l = (dist(lm[37], lm[41]) + dist(lm[38], lm[40])) / (2.0 * dist(lm[36], lm[39]));
  const r = (dist(lm[43], lm[47]) + dist(lm[44], lm[46])) / (2.0 * dist(lm[42], lm[45]));
  return (l + r) / 2.0;
}

/**
 * Mouth Aspect Ratio — smile widens the mouth horizontally
 * Outer mouth corners: 48 (left) and 54 (right)
 * Upper lip center: 51, Lower lip center: 57
 */
function computeMAR(lm: { x: number; y: number }[]): number {
  const horizontal = dist(lm[48], lm[54]);
  const vertical   = dist(lm[51], lm[57]);
  // Smile = wide mouth, low vertical/horizontal ratio
  return horizontal > 0 ? vertical / horizontal : 0;
}

export type LiveSignal = 'blink' | 'smile' | 'turn' | 'nod';

export interface LivenessStatus {
  result:      'real' | 'photo' | 'pending';
  signals:     Set<LiveSignal>;
  blinkCount:  number;
  headMoved:   boolean;
  smiled:      boolean;
  progress:    number;         // 0–100
  timeLeft:    number;         // seconds remaining
  instruction: string;         // what to show user
}

export class LivenessChecker {
  // ── Thresholds ─────────────────────────────────────────────────────────
  private readonly EAR_CLOSE       = 0.20;   // eye closing
  private readonly EAR_OPEN        = 0.24;   // eye open after blink
  private readonly SMILE_MAR_BASE  = 0.55;   // neutral mouth MAR approx
  private readonly SMILE_DROP      = 0.12;   // MAR must drop by this much to count as smile
  private readonly HEAD_TURN_PX    = 12;     // horizontal nose movement
  private readonly HEAD_NOD_PX     = 10;     // vertical nose movement
  private readonly SIGNALS_NEEDED  = 2;      // need any 2 signals to pass
  private readonly MAX_FRAMES      = 210;    // ~7 sec at 30fps
  private readonly FPS_ESTIMATE    = 30;

  // ── State ──────────────────────────────────────────────────────────────
  private blinkCount      = 0;
  private eyeWasClosed    = false;
  private frameCount      = 0;
  private signals         = new Set<LiveSignal>();

  // Smile tracking
  private baseMar: number | null = null;
  private marSamples: number[]   = [];

  // Head movement tracking
  private noseHistory: { x: number; y: number }[] = [];

  private _result: 'real' | 'photo' | 'pending' = 'pending';

  addFrame(lm: { x: number; y: number }[]): void {
    if (lm.length < 68) return;
    if (this._result !== 'pending') return;

    this.frameCount++;
    const ear  = computeEAR(lm);
    const mar  = computeMAR(lm);
    const nose = lm[30]; // nose tip

    // ── 1. BLINK detection ───────────────────────────────────────────────
    if (!this.eyeWasClosed && ear < this.EAR_CLOSE) {
      this.eyeWasClosed = true;
    } else if (this.eyeWasClosed && ear > this.EAR_OPEN) {
      this.blinkCount++;
      this.eyeWasClosed = false;
      this.signals.add('blink');
      console.log(`[Liveness] 👁 Blink #${this.blinkCount}`);
    }

    // ── 2. SMILE detection ───────────────────────────────────────────────
    if (!this.signals.has('smile')) {
      this.marSamples.push(mar);
      if (this.marSamples.length > 60) this.marSamples.shift();

      // Establish baseline from first 20 frames
      if (this.frameCount === 20) {
        this.baseMar = this.marSamples.reduce((a, b) => a + b, 0) / this.marSamples.length;
        console.log(`[Liveness] 😐 Baseline MAR: ${this.baseMar.toFixed(3)}`);
      }

      if (this.baseMar !== null && mar < this.baseMar - this.SMILE_DROP) {
        this.signals.add('smile');
        console.log(`[Liveness] 😊 Smile detected (MAR: ${mar.toFixed(3)} vs base: ${this.baseMar.toFixed(3)})`);
      }
    }

    // ── 3. HEAD TURN / NOD detection ────────────────────────────────────
    this.noseHistory.push(nose);
    if (this.noseHistory.length > 30) this.noseHistory.shift();

    if (this.noseHistory.length >= 5) {
      const oldest = this.noseHistory[0];
      const dx = Math.abs(nose.x - oldest.x);
      const dy = Math.abs(nose.y - oldest.y);

      if (!this.signals.has('turn') && dx > this.HEAD_TURN_PX) {
        this.signals.add('turn');
        console.log(`[Liveness] ↩️ Head turn detected (dx: ${dx.toFixed(1)}px)`);
      }
      if (!this.signals.has('nod') && dy > this.HEAD_NOD_PX) {
        this.signals.add('nod');
        console.log(`[Liveness] 🔼 Head nod detected (dy: ${dy.toFixed(1)}px)`);
      }
    }

    // ── Decision — fires INSTANTLY ───────────────────────────────────────
    if (this.signals.size >= this.SIGNALS_NEEDED) {
      this._result = 'real';
      console.log(`[Liveness] ✅ REAL — signals: ${Array.from(this.signals).join(', ')}`);
    } else if (this.frameCount >= this.MAX_FRAMES) {
      this._result = 'photo';
      console.log(`[Liveness] 🚫 PROXY — only ${this.signals.size} signal(s): ${Array.from(this.signals).join(', ')}`);
    }
  }

  getStatus(): LivenessStatus {
    const timeLeft = Math.max(0, Math.round((this.MAX_FRAMES - this.frameCount) / this.FPS_ESTIMATE));
    const progress = Math.min(100, (this.signals.size / this.SIGNALS_NEEDED) * 100 +
      (this.frameCount / this.MAX_FRAMES) * 20);

    return {
      result:     this._result,
      signals:    new Set(this.signals),
      blinkCount: this.blinkCount,
      headMoved:  this.signals.has('turn') || this.signals.has('nod'),
      smiled:     this.signals.has('smile'),
      progress:   Math.min(100, progress),
      timeLeft,
      instruction: this._getInstruction(),
    };
  }

  private _getInstruction(): string {
    if (this._result === 'real')  return '✅ Liveness confirmed!';
    if (this._result === 'photo') return '🚫 Liveness failed';

    const missing: string[] = [];
    if (!this.signals.has('blink') && !this.signals.has('smile') &&
        !this.signals.has('turn')  && !this.signals.has('nod')) {
      return '👁 Blink, smile, or move your head';
    }
    if (this.signals.size < this.SIGNALS_NEEDED) {
      if (!this.signals.has('blink')) missing.push('blink');
      if (!this.signals.has('smile')) missing.push('smile');
      if (!this.signals.has('turn') && !this.signals.has('nod')) missing.push('move head');
      return `Almost there! Try to ${missing.slice(0, 2).join(' or ')}`;
    }
    return 'Hold still...';
  }

  isReady(): boolean   { return this._result !== 'pending'; }
  getResult(): 'real' | 'photo' | 'pending' { return this._result; }
  getBlinkCount(): number { return this.blinkCount; }
  getSignals(): Set<LiveSignal> { return new Set(this.signals); }

  getProgress(): number {
    return Math.min(100, (this.signals.size / this.SIGNALS_NEEDED) * 100);
  }

  reset(): void {
    this.blinkCount   = 0;
    this.eyeWasClosed = false;
    this.frameCount   = 0;
    this.signals      = new Set();
    this.baseMar      = null;
    this.marSamples   = [];
    this.noseHistory  = [];
    this._result      = 'pending';
  }
}
