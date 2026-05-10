/**
 * Liveness Detection — Strict 3-Blink Counter
 *
 * RULE:
 *  - Person MUST blink 3 times within MAX_FRAMES (~4 sec at 30fps)
 *  - 3 blinks = REAL ✅
 *  - Less than 3 blinks when time runs out = PROXY 🚫
 *
 * HOW BLINK IS DETECTED:
 *  - EAR (Eye Aspect Ratio) < EAR_CLOSE_THRESHOLD → eye closing
 *  - EAR > EAR_OPEN_THRESHOLD after closing → eye opened = 1 blink
 */

function dist(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * Eye Aspect Ratio (EAR) using face-api 68-point landmarks
 * Left eye : 36-41
 * Right eye: 42-47
 * Open eye EAR  ≈ 0.25–0.32
 * Closed eye EAR ≈ 0.10–0.18
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

export class LivenessChecker {
  private readonly EAR_CLOSE_THRESHOLD = 0.20; // below = eye closing
  private readonly EAR_OPEN_THRESHOLD  = 0.24; // above after close = blink complete
  private readonly REQUIRED_BLINKS     = 3;    // must blink 3 times
  private readonly MAX_FRAMES          = 150;  // ~5 sec at 30fps

  private blinkCount   = 0;
  private eyeWasClosed = false;
  private frameCount   = 0;
  private _result: 'real' | 'photo' | 'pending' = 'pending';

  addFrame(landmarks: { x: number; y: number }[]): void {
    if (landmarks.length < 68) return;
    if (this._result !== 'pending') return;

    this.frameCount++;
    const ear = computeEAR(landmarks);

    // State machine: detect close → open transition = one blink
    if (!this.eyeWasClosed && ear < this.EAR_CLOSE_THRESHOLD) {
      this.eyeWasClosed = true;
    } else if (this.eyeWasClosed && ear > this.EAR_OPEN_THRESHOLD) {
      this.blinkCount++;
      this.eyeWasClosed = false;
      console.log(`[Liveness] Blink #${this.blinkCount} | EAR: ${ear.toFixed(3)}`);
    }

    if (this.blinkCount >= this.REQUIRED_BLINKS) {
      this._result = 'real';
      console.log('[Liveness] ✅ REAL — 3 blinks confirmed');
    } else if (this.frameCount >= this.MAX_FRAMES) {
      this._result = 'photo';
      console.log(`[Liveness] 🚫 PROXY — only ${this.blinkCount}/3 blinks in ${this.frameCount} frames`);
    }
  }

  isReady(): boolean   { return this._result !== 'pending'; }
  getBlinkCount(): number { return this.blinkCount; }
  getFrameCount(): number { return this.frameCount; }
  getMaxFrames(): number  { return this.MAX_FRAMES; }

  /** 0-100 progress: driven by blinks first, time as fallback */
  getProgress(): number {
    const byBlinks = (this.blinkCount / this.REQUIRED_BLINKS) * 100;
    const byTime   = (this.frameCount  / this.MAX_FRAMES)     * 100;
    return Math.min(100, Math.max(byBlinks, byTime * 0.4));
  }

  getResult(): 'real' | 'photo' | 'pending' { return this._result; }

  reset(): void {
    this.blinkCount   = 0;
    this.eyeWasClosed = false;
    this.frameCount   = 0;
    this._result      = 'pending';
  }
}
