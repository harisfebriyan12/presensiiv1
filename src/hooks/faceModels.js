/**
 * Face-api.js Model Loading Utility
 * Handles loading and initialization of AI models for face recognition
 */

import * as faceapi from 'face-api.js';

let modelsLoaded = false;
let loadingPromise = null;

/**
 * Load all required face-api.js models
 * @returns {Promise<boolean>} True if models loaded successfully
 */
export const loadFaceModels = async (options = {}) => {
  const { detector = 'ssdMobilenetv1' } = options; // 'ssdMobilenetv1' or 'tinyFaceDetector'

  // Return existing promise if already loading
  if (loadingPromise) {
    return loadingPromise;
  }

  // Return true if already loaded
  if (modelsLoaded) {
    return true;
  }

  // Create loading promise
  loadingPromise = (async () => {
    try {
      const modelPath = `${import.meta.env.BASE_URL}models`;
      console.log(`Loading face-api.js models from ${modelPath}...`);
      
      const modelsToLoad = [
        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath)
      ];

      if (detector === 'ssdMobilenetv1') {
        modelsToLoad.push(faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath));
      } else {
        modelsToLoad.push(faceapi.nets.tinyFaceDetector.loadFromUri(modelPath));
      }
      
      await Promise.all(modelsToLoad);
      
      modelsLoaded = true;
      console.log(`✅ Face-api.js models (detector: ${detector}) loaded successfully`);
      return true;
      
    } catch (error) {
      console.error('❌ Error loading face-api.js models:', error);
      console.error('Make sure model files are downloaded to /public/models/');
      console.error('Download from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights');
      throw new Error('Failed to load face recognition models. Please check model files.');
    }
  })();

  return loadingPromise;
};

/**
 * Check if models are loaded
 * @returns {boolean} True if models are ready
 */
export const areModelsLoaded = () => {
  return modelsLoaded;
};

/**
 * Get face descriptor from image element
 * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} imageElement 
 * @returns {Promise<Float32Array|null>} Face descriptor or null
 */
export const getFaceDescriptor = async (imageElement) => {
  try {
    if (!modelsLoaded) {
      await loadFaceModels();
    }

    const detection = await faceapi
      .detectSingleFace(imageElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    
    return detection ? detection.descriptor : null;
  } catch (error) {
    console.error('Error getting face descriptor:', error);
    return null;
  }
};

/**
 * Compare two face descriptors
 * @param {Float32Array} descriptor1 
 * @param {Float32Array} descriptor2 
 * @param {number} threshold Similarity threshold (0.0-1.0, lower = more similar)
 * @returns {boolean} True if faces match
 */
export const compareFaceDescriptors = (descriptor1, descriptor2, threshold = 0.6) => {
  if (!descriptor1 || !descriptor2) {
    return false;
  }
  
  try {
    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
    return distance < threshold;
  } catch (error) {
    console.error('Error comparing face descriptors:', error);
    return false;
  }
};

/**
 * Detect faces in image and return count
 * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} imageElement 
 * @returns {Promise<number>} Number of faces detected
 */
export const detectFaceCount = async (imageElement) => {
  try {
    if (!modelsLoaded) {
      await loadFaceModels();
    }

    const detections = await faceapi.detectAllFaces(
      imageElement,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
    );
    
    return detections.length;
  } catch (error) {
    console.error('Error detecting faces:', error);
    return 0;
  }
};

/**
 * Create face descriptor from image URL
 * @param {string} imageUrl 
 * @returns {Promise<Float32Array|null>}
 */
export const getFaceDescriptorFromUrl = async (imageUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = async () => {
      try {
        const descriptor = await getFaceDescriptor(img);
        resolve(descriptor);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image from URL'));
    };
    
    img.src = imageUrl;
  });
};