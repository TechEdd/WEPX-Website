let img;
let rgbArray;
var newLoad = true;
var stopLoadingImages = false;
let temp;
let allImagesLoaded = false;
const USE_PLATE_CARREE = false;

const max24BitValue = 256 ** 3;
// Color table as an array of tuples (value, r, g, b)

let ajustColormap = false;

var rgbArrayList = [];
var canvasList = [];

if (ajustColormap) {
	//colorTable = rescaleColorTable(minValue, maxValue, colorTable);
	colorTable = rescaleColorTable(180, 250, colorTable);
}

function rescaleColorTable(minValue, maxValue, colorTable) {
	// Get the original range of values based on the colorTable length
	const originalMin = 0; // The minimum value in the original table (can be adjusted if needed)
	const originalMax = colorTable.length - 1; // The maximum value in the original table (based on its length)

	// Rescale the colors based on the new minimum and maximum values
	return colorTable.map((entry, index) => {
		// Calculate the new value based on the index in the table
		const rescaledValue = minValue + ((maxValue - minValue) * index) / (originalMax);

		// Return a new object with the rescaled value and the same color
		return {
			value: rescaledValue,
			color: entry.color
		};
	});
}
function getRadarBBOX(radarInfo) {
	const radarLat = radarInfo.lat;
	const radarLon = radarInfo.lon;
	const maxRange = parseFloat(radarInfo.range);
	const earthRadius = 6371000;
	const latRad = radarLat * Math.PI / 180;

	const angularDistance = maxRange / earthRadius;
	const latRange = angularDistance * (180 / Math.PI); // Max lat change
	const lonRange = latRange / Math.cos(latRad);       // Max lon change

	return [
		radarLon - lonRange, // minLon
		radarLat - latRange, // minLat
		radarLon + lonRange, // maxLon
		radarLat + latRange  // maxLat
	];
}

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

function toDegrees(radians) {
    return radians * 180 / Math.PI;
}

function destinationPoint(lat1, lon1, bearing, distance) {
    const lat1Rad = toRadians(lat1);
    const lon1Rad = toRadians(lon1);
    const bearingRad = toRadians(bearing);
    const angularDistance = distance / EARTH_RADIUS_METERS;

    const lat2Rad = Math.asin(Math.sin(lat1Rad) * Math.cos(angularDistance) +
                           Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(bearingRad));

    const lon2Rad = lon1Rad + Math.atan2(Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1Rad),
                                      Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad));

    const lon2Deg = (toDegrees(lon2Rad) + 540) % 360 - 180;

    return {
        lat: toDegrees(lat2Rad),
        lon: lon2Deg
    };
}

function calculateGeoBounds(radarLat, radarLon, maxRange, margin = 0.1) {
     if (maxRange <= 0) {
        return { minLat: radarLat, maxLat: radarLat, minLon: radarLon, maxLon: radarLon };
    }
    const north = destinationPoint(radarLat, radarLon, 0, maxRange);
    const east = destinationPoint(radarLat, radarLon, 90, maxRange);
    const south = destinationPoint(radarLat, radarLon, 180, maxRange);
    const west = destinationPoint(radarLat, radarLon, 270, maxRange);

    let minLat = Math.min(radarLat, north.lat, east.lat, south.lat, west.lat);
    let maxLat = Math.max(radarLat, north.lat, east.lat, south.lat, west.lat);
    let minLon = Math.min(radarLon, north.lon, east.lon, south.lon, west.lon);
    let maxLon = Math.max(radarLon, north.lon, east.lon, south.lon, west.lon);

    const latMargin = (maxLat - minLat) * margin;
    const lonMargin = (maxLon - minLon) * margin;

    if (west.lon > east.lon) { // Basic check for dateline crossing
         console.warn("Potential dateline crossing in bounds calculation, simple margin applied.");
         // More robust handling might be needed depending on location
         minLon -= lonMargin;
         maxLon += lonMargin;
         // Check if expansion crossed +/- 180 and adjust bounds if needed (complex)
    } else {
        minLon -= lonMargin;
        maxLon += lonMargin;
    }

    minLat -= latMargin;
    maxLat += latMargin;
    minLat = Math.max(-90, minLat);
    maxLat = Math.min(90, maxLat);

    // Handle longitude wrapping more carefully if needed
    // minLon = (minLon + 540) % 360 - 180;
    // maxLon = (maxLon + 540) % 360 - 180;

    return { minLat, maxLat, minLon, maxLon };
}

function distanceAndBearing(lat1, lon1, lat2, lon2) {
    const lat1Rad = toRadians(lat1);
    const lon1Rad = toRadians(lon1);
    const lat2Rad = toRadians(lat2);
    const lon2Rad = toRadians(lon2);

    const dLat = lat2Rad - lat1Rad;
    const dLon = lon2Rad - lon1Rad;

    // Distance (Haversine)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = EARTH_RADIUS_METERS * c;

    // Bearing
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    let bearingRad = Math.atan2(y, x);

    // Convert bearing to 0-360 degrees
    let bearingDeg = (toDegrees(bearingRad) + 360) % 360;

    return { distance, bearing: bearingDeg };
}

function renderPPI(ctx, sourceImageData, isPlateCarree = false, radarInfo = null) {

    if (!ctx || !sourceImageData || !(sourceImageData instanceof ImageData)) {
        console.error("Invalid input for renderPPI: requires ctx and a valid ImageData object.");
        return;
    }

    const N = sourceImageData.height; // Azimuths
    const M = sourceImageData.width;  // Range bins
    const radarPixelData = sourceImageData.data;

    if (N <= 0 || M <= 0) {
        console.error("Invalid dimensions derived from ImageData (N or M is zero or negative).");
        return;
    }
    if (radarPixelData.length !== N * M * 4) {
        console.error(`ImageData.data length (${radarPixelData.length}) does not match derived N*M*4 (${N * M * 4}).`);
        return;
    }
    if (isPlateCarree && (!radarInfo || radarInfo.lat == null || radarInfo.lon == null || radarInfo.range == null)) {
        console.error("radarInfo (lat, lon, range) is required when isPlateCarree is true.");
        return;
    }

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // *** Clear canvas to transparent ***
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    // No explicit background fill needed anymore


    // --- Plate Carrée Projection ---
    if (isPlateCarree) {
        const radarLat = radarInfo.lat;
        const radarLon = radarInfo.lon;
        const maxRange = parseFloat(radarInfo.range);

        const bounds = calculateGeoBounds(radarLat, radarLon, maxRange);
        const { minLat, maxLat, minLon, maxLon } = bounds;
        const latSpan = maxLat - minLat;
        const lonSpan = maxLon - minLon;

        // Check for degenerate bounds (prevents division by zero)
        if (latSpan <= 1e-9 || lonSpan <= 1e-9) { // Use a small epsilon
            console.warn("Calculated geographic span is effectively zero. Cannot render Plate Carree.");
            // Optionally draw a marker at the radar location if needed for context
            if (latSpan > 1e-9 && lonSpan > 1e-9) { // Only if bounds are somewhat valid
                 const radarCanvasX = ((radarLon - minLon) / lonSpan) * canvasWidth;
                 const radarCanvasY = ((maxLat - radarLat) / latSpan) * canvasHeight;
                 ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Semi-transparent white marker
                 ctx.fillRect(radarCanvasX - 2, radarCanvasY - 2, 4, 4);
             }
            return;
        }

        // --- Option 1: Faster static rendering using putImageData ---
        if (!shouldLiveUpdate) {
            const targetImageData = ctx.createImageData(canvasWidth, canvasHeight);
            const targetData = targetImageData.data;

            for (let py = 0; py < canvasHeight; py++) {
                for (let px = 0; px < canvasWidth; px++) {
                    const targetIndex = (py * canvasWidth + px) * 4;

                    // Convert canvas pixel (px, py) back to geographic coords (lon, lat)
                    const lon = minLon + (px / canvasWidth) * lonSpan;
                    const lat = maxLat - (py / canvasHeight) * latSpan; // Y is inverted

                    // Check if the calculated lat/lon is within the original bounds
                    // (Handles margins and potential calculation drift)
                    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {

                        // Calculate distance and bearing from radar center to this lat/lon
                        const { distance, bearing } = distanceAndBearing(radarLat, radarLon, lat, lon);

                        // Is the canvas pixel's location within the radar range?
                        if (distance >= 0 && distance <= maxRange) {
                            // Map distance and bearing back to radar indices (j, i)
                            const j = Math.min(M - 1, Math.max(0, Math.floor((distance / maxRange) * M)));
                            const i = Math.min(N - 1, Math.max(0, Math.floor((bearing / 360) * N)));

                            // Get color from source radar data
                            const sourceIndex = (i * M + j) * 4;
                            const r = radarPixelData[sourceIndex];
                            const g = radarPixelData[sourceIndex + 1];
                            const b = radarPixelData[sourceIndex + 2];
                            const a = radarPixelData[sourceIndex + 3];

                            // Set color in target ImageData
                            targetData[targetIndex] = r;
                            targetData[targetIndex + 1] = g;
                            targetData[targetIndex + 2] = b;
                            targetData[targetIndex + 3] = a; // Use source alpha

                        } else {
                            // Outside radar range - make transparent
                            targetData[targetIndex] = 0;
                            targetData[targetIndex + 1] = 0;
                            targetData[targetIndex + 2] = 0;
                            targetData[targetIndex + 3] = 0; // Transparent
                        }
                    } else {
                        // Outside the calculated geographic bounds - make transparent
                        targetData[targetIndex] = 0;
                        targetData[targetIndex + 1] = 0;
                        targetData[targetIndex + 2] = 0;
                        targetData[targetIndex + 3] = 0; // Transparent
                    }
                }
            }
            ctx.putImageData(targetImageData, 0, 0);
        }
        // --- Option 2: Slower live update rendering (draw slightly larger rects) ---
        else {
            const liveFillSize = 2; // Draw 2x2 pixel rectangles for better filling
            for (let i = 0; i < N; i++) { // Azimuth loop
                const bearing = (i / N) * 360;
                for (let j = 0; j < M; j++) { // Range bin loop
                    const distance = ((j + 0.5) / M) * maxRange;
                    const sourceIndex = (i * M + j) * 4;
                    const a = radarPixelData[sourceIndex + 3];

                    // Skip transparent pixels in source data for performance
                    if (a === 0) continue;

                    const point = destinationPoint(radarLat, radarLon, bearing, distance);

                    // Check if point is within *displayable* bounds before mapping
                    if (point.lat >= minLat && point.lat <= maxLat && point.lon >= minLon && point.lon <= maxLon) {
                        const canvasX = Math.floor(((point.lon - minLon) / lonSpan) * canvasWidth);
                        const canvasY = Math.floor(((maxLat - point.lat) / latSpan) * canvasHeight);

                        // Check if calculated canvas coordinates are valid
                        if (canvasX >= -liveFillSize && canvasX < canvasWidth && canvasY >= -liveFillSize && canvasY < canvasHeight) {
                            const r = radarPixelData[sourceIndex];
                            const g = radarPixelData[sourceIndex + 1];
                            const b = radarPixelData[sourceIndex + 2];
                            // Alpha 'a' already retrieved

                            ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
                            // Draw slightly larger rectangle to help fill gaps
                            ctx.fillRect(canvasX, canvasY, liveFillSize, liveFillSize);
                        }
                    }
                }
                 // Request animation frame could be added here for smoother live updates
                 // if (i % 10 === 0) await new Promise(requestAnimationFrame); // Example throttling
            }
        }

    // --- Standard PPI Projection ---
    } else {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const maxCanvasRadius = Math.min(centerX, centerY);

            const targetImageData = ctx.createImageData(canvasWidth, canvasHeight);
            const targetData = targetImageData.data;
            const maxRadiusSq = maxCanvasRadius * maxCanvasRadius;

            for (let py = 0; py < canvasHeight; py++) {
                for (let px = 0; px < canvasWidth; px++) {
                    const dx = px - centerX;
                    const dy = py - centerY;
                    const radiusSq = dx * dx + dy * dy;
                    const targetIndex = (py * canvasWidth + px) * 4;

                    // Is the canvas pixel within the PPI circle?
                    if (radiusSq <= maxRadiusSq) {
                        const radius = Math.sqrt(radiusSq);
                        let angle = Math.atan2(dy, dx);
                        let radarAngle = angle + Math.PI / 2;
                        if (radarAngle < 0) radarAngle += 2 * Math.PI;
                        if (radarAngle >= 2 * Math.PI) radarAngle -= 2 * Math.PI;

                        const j = Math.min(M - 1, Math.max(0, Math.floor((radius / maxCanvasRadius) * M)));
                        const i = Math.min(N - 1, Math.max(0, Math.floor((radarAngle / (2 * Math.PI)) * N)));

                        const sourceIndex = (i * M + j) * 4;
                        const r = radarPixelData[sourceIndex];
                        const g = radarPixelData[sourceIndex + 1];
                        const b = radarPixelData[sourceIndex + 2];
                        const a = radarPixelData[sourceIndex + 3];

                        targetData[targetIndex] = r;
                        targetData[targetIndex + 1] = g;
                        targetData[targetIndex + 2] = b;
                        targetData[targetIndex + 3] = a; // Use source alpha
                    } else {
                         // Outside the circle - make transparent
                         targetData[targetIndex] = 0;
                         targetData[targetIndex + 1] = 0;
                         targetData[targetIndex + 2] = 0;
                         targetData[targetIndex + 3] = 0; // *** TRANSPARENT ***
                    }
                }
            }
            ctx.putImageData(targetImageData, 0, 0);
    }
     // console.log("PPI Rendering complete."); // Keep muted unless debugging
}


// --- Mouse Coordinate to Data Index Function ---
function getPPIPixelIndex(mouseX, mouseY, canvasWidth, canvasHeight, M, N, isPlateCarree = false, radarInfo = null) {
     if (N <= 0 || M <= 0) {
        console.error("getPPIPixelIndex: Invalid M or N provided.");
        return null;
    }

    if (isPlateCarree) {
        if (!radarInfo || radarInfo.lat == null || radarInfo.lon == null || radarInfo.range == null) {
            console.error("getPPIPixelIndex (PlateCarree): radarInfo is required.");
            return null;
        }
        const radarLat = radarInfo.lat;
        const radarLon = radarInfo.lon;
        const maxRange = parseFloat(radarInfo.range);

        // 1. Recalculate the geographic bounds used for rendering
        // It's crucial these bounds match exactly what renderPPI used.
        const bounds = calculateGeoBounds(radarLat, radarLon, maxRange);
        const { minLat, maxLat, minLon, maxLon } = bounds;
        const latSpan = maxLat - minLat;
        const lonSpan = maxLon - minLon;

        if (latSpan <= 1e-9 || lonSpan <= 1e-9) return null; // Cannot map if span is zero

        // 2. Convert mouse canvas coordinates back to Lat/Lon
        const lon = minLon + (mouseX / canvasWidth) * lonSpan;
        const lat = maxLat - (mouseY / canvasHeight) * latSpan; // Y is inverted

        // Optional check: is the mouse pointer outside the geographic bounds?
         if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) {
            // This usually means the mouse is in the margin area if margins were added
            // return null; // Uncomment if you want margin clicks to return null
         }

        // 3. Calculate distance and bearing from radar center to this Lat/Lon
        const { distance, bearing } = distanceAndBearing(radarLat, radarLon, lat, lon);


        // 4. Check if the point is beyond the radar's maximum range
        if (distance < 0 || distance > maxRange) {
            return null;
        }

        // 5. Convert distance and bearing back to radar indices (j, i)
        // Use floor to get the bin index
        const j = Math.floor((distance / maxRange) * M);
        const i = Math.floor((bearing / 360) * N);

        // Clamp indices to valid range (shouldn't be necessary if checks above are correct, but safe)
        const final_i = Math.min(N - 1, Math.max(0, i));
        const final_j = Math.min(M - 1, Math.max(0, j));

        // Check bounds again after potential flooring/clamping
         if (final_i < 0 || final_i >= N || final_j < 0 || final_j >= M) {
            return null; // Should not happen if distance/bearing logic is correct
         }

        return final_i * M + final_j; // Return the flat index

    } else { // Standard PPI
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const maxCanvasRadius = Math.min(centerX, centerY);

        const dx = mouseX - centerX;
        const dy = mouseY - centerY;
        const radius = Math.sqrt(dx * dx + dy * dy);

        if (radius > maxCanvasRadius || radius < 0) { // Check if mouse is outside the PPI circle
            return null;
        }

        let angle = Math.atan2(dy, dx); // -PI to PI, 0 is right
        let radarAngle = angle + Math.PI / 2; // Convert canvas angle to radar angle (0=N, clockwise, 0 to 2PI)
        if (radarAngle < 0) radarAngle += 2 * Math.PI;
        // Handle potential float precision issues near 2PI
        if (radarAngle >= 2 * Math.PI) radarAngle -= (2*Math.PI);


        // Map radius and angle back to radar indices
        // Use floor to get the bin index
        const j = Math.floor((radius / maxCanvasRadius) * M);
        const i = Math.floor((radarAngle / (2 * Math.PI)) * N);

        // Clamp indices to valid range
        const final_i = Math.min(N - 1, Math.max(0, i));
        const final_j = Math.min(M - 1, Math.max(0, j));

       // Final check - although radius check should cover j
       if (final_i < 0 || final_i >= N || final_j < 0 || final_j >= M) {
           return null; // Should not happen
       }

        return final_i * M + final_j; // Return the flat index
    }
}


async function drawColormap(colorTable) {
	const colormapCanvas = document.getElementById("colormapCanvas");
	colormapCanvas.innerHTML = "";
	const ctx = colormapCanvas.getContext("2d");
	const width = colormapCanvas.width;
	const height = colormapCanvas.height;

	// Calculate the range of values
	const minValue = Math.min(...colorTable.map(entry => entry.value));
	const maxValue = Math.max(...colorTable.map(entry => entry.value));
	const range = maxValue - minValue;

	// Draw the colormap vertically
	for (let i = 0; i < colorTable.length - 1; i++) {
		const start = colorTable[i];
		const end = colorTable[i + 1];

		// Normalize start and end positions (invert vertically)
		const startY = height - ((start.value - minValue) / range) * height;
		const endY = height - ((end.value - minValue) / range) * height;

		// Create a gradient for smooth transitions
		const gradient = ctx.createLinearGradient(0, startY, 0, endY);
		gradient.addColorStop(0, `rgb(${start.color.join(",")})`);
		gradient.addColorStop(1, `rgb(${end.color.join(",")})`);

		// Fill the corresponding range with the gradient
		ctx.fillStyle = gradient;
		ctx.fillRect(0, endY, width, startY - endY);
	}
	document.getElementById("colormapVariable").textContent = variable;
}
drawColormap(colorTable);

// Global worker pool (initialized once)
const workerPool = {};
function initializeWorkerPool(script, numWorkers) {
	if (!workerPool[script]) {
		workerPool[script] = Array(numWorkers).fill().map(() => ({
			worker: new Worker(script),
			busy: false
		}));
	}
	return workerPool[script];
}

// Check WebGL support once at startup (global scope)
const hasWebGL = !!window.WebGLRenderingContext &&
	!!document.createElement('canvas').getContext('webgl');

// Main function with optimizations
async function mapColorsWithWorker(imageData, width, height, minValue, maxValue, variable, colorTable) {
	return new Promise((resolve, reject) => {
		const isRadar = variable === "radar";
		const workerScript = isRadar ? "/js/arrayWorkers.js" : "/js/arrayWorkers - gpu.js";

		// Determine number of cores dynamically
		const numCores = isRadar
			? Math.min(Math.max(1, (navigator.hardwareConcurrency || 4) >> 1), height)
			: 1;

		console.log(`Using ${numCores} cores with script: ${workerScript}`);

		// Pre-allocate final arrays
		const finalRgbArray = new Float32Array(width * height);
		const finalImageDataArray = new Uint8ClampedArray(width * height * 4);
		let completed = 0;

		// Initialize or reuse worker pool
		const workers = initializeWorkerPool(workerScript, numCores);

		if (numCores === 1) {
			// Single worker case
			const workerObj = workers[0];
			const worker = workerObj.worker;
			workerObj.busy = true;

			worker.onmessage = (e) => {
				const { rgbArray, imageDataArray } = e.data;
				finalRgbArray.set(new Float32Array(rgbArray));
				finalImageDataArray.set(new Uint8ClampedArray(imageDataArray));
				workerObj.busy = false;
				resolve({ rgbArray: finalRgbArray, imageDataArray: finalImageDataArray });
			};

			worker.onerror = (err) => {
				workerObj.busy = false;
				reject(err);
			};

			// Use transferable objects instead of copying
			const imageDataBuffer = imageData.buffer;
			worker.postMessage({
				imageData: imageData,
				width,
				height,
				minValue,
				maxValue,
				isInvertedColormap, // Assumed to be defined elsewhere
				colorTable,
				isRadar
			}, [imageDataBuffer]); // Transfer ownership of the buffer
		} else {
			// Multiple workers: split into chunks
			const chunkSize = Math.ceil(height / numCores);
			const tasks = [];

			for (let i = 0; i < numCores; i++) {
				const startRow = i * chunkSize;
				const endRow = Math.min(startRow + chunkSize, height);
				if (startRow >= endRow) break; // Skip empty chunks

				const chunkHeight = endRow - startRow;
				const startOffset = startRow * width * 4;
				const endOffset = endRow * width * 4;

				// Slice the buffer and transfer it
				const chunkImageData = imageData.subarray(startOffset, endOffset);
				const chunkBuffer = chunkImageData.buffer.slice(startOffset, endOffset); // Create a transferable copy
				const transferableChunk = new Uint8ClampedArray(chunkBuffer);

				// Find an available worker
				const workerObj = workers.find(w => !w.busy);
				if (!workerObj) {
					reject(new Error("No available workers"));
					return;
				}
				const worker = workerObj.worker;
				workerObj.busy = true;

				tasks.push(new Promise((res, rej) => {
					worker.onmessage = (e) => {
						const { rgbArray, imageDataArray } = e.data;
						const chunkOffset = startRow * width;

						finalRgbArray.set(new Float32Array(rgbArray), chunkOffset);
						finalImageDataArray.set(new Uint8ClampedArray(imageDataArray), startOffset);

						workerObj.busy = false;
						completed++;
						if (completed === tasks.length) {
							resolve({ rgbArray: finalRgbArray, imageDataArray: finalImageDataArray });
						}
						res();
					};

					worker.onerror = (err) => {
						workerObj.busy = false;
						rej(err);
					};

					worker.postMessage({
						imageData: transferableChunk,
						width,
						height: chunkHeight,
						minValue,
						maxValue,
						isInvertedColormap, // Assumed to be defined elsewhere
						colorTable,
						isRadar
					}, [transferableChunk.buffer]);
				}));
			}

			Promise.all(tasks).catch(reject);
		}
	});
}


async function convertToCanvasAsync(imgSrc) {
	try {
		//  Create a canvas and get raw RGBA data
		const canvas = new OffscreenCanvas(imgSrc.width, imgSrc.height);
		const ctx = canvas.getContext('2d');
		if (request == "model") {
			canvas.width = imgSrc.width;
			canvas.height = imgSrc.height;
		} else if (request == "radar") {
			canvas.width = canvas.height = 3000;
		}


		//assert the right scale for the canvas
		if (newLoad) {
			if (request == "model") {
				document.getElementById("canvas").width = canvas.width;
				document.getElementById("canvas").height = canvas.height;
			} else if (request == "radar") {
				document.getElementById("canvas").width = canvas.width = 3000;
				document.getElementById("canvas").height = canvas.height = 3000;
			}
			newLoad = false;
		}

		ctx.drawImage(imgSrc, 0, 0);

		const imageData = ctx.getImageData(0, 0, imgSrc.width, imgSrc.height);
		temp1 = imageData;
		// Use the worker to process the RGBA data and apply the color mapping
		const { rgbArray, imageDataArray } = await mapColorsWithWorker(
			imageData.data, // Raw image data
			imgSrc.width,
			imgSrc.height,
			minValue,
			maxValue,
			variable,
			colorTable
		);

		// Create ImageData and draw it back on the canvas
		const processedImageData = new ImageData(
			new Uint8ClampedArray(imageDataArray),
			imgSrc.width, imgSrc.height
		);
		if (request == "model") {
			ctx.putImageData(processedImageData, 0, 0);
		}
		else if (request == "radar") {
			radarWidth = imgSrc.width;
			radarHeight = imgSrc.height;
			renderPPI(ctx, processedImageData, USE_PLATE_CARREE, radarInfo);
			forecastbbox = getRadarBBOX(radarInfo);
		}

		return { rgbArray, canvas };
	} catch (error) {
		console.error("Error in convertToCanvasAsync:", error);
		throw error;
	}
}

//squential preload
async function preloadImagesAsync() {
	try {
		// Wait for the other loading to finish if necessary
		allImagesLoaded = false;
		while (stopLoadingImages) {
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		// Ensure the correct scale for the canvas
		newLoad = true;

		let startIndex = 0;
		if (request == "radar") {
			startIndex = Math.max(data["files"].length - radarImagesToSee, 0);
		}

		for (const [i, file] of data["files"].slice(startIndex).entries()) {
			const index = startIndex + i;
			// If a new load is triggered, stop loading new files
			if (stopLoadingImages) {
				stopLoadingImages = false;
				console.log("restart");
				return;
			}
			let imgSrc;
			// Load the image
			if (request == "model") {
				imgSrc = "/downloads/" + model + "/" + run1 / 1000 + "/" + file["file"];
			} else if (request == "radar") {
				imgSrc = "/downloads/radars/" + model + "/" + file["file"];
			}

			if (zoomMode == "zoomed") {
				imgSrc = `/scripts/crop.php?xmin=${xmin}&xmax=${xmax}&ymin=${ymin}&ymax=${ymax}&file=${imgSrc}`;
			}

			const { img, sizeInKB } = await loadImage(imgSrc);

			// Process the image with convertToCanvasAsync
			console.time(imgSrc);
			const { rgbArray, canvas } = await convertToCanvasAsync(img);
			console.timeEnd(imgSrc);

			// Ensure new images are inserted at a specific index
			if (!stopLoadingImages) {
				canvasList[index] = canvas;
				rgbArrayList[index] = rgbArray;
			}

			// Update the main canvas if this is the first image
			slider.dispatchEvent(new Event("input"));

			// Slider updates
			if (unavailablePercent === undefined) {
				unavailablePercent = ((data["files"].length - 1 - slider.min) / (slider.max - slider.min)) * 100;
			}
			availableSlider.style.width = ((index / unavailablePercent) * 100).toString() + "%";
			sliderMaxAvailable = index;
		}

		allImagesLoaded = true;
		console.log("All images preloaded");
		availableSlider.style.opacity = 0;
	} catch (error) {
		console.error("Error in preloadImagesAsync:", error);
	}
}

//helper function to preload image
async function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			// Creating a new request to get the image file size
			fetch(src, { method: 'HEAD' })
				.then(response => {
					const sizeInBytes = response.headers.get('Content-Length');
					const sizeInKB = sizeInBytes ? (parseInt(sizeInBytes) / 1024).toFixed(2) : 0;
					resolve({ img, sizeInKB });
				})
				.catch(err => reject(`Failed to fetch file size for ${src}: ${err}`));
		};
		img.onerror = (err) => reject(`Failed to load image at ${src}: ${err}`);
		img.src = src;
	});

}

function reloadImages() {
	//clearing all images array
	rgbArray = null;
	canvasList = [];
	rgbArrayList = [];
	console.log(rgbArrayList, canvasList);
	const params = new URLSearchParams(window.location.search);
	request = params.get('request') || 'model';
	model = params.get('model') || 'HRRR';
	variable = params.get('variable') || 'CAPE';
	level = params.get('level') || 'lev_surface';
	if (!isRadar) {
		let run1 = params.get('run');
		if (run1 === undefined) {
			fetchFile(`/scripts/getLastRun.php?model=${model}`)
				.then(lastRun => {
					run1 = lastRun;
				});
		}
	}
	document.getElementById("modelIndicator").innerHTML = "Model: " + model;
	if (request == "radar") {
		document.getElementById("layerIndicator").innerHTML = variable + " (" + level + ")";
	} else {
		document.getElementById("layerIndicator").innerHTML = document.getElementById(variable).innerHTML;
	}
	fetchFile(`/scripts/getListOfFiles.php?request=${request}&model=${model}&variable=${variable}&level=${level}&run=${run1}`).then(listOfFiles => {
		data = JSON.parse(listOfFiles);
		console.log(JSON.parse(listOfFiles));
		run1 = data["run"] * 1000;
		runNb = new Date(parseInt(run1)).getUTCHours();
		minValue = data["vmin"];
		maxValue = data["vmax"];
		let cmapVariable;

		if (variable.includes("reflectivity")) {
			cmapVariable = "REFC";
		} else if (variable.includes("echo_tops")) {
			cmapVariable = "RETOP";
		} else if (variable.includes("velocity")) {
			cmapVariable = "velocity";
		} else {
			cmapVariable = variable;
		};

		fetchFile('/colormaps/' + cmapVariable + '.txt').then(jsonColor => {
			colorTable = JSON.parse(jsonColor);
			let isInvertedColormap = false;
			//inverted colormaps
			if (variable != "CIN" || variable != "SBT124") {
				nodata = data["vmin"];
			} else {
				nodata = data["vmax"]

			}
			drawColormap(colorTable);
			preloadImagesAsync();
		});

	});

}

function fetchFile(url) {
	return fetch(url)
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error, status: ${response.status}`);
			}
			return response.text();
		})
		.catch(error => {
			console.error('Error loading PHP file:', error);
			throw error; // Rethrow error to handle it further up
		});
}

function darkMode(dark) {
	if (dark) {
		container.style.backgroundColor = "#101010";
		map.style.filter = "invert(1)";
		if (document.querySelector(".image").style.border != undefined) {
			document.querySelector(".image").style.border = "border: 2px solid white"
		}
	}
	else {
		container.style.backgroundColor = "#ddd";
		map.style.filter = "invert(0)";
		if (document.querySelector(".image").style.border != undefined) {
			document.querySelector(".image").style.border = "border: 2px solid black"
		}
	}
}

window.addEventListener('DOMContentLoaded', () => {
	preloadImagesAsync();
});