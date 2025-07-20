"use client";
import React, { useState, useRef, useEffect } from 'react';

// Main App Component
export default function App() {
    // Refs for video and canvas elements
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    
    // Refs for tracking intervals and media recording
    const intervalRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    // State management
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [downloadLink, setDownloadLink] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [infoMessage, setInfoMessage] = useState('Please wait, loading models...');

    // Effect to load face-api.js and its models
    useEffect(() => {
        const loadFaceApiScript = () => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
            script.async = true;
            script.onload = () => {
                console.log('face-api.js loaded');
                loadModels();
            };
            script.onerror = () => {
                 setErrorMessage('Failed to load face-api.js script. Please check your internet connection.');
            }
            document.body.appendChild(script);
        };

        const loadModels = async () => {
            try {
                // It's important that the models are hosted somewhere accessible
                const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@0.33.1/model/';
                await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
                console.log('Models loaded');
                setModelsLoaded(true);
                setInfoMessage('Models loaded successfully. You can now start the camera.');
            } catch (error) {
                console.error('Error loading models:', error);
                setErrorMessage('Could not load face detection models. Please refresh the page to try again.');
            }
        };

        loadFaceApiScript();

        // Cleanup function to stop streams and intervals
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Function to start the webcam
    const startCamera = async () => {
        if (isCameraOn) return;
        setErrorMessage('');
        setDownloadLink('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 720, height: 560 },
                audio: true // Request audio for recording
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraOn(true);
                setInfoMessage('Camera is on. Position your face in the frame.');
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
            setErrorMessage("Could not access the webcam. Please ensure you have a webcam connected and have granted permission.");
        }
    };

    // Function to handle the video playing event
    const handleVideoPlay = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        intervalRef.current = setInterval(async () => {
            if (videoRef.current && canvasRef.current && window.faceapi) {
                // Match canvas dimensions to video
                canvasRef.current.innerHTML = window.faceapi.createCanvasFromMedia(videoRef.current);
                const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
                window.faceapi.matchDimensions(canvasRef.current, displaySize);

                // Detect faces
                const detections = await window.faceapi.detectAllFaces(videoRef.current, new window.faceapi.TinyFaceDetectorOptions());
                const resizedDetections = window.faceapi.resizeResults(detections, displaySize);

                const context = canvasRef.current.getContext('2d', { willReadFrequently: true });
                // Clear previous drawings
                context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                // Draw video frame onto canvas
                context.drawImage(videoRef.current, 0, 0, displaySize.width, displaySize.height);
                // Draw detection boxes
                window.faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
            }
        }, 100); // Run detection every 100ms
    };

    // Function to start recording
    const startRecording = () => {
        if (!isCameraOn || isRecording) return;
        setDownloadLink('');
        recordedChunksRef.current = [];
        
        // Get stream from the canvas which has both video and drawings
        const stream = canvasRef.current.captureStream(30); // 30 fps
        
        // Add audio track from the original video stream to the canvas stream
        const audioTrack = videoRef.current.srcObject.getAudioTracks()[0];
        if (audioTrack) {
            stream.addTrack(audioTrack);
        }

        mediaRecorderRef.current = new MediaRecorder(stream, {
            mimeType: 'video/webm; codecs=vp9,opus'
        });

        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };

        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            setDownloadLink(url);
            setInfoMessage('Recording finished. You can now download the video.');
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        setInfoMessage('Recording in progress...');
    };

    // Function to stop recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // Info message is set in the onstop handler
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-4xl bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8">
                <h1 className="text-3xl md:text-4xl font-bold text-center text-cyan-400 mb-2">Face Tracking & Recorder</h1>
                <p className="text-center text-gray-400 mb-6">Built with React & face-api.js</p>

                {/* Message Display Area */}
                <div className="text-center mb-4 p-3 rounded-lg bg-gray-700 min-h-[50px] flex items-center justify-center">
                    {errorMessage ? (
                        <p className="text-red-400">{errorMessage}</p>
                    ) : (
                        <p className="text-gray-300">{infoMessage}</p>
                    )}
                </div>

                {/* Video and Canvas Container */}
                <div className="relative w-full max-w-3xl mx-auto aspect-video rounded-lg overflow-hidden shadow-lg bg-black">
                    <video
                        ref={videoRef}
                        onPlay={handleVideoPlay}
                        autoPlay
                        muted
                        playsInline
                        className="absolute top-0 left-0 w-full h-full object-cover"
                        style={{ display: isCameraOn ? 'block' : 'none' }}
                    ></video>
                    <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full"></canvas>
                     {!isCameraOn && (
                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                            <p className="text-gray-500">Camera is off</p>
                        </div>
                    )}
                </div>

                {/* Controls Area */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                    {!isCameraOn ? (
                        <button
                            onClick={startCamera}
                            disabled={!modelsLoaded}
                            className="px-6 py-3 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            {modelsLoaded ? 'Start Camera' : 'Loading Models...'}
                        </button>
                    ) : (
                        <>
                            {!isRecording ? (
                                <button
                                    onClick={startRecording}
                                    className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 transition-all"
                                >
                                    Start Recording
                                </button>
                            ) : (
                                <button
                                    onClick={stopRecording}
                                    className="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 transition-all flex items-center gap-2"
                                >
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                    </span>
                                    Stop Recording
                                </button>
                            )}
                        </>
                    )}
                </div>
                
                {/* Download Link */}
                {downloadLink && (
                    <div className="text-center mt-6">
                        <a
                            href={downloadLink}
                            download={`face-tracking-recording-${new Date().toISOString()}.webm`}
                            className="inline-block px-8 py-4 bg-purple-600 text-white font-bold rounded-lg shadow-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 transition-all"
                        >
                            Download Video
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
