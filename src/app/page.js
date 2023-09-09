"use client";

import React, { useRef, useEffect } from "react";
import Webcam from "react-webcam";
import Stats from 'stats.js';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function Home() {
    const webcamRef = useRef(null);
    const statsRef = useRef(null);
    const faceLandmarkerRef = useRef(null);

    useEffect(() => {
        async function initializeFaceLandmarker() {
            const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
            if (!hasGetUserMedia) {
                console.warn("getUserMedia() is not supported by your browser");
                return;
            }

            statsRef.current = new Stats();
            statsRef.current.showPanel(0);
            document.body.appendChild(statsRef.current.dom);

            const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");
            const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU",
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 1,
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
        console.log(results.faceLandmarks);
    }

    return (
        <div>
            <Webcam ref={webcamRef} />

            <canvas
                style={{ display: 'none' }}
            />
        </div>
    )
}
