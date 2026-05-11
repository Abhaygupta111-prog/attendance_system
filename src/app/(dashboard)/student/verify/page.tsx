"use client"

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    CheckCircle2, Loader2, ArrowLeft, ShieldCheck,
    MapPin, AlertTriangle, Camera, Brain, XCircle, UserX, Eye,
    Smile, MoveHorizontal, MoveVertical, Bell
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authService, dataStore } from '@/lib/store';
import { LivenessChecker, LiveSignal } from '@/lib/livenessDetection';

type VerifyStep = 'idle' | 'liveness' | 'models' | 'face' | 'location' | 'saving' | 'done';
type LivenessState = 'pending' | 'real' | 'photo';

const STEP_LABELS: Record<VerifyStep, string> = {
    idle: '',
    liveness: 'Prove you are real...',
    models: 'Loading AI models...',
    face: 'Matching your face...',
    location: 'Getting GPS location...',
    saving: 'Recording attendance...',
    done: '',
};

// Signal display config
const SIGNAL_CONFIG: Record<LiveSignal, { label: string; icon: React.ReactNode }> = {
    blink: { label: 'Blink',      icon: <Eye size={18} /> },
    smile: { label: 'Smile',      icon: <Smile size={18} /> },
    turn:  { label: 'Turn Head',  icon: <MoveHorizontal size={18} /> },
    nod:   { label: 'Nod Head',   icon: <MoveVertical size={18} /> },
};

async function sendNotification(title: string, body: string) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission === 'granted') new Notification(title, { body, icon: '/favicon.ico' });
}

export default function StudentVerifyAttendance() {
    const [verifyStep, setVerifyStep]       = useState<VerifyStep>('idle');
    const [isVerified, setIsVerified]       = useState(false);
    const [livenessState, setLivenessState] = useState<LivenessState>('pending');
    const [signals, setSignals]             = useState<Set<LiveSignal>>(new Set());
    const [instruction, setInstruction]     = useState('Blink, smile, or move your head');
    const [progress, setProgress]           = useState(0);
    const [timeLeft, setTimeLeft]           = useState(7);
    const [notifGranted, setNotifGranted]   = useState(false);
    const [faceDetected, setFaceDetected]   = useState(false);
    const [proxyStudent, setProxyStudent]   = useState<null | {
        name: string; rollNo: string; email: string; photoURL?: string; class?: string;
    }>(null);

    const videoRef     = useRef<HTMLVideoElement>(null);
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);
    const checkerRef   = useRef<LivenessChecker>(new LivenessChecker());

    const router       = useRouter();
    const searchParams = useSearchParams();
    const sessionId    = searchParams.get('sessionId');
    const { toast }    = useToast();
    const user         = authService.getCurrentUser();

    // Camera init
    useEffect(() => {
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
            .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
            .catch(() => toast({ variant: 'destructive', title: 'Camera Error', description: 'Enable camera to verify attendance.' }));
        return () => {
            const stream = videoRef.current?.srcObject as MediaStream;
            stream?.getTracks().forEach(t => t.stop());
            cancelAnimationFrame(animFrameRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Notification permission
    useEffect(() => {
        if ('Notification' in window) {
            if (Notification.permission === 'granted') setNotifGranted(true);
            else Notification.requestPermission().then(p => setNotifGranted(p === 'granted'));
        }
    }, []);

    // Liveness loop — auto detects face, no manual trigger needed for detection
    const startLivenessLoop = useCallback(async (faceapi: typeof import('@vladmandic/face-api')) => {
        const checker = checkerRef.current;
        checker.reset();

        const loop = async () => {
            if (!videoRef.current) return;

            const detection = await faceapi
                .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks();

            if (detection) {
                setFaceDetected(true);
                const pts = detection.landmarks.positions.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
                checker.addFrame(pts);

                // Draw face outline on canvas (no circle — auto outline)
                if (canvasRef.current && videoRef.current) {
                    const ctx = canvasRef.current.getContext('2d');
                    if (ctx) {
                        canvasRef.current.width  = videoRef.current.videoWidth  || 640;
                        canvasRef.current.height = videoRef.current.videoHeight || 480;
                        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                        const box = detection.detection.box;
                        const status = checker.getStatus();

                        // Box color by state
                        const color = status.result === 'real'  ? '#22c55e' :
                                      status.result === 'photo' ? '#ef4444' :
                                      status.signals.size > 0  ? '#f59e0b' : '#6366f1';

                        ctx.strokeStyle = color;
                        ctx.lineWidth   = 3;
                        ctx.shadowColor = color;
                        ctx.shadowBlur  = 12;

                        // Rounded rect around face
                        const r = 12, x = box.x, y = box.y, w = box.width, h = box.height;
                        ctx.beginPath();
                        ctx.moveTo(x + r, y);
                        ctx.lineTo(x + w - r, y);
                        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
                        ctx.lineTo(x + w, y + h - r);
                        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                        ctx.lineTo(x + r, y + h);
                        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
                        ctx.lineTo(x, y + r);
                        ctx.quadraticCurveTo(x, y, x + r, y);
                        ctx.closePath();
                        ctx.stroke();
                    }
                }

                const status = checker.getStatus();
                setSignals(new Set(status.signals));
                setInstruction(status.instruction);
                setProgress(status.progress);
                setTimeLeft(status.timeLeft);

                if (checker.isReady()) {
                    const res = checker.getResult();
                    setLivenessState(res === 'real' ? 'real' : 'photo');
                    cancelAnimationFrame(animFrameRef.current);
                    return;
                }
            } else {
                setFaceDetected(false);
                // Clear canvas when no face
                if (canvasRef.current) {
                    const ctx = canvasRef.current.getContext('2d');
                    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
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
        setSignals(new Set());
        setProgress(0);
        setTimeLeft(7);
        setFaceDetected(false);
        checkerRef.current.reset();

        // Load models
        setVerifyStep('models');
        const users     = await dataStore.getUsers();
        const freshUser = users.find(u => u.id === user.id);

        if (!freshUser?.faceEnrolled || !freshUser?.faceDescriptor?.length) {
            toast({ variant: 'destructive', title: 'Face Not Enrolled', description: 'Please enroll your face first.' });
            await sendNotification('⚠️ Face Not Enrolled', 'Please enroll your face in settings first.');
            setVerifyStep('idle');
            return;
        }

        let faceapi: typeof import('@vladmandic/face-api');
        let getDescriptorFromVideo: (v: HTMLVideoElement) => Promise<Float32Array | null>;
        let faceDistance: (a: number[] | Float32Array, b: number[] | Float32Array) => number;
        let FACE_MATCH_THRESHOLD: number;

        try {
            const faceApiLib       = await import('@/lib/faceApi');
            await faceApiLib.loadFaceModels();
            faceapi                = await import('@vladmandic/face-api');
            getDescriptorFromVideo = faceApiLib.getDescriptorFromVideo;
            faceDistance           = faceApiLib.faceDistance;
            FACE_MATCH_THRESHOLD   = faceApiLib.FACE_MATCH_THRESHOLD;
        } catch {
            toast({ variant: 'destructive', title: 'Model Load Failed', description: 'Could not load face recognition AI.' });
            setVerifyStep('idle');
            return;
        }

        // Start liveness — auto runs, no user action needed
        setVerifyStep('liveness');
        await sendNotification('👁 Liveness Check', 'Blink, smile, or move your head to prove you are real.');
        startLivenessLoop(faceapi!);

        const livenessResult = await new Promise<'real' | 'photo'>((resolve) => {
            const iv = setInterval(() => {
                const r = checkerRef.current.getResult();
                if (r !== 'pending') { clearInterval(iv); resolve(r); }
            }, 100);
        });

        cancelAnimationFrame(animFrameRef.current);

        if (livenessResult === 'photo') {
            setVerifyStep('face');
            const video = videoRef.current;
            if (video) {
                const suspectDesc = await getDescriptorFromVideo(video);
                if (suspectDesc) {
                    let bestMatch = null, bestDist = FACE_MATCH_THRESHOLD;
                    for (const u of users) {
                        if (!u.faceDescriptor?.length) continue;
                        const d = faceDistance(suspectDesc, Float32Array.from(u.faceDescriptor));
                        if (d < bestDist) { bestDist = d; bestMatch = u; }
                    }
                    if (bestMatch) {
                        setProxyStudent({
                            name:     bestMatch.name ?? 'Unknown',
                            rollNo:   (bestMatch as Record<string, string>).rollNo ?? bestMatch.id,
                            email:    bestMatch.email ?? '',
                            photoURL: (bestMatch as Record<string, string>).photoURL,
                            class:    (bestMatch as Record<string, string>).class,
                        });
                        await sendNotification('🚫 Proxy Detected!', `${bestMatch.name ?? 'Someone'} tried to use a photo.`);
                    } else {
                        await sendNotification('🚫 Proxy Detected!', 'Unknown photo. Attendance NOT marked.');
                    }
                }
            }
            setVerifyStep('idle');
            toast({ variant: 'destructive', title: '🚫 Proxy Detected!', description: 'No liveness signals detected. Attendance NOT marked.' });
            return;
        }

        // Face match
        setVerifyStep('face');
        await sendNotification('✅ Liveness Passed!', 'Now matching your face...');
        const video = videoRef.current;
        if (!video) { toast({ variant: 'destructive', title: 'Camera Error', description: 'Camera not accessible.' }); setVerifyStep('idle'); return; }

        const liveDesc = await getDescriptorFromVideo(video);
        if (!liveDesc) {
            toast({ variant: 'destructive', title: 'No Face Detected', description: 'Ensure face is visible and well-lit.' });
            setVerifyStep('idle');
            return;
        }

        const stored   = Float32Array.from(freshUser.faceDescriptor);
        const distance = faceDistance(liveDesc, stored);

        if (distance > FACE_MATCH_THRESHOLD) {
            toast({ variant: 'destructive', title: 'Face Not Recognised', description: `Score: ${((1 - distance) * 100).toFixed(0)}%` });
            await sendNotification('❌ Face Not Matched', `Score too low: ${((1 - distance) * 100).toFixed(0)}%`);
            setVerifyStep('idle');
            return;
        }

        // GPS
        setVerifyStep('location');
        if (!navigator.geolocation) { toast({ variant: 'destructive', title: 'Location Error', description: 'Geolocation not supported.' }); setVerifyStep('idle'); return; }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                setVerifyStep('saving');
                const sessions = await dataStore.getLiveSessions();
                const session  = sessions.find(s => s.id === sessionId && s.isActive);
                if (!session) { toast({ variant: 'destructive', title: 'Session Ended', description: 'This session is no longer active.' }); setVerifyStep('idle'); return; }
                await dataStore.markAttendance([user.id], session.classId, { lat: latitude, lng: longitude });
                setIsVerified(true);
                setVerifyStep('done');
                toast({ title: '✅ Attendance Marked!', description: `Face matched (${((1 - distance) * 100).toFixed(0)}%) · GPS recorded.` });
                await sendNotification('✅ Attendance Marked!', `Welcome! Face: ${((1 - distance) * 100).toFixed(0)}% match · Location saved.`);
            },
            (err) => {
                setVerifyStep('idle');
                const msg = err.code === err.PERMISSION_DENIED ? 'GPS access denied.' : 'Could not get location.';
                toast({ variant: 'destructive', title: 'Location Required', description: msg });
                sendNotification('📍 Location Required', msg);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const isProcessing   = verifyStep !== 'idle' && verifyStep !== 'done';
    const steps: VerifyStep[] = ['liveness', 'models', 'face', 'location', 'saving'];
    const currentStepIdx = steps.indexOf(verifyStep);
    const allSignals: LiveSignal[] = ['blink', 'smile', 'turn', 'nod'];

    if (isVerified) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center p-8">
                <Card className="max-w-md w-full text-center p-8 space-y-6">
                    <div className="mx-auto w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle2 size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-green-600">Attendance Marked!</h2>
                        <p className="text-muted-foreground mt-2">Liveness verified · Face matched · GPS recorded.</p>
                    </div>
                    <div className="flex justify-center gap-3 flex-wrap">
                        {Array.from(signals).map(s => (
                            <span key={s} className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                                {SIGNAL_CONFIG[s].icon} {SIGNAL_CONFIG[s].label}
                            </span>
                        ))}
                    </div>
                    <Button className="w-full" onClick={() => router.push('/student')}>Back to Dashboard</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-12">
            <Header title="Attendance Verification" />
            <div className="px-4 md:px-8 max-w-3xl mx-auto w-full">

                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" className="gap-2" onClick={() => router.back()}>
                        <ArrowLeft size={16} /> Cancel
                    </Button>
                    <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${notifGranted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        <Bell size={12} /> {notifGranted ? 'Notifications ON' : 'Notifications OFF'}
                    </div>
                </div>

                {/* Proxy detected card */}
                {livenessState === 'photo' && (
                    <Card className="mb-6 border-2 border-red-500 shadow-xl overflow-hidden">
                        <div className="bg-red-500 text-white p-4 flex items-center gap-3">
                            <XCircle size={28} />
                            <div>
                                <p className="font-bold text-lg">⚠️ PROXY DETECTED</p>
                                <p className="text-sm text-red-100">No liveness signals — photo or static face</p>
                            </div>
                        </div>
                        <CardContent className="p-5">
                            {proxyStudent ? (
                                <div className="flex items-center gap-5">
                                    <div className="shrink-0">
                                        {proxyStudent.photoURL
                                            ? <img src={proxyStudent.photoURL} alt={proxyStudent.name} className="w-20 h-20 rounded-full border-4 border-red-400 object-cover" />
                                            : <div className="w-20 h-20 rounded-full border-4 border-red-400 bg-red-100 flex items-center justify-center"><UserX size={36} className="text-red-400" /></div>}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xl font-bold">{proxyStudent.name}</p>
                                        {proxyStudent.rollNo && <p className="text-sm text-gray-500">Roll No: {proxyStudent.rollNo}</p>}
                                        {proxyStudent.class  && <p className="text-sm text-gray-500">Class: {proxyStudent.class}</p>}
                                        {proxyStudent.email  && <p className="text-sm text-gray-500">{proxyStudent.email}</p>}
                                        <div className="mt-3 inline-flex items-center gap-2 bg-red-100 text-red-700 text-sm font-semibold px-3 py-1.5 rounded-full">
                                            <XCircle size={14} /> Attendance NOT marked
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center"><UserX size={30} className="text-red-400" /></div>
                                    <div>
                                        <p className="font-bold">Unknown Person</p>
                                        <p className="text-sm text-gray-500">Not matching any registered student</p>
                                        <div className="mt-2 inline-flex items-center gap-2 bg-red-100 text-red-700 text-sm font-semibold px-3 py-1.5 rounded-full">
                                            <XCircle size={14} /> Attendance NOT marked
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Main camera card */}
                <Card className="shadow-xl overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle>Verify Your Presence</CardTitle>
                        <CardDescription>Auto face detection · Blink / Smile / Move head · GPS</CardDescription>
                    </CardHeader>

                    {/* Camera + canvas overlay — NO circle, auto bounding box */}
                    <div className="relative bg-black aspect-video overflow-hidden">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

                        {/* Face not detected hint */}
                        {verifyStep === 'liveness' && !faceDetected && (
                            <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
                                <span className="bg-black/60 text-white/80 text-sm px-4 py-2 rounded-full animate-pulse">
                                    📷 Look at the camera...
                                </span>
                            </div>
                        )}

                        {/* Liveness signal indicators — shown during liveness */}
                        {verifyStep === 'liveness' && faceDetected && (
                            <div className="absolute top-3 left-3 right-3 flex gap-2 z-20 flex-wrap">
                                {allSignals.map(s => (
                                    <div key={s} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                                        signals.has(s)
                                            ? 'bg-green-500 text-white scale-105 shadow-lg shadow-green-500/40'
                                            : 'bg-black/50 text-white/50'
                                    }`}>
                                        {SIGNAL_CONFIG[s].icon}
                                        {SIGNAL_CONFIG[s].label}
                                        {signals.has(s) && ' ✓'}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Progress bar */}
                        {verifyStep === 'liveness' && (
                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40 z-10">
                                <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                        )}

                        {/* Processing overlay */}
                        {isProcessing && (
                            <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white z-10 gap-4 px-6">
                                {verifyStep === 'liveness' ? (
                                    <>
                                        {/* Signal pills */}
                                        <div className="flex gap-3 flex-wrap justify-center">
                                            {allSignals.map(s => (
                                                <div key={s} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                                                    signals.has(s)
                                                        ? 'bg-green-500 border-green-400 scale-110 shadow-xl'
                                                        : 'bg-white/10 border-white/20'
                                                }`}>
                                                    <span className={signals.has(s) ? 'text-white' : 'text-white/40'}>
                                                        {SIGNAL_CONFIG[s].icon}
                                                    </span>
                                                    <span className={`text-sm font-semibold ${signals.has(s) ? 'text-white' : 'text-white/40'}`}>
                                                        {SIGNAL_CONFIG[s].label}
                                                    </span>
                                                    {signals.has(s) && <CheckCircle2 size={14} className="text-white" />}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-lg font-bold text-center">{instruction}</p>
                                        <p className="text-sm text-white/50">{timeLeft}s · any 2 signals needed</p>
                                    </>
                                ) : (
                                    <>
                                        <Loader2 className="w-14 h-14 animate-spin text-accent" />
                                        <p className="text-lg font-bold">{STEP_LABELS[verifyStep]}</p>
                                    </>
                                )}

                                <div className="flex gap-3 mt-1">
                                    {steps.map((s, i) => (
                                        <div key={s} className="flex items-center gap-2">
                                            {i > 0 && <div className="w-4 h-px bg-white/20" />}
                                            <div className={`w-2.5 h-2.5 rounded-full transition-all ${currentStepIdx >= i ? 'bg-accent scale-125' : 'bg-white/25'}`} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t flex flex-col gap-4">
                        {/* Feature badges */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                                <Eye className="text-green-500 shrink-0" size={14} /><p>Blink detect</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                                <Smile className="text-yellow-500 shrink-0" size={14} /><p>Smile detect</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                                <Brain className="text-primary shrink-0" size={14} /><p>Local AI</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                                <MapPin className="text-primary shrink-0" size={14} /><p>GPS recorded</p>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                            <ShieldCheck size={14} className="shrink-0 mt-0.5 text-blue-500" />
                            <p>
                                <strong>Auto detection:</strong> Just look at the camera. 
                                The system automatically detects your face and asks you to perform 
                                any <strong>2 of 4</strong> actions: <strong>blink</strong>, <strong>smile</strong>, 
                                <strong> turn head</strong>, or <strong>nod</strong>.
                                Photos and static faces are rejected instantly.
                            </p>
                        </div>

                        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <p>Good lighting required · Face must be clearly visible · First-time model download ~10 sec</p>
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
                                    : <><Camera className="mr-2 h-4 w-4" /> Confirm &amp; Mark Present</>}
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
