"use client";

import React, { useRef, useEffect, useState, memo } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { Loader2, Eye, Move } from 'lucide-react';

export interface AnalysisMetrics {
  eyeContactScore: number;
  headMovement: number;
}

interface RealTimeAnalysisProps {
  videoTrack: MediaStreamTrack | null;
  onMetricsFinalized: (metrics: AnalysisMetrics) => void;
}

export const RealTimeAnalysis: React.FC<RealTimeAnalysisProps> = memo(({ videoTrack, onMetricsFinalized }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>();
  const modelRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const lastPositionRef = useRef<{ x: number, y: number } | null>(null);
  const [metrics, setMetrics] = useState<AnalysisMetrics & { isModelReady: boolean; statusMessage: string; }>({
    eyeContactScore: 0,
    headMovement: 0,
    isModelReady: false,
    statusMessage: "A inicializar TensorFlow.js..."
  });

  useEffect(() => {
    if (videoTrack && videoRef.current) {
      videoRef.current.srcObject = new MediaStream([videoTrack]);
      videoRef.current.play().catch(e => console.error("Erro ao reproduzir vídeo para análise:", e));
    }
  }, [videoTrack]);

  useEffect(() => {
    const detectFaces = async () => {
      if (videoRef.current && modelRef.current && videoRef.current.readyState >= 3) {
        const video = videoRef.current;
        const faceEstimates = await modelRef.current.estimateFaces(video);

        if (faceEstimates.length > 0) {
          const keypoints = faceEstimates[0].keypoints;
          const noseTip = keypoints.find(k => k.name === 'noseTip');
          
          let movement = 0;
          if(noseTip && lastPositionRef.current) {
              const dx = noseTip.x - lastPositionRef.current.x;
              const dy = noseTip.y - lastPositionRef.current.y;
              movement = Math.sqrt(dx * dx + dy * dy);
              lastPositionRef.current = { x: noseTip.x, y: noseTip.y };
          } else if (noseTip) {
              lastPositionRef.current = { x: noseTip.x, y: noseTip.y };
          }
          
          const leftEyeUpper = keypoints.find(k => k.name === 'leftEyeUpper1');
          const rightEyeUpper = keypoints.find(k => k.name === 'rightEyeUpper1');

          let isLookingForward = false;
          if (leftEyeUpper?.z && rightEyeUpper?.z) {
              isLookingForward = Math.abs(leftEyeUpper.z - rightEyeUpper.z) < 10;
          }
          
          setMetrics(prev => ({
              ...prev,
              eyeContactScore: isLookingForward ? Math.min(100, prev.eyeContactScore + 0.5) : Math.max(0, prev.eyeContactScore - 0.5),
              headMovement: prev.headMovement + movement,
          }));
        }
      }
      requestRef.current = requestAnimationFrame(detectFaces);
    };

    const setupModel = async () => {
      try {
        await tf.ready();
        setMetrics(prev => ({ ...prev, statusMessage: "A carregar modelo de detecção facial..." }));
        
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshMediaPipeModelConfig = {
          runtime: 'mediapipe',
          solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
          maxFaces: 1,
          refineLandmarks: true,
        };
        const detector = await faceLandmarksDetection.createDetector(model, detectorConfig);

        modelRef.current = detector;
        setMetrics(prev => ({ ...prev, isModelReady: true, statusMessage: "Modelo pronto. A analisar..." }));
        requestRef.current = requestAnimationFrame(detectFaces);
      } catch (error) {
        console.error("Falha ao carregar o modelo de IA:", error);
        setMetrics(prev => ({ ...prev, statusMessage: "Erro ao carregar modelo." }));
      }
    };

    setupModel();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if(modelRef.current) {
        modelRef.current.dispose();
      }
      onMetricsFinalized({
          eyeContactScore: metrics.eyeContactScore,
          headMovement: metrics.headMovement
      });
    };
  }, []);

  return (
    <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700 h-full">
      <h3 className="text-lg font-semibold text-white mb-4">Análise Comportamental em Tempo Real</h3>
      <video ref={videoRef} className="hidden" />
      
      {!metrics.isModelReady ? (
        <div className="flex items-center text-yellow-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span>{metrics.statusMessage}</span>
        </div>
      ) : (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <Eye className="h-5 w-5 mr-3 text-blue-400" />
                    <span className="text-white">Estimativa de Contato Visual</span>
                </div>
                <div className="w-1/3 bg-gray-700 rounded-full h-2.5">
                    <div className="bg-blue-400 h-2.5 rounded-full" style={{ width: `${metrics.eyeContactScore}%` }}></div>
                </div>
                <span className="font-bold text-lg text-blue-300 w-16 text-right">{metrics.eyeContactScore.toFixed(0)}%</span>
            </div>
             <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <Move className="h-5 w-5 mr-3 text-purple-400" />
                    <span className="text-white">Acúmulo de Movimento (Cabeça)</span>
                </div>
                <span className="font-bold text-lg text-purple-300">{metrics.headMovement.toFixed(0)}</span>
            </div>
            <p className="text-xs text-gray-500 pt-2">
                Estes dados são estimativas geradas por IA para apoiar a observação clínica e não constituem um diagnóstico.
            </p>
        </div>
      )}
    </div>
  );
});
RealTimeAnalysis.displayName = 'RealTimeAnalysis';