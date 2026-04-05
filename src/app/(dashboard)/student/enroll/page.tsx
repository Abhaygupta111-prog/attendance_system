
"use client"

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, ShieldCheck, Loader2, CameraIcon, CheckCircle2, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/lib/store';

export default function FaceEnrollment() {
  const [step, setStep] = useState<'intro' | 'scanning' | 'success'>('intro');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const user = authService.getCurrentUser();

  useEffect(() => {
    if (step === 'scanning' && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => {
          toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access webcam.' });
          setStep('intro');
        });
    } else {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    }
  }, [step, toast]);

  const handleEnroll = async () => {
    if (!videoRef.current || !user) return;
    setIsProcessing(true);

    try {
      const video = videoRef.current;

      // ── Step 1: Load face-api.js models ─────────────────────────
      setProcessingMsg('Loading AI models (first time ~10 s)...');
      const { loadFaceModels, getDescriptorFromVideo } = await import('@/lib/faceApi');
      await loadFaceModels();

      // ── Step 2: Extract face descriptor ─────────────────────────
      setProcessingMsg('Detecting face...');
      const descriptor = await getDescriptorFromVideo(video);

      if (!descriptor) {
        toast({
          variant: 'destructive',
          title: 'No Face Detected',
          description: 'Position your face clearly in the circle and ensure good lighting.',
        });
        return;
      }

      // ── Step 3: Capture compressed photo (200×200) ──────────────
      setProcessingMsg('Capturing photo...');
      const size = 200;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const side = Math.min(vw, vh);
      ctx?.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size);
      const photoDataUri = canvas.toDataURL('image/jpeg', 0.8);

      // ── Step 4: Save to MongoDB via PATCH ───────────────────────
      setProcessingMsg('Saving to database...');
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceData: photoDataUri,
          faceDescriptor: Array.from(descriptor), // Float32Array → plain array for JSON
          faceEnrolled: true,
          avatar: photoDataUri,
        }),
      });

      if (!res.ok) throw new Error('Failed to save face data');

      // ── Step 5: Update localStorage session ─────────────────────
      await authService.refreshCurrentUser();
      setStep('success');
      toast({ title: '✅ Enrolled!', description: 'Your face has been securely registered.' });

    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Enrollment Failed',
        description: err.message || 'An error occurred. Try again.',
      });
    } finally {
      setIsProcessing(false);
      setProcessingMsg('');
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header title="Face Enrollment" />

      <div className="px-8 max-w-4xl mx-auto w-full">
        <Card className="shadow-lg">
          <CardHeader className="text-center border-b bg-muted/20">
            <CardTitle className="text-2xl font-bold">Secure Face Registration</CardTitle>
            <CardDescription>Enroll your face to enable touchless attendance · Powered by face-api.js (offline AI)</CardDescription>
          </CardHeader>

          <CardContent className="p-8">
            {/* ── Intro step ─────────────────────────────────────── */}
            {step === 'intro' && (
              <div className="space-y-8 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { icon: Brain, color: 'primary', title: 'Offline AI', desc: 'face-api.js runs entirely in your browser — no API key required.' },
                    { icon: Camera, color: 'accent', title: 'Fast', desc: 'Verification takes less than 2 seconds after first model load.' },
                    { icon: CheckCircle2, color: 'primary', title: 'Accurate', desc: '128-dimensional face embeddings with 99.38% LFW accuracy.' },
                  ].map(({ icon: Icon, color, title, desc }) => (
                    <div key={title} className="text-center space-y-2">
                      <div className={`w-12 h-12 bg-${color}/10 text-${color} rounded-full flex items-center justify-center mx-auto mb-2`}>
                        <Icon size={24} />
                      </div>
                      <h4 className="font-bold">{title}</h4>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-muted p-6 rounded-xl space-y-3">
                  <h4 className="font-semibold">Guidelines for best results:</h4>
                  <ul className="text-sm space-y-1.5 list-disc list-inside text-muted-foreground">
                    <li>Ensure your face is well-lit from the front</li>
                    <li>Remove glasses and hats if possible</li>
                    <li>Maintain a neutral expression</li>
                    <li>Look directly into the camera</li>
                    <li>First-time model download takes ~10 seconds (cached afterwards)</li>
                  </ul>
                </div>

                <Button className="w-full h-12 text-lg shadow-lg" onClick={() => setStep('scanning')}>
                  Start Registration
                </Button>
              </div>
            )}

            {/* ── Scanning step ──────────────────────────────────── */}
            {step === 'scanning' && (
              <div className="space-y-6">
                <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border-4 border-muted">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

                  {/* face guide */}
                  <div className="absolute inset-0 border-[60px] border-black/30 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-2 border-white/50 rounded-full animate-pulse flex items-center justify-center">
                      <div className="w-48 h-48 border border-white/20 rounded-full" />
                    </div>
                  </div>
                  <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs">
                    Centre your face in the circle
                  </p>

                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white z-10 gap-3">
                      <Loader2 className="w-12 h-12 animate-spin text-primary" />
                      <p className="text-lg font-bold">{processingMsg}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" className="flex-1 h-12" onClick={() => setStep('intro')} disabled={isProcessing}>
                    Cancel
                  </Button>
                  <Button className="flex-1 h-12 gap-2 text-base" onClick={handleEnroll} disabled={isProcessing}>
                    <CameraIcon size={20} /> Capture & Enroll Face
                  </Button>
                </div>
              </div>
            )}

            {/* ── Success step ───────────────────────────────────── */}
            {step === 'success' && (
              <div className="py-12 flex flex-col items-center space-y-6">
                <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center text-white shadow-xl shadow-accent/20">
                  <CheckCircle2 size={48} />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-bold">Registration Complete!</h3>
                  <p className="text-muted-foreground">Your 128-d face embedding has been stored. You can now mark attendance.</p>
                </div>
                <Link href="/student">
                  <Button size="lg" className="px-12">Return to Dashboard</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
