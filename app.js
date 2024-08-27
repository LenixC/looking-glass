(async () => {
    // Load the models
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');

    console.log('Models loaded');

    // Initialize Three.js
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create a 3D object (e.g., a cube)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff000f });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Initialize camera position
    camera.position.y = -5;
    camera.position.z = 5;
    let targetZ = camera.position.z;
    let targetX = camera.position.x;
    let targetY = camera.position.y;
    const interpolationSpeed = 0.2;
    const minCameraZ = 2;
    const maxCameraZ = 10;
    const maxCameraX = 5;
    const maxCameraY = 5;

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Function to calculate Euclidean distance between two points
    function calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Function to estimate distance based on eye distance
    function estimateDistance(eyeDistancePixels) {
        const REAL_EYE_DISTANCE_CM = 6.5;
        const FOCAL_LENGTH_PIXELS = 1000;
        return (REAL_EYE_DISTANCE_CM * FOCAL_LENGTH_PIXELS) / eyeDistancePixels;
    }

    // Function to initialize the face tracking and update the 3D scene
    async function initializeFaceTracking() {
        const video = document.createElement('video');
        video.width = 320;
        video.height = 240;
        video.autoplay = true;
        video.playsInline = true;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            video.srcObject = stream;
            await new Promise(resolve => video.onloadedmetadata = resolve);

            function update() {
                faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().then(detections => {
                    const resizedDetections = faceapi.resizeResults(detections, { width: video.width, height: video.height });

                    resizedDetections.forEach(detection => {
                        const landmarks = detection.landmarks;
                        const leftEye = landmarks.getLeftEye();
                        const rightEye = landmarks.getRightEye();

                        // Calculate the distance between eyes
                        const leftEyePoint = leftEye[3];
                        const rightEyePoint = rightEye[0];
                        const eyeDistance = calculateDistance(leftEyePoint, rightEyePoint);

                        // Estimate distance
                        targetZ = 5 - (estimateDistance(eyeDistance) / 20);
                        targetZ = Math.max(minCameraZ, Math.min(maxCameraZ, targetZ));

                        // Calculate face position (relative to video frame)
                        const faceBox = detection.detection.box;
                        const faceCenterX = faceBox.x + faceBox.width / 2;
                        const faceCenterY = faceBox.y + faceBox.height / 2;

                        // Calculate horizontal and vertical offsets
                        const videoWidth = video.width;
                        const videoHeight = video.height;
                        const offsetX = (faceCenterX - videoWidth / 2) / (videoWidth / 2);
                        const offsetY = (faceCenterY - videoHeight / 2) / (videoHeight / 2);

                        // Apply offsets to camera position
                        targetX = -offsetX * maxCameraX;
                        targetY = -offsetY * maxCameraY;

                        // Interpolate camera position and rotation
                        camera.position.x += (targetX - camera.position.x) * interpolationSpeed;
                        camera.position.y += (targetY - camera.position.y) * interpolationSpeed;
                        camera.position.z += (targetZ - camera.position.z) * interpolationSpeed;

                        // Update camera look direction
                        camera.lookAt(scene.position);
                    });
                }).catch(err => console.error('Error during face detection: ', err));

                // Render the scene
                renderer.render(scene, camera);

                // Request the next frame
                requestAnimationFrame(update);
            }

            // Start the animation loop
            update();
        } catch (err) {
            console.error('Error accessing webcam: ', err);
        }
    }

    // Start the face tracking
    initializeFaceTracking();
})();
