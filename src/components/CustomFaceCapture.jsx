import React, { useRef, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import * as faceapi from 'face-api.js';
import { loadFaceModels } from '../hooks/faceModels';
import { generateFaceFingerprint, detectFacePattern } from '../hooks/customFaceRecognition';

const CustomFaceCapture = ({ onFaceCapture, isCapturing = false }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState("Posisikan wajah Anda di dalam lingkaran.");
  const [isFaceReady, setIsFaceReady] = useState(false);
  const isFaceCenteredRef = useRef(false);

  const speak = (text) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech synthesis failed", e);
    }
  };

  const handleCapture = async () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      // Flip the image horizontally
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Ambil ImageData dari canvas, lalu generate custom fingerprint
      try {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        // Deteksi pola wajah (opsional, bisa dihilangkan jika ingin lebih longgar)
        const isValidFace = detectFacePattern(imageData);
        canvas.toBlob(async blob => {
          if (isValidFace) {
            const fingerprint = generateFaceFingerprint(imageData);
            await Swal.fire({
              icon: 'success',
              title: 'Foto Berhasil',
              text: 'Foto wajah berhasil diambil dan diverifikasi!'
            });
            onFaceCapture(blob, fingerprint);
          } else {
            await Swal.fire({
              icon: 'warning',
              title: 'Fingerprint Tidak Terdeteksi',
              text: 'Fingerprint wajah tidak terdeteksi, silakan ulangi pengambilan foto.'
            });
            onFaceCapture(blob, null);
          }
        }, 'image/jpeg', 0.95);
      } catch (e) {
        canvas.toBlob(async blob => {
          await Swal.fire({
            icon: 'error',
            title: 'Gagal Mengambil Foto',
            text: 'Terjadi kesalahan saat mengambil foto.'
          });
          onFaceCapture(blob, null);
        }, 'image/jpeg', 0.95);
      }
    }
  };

  useEffect(() => {
    let stream = null;
    let animationFrameId = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Kamera tidak didukung oleh browser ini.');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError(err.message || 'Gagal mengakses kamera. Pastikan izin telah diberikan.');
      }
    };

    const detectFace = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === 4) {
        const displaySize = { width: video.clientWidth, height: video.clientHeight };
        if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
            faceapi.matchDimensions(canvas, displaySize);
        }

        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 })).withFaceLandmarks();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radiusX = canvas.width / 3.5;
        const radiusY = canvas.height / 2.5;

        context.beginPath();
        context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        context.lineWidth = 5;

        if (resizedDetections.length > 0) {
          const face = resizedDetections[0].detection.box;
          const faceCenterX = face.x + face.width / 2;
          const faceCenterY = face.y + face.height / 2;

          const isCentered = Math.abs(faceCenterX - centerX) < 30 && Math.abs(faceCenterY - centerY) < 40;
          const isGoodSize = face.width > 100 && face.height > 100;

          if (isCentered && isGoodSize) {
            context.strokeStyle = 'green';
            setIsFaceReady(true);
            if (!isFaceCenteredRef.current) {
              setFeedback("Wajah terdeteksi. Silakan ambil foto.");
              speak("Wajah terdeteksi. Silakan ambil foto.");
              isFaceCenteredRef.current = true;
            }
          } else {
            context.strokeStyle = 'yellow';
            setIsFaceReady(false);
            if (isFaceCenteredRef.current) {
              const newFeedback = !isGoodSize ? "Mohon lebih dekat ke kamera." : "Posisikan wajah di tengah lingkaran.";
              setFeedback(newFeedback);
              speak(newFeedback);
              isFaceCenteredRef.current = false;
            }
          }
        } else {
          context.strokeStyle = 'red';
          setIsFaceReady(false);
          if (isFaceCenteredRef.current) {
            setFeedback("Wajah tidak terdeteksi.");
            speak("Wajah tidak terdeteksi.");
            isFaceCenteredRef.current = false;
          }
        }
        context.stroke();
      }
      animationFrameId = requestAnimationFrame(detectFace);
    };

    const initialize = async () => {
      try {
        await loadFaceModels({ detector: 'tinyFaceDetector' });
        await startCamera();
        speak("Posisikan wajah Anda di dalam lingkaran.");
      } catch (err) {
        console.error("Initialization failed:", err);
        setError("Gagal memulai kamera atau memuat model. Coba muat ulang halaman.");
      }
    };

    initialize();
    
    const videoElement = videoRef.current;
    if(videoElement){
        videoElement.onplay = () => {
            detectFace();
        }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  if (error) {
    return <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center">Error: {error}</div>;
  }

  return (
    <div className="relative bg-black rounded-lg w-full max-w-md mx-auto overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', transform: 'scaleX(-1)' }}
      />
      <canvas ref={canvasRef} className="absolute top-0 left-0" style={{ transform: 'scaleX(-1)' }}/>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full px-4 flex flex-col items-center">
        <div className="bg-black bg-opacity-60 text-white text-center p-2 rounded-md mb-4">
          {feedback}
        </div>
        {isFaceReady && (
          <button
            onClick={handleCapture}
            disabled={isCapturing}
            className="bg-tosca-500 hover:bg-tosca-700 text-white font-bold py-2 px-4 rounded-full disabled:bg-gray-500"
          >
            {isCapturing ? 'Memproses...' : 'Ambil Foto'}
          </button>
        )}
      </div>
    </div>
  );
};

export default CustomFaceCapture;