"use client";

import React, {useEffect, useRef, useState} from "react";
import Webcam from "react-webcam";
import Stats from 'stats.js';
import {FaceLandmarker, FilesetResolver} from "@mediapipe/tasks-vision";

export default function Home() {
    const webcamRef = useRef(null);
    const statsRef = useRef(null);
    const faceLandmarkerRef = useRef(null);
    const [smileScores, setSmileScores] = useState([]); // Store smile scores

    useEffect(() => {
        async function initializeFaceLandmarker() {
            // Check for getUserMedia support
            const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
            if (!hasGetUserMedia) {
                console.warn("getUserMedia() is not supported by your browser");
                return;
            }

            // Initialize the performance statistics panel
            statsRef.current = new Stats();
            statsRef.current.showPanel(0);
            document.body.appendChild(statsRef.current.dom);

            // Load models and assets for facial landmark detection
            const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");
            const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU",
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 2,
            });
            await faceLandmarker.setOptions({ runningMode: "VIDEO" });

            faceLandmarkerRef.current = faceLandmarker;

            let lastVideoTime = -1;

            async function renderLoop() {
                const video = webcamRef.current.video;
                const timestamp = performance.now();

                // Check if the video dimensions are available
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    if (video.currentTime !== lastVideoTime) {
                        statsRef.current.begin(); // Start measuring video performance

                        const faceLandmarkerResult = await faceLandmarker.detectForVideo(video, timestamp);

                        statsRef.current.end(); // End measuring video performance

                        processResults(faceLandmarkerResult);
                        lastVideoTime = video.currentTime;
                    }
                }

                requestAnimationFrame(renderLoop);
            }

            await renderLoop();
        }

        // Handle the Promise returned by initializeFaceLandmarker
        initializeFaceLandmarker()
            .catch(error => {
                console.error("Error initializing FaceLandmarker:", error);
            });

    }, []);

    function processResults(results) {
        const smileScores = results.faceBlendshapes.map((face) => {
            // Calculate the smile score as the average of mouthSmileLeft and mouthSmileRight
            const mouthSmileLeft = face.categories.find(cat => cat.categoryName === 'mouthSmileLeft');
            const mouthSmileRight = face.categories.find(cat => cat.categoryName === 'mouthSmileRight');
            return (mouthSmileLeft.score + mouthSmileRight.score) / 2;
        });

        setSmileScores(smileScores); // Update smileScores state
        console.log(results.faceLandmarks);
        console.log(results.faceBlendshapes);
    }

    return (
        <div>
            <Webcam ref={webcamRef} />

            <canvas style={{ display: 'none' }} />

            <div>
                {smileScores.map((score, index) => (
                    <div key={index}>
                        Smile Score {index + 1}: {score.toFixed(2)} {/* Display smile score */}
                    </div>
                ))}
            </div>
        </div>
    )
}
