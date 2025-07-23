import { loadFaceModels, getFaceDescriptor, compareFaceDescriptors, getFaceDescriptorFromUrl } from './faceModels';

// Re-export functions for backward compatibility
export { loadFaceModels as loadFaceApiModels };
export { getFaceDescriptor };
export { compareFaceDescriptors as compareFaces };
export { getFaceDescriptorFromUrl };

/**
 * Capture face from video stream
 * @param {HTMLVideoElement} video 
 * @returns {Promise<Float32Array|null>}
 */
export const captureFaceFromVideo = async (video) => {
  if (!video || video.readyState !== 4) {
    throw new Error('Video not ready');
  }
  
  return await getFaceDescriptor(video);
};