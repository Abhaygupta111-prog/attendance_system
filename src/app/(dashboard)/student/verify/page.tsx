"use client"

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    CheckCircle2, Loader2, ArrowLeft, ShieldCheck,
    MapPin, AlertTriangle, Camera, Brain, XCircle, UserX
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authService, dataStore } from '@/lib/store';
import { LivenessChecker } from '@/lib/livenessDetection';

type VerifyStep = 'idle' | 'liveness' | 'models' | 'face' | 'location' | 'saving' | 'done';
type LivenessState = 'pending' | 'real' | 'photo';

const STEP_LABELS: Record<VerifyStep, string> = {
    idle: '',
    liveness: 'Checking liveness — stay still & blink naturally...',
    models: 'Loading AI models...',
    face: 'Matching your face...',
    location: 'Getting GPS location...',
    saving: 'Recording attendance...',
    done: '',
};

export default function StudentVerifyAttendance() {
    const [verifyStep, setVerifyStep] = useState<VerifyStep>('idle');
    const [isVerified, setIsVerified] = useState(false);
    const [livenessState, setLivenessState] = useState<LivenessState>('pending');
    const [livenessProgress, setLivenessProgress] = useState(0);
    const [proxyStudent, setProxyStudent] = useState<null | {
        name: string; rollNo: string; email: string; photoURL?: string; class?: string;
    }>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const animFrameRef = useRef<number>(0);
    const checkerRef = useRef<LivenessChecker>(new LivenessChecker());

    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('sessionId');
    const { toast } = useToast();
    const user = authService.getCurrentUser();

    useEffect(() => {
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: 'user' } })
            .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
            .catch(() => toast({ variant: 'destructive', title: 'Camera Error', description: 'Enable camera to verify attendance.' }));
        return () => {
            const stream = videoRef.current?.srcObject as MediaStream;
            stream?.getTracks().forEach(t => t.stop());
            cancelAnimationFrame(animFrameRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startLivenessLoop = useCallback(async (faceapi: typeof import('@vladmandic/face-api')) => {
        const checker = checkerRef.current;
        checker.reset();
        const loop = async () => {
            if (!videoRef.current) return;
            const result = await faceapi
                .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
                .withFaceLandmarks();
            if (result) {
                const pts = result.landmarks.positions.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
                checker.addFrame(pts);
                setLivenessProgress(checker.getProgress());
                if (checker.isReady()) {
                    const res = checker.getResult();
                    setLivenessState(res === 'real' ? 'real' : 'photo');
                    cancelAnimationFrame(animFrameRef.current);
                    return;
                }
            }
            animFrameRef.current = requestAnimationFrame(loop);
        };
        animFrameRef.current = requestAnimationFrame(loop);
    }, []);

    const handleVerify = async () => {
        if (!sessionId || !user) return;
        setProxyStudent(null);
        setLivenessState('pending');
        setLivenessProgress(0);
        checkerRef.current.reset();

        setVerifyStep('models');
        const users = await dataStore.getUsers();
        const freshUser = users.find(u => u.id === user.id);

        if (!freshUser?.faceEnrolled || !freshUser?.faceDescriptor?.length) {
            toast({ variant: 'destructive', title: 'Face Not Enrolled', description: 'Please enroll your face first.' });
            setVerifyStep('idle');
            return;
        }

        let faceapi: typeof import('@vladmandic/face-api');
        let getDescriptorFromVideo: (v: HTMLVideoElement) => Promise<Float32Array | null>;
        let faceDistance: (a: number[] | Float32Array, b: number[] | Float32Array) => number;
        let FACE_MATCH_THRESHOLD: number;

        try {
            const faceApiLib = await import('@/lib/faceApi');
            await faceApiLib.loadFaceModels();
            faceapi = await import('@vladmandic/face-api');
            getDescriptorFromVideo = faceApiLib.getDescriptorFromVideo;
            faceDistance = faceApiLib.faceDistance;
            FACE_MATCH_THRESHOLD = faceApiLib.FACE_MATCH_THRESHOLD;
        } catch {
            toast({ variant: 'destructive', title: 'Model Load Failed', description: 'Could not load face recognition AI.' });
            setVerifyStep('idle');
            return;
        }

        // LIVENESS CHECK
        setVerifyStep('liveness');
        startLivenessLoop(faceapi!);

        const livenessResult = await new Promise<'real' | 'photo'>((resolve) => {
            const interval = setInterval(() => {
                const result = checkerRef.current.getResult();
                if (result !== 'pending') { clearInterval(interval); resolve(result); }
            }, 100);
        });

        cancelAnimationFrame(animFrameRef.current);

        if (livenessResult === 'photo') {
            setVerifyStep('face');
            const video = videoRef.current;
            if (video) {
                const suspectDescriptor = await getDescriptorFromVideo(video);
                if (suspectDescriptor) {
                    let bestMatch = null;
                    let bestDist = FACE_MATCH_THRESHOLD;
                    for (const u of users) {
                        if (!u.faceDescriptor?.length) continue;
                        const d = faceDistance(suspectDescriptor, Float32Array.from(u.faceDescriptor));
                        if (d < bestDist) { bestDist = d; bestMatch = u; }
                    }
                    if (bestMatch) {
                        setProxyStudent({
                            name: bestMatch.name ?? 'Unknown',
                            rollNo: (bestMatch as Record<string, string>).rollNo ?? bestMatch.id,
                            email: bestMatch.email ?? '',
                            photoURL: (bestMatch as Record<string, string>).photoURL,
                            class: (bestMatch as Record<string, string>).class,
                        });
                    }
                }
            }
            setVerifyStep('idle');
            toast({ variant: 'destructive', title: '🚫 Proxy Detected!', description: 'Photo shown instead of real face. Attendance NOT marked.' });
            return;
        }

        // FACE MATCH
        setVerifyStep('face');
        const video = videoRef.current;
        if (!video) { toast({ variant: 'destructive', title: 'Camera Error', description: 'Camera not accessible.' }); setVerifyStep('idle'); return; }

        const liveDescriptor = await getDescriptorFromVideo(video);
        if (!liveDescriptor) {
            toast({ variant: 'destructive', title: 'No Face Detected', description: 'Ensure face is visible and well-lit.' });
            setVerifyStep('idle');
            return;
        }

        const storedDescriptor = Float32Array.from(freshUser.faceDescriptor);
        const distance = faceDistance(liveDescriptor, storedDescriptor);

        if (distance > FACE_MATCH_THRESHOLD) {
            toast({ variant: 'destructive', title: 'Face Not Recognised', description: `Similarity score too low (${((1 - distance) * 100).toFixed(0)}%).` });
            setVerifyStep('idle');
            return;
        }

        // GPS
        setVerifyStep('location');
        if (!navigator.geolocation) { toast({ variant: 'destructive', title: 'Location Error', description: 'Geolocation not supported.' }); setVerifyStep('idle'); return; }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setVerifyStep('saving');
                const sessions = await dataStore.getLiveSessions();
                const session = sessions.find(s => s.id === sessionId && s.isActive);
                if (!session) { toast({ variant: 'destructive', title: 'Session Ended', description: 'This session is no longer active.' }); setVerifyStep('idle'); return; }
                await dataStore.markAttendance([user.id], session.classId, { lat: latitude, lng: longitude });
                setIsVerified(true);
                setVerifyStep('done');
                toast({ title: '✅ Attendance Marked!', description: `Face matched (${((1 - distance) * 100).toFixed(0)}% similarity) · Location recorded.` });
            },
            (err) => {
                setVerifyStep('idle');
                toast({ variant: 'destructive', title: 'Location Required', description: err.code === err.PERMISSION_DENIED ? 'GPS access denied.' : 'Could not get location.' });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const isProcessing = verifyStep !== 'idle' && verifyStep !== 'done';
    const steps: VerifyStep[] = ['liveness', 'models', 'face', 'location', 'saving'];
    const currentStepIdx = steps.indexOf(verifyStep);

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

    return (
        <div className="flex flex-col gap-8 pb-12">
            <Header title="Attendance Verification" />
            <div className="px-8 max-w-3xl mx-auto w-full">
                <Button variant="ghost" className="mb-4 gap-2" onClick={() => router.back()}>
                    <ArrowLeft size={16} /> Cancel
                </Button>

                {/* PROXY DETECTED CARD */}
                {livenessState === 'photo' && (
                    <Card className="mb-6 border-2 border-red-500 shadow-xl overflow-hidden">
                        <div className="bg-red-500 text-white p-4 flex items-center gap-3">
                            <XCircle size={28} />
                            <div>
                                <p className="font-bold text-lg">⚠️ PROXY DETECTED</p>
                                <p className="text-sm text-red-100">A photo was shown instead of a real face</p>
                            </div>
                        </div>
                        <CardContent className="p-5">
                            {proxyStudent ? (
                                <div className="flex items-center gap-5">
                                    <div className="shrink-0">
                                        {proxyStudent.photoURL ? (
                                            <img src={proxyStudent.photoURL} alt={proxyStudent.name}
                                                className="w-20 h-20 rounded-full border-4 border-red-400 object-cover" />
                                        ) : (
                                            <div className="w-20 h-20 rounded-full border-4 border-red-400 bg-red-100 flex items-center justify-center">
                                                <UserX size={36} className="text-red-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xl font-bold text-gray-900">{proxyStudent.name}</p>
                                        {proxyStudent.rollNo && <p className="text-sm text-gray-500 mt-0.5">Roll No: {proxyStudent.rollNo}</p>}
                                        {proxyStudent.class && <p className="text-sm text-gray-500">Class: {proxyStudent.class}</p>}
                                        {proxyStudent.email && <p className="text-sm text-gray-500">{proxyStudent.email}</p>}
                                        <div className="mt-3 inline-flex items-center gap-2 bg-red-100 text-red-700 text-sm font-semibold px-3 py-1.5 rounded-full">
                                            <XCircle size={14} /> Attendance NOT marked — Physical presence required!
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                                        <UserX size={30} className="text-red-400" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">Unknown Person</p>
                                        <p className="text-sm text-gray-500">Photo not matching any registered student</p>
                                        <div className="mt-2 inline-flex items-center gap-2 bg-red-100 text-red-700 text-sm font-semibold px-3 py-1.5 rounded-full">
                                            <XCircle size={14} /> Attendance NOT marked!
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* MAIN CAMERA CARD */}
                <Card className="shadow-xl overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle>Verify Your Presence</CardTitle>
                        <CardDescription>Liveness check + face recognition + GPS — no cloud API required</CardDescription>
                    </CardHeader>

                    <CardContent className="p-0 relative bg-black aspect-video">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none">
                            <div className="w-full h-full border-2 border-accent/50 rounded-2xl relative">
                                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 rounded-full transition-colors ${livenessState === 'photo' ? 'border-red-500' : livenessState === 'real' ? 'border-green-400' : 'border-accent/60'
                                    }`} />
                                <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/60 text-xs whitespace-nowrap">
                                    {verifyStep === 'liveness' ? `Liveness check... ${livenessProgress}%` : 'Centre your face in the circle'}
                                </p>
                            </div>
                        </div>

                        {verifyStep === 'liveness' && (
                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40">
                                <div className="h-full bg-accent transition-all duration-200" style={{ width: `${livenessProgress}%` }} />
                            </div>
                        )}

                        {isProcessing && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white z-10 gap-4">
                                <Loader2 className="w-14 h-14 animate-spin text-accent" />
                                <p className="text-lg font-bold">{STEP_LABELS[verifyStep]}</p>
                                {verifyStep === 'liveness' && (
                                    <p className="text-sm text-white/60">Blink naturally — {livenessProgress}% complete</p>
                                )}
                                <div className="flex gap-3 mt-2">
                                    {steps.map((s, i) => (
                                        <div key={s} className="flex items-center gap-2">
                                            {i > 0 && <div className="w-4 h-px bg-white/20" />}
                                            <div className={`w-2.5 h-2.5 rounded-full transition-all ${currentStepIdx >= i ? 'bg-accent scale-125' : 'bg-white/25'}`} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <div className="p-6 border-t flex flex-col gap-4">
                        <div className="grid grid-cols-4 gap-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                                <ShieldCheck className="text-green-500 shrink-0" size={14} /><p>Liveness check</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                                <Brain className="text-primary shrink-0" size={14} /><p>face-api.js local AI</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                                <ShieldCheck className="text-accent shrink-0" size={14} /><p>128-d embedding</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                                <MapPin className="text-primary shrink-0" size={14} /><p>GPS recorded</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <p>Liveness detection prevents proxy via photos. Blink naturally during the check. First-time model download ~10 sec.</p>
                        </div>

                        <Button
                            className="w-full h-12 text-base font-semibold"
                            onClick={handleVerify}
                            disabled={isProcessing}
                            variant={livenessState === 'photo' ? 'destructive' : 'default'}
                        >
                            {isProcessing
                                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                                : livenessState === 'photo'
                                    ? <><XCircle className="mr-2 h-4 w-4" /> Try Again</>
                                    : <><Camera className="mr-2 h-4 w-4" /> Confirm & Mark Present</>}
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
