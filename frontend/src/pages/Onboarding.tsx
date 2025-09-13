import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, Camera, Mic, AlertCircle } from 'lucide-react';

// Interface for defining the structure of each onboarding step
interface OnboardingStep {
    step: number;
    title: string;
    description: string;
}

// Component definition
const Onboarding = () => {
    // Array defining the steps of the onboarding process
    const steps: OnboardingStep[] = [
        {
            step: 1,
            title: "Upload Your Resume",
            description: "Drop your resume or click to browse. We accept PDF and DOC formats."
        },
        {
            step: 2,
            title: "Take a Professional Photo",
            description: "Capture a professional headshot for your profile."
        },
        {
            step: 3,
            title: "Voice Sample",
            description: 'Please read aloud: "I am excited to join Rehearse.io for interview preparation."'
        }
    ];

    // State management for the component
    const [currentStep, setCurrentStep] = useState(2); // Start at step 2 for camera testing
    const [progress, setProgress] = useState((2 / steps.length) * 100);
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string>('');
    const [cameraLoading, setCameraLoading] = useState(false);

    // Refs for DOM elements and media objects
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // --- Step 1: Resume Upload Logic ---
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setResumeFile(acceptedFiles[0]);
        }
    }, []);

    // Mock dropzone for this example since we don't have the actual library
    const getRootProps = () => ({
        onClick: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.docx,.doc';
            input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files && files.length > 0) {
                    setResumeFile(files[0]);
                }
            };
            input.click();
        }
    });

    const getInputProps = () => ({});
    const isDragActive = false;

    // --- Step 2: Photo Capture Logic (FIXED) ---
    const startCamera = useCallback(async () => {
        try {
            // Reset states
            setError('');
            setCameraLoading(true);
            setStream(null);

            // Ensure video element exists
            if (!videoRef.current) {
                console.error('Video element not mounted yet');
                setCameraLoading(false);
                setError('Camera initialization failed. Please try again.');
                return;
            }
            
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera access is not supported in this browser');
            }

            // Stop any existing stream
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            console.log('Requesting camera access...');
            
            const videoStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user', // Front-facing camera
                    aspectRatio: { ideal: 16/9 }
                } 
            });
            
            console.log('Camera access granted');
            
            // Set stream first
            setStream(videoStream);
            
            // Then set video source
            videoRef.current.srcObject = videoStream;
            
            // Ensure video plays
            await videoRef.current.play().catch(playError => {
                throw new Error(`Failed to play video: ${playError.message}`);
            });
            
        } catch (err) {
            console.error('Error accessing camera:', err);
            setCameraLoading(false);
            
            // Provide user-friendly error messages
            if (err instanceof Error) {
                if (err.name === 'NotAllowedError') {
                    setError('Camera permission was denied. Please allow camera access and try again.');
                } else if (err.name === 'NotFoundError') {
                    setError('No camera was found on this device.');
                } else if (err.name === 'NotSupportedError') {
                    setError('Camera is not supported in this browser.');
                } else {
                    setError(`Camera error: ${err.message}`);
                }
            } else {
                setError('An unknown error occurred while accessing the camera.');
            }
        }
    }, [videoRef, stream, setStream, setError, setCameraLoading]);

    const capturePhoto = () => {
        if (videoRef.current && videoRef.current.videoWidth > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const photoUrl = canvas.toDataURL('image/jpeg', 0.8);
                setPhoto(photoUrl);
                console.log('Photo captured successfully');
            }
            // Stop the camera stream after taking the photo
            stopCamera();
        } else {
            setError('Video is not ready. Please wait for the camera to load.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop();
                console.log('Camera track stopped');
            });
            setStream(null);
        }
    };

    
    const startRecording = async () => {
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStream(audioStream);
            const mediaRecorder = new MediaRecorder(audioStream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(audioBlob);
                setAudioUrl(url);
                audioStream.getTracks().forEach(track => track.stop());
                setStream(null);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
        }
    };
    
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };
    
    const recordAgain = () => {
        setAudioUrl(null);
        setIsRecording(false);
    };

    // --- Navigation Logic ---
    const handleNext = () => {
        if (currentStep < steps.length) {
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);
            setProgress((nextStep / steps.length) * 100);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            const prevStep = currentStep - 1;
            setCurrentStep(prevStep);
            setProgress((prevStep / steps.length) * 100);
        }
    };
    
    const handleFinish = () => {
        console.log("Onboarding Complete! Data:", {
            resume: resumeFile,
            photo: photo,
            audio: audioUrl,
        });
        alert('Thank you for completing the onboarding!');
    };

    const isNextButtonDisabled = () => {
        switch (currentStep) {
            case 1:
                return !resumeFile;
            case 2:
                return !photo;
            case 3:
                return !audioUrl;
            default:
                return true;
        }
    };
    
    // Initialize camera when step 2 is active
    useEffect(() => {
        if (currentStep === 2 && !photo && !stream && !cameraLoading) {
            startCamera();
        }
    }, [currentStep, photo, stream, cameraLoading, startCamera]);

    // Cleanup effect
    useEffect(() => {
        // Clean up function that runs when component unmounts or when dependencies change
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => {
                    track.stop();
                    console.log('Media track stopped on cleanup');
                });
            }
            if (mediaRecorderRef.current && isRecording) {
                mediaRecorderRef.current.stop();
                console.log('Media recorder stopped on cleanup');
            }
        };
    }, [stream, isRecording]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl p-8 shadow-xl rounded-lg">
                <div className="mb-8">
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between mt-2 text-sm text-gray-500">
                        {steps.map((step) => (
                            <span
                                key={step.step}
                                className={currentStep >= step.step ? 'text-blue-600 font-semibold' : ''}
                            >
                                {step.title}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-gray-800 mb-2">
                            {steps[currentStep - 1].title}
                        </h2>
                        <p className="text-gray-600">
                            {steps[currentStep - 1].description}
                        </p>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                            <AlertCircle className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Step 1: Resume Upload */}
                    {currentStep === 1 && (
                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
                        >
                            <input {...getInputProps()} />
                            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <p className="text-gray-600 font-medium">
                                {resumeFile
                                    ? `Selected: ${resumeFile.name}`
                                    : 'Drag & drop your resume, or click to select'}
                            </p>
                        </div>
                    )}

                    {/* Step 2: Photo Capture */}
                    {currentStep === 2 && (
                        <div className="flex flex-col items-center space-y-4">
                            {photo ? (
                                <>
                                    <img
                                        src={photo}
                                        alt="Your headshot"
                                        className="rounded-full object-cover w-52 h-52 border-4 border-white shadow-md"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setPhoto(null);
                                            setError('');
                                        }}
                                    >
                                        Retake Photo
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <div className="relative w-80 h-60 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                                        {/* Always render the video element but hide it when not streaming */}
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            style={{ 
                                                transform: 'scaleX(-1)',
                                                display: stream ? 'block' : 'none'
                                            }}
                                            className="w-full h-full object-cover"
                                            onLoadedMetadata={() => {
                                                console.log('Video metadata loaded');
                                                setCameraLoading(false);
                                            }}
                                            onError={(e) => {
                                                console.error('Video error:', e);
                                                setError('Error loading video stream');
                                                setCameraLoading(false);
                                            }}
                                        />
                                        
                                        {/* Show loading or camera icon */}
                                        {!stream && (
                                            <div className="flex flex-col items-center space-y-2">
                                                <Camera className="h-16 w-16 text-gray-400" />
                                                <span className="text-gray-500">Camera preview</span>
                                            </div>
                                        )}
                                        
                                        {/* Loading overlay */}
                                        {cameraLoading && (
                                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                                <div className="text-white">Loading camera...</div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex space-x-2">
                                        {!stream ? (
                                            <Button onClick={startCamera} disabled={cameraLoading}>
                                                <Camera className="mr-2 h-4 w-4" />
                                                {cameraLoading ? 'Starting...' : 'Start Camera'}
                                            </Button>
                                        ) : (
                                            <>
                                                <Button onClick={capturePhoto} disabled={cameraLoading}>
                                                    <Camera className="mr-2 h-4 w-4" />
                                                    Capture Photo
                                                </Button>
                                                <Button variant="outline" onClick={stopCamera}>
                                                    Stop Camera
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 3: Voice Recording */}
                    {currentStep === 3 && (
                        <div className="text-center space-y-6 flex flex-col items-center">
                            <div className={`w-32 h-32 mx-auto bg-gray-100 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? 'bg-red-100' : ''}`}>
                                <Mic className={`h-12 w-12 transition-colors duration-300 ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
                            </div>
                            {!audioUrl ? (
                                <Button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    variant={isRecording ? "destructive" : "default"}
                                    className="w-48"
                                >
                                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <audio src={audioUrl} controls className="mx-auto" />
                                    <Button variant="outline" onClick={recordAgain}>
                                        Record Again
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between pt-6">
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            disabled={currentStep === 1}
                        >
                            Back
                        </Button>
                        <Button
                            onClick={currentStep === steps.length ? handleFinish : handleNext}
                            disabled={isNextButtonDisabled()}
                        >
                            {currentStep === steps.length ? 'Finish' : 'Next'}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default Onboarding;