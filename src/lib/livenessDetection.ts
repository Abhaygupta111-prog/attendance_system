/**
 * Liveness Detection — Anti-Spoofing
 * 
 * Photo mein aankhein KABHI nahi jhapakti.
 * Real face mein EAR (Eye Aspect Ratio) vary karta hai.
 * Agar EAR bahut high hai (aankhein fully open & static) = PHOTO
 * Agar EAR low hai (blink detected) = REAL FACE
 * 
 * Hum multiple frames mein EAR track karte hain.
 * Agar EAR vary karta hai = real, nahi karta = photo.
 */

/** Euclidean distance between two 2D points */
function dist(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * Eye Aspect Ratio (EAR) — dono aankhon ka average
 * face-api landmark indices for 68-point model:
 *   Left eye:  36-41
 *   Right eye: 42-47
 */
export function computeEAR(landmarks: { x: number; y: number }[]): number {
  // Left eye points
  const lP1 = landmarks[36];
  const lP2 = landmarks[37];
  const lP3 = landmarks[38];
  const lP4 = landmarks[39];
  const lP5 = landmarks[40];
  const lP6 = landmarks[41];

  // Right eye points
  const rP1 = landmarks[42];
  const rP2 = landmarks[43];
  const rP3 = landmarks[44];
  const rP4 = landmarks[45];
  const rP5 = landmarks[46];
  const rP6 = landmarks[47];

  // EAR formula: (vertical1 + vertical2) / (2 * horizontal)
  const leftEAR =
    (dist(lP2, lP6) + dist(lP3, lP5)) / (2.0 * dist(lP1, lP4));
  const rightEAR =
    (dist(rP2, rP6) + dist(rP3, rP5)) / (2.0 * dist(rP1, rP4));

  return (leftEAR + rightEAR) / 2.0;
}

/**
 * LivenessChecker class — multiple frames track karta hai
 * Usage:
 *   const checker = new LivenessChecker()
 *   // har frame mein:
 *   checker.addFrame(landmarks)
 *   const result = checker.getResult()
 */
export class LivenessChecker {
  private earHistory: number[] = [];
  private readonly requiredFrames = 15;   // kitne frames collect karne hain
  private readonly varianceThreshold = 0.0003; // variance itna hona chahiye = real face

  /** Ek frame ka EAR add karo */
  addFrame(landmarks: { x: number; y: number }[]): void {
    if (landmarks.length < 68) return;
    const ear = computeEAR(landmarks);
    this.earHistory.push(ear);
    // sirf last 30 frames rakh
    if (this.earHistory.length > 30) this.earHistory.shift();
  }

  /** Enough frames collect hue? */
  isReady(): boolean {
    return this.earHistory.length >= this.requiredFrames;
  }

  /** Progress 0-100 */
  getProgress(): number {
    return Math.min(100, Math.round((this.earHistory.length / this.requiredFrames) * 100));
  }

  /**
   * Result check karo
   * returns: 'real' | 'photo' | 'pending'
   */
  getResult(): 'real' | 'photo' | 'pending' {
    if (!this.isReady()) return 'pending';

    const mean = this.earHistory.reduce((a, b) => a + b, 0) / this.earHistory.length;
    const variance =
      this.earHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      this.earHistory.length;

    console.log(`[Liveness] EAR variance: ${variance.toFixed(6)} (threshold: ${this.varianceThreshold})`);

    // Photo mein variance almost 0 hota hai
    // Real face mein variance higher hota hai (subtle movements)
    return variance >= this.varianceThreshold ? 'real' : 'photo';
  }

  reset(): void {
    this.earHistory = [];
  }
}