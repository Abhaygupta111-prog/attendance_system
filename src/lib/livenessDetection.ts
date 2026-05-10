/**
 * Liveness Detection — Fast & Strict
 *
 * PASS if ANY of these are true within MAX_FRAMES:
 *  ✅ Person blinks 3+ times  (catches fast blinkers)
 *  ✅ Person blinks 1-2 times AND head moves  (catches natural movement)
 *
 * FAIL (PROXY) if:
 *  🚫 0 blinks and no head movement (static photo)
 *  🚫 Time runs out with insufficient proof of life
 *
 * SPEED:
 *  - Blink detected instantly → result fires as soon as 3rd blink happens
 *  - No waiting for timer to run out if person already proved liveness
 */

function dist(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * Eye Aspect Ratio (EAR)
 * face-api 68-point model:
 *   Left eye:  36-41  |  Right eye: 42-47
 * Open  ≈ 0.25–0.32
 * Blink ≈ 0.10–0.18
 */
export function computeEAR(landmarks: { x: number; y: number }[]): number {
  const lP1 = landmarks[36], lP2 = landmarks[37], lP3 = landmarks[38];
  const lP4 = landmarks[39], lP5 = landmarks[40], lP6 = landmarks[41];
  const rP1 = landmarks[42], rP2 = landmarks[43], rP3 = landmarks[44];
  const rP4 = landmarks[45], rP5 = landmarks[46], rP6 = landmarks[47];

  const leftEAR  = (dist(lP2, lP6) + dist(lP3, lP5)) / (2.0 * dist(lP1, lP4));
  const rightEAR = (dist(rP2, rP6) + dist(rP3, rP5)) / (2.0 * dist(rP1, rP4));
  return (leftEAR + rightEAR) / 2.0;
}

/**
 * Nose tip (landmark 30) position — used to detect head movement
 */
function getNoseTip(landmarks: { x: number; y: number }[]): { x: number; y: number } {
  return landmarks[30];
}

export class LivenessChecker {
  // ── Blink thresholds ───────────────────────────────────────────────────
  private readonly EAR_CLOSE = 0.20;   // below = closing
  private readonly EAR_OPEN  = 0.24;   // above after close = blink done

  // ── Head movement threshold ────────────────────────────────────────────
  private readonly HEAD_MOVE_PX = 8;   // pixels nose must move to count as movement

  // ── Pass rules ────────────────────────────────────────────────────────
  private readonly BLINKS_TO_PASS   = 3;   // 3+ blinks alone = PASS instantly
  private readonly BLINKS_WITH_MOVE = 1;   // 1+ blink + head move = PASS
  private readonly MAX_FRAMES       = 180; // ~6 sec timeout at 30fps

  // ── State ─────────────────────────────────────────────────────────────
  private blinkCount    = 0;
  private eyeWasClosed  = false;
  private frameCount    = 0;
  private headMoved     = false;
  private firstNosePos: { x: number; y: number } | null = null;
  private _result: 'real' | 'photo' | 'pending' = 'pending';

  addFrame(landmarks: { x: number; y: number }[]): void {
    if (landmarks.length < 68) return;
    if (this._result !== 'pending') return;

    this.frameCount++;
    const ear  = computeEAR(landmarks);
    const nose = getNoseTip(landmarks);

    // ── Track head movement ────────────────────────────────────────────
    if (!this.firstNosePos) {
      this.firstNosePos = nose;
    } else if (!this.headMoved) {
      const moved = dist(nose, this.firstNosePos);
      if (moved > this.HEAD_MOVE_PX) {
        this.headMoved = true;
        console.log(`[Liveness] 🔄 Head moved ${moved.toFixed(1)}px`);
      }
    }

    // ── Blink state machine ────────────────────────────────────────────
    if (!this.eyeWasClosed && ear < this.EAR_CLOSE) {
      this.eyeWasClosed = true;
    } else if (this.eyeWasClosed && ear > this.EAR_OPEN) {
      this.blinkCount++;
      this.eyeWasClosed = false;
      console.log(`[Liveness] 👁 Blink #${this.blinkCount} | EAR: ${ear.toFixed(3)}`);
    }

    // ── Decision — fires INSTANTLY as soon as condition met ────────────
    if (this.blinkCount >= this.BLINKS_TO_PASS) {
      // 3+ blinks = definitely real, no movement needed
      this._result = 'real';
      console.log('[Liveness] ✅ REAL — 3+ blinks');

    } else if (this.blinkCount >= this.BLINKS_WITH_MOVE && this.headMoved) {
      // 1+ blink + head movement = real
      this._result = 'real';
      console.log('[Liveness] ✅ REAL — blink + head movement');

    } else if (this.frameCount >= this.MAX_FRAMES) {
      // Time ran out — not enough proof
      this._result = 'photo';
      console.log(`[Liveness] 🚫 PROXY — ${this.blinkCount} blinks, headMoved: ${this.headMoved}`);
    }
  }

  isReady(): boolean      { return this._result !== 'pending'; }
  getBlinkCount(): number { return this.blinkCount; }
  getFrameCount(): number { return this.frameCount; }
  getMaxFrames(): number  { return this.MAX_FRAMES; }
  isHeadMoved(): boolean  { return this.headMoved; }

  /** 0–100 progress bar value */
  getProgress(): number {
    // Drive by blinks first (most satisfying feedback), time as fallback
    const byBlinks = (this.blinkCount / this.BLINKS_TO_PASS) * 100;
    const byTime   = (this.frameCount  / this.MAX_FRAMES)    * 100;
    return Math.min(100, Math.max(byBlinks, byTime * 0.35));
  }

  getResult(): 'real' | 'photo' | 'pending' { return this._result; }

  reset(): void {
    this.blinkCount    = 0;
    this.eyeWasClosed  = false;
    this.frameCount    = 0;
    this.headMoved     = false;
    this.firstNosePos  = null;
    this._result       = 'pending';
  }
}
