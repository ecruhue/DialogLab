// utils/modelThumbnailGenerator.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

/**
 * Generates a PNG thumbnail from a 3D model URL
 * @param {string} modelUrl - URL to the GLB/GLTF model
 * @param {number} width - Thumbnail width
 * @param {number} height - Thumbnail height
 * @returns {Promise<string>} - Promise resolving to PNG data URL
 */
export async function generateModelThumbnail(modelUrl, width = 512, height = 512) {
  return new Promise((resolve, reject) => {
    try {
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      // Set up high-quality renderer
      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(width, height);
      renderer.setClearColor(0xffffff, 0);
      renderer.setPixelRatio(window.devicePixelRatio || 2); // Higher resolution rendering
      
      // Enable physically correct lighting for better materials
      renderer.physicallyCorrectLights = true;
      
      // Improve shadow quality if model has shadows
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // Set up scene with environment
      const scene = new THREE.Scene();

      // // Optional: Add environment map for more realistic lighting/reflections
      // const hdrUrls = [
      //   'px.jpg', 'nx.jpg',
      //   'py.jpg', 'ny.jpg',
      //   'pz.jpg', 'nz.jpg'
      // ];
      
      // // Try to load environment map if available (fallback gracefully if not)
      // try {
      //   const envMapLoader = new THREE.CubeTextureLoader();
      //   envMapLoader.setPath('/assets/envmaps/studio/');
      //   envMapLoader.load(hdrUrls, (envMap) => {
      //     scene.environment = envMap;
      //     scene.background = null; // Keep transparent background
      //   });
      // } catch (error) {
      //   // Silently fail - environment maps are optional enhancement
      //   console.log('Environment map not available, using default lighting');
      // }

      // Set up camera to focus on upper body
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 1.85, 2.0); // Positioned higher and closer for upper body focus
      camera.lookAt(0, 1.5, 0); // Look at upper chest/neck area
      
      // Enhanced lighting setup for brighter, more flattering thumbnails
      
      // Stronger ambient light for overall brightness
      const ambientLight = new THREE.AmbientLight(0xffffff, 1);
      scene.add(ambientLight);
      
      // Main key light - brighter and positioned for flattering facial lighting
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
      keyLight.position.set(1.5, 2, 2);
      scene.add(keyLight);
      
      // Fill light from the opposite side to reduce harsh shadows
      const fillLight = new THREE.DirectionalLight(0xffffeb, 0.7); // Slightly warm
      fillLight.position.set(-1.5, 0.5, 2);
      scene.add(fillLight);
      
      // Rim/back light for subject separation and highlighting contours
      const rimLight = new THREE.DirectionalLight(0xf0f8ff, 0.8); // Slightly cool
      rimLight.position.set(0, 2, -2);
      scene.add(rimLight);
      
      // Soft bottom fill to illuminate neck/chin area
      const bottomFill = new THREE.DirectionalLight(0xffffff, 0.4);
      bottomFill.position.set(0, -1, 1.5);
      scene.add(bottomFill);
      
      // Load the model
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          const avatarModel = gltf.scene;
          
          // Auto-position the model to show upper body prominently
          const box = new THREE.Box3().setFromObject(avatarModel);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          
          // Calculate scale for larger upper body view
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.5 / maxDim; // Larger scale factor for a closer view
          avatarModel.scale.set(scale, scale, scale);
          
          // Position adjustments to focus on upper body
          avatarModel.position.x = -center.x * scale;
          // Shift the model down to bring upper body into frame
          avatarModel.position.y = -center.y * scale + 0.7; 
          avatarModel.position.z = -center.z * scale + 0.7;
          
          // Optional: you could also clip the lower body if needed
          // by adding a clipping plane to the renderer
          
          // Add model to scene
          scene.add(avatarModel);
          
          // Optional: add a subtle animation for a more interesting thumbnail
          let frameCount = 0;
          const animate = () => {
            if (frameCount >= 30) {
              // After 30 frames, prepare for final high-quality capture
              
              // Apply final adjustments for the perfect shot
              // Slightly turn model to show more dimensionality
              avatarModel.rotation.y = 0.2;
              
              // Temporarily boost quality settings for final render
              renderer.toneMappingExposure = 1.2; // Slightly brighter final exposure
              
              // Multi-sampling trick: render multiple times with tiny camera position variations
              // for pseudo-antialiasing effect
              const originalPosition = camera.position.clone();
              const microShifts = [
                new THREE.Vector3(0.001, 0, 0),
                new THREE.Vector3(0, 0.001, 0),
                new THREE.Vector3(0, 0, 0.001),
                new THREE.Vector3(-0.001, 0, 0),
                new THREE.Vector3(0, -0.001, 0),
                new THREE.Vector3(0, 0, -0.001),
              ];
              
              // Render multiple samples for higher quality
              for (const shift of microShifts) {
                camera.position.add(shift);
                renderer.render(scene, camera);
              }
              
              // Reset camera to original position for final render
              camera.position.copy(originalPosition);
              renderer.render(scene, camera);
              
              // Create high quality PNG with maximum quality
              const dataUrl = canvas.toDataURL('image/png', 1.0);
              
              // Clean up
              renderer.dispose();
              renderer.forceContextLoss();
              scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                  if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                  } else {
                    object.material.dispose();
                  }
                }
              });
              
              resolve(dataUrl);
              return;
            }
            
            frameCount++;
            // Smaller rotation per frame for smoother animation
            avatarModel.rotation.y += 0.01;
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
          };
          
          // Start animation
          animate();
        },
        // Progress callback
        (xhr) => {
          // If needed, you can track loading progress
          // console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`);
        },
        // Error callback
        (error) => {
          console.error('Error loading model:', error);
          reject(error);
        }
      );
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      reject(error);
    }
  });
}

/**
 * Generate and cache thumbnails for multiple models
 * @param {string[]} modelUrls - Array of model URLs
 * @returns {Promise<Object>} - Object mapping indices to thumbnail URLs
 */
// export async function generateModelThumbnailCache(modelUrls) {
//   const thumbnails = {};
  
//   // Try to get cached thumbnails first
//   const cachedThumbnails = localStorage.getItem('avatarThumbnails');
//   if (cachedThumbnails) {
//     const parsed = JSON.parse(cachedThumbnails);
    
//     // Check if cache is still valid (same number of models)
//     if (Object.keys(parsed).length === modelUrls.length) {
//       return parsed;
//     }
//   }
  
//   // Generate thumbnails one by one (could be optimized with Promise.all for parallel processing)
//   for (let i = 0; i < modelUrls.length; i++) {
//     try {
//       thumbnails[i] = await generateModelThumbnail(modelUrls[i]);
//     } catch (error) {
//       console.error(`Failed to generate thumbnail for model ${i}:`, error);
//       // Use a placeholder for failed thumbnails
//       thumbnails[i] = null;
//     }
//   }
  
//   // Cache the results
//   localStorage.setItem('avatarThumbnails', JSON.stringify(thumbnails));
  
//   return thumbnails;
// }


export async function generateModelThumbnailCache(modelUrls) {
  console.log('Generating thumbnail cache for:', modelUrls);
  const thumbnails = {};
  
  // Try to get cached thumbnails first
  const cachedThumbnails = localStorage.getItem('avatarThumbnails');
  const cachedUrlMap = localStorage.getItem('avatarThumbnailsUrlMap');
  
  // Only use cache if both the thumbnails and URL map exist
  if (cachedThumbnails && cachedUrlMap) {
    try {
      const parsed = JSON.parse(cachedThumbnails);
      const urlMap = JSON.parse(cachedUrlMap);
      
      // Check if cache is still valid by comparing URLs
      const cacheIsValid = modelUrls.length === Object.keys(urlMap).length &&
        modelUrls.every((url, index) => urlMap[index] === url);
      
      if (cacheIsValid) {
        console.log('Using cached thumbnails - URLs match');
        return parsed;
      } else {
        console.log('Cache invalidated - URLs changed');
      }
    } catch (error) {
      console.error('Error parsing cached thumbnails:', error);
    }
  }
  
  // Generate thumbnails one by one
  for (let i = 0; i < modelUrls.length; i++) {
    try {
      console.log(`Generating thumbnail for model ${i}:`, modelUrls[i]);
      thumbnails[i] = await generateModelThumbnail(modelUrls[i]);
    } catch (error) {
      console.error(`Failed to generate thumbnail for model ${i}:`, error);
      // Use a placeholder for failed thumbnails
      thumbnails[i] = null;
    }
  }
  
  // Create a map of indices to URLs for future cache validation
  const urlMap = {};
  modelUrls.forEach((url, index) => {
    urlMap[index] = url;
  });
  
  // Cache both the thumbnails and the URL map
  localStorage.setItem('avatarThumbnails', JSON.stringify(thumbnails));
  localStorage.setItem('avatarThumbnailsUrlMap', JSON.stringify(urlMap));
  
  console.log('Generated new thumbnails for', modelUrls.length, 'models');
  return thumbnails;
}