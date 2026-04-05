
"use client"

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, ArrowLeft, Clock, Camera, CameraIcon, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [semester, setSemester] = useState('');
  const [course, setCourse] = useState('');
  const [section, setSection] = useState('');
  const [password, setPassword] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        setHasCameraPermission(false);
      }
    };

    getCameraPermission();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    const size = 200; // square thumbnail — ~10KB as base64, safe for MongoDB
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Center-crop so face fills the square
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const minSide = Math.min(vw, vh);
      const sx = (vw - minSide) / 2;
      const sy = (vh - minSide) / 2;
      ctx.drawImage(video, sx, sy, minSide, minSide, 0, 0, size, size);
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
      toast({ title: "Photo Captured", description: "Your profile photo has been saved." });
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      // Send the compressed face photo as avatar (200x200 JPEG ~10KB — safe for JSON)
      const result = await authService.signup({
        name,
        email,
        semester,
        course,
        section,
        ...(capturedImage ? { avatar: capturedImage } : {}),
      });

      if (result.success) {
        setIsSuccess(true);
        toast({
          title: "Registration Submitted",
          description: "Your account is now pending teacher approval.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Signup Error",
          description: result.error || "Could not complete registration.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "System Error",
        description: error.message || "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-xl border-t-4 border-t-accent text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4">
              <Clock size={32} />
            </div>
            <CardTitle className="text-2xl">Registration Pending</CardTitle>
            <CardDescription className="text-lg">
              Thank you for registering, {name.split(' ')[0]}!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your account has been created and is waiting for a teacher to approve your access. 
              You will be able to log in once your status is updated to 'Active'.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full gap-2">
                <ArrowLeft size={16} /> Back to Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-12">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">V</div>
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">Join AttendVerify</h2>
          <p className="mt-2 text-sm text-muted-foreground">Student Registration Portal</p>
        </div>

        <Card className="shadow-xl border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-xl">Create Account</CardTitle>
            <CardDescription>Enter your details and enroll your face for attendance</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="John Doe" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="john@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course">Course</Label>
                  <Input 
                    id="course" 
                    placeholder="e.g. BCA" 
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="semester">Semester</Label>
                  <Input 
                    id="semester" 
                    placeholder="e.g. 6" 
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section">Section</Label>
                  <Input 
                    id="section" 
                    placeholder="e.g. A" 
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label>Profile Photo (Face Enrollment)</Label>
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-2 border-muted group">
                  {capturedImage ? (
                    <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
                  ) : (
                    <>
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                      <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none">
                        <div className="w-full h-full border-2 border-dashed border-white/50 rounded-full" />
                      </div>
                    </>
                  )}
                  
                  {hasCameraPermission === false && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 text-center">
                      <Alert variant="destructive">
                        <CameraIcon className="h-4 w-4" />
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                          Please enable camera permissions in your browser settings to enroll your face.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  {!capturedImage ? (
                    <Button 
                      type="button" 
                      className="flex-1 gap-2" 
                      onClick={handleCapture}
                      disabled={!hasCameraPermission}
                    >
                      <Camera size={18} /> {hasCameraPermission === null ? 'Waiting for camera...' : 'Capture Face (Optional)'}
                    </Button>
                  ) : (
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1 gap-2" 
                      onClick={handleRetake}
                    >
                      <RefreshCw size={18} /> Retake Photo
                    </Button>
                  )}
                </div>
                {hasCameraPermission === false && (
                  <p className="text-xs text-muted-foreground text-center">
                    Camera unavailable — you can still register. Face enrollment can be done later from your dashboard.
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full h-11 text-lg shadow-lg" disabled={isLoading}>
                {isLoading ? "Processing..." : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Complete Registration
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 text-center">
             <p className="text-sm text-muted-foreground">
               Already have an account?{' '}
               <Link href="/login" className="text-primary font-bold hover:underline">
                 Sign In
               </Link>
             </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
