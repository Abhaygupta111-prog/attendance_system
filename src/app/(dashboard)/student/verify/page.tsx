
"use client"

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, ArrowLeft, ShieldCheck, MapPin, AlertTriangle, Camera, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authService, dataStore } from '@/lib/store';

type VerifyStep = 'idle' | 'models' | 'face' | 'location' | 'saving' | 'done';

const STEP_LABELS: Record<VerifyStep, string> = {
  idle: '',
  models: 'Loading AI models...',
  face: 'Matching your face...',
  location: 'Getting GPS location...',
  saving: 'Recording attendance...',
  done: '',
};

export default function StudentVerifyAttendance() {
  const [verifyStep, setVerifyStep] = useState<VerifyStep>('idle');
  const [isVerified, setIsVerified] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const { toast } = useToast();
  const user = authService.getCurrentUser();

  // Start camera on mount
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
      .catch(() => toast({ variant: 'destructive', title: 'Camera Error', description: 'Enable camera to verify attendance.' }));

    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async () => {
    if (!sessionId || !user) return;

    // ── Step 1: Fetch fresh user data (need faceDescriptor) ─────
    setVerifyStep('models');
    const users = await dataStore.getUsers();
    const freshUser = users.find(u => u.id === user.id);

    if (!freshUser?.faceEnrolled || !freshUser?.faceDescriptor?.length) {
      toast({
        variant: 'destructive',
        title: 'Face Not Enrolled',
        description: 'Please enroll your face first from the "Enroll Face" page.',
      });
      setVerifyStep('idle');
      return;
    }

    // ── Step 2: Load face-api.js models ─────────────────────────
    let getDescriptorFromVideo: (v: HTMLVideoElement) => Promise<Float32Array | null>;
    let faceDistance: (a: number[] | Float32Array, b: number[] | Float32Array) => number;
    let FACE_MATCH_THRESHOLD: number;

    try {
      const faceApi = await import('@/lib/faceApi');
      await faceApi.loadFaceModels();
      getDescriptorFromVideo = faceApi.getDescriptorFromVideo;
      faceDistance = faceApi.faceDistance;
      FACE_MATCH_THRESHOLD = faceApi.FACE_MATCH_THRESHOLD;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Model Load Failed', description: 'Could not load face recognition AI. Check your internet connection.' });
      setVerifyStep('idle');
      return;
    }

    // ── Step 3: Capture live face descriptor ────────────────────
    setVerifyStep('face');
    const video = videoRef.current;
    if (!video) {
      toast({ variant: 'destructive', title: 'Camera Error', description: 'Camera not accessible.' });
      setVerifyStep('idle');
      return;
    }

    const liveDescriptor = await getDescriptorFromVideo(video);

    if (!liveDescriptor) {
      toast({
        variant: 'destructive',
        title: 'No Face Detected',
        description: 'Ensure your face is fully visible, well-lit, and centred in the circle.',
      });
      setVerifyStep('idle');
      return;
    }

    // ── Step 4: Compare with stored descriptor ──────────────────
    const storedDescriptor = Float32Array.from(freshUser.faceDescriptor);
    const distance = faceDistance(liveDescriptor, storedDescriptor);
    console.log(`[FaceVerify] Euclidean distance: ${distance.toFixed(4)} (threshold: ${FACE_MATCH_THRESHOLD})`);

    if (distance > FACE_MATCH_THRESHOLD) {
      toast({
        variant: 'destructive',
        title: 'Face Not Recognised',
        description: `Similarity score too low (${((1 - distance) * 100).toFixed(0)}%). Try better lighting or re-enroll your face.`,
      });
      setVerifyStep('idle');
      return;
    }

    // ── Step 5: Get GPS location ────────────────────────────────
    setVerifyStep('location');

    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Location Error', description: 'Geolocation not supported by your browser.' });
      setVerifyStep('idle');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // ── Step 6: Mark attendance ─────────────────────────────
        setVerifyStep('saving');
        const sessions = await dataStore.getLiveSessions();
        const session = sessions.find(s => s.id === sessionId && s.isActive);

        if (!session) {
          toast({ variant: 'destructive', title: 'Session Ended', description: 'This attendance session is no longer active.' });
          setVerifyStep('idle');
          return;
        }

        await dataStore.markAttendance([user.id], session.classId, { lat: latitude, lng: longitude });
        setIsVerified(true);
        setVerifyStep('done');
        toast({ title: '✅ Attendance Marked!', description: `Face matched (${((1 - distance) * 100).toFixed(0)}% similarity) · Location recorded.` });
      },
      (err) => {
        setVerifyStep('idle');
        toast({
          variant: 'destructive',
          title: 'Location Required',
          description: err.code === err.PERMISSION_DENIED
            ? 'GPS access denied. Enable location services to mark attendance.'
            : 'Could not get location. Please try again.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const isProcessing = verifyStep !== 'idle' && verifyStep !== 'done';

  if (isVerified) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-8">
        <Card className="max-w-md w-full text-center p-8 space-y-6">
          <div className="mx-auto w-20 h-20 bg-accent text-white rounded-full flex items-center justify-center shadow-lg">
            <CheckCircle2 size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Verified!</h2>
            <p className="text-muted-foreground mt-2">Face matched · Attendance and GPS location recorded.</p>
          </div>
          <Button className="w-full" onClick={() => router.push('/student')}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  const steps: VerifyStep[] = ['models', 'face', 'location', 'saving'];
  const currentStepIdx = steps.indexOf(verifyStep);

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Attendance Verification" />
      <div className="px-8 max-w-3xl mx-auto w-full">
        <Button variant="ghost" className="mb-4 gap-2" onClick={() => router.back()}>
          <ArrowLeft size={16} /> Cancel
        </Button>

        <Card className="shadow-xl overflow-hidden">
          <CardHeader className="bg-primary/5 border-b">
            <CardTitle>Verify Your Presence</CardTitle>
            <CardDescription>Local face recognition (face-api.js) + GPS — no cloud API required</CardDescription>
          </CardHeader>

          {/* Camera feed */}
          <CardContent className="p-0 relative bg-black aspect-video">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

            {/* Face circle guide */}
            <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none">
              <div className="w-full h-full border-2 border-accent/50 rounded-2xl relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-accent/60 rounded-full" />
                <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/60 text-xs whitespace-nowrap">
                  Centre your face in the circle
                </p>
              </div>
            </div>

            {/* Processing overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white z-10 gap-4">
                <Loader2 className="w-14 h-14 animate-spin text-accent" />
                <p className="text-lg font-bold">{STEP_LABELS[verifyStep]}</p>

                {/* Progress indicators */}
                <div className="flex gap-3 mt-2">
                  {steps.map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      {i > 0 && <div className="w-4 h-px bg-white/20" />}
                      <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                        currentStepIdx >= i ? 'bg-accent scale-125' : 'bg-white/25'
                      }`} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>

          <div className="p-6 border-t flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                <Brain className="text-primary shrink-0" size={14} />
                <p>face-api.js local AI (no API key)</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                <ShieldCheck className="text-accent shrink-0" size={14} />
                <p>128-d face embedding match</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                <MapPin className="text-primary shrink-0" size={14} />
                <p>GPS location recorded</p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p>First-time model download takes ~10 seconds and is cached for future use. Ensure face is fully visible and well-lit.</p>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handleVerify}
              disabled={isProcessing}
            >
              {isProcessing
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                : <><Camera className="mr-2 h-4 w-4" /> Confirm & Mark Present</>
              }
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
