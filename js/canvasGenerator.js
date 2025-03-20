let img;
let rgbArray;
var newLoad = true;
var stopLoadingImages = false;
let temp;
let allImagesLoaded = false;

const max24BitValue = 256 ** 3;
// Color table as an array of tuples (value, r, g, b)

let ajustColormap = false;

var rgbArrayList = [];
var canvasList = [];

if (ajustColormap){
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

function renderPPI(ctx, imageData, width, height, shouldLiveUpdate, isPlateCarree = false, radarInfo=null) {
	const data = imageData.data;
	const N = height;  // Number of azimuths (scan lines)
	const M = width;   // Number of range bins (radial resolution)
	const R = Math.min(ctx.canvas.width, ctx.canvas.height) / 2;
	const cx = R, cy = R; // Center of canvas

	// Radar info for Plate Carrée
	const radarLat = radarInfo.lat;    // Radar latitude in degrees
	const radarLon = radarInfo.lon;    // Radar longitude in degrees
	const maxRange = parseFloat(radarInfo.range); // Maximum range in meters
	const earthRadius = 6371000; // Earth's radius in meters

	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

	// Apply 90° rotation only for polar rendering
	if (!isPlateCarree) {
		ctx.save();
		ctx.translate(0, ctx.canvas.height);
		ctx.rotate(-Math.PI / 2);
	} else {
		ctx.save(); // Still save context for restoration
	}

	let i = 0; // Track the current azimuth
	const batchSize = Math.max(1, Math.floor(N / 120)); // Render ~60 frames

	function drawAzimuth(i) {
		let theta = (i / N) * 2 * Math.PI; // Azimuth angle in radians

		for (let j = 0; j < M; j++) {
			let srcIdx = (i * M + j) * 4;
			if (data[srcIdx + 3] === 0) continue; // Skip fully transparent pixels

			let x, y, rotateAngle;
			let pixelSize = Math.max(1.5, (0.3 + 0.7 * Math.pow(j / M, 0.7)) * (R / M) * 4);
			let alpha = data[srcIdx + 3] / 255;

			if (isPlateCarree) {
				// Plate Carrée projection
				let range = (j / M) * maxRange;
				let latRad = radarLat * Math.PI / 180;
				let lonRad = radarLon * Math.PI / 180;
				let angularDistance = range / earthRadius;
				let azimuthRad = theta;

				let newLatRad = Math.asin(
					Math.sin(latRad) * Math.cos(angularDistance) +
					Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(azimuthRad)
				);
				let newLonRad = lonRad + Math.atan2(
					Math.sin(azimuthRad) * Math.sin(angularDistance) * Math.cos(latRad),
					Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
				);

				let newLat = newLatRad * 180 / Math.PI;
				let newLon = newLonRad * 180 / Math.PI;

				// Adjust scaling for proper compression
				let latRange = (maxRange / earthRadius) * (180 / Math.PI); // Latitude range in degrees
				let lonRange = latRange / Math.cos(latRad); // Longitude range adjusted for latitude

				// Map to canvas, compress y-axis relative to x-axis
				x = cx + ((newLon - radarLon) / lonRange) * R;
				y = cy - ((newLat - radarLat) / latRange) * R * Math.cos(latRad); // Compress y by cos(latitude)
				rotateAngle = 0; // No rotation in Plate Carrée
			} else {
				// Original polar rendering
				let r = (j / M) * R;
				x = cx + r * Math.cos(theta);
				y = cy + r * Math.sin(theta);
				rotateAngle = theta; // Rotate according to azimuth
			}

			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(rotateAngle);
			ctx.fillStyle = `rgba(${data[srcIdx]}, ${data[srcIdx + 1]}, ${data[srcIdx + 2]}, ${alpha})`;
			ctx.fillRect(-pixelSize / 2, -pixelSize / 2, pixelSize, pixelSize * 1.5);
			ctx.restore();
		}
	}

	function drawNextBatch() {
		let maxI = Math.min(i + batchSize, N);

		for (; i < maxI; i++) {
			drawAzimuth(i);
		}

		if (shouldLiveUpdate && i < N) {
			requestAnimationFrame(drawNextBatch);
		} else if (!shouldLiveUpdate && i >= N) {
			ctx.restore();
		}
	}

	if (shouldLiveUpdate) {
		drawNextBatch();
	} else {
		for (i = 0; i < N; i++) {
			drawAzimuth(i);
		}
		ctx.restore();
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

async function mapColorsWithWorker(imageData, width, height, minValue, maxValue, variable, colorTable, sizeOfImage) {
	return new Promise((resolve, reject) => {
		//deviding by 2 for best performance
		let numCores = navigator.hardwareConcurrency/2 || 2;

		const workers = [];
		const results = [];
		let completed = 0;

		const chunkSize = (height + numCores - 1) >> Math.log2(numCores);
		const transferableObjects = [];

		for (let i = 0; i < numCores; i++) {
			const worker = new Worker(sizeOfImage > 1200 ? "/js/arrayWorkers - d3.js" : "/js/arrayWorkers.js");
			console.log(sizeOfImage > 1200 ? "/js/arrayWorkers - d3.js" : "/js/arrayWorkers.js")
			workers.push(worker);

			worker.onmessage = (e) => {
				const { rgbArray, imageDataArray } = e.data;
				results[i] = { rgbArray: new Float32Array(rgbArray), imageDataArray: new Uint8ClampedArray(imageDataArray) };
				worker.terminate();

				if (++completed === numCores) {
					const finalRgbArray = new Float32Array(width * height);
					const finalImageDataArray = new Uint8ClampedArray(width * height * 4);

					for (let j = 0; j < numCores; j++) {
						const offset = j * chunkSize * width * 4;
						finalRgbArray.set(results[j].rgbArray, j * chunkSize * width);
						finalImageDataArray.set(results[j].imageDataArray, offset);
					}

					resolve({ rgbArray: finalRgbArray, imageDataArray: finalImageDataArray });
				}
			};

			worker.onerror = (err) => {
				console.error("Worker encountered an error:", err);
				reject(err);
				worker.terminate();
			};

			const startRow = i * chunkSize;
			const endRow = Math.min(startRow + chunkSize, height);
			const chunkHeight = endRow - startRow;
			const chunkImageData = imageData.slice(startRow * width * 4, endRow * width * 4);

			transferableObjects.push(chunkImageData.buffer);
			let isRadar = (request == "radar");
			worker.postMessage({
				imageData: chunkImageData,
				width,
				height: chunkHeight,
				minValue,
				maxValue,
				isInvertedColormap,
				colorTable,
				isRadar
			}, [chunkImageData.buffer]);
		}
	});
}


async function convertToCanvasAsync(imgSrc, imgSize) {
    try {
        //  Create a canvas and get raw RGBA data
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
		canvas.width = imgSrc.width;
		canvas.height = imgSrc.height;

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
            colorTable,
			imgSize
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
			renderPPI(ctx, processedImageData, imgSrc.width, imgSrc.height, false, false, radarInfo);
			forecastbbox = getRadarBBOX(radarInfo);
		}

		return {rgbArray, canvas};
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

		let imageIndex = 0; // Counter to track the index

		for (const [index, file] of data["files"].entries()) {
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
			const { rgbArray, canvas } = await convertToCanvasAsync(img, sizeInKB);
			console.timeEnd(imgSrc);

			// Ensure new images are inserted at a specific index
			if (!stopLoadingImages) {
				canvasList[imageIndex] = canvas;
				rgbArrayList[imageIndex] = rgbArray;
				imageIndex++; // Move to the next index
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

function reloadImages(){
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
	fetchFile(`/scripts/getLastRun.php?model=${model}`).then(lastRun => {
		run1 = params.get('run') || lastRun;
		document.getElementById("modelIndicator").innerHTML = "Model: " + model;
		document.getElementById("layerIndicator").innerHTML = document.getElementById(variable).innerHTML
		fetchFile(`/scripts/getListOfFiles.php?request=${request}&model=${model}&variable=${variable}&level=${level}&run=${run1}`).then(listOfFiles => {
			data = JSON.parse(listOfFiles);
			console.log(JSON.parse(listOfFiles));
			run1 = data["run"] * 1000;
			runNb = new Date(parseInt(run1)).getUTCHours();
			minValue = data["vmin"];
			maxValue = data["vmax"];
			fetchFile('/colormaps/' + variable + '.txt').then(jsonColor => {
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

function darkMode(dark){
	if (dark){
		container.style.backgroundColor = "#101010";
		map.style.filter = "invert(1)";
		if (document.querySelector(".image").style.border != undefined) {
			document.querySelector(".image").style.border ="border: 2px solid white"
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