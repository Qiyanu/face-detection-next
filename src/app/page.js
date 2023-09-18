"use client";

import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import Stats from "stats.js";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function Home() {
    const webcamRef = useRef(null);
    const statsRef = useRef(null);
    const faceLandmarkerRef = useRef(null);
    const [smileScores, setSmileScores] = useState([]);
    const [smileCounts, setSmileCounts] = useState([]);
    const [faceIndexes, setFaceIndexes] = useState([]);
    const smileThreshold = 0.4;
    const smileFlagRef = useRef([]);

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
                numFaces: 2,
            });
            await faceLandmarker.setOptions({ runningMode: "VIDEO" });

            faceLandmarkerRef.current = faceLandmarker;

            let lastVideoTime = -1;

            async function renderLoop() {
                const video = webcamRef.current.video;
                const timestamp = performance.now();

                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    if (video.currentTime !== lastVideoTime) {
                        statsRef.current.begin();

                        const faceLandmarkerResult = await faceLandmarker.detectForVideo(video, timestamp);

                        statsRef.current.end();

                        processResults(faceLandmarkerResult);
                        lastVideoTime = video.currentTime;
                    }
                }

                requestAnimationFrame(renderLoop);
            }

            await renderLoop();
        }

        initializeFaceLandmarker().catch(error => {
            console.error("Error initializing FaceLandmarker:", error);
        });

    }, []);

    function processResults(results) {
        const numFaces = results.faceBlendshapes.length;

        setSmileCounts(prevCounts => {
            const newCounts = [...prevCounts];
            while (newCounts.length < numFaces) {
                newCounts.push(0);
                smileFlagRef.current.push(false);
            }
            return newCounts;
        });

        const newFaceIndexes = Array.from({ length: numFaces }, (_, index) => index);
        setFaceIndexes(newFaceIndexes);

        results.faceBlendshapes.forEach((face, index) => {
            const mouthSmileLeft = face.categories.find(cat => cat.categoryName === 'mouthSmileLeft');
            const mouthSmileRight = face.categories.find(cat => cat.categoryName === 'mouthSmileRight');
            const score = (mouthSmileLeft.score + mouthSmileRight.score) / 2;

            setSmileScores(prevScores => {
                const newScores = [...prevScores];
                newScores[index] = score;
                return newScores;
            });

            if (score > smileThreshold && !smileFlagRef.current[index]) {
                setSmileCounts(prevCounts => {
                    const newCounts = [...prevCounts];
                    newCounts[index]++;
                    return newCounts;
                });
                smileFlagRef.current[index] = true;
            } else if (score <= smileThreshold) {
                smileFlagRef.current[index] = false;
            }
        });
    }

    return (
        <div>
            <Webcam ref={webcamRef} />

            <canvas style={{ display: "none" }} />

            <div>
                {faceIndexes.map((faceIndex, index) => (
                    <div key={index}>
                        Face {faceIndex + 1} Smile Score: {smileScores[faceIndex].toFixed(2)}
                    </div>
                ))}
            </div>

            <div>
                {faceIndexes.map((faceIndex, index) => (
                    <div key={index}>
                        Face {faceIndex + 1} Smile Count: {smileCounts[faceIndex]}
                    </div>
                ))}
            </div>
        </div>
    );
}
