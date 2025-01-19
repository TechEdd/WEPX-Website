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
		
		let numCores = 4;
		// Default to 4 threads if not available, divide by 2 for better performance on higher threads
		if (navigator.hardwareConcurrency > 8){
			numCores = navigator.hardwareConcurrency/2;
		} else if (!navigator.hardwareConcurrency) {
			numCores = 4;
		} else {
			numCores = navigator.hardwareConcurrency;
		}
		
        const workers = [];
        const results = [];
        let completed = 0;

        const chunkSize = Math.ceil(height / numCores);
        for (let i = 0; i < numCores; i++) {
			
			let worker;
			//d3.js faster for images full of data, propritary faster for images with null pixels
			if (sizeOfImage > 1200){
				worker = new Worker("arrayWorkers - d3.js");
				console.log("using d3.js converter")
			} else {
				worker = new Worker("arrayWorkers.js");
				console.log("using propritary converter")
			}
			
            workers.push(worker);

            worker.onmessage = (e) => {
                let { rgbArray, imageDataArray } = e.data; // Received processed RGBA array
                rgbArray = new Float32Array(rgbArray);
                imageDataArray = new Uint8ClampedArray(imageDataArray);
                results[i] = { rgbArray, imageDataArray };
                worker.terminate(); // Clean up the worker

                if (++completed === numCores) {
                    // Combine results
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
                reject(err); // Reject on error
                worker.terminate(); // Clean up the worker
            };

            // Calculate the chunk of image data for this worker
            const startRow = i * chunkSize;
            const endRow = Math.min(startRow + chunkSize, height);
            const chunkHeight = endRow - startRow;
            const chunkImageData = imageData.slice(startRow * width * 4, endRow * width * 4);

            // Post data to the worker
            worker.postMessage({
                imageData: chunkImageData, // Raw RGBA data from the canvas
                width, // Width of the image
                height: chunkHeight, // Height of the chunk
                minValue, // Minimum value for scaling
                maxValue, // Maximum value for scaling
                isInvertedColormap, // if colormap inverted
                colorTable // Color mapping table
            });
        }
    });
}


async function convertToCanvasAsync(imgSrc, imgSize) {
    try {
        // Step 1: Create a canvas and get raw RGBA data
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
		canvas.width = imgSrc.width;
		canvas.height = imgSrc.height;

		//assert the right scale for the canvas
		if (newLoad) {
			document.getElementById("canvas").width = canvas.width;
			document.getElementById("canvas").height = canvas.height;
			newLoad = false;
		}

		ctx.drawImage(imgSrc, 0, 0);
		
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		temp1 = imageData;
        // Step 2: Use the worker to process the RGBA data and apply the color mapping
        const { rgbArray, imageDataArray } = await mapColorsWithWorker(
            imageData.data, // Raw image data
            canvas.width,
            canvas.height,
            minValue,
            maxValue,
            variable,
            colorTable,
			imgSize
        );

        // Step 3: Create ImageData and draw it back on the canvas
        const processedImageData = new ImageData(
            new Uint8ClampedArray(imageDataArray),
            canvas.width,
            canvas.height
        );
        ctx.putImageData(processedImageData, 0, 0);

        // Step 4: Return the canvas
		return {rgbArray, canvas};
    } catch (error) {
        console.error("Error in convertToCanvasAsync:", error);
        throw error;
    }
}

//squential preload
async function preloadImagesAsync() {
	try {
		//wait for the other loading to wait if necessary
		allImagesLoaded = false;
		while (stopLoadingImages) {
			await new Promise(resolve => setTimeout(resolve, 100));
		};

		//assert the right scale for the canvas, used in converttocanvas function
		newLoad = true;

        for (const file of data["files"]) {
			//if new variable loaded stop the loading of new files
			if (stopLoadingImages) {
				stopLoadingImages = false;
				console.log("restart");
				return;
			}
			// Step 1: Load the image
            let imgSrc = "downloads/" + model + "/" + runNb.toString().padStart(2, "0") + "/" + file["file"];
			if (zoomMode == "zoomed"){
				imgSrc = `crop.php?xmin=${xmin}&xmax=${xmax}&ymin=${ymin}&ymax=${ymax}&file=${imgSrc}`
			}
			const { img, sizeInKB } = await loadImage(imgSrc); // load images asynchronously
			
			// Step 2: Process the image with convertToCanvasAsync
			console.time(imgSrc);
            const { rgbArray, canvas } = await convertToCanvasAsync(img, sizeInKB);
			console.timeEnd(imgSrc);
			// Step 3: Add to canvasList and rgbArrayList
			// last resort to keep new array clean if restarted
			if (!stopLoadingImages) {
				canvasList.push(canvas);
				rgbArrayList.push(rgbArray);
			}
            

            // Step 4: Update the main canvas if this is the first image
            slider.dispatchEvent(new Event("input"));
		}
		allImagesLoaded = true;
        console.log("All images preloaded successfully");
    } catch (error) {
        console.error("Error in preloadImagesAsync:", error);
    }
}

// Helper function to load an image asynchronously
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
	console.log(rgbArrayList,canvasList)
	
	const params = new URLSearchParams(window.location.search);
	request = params.get('request') || 'model';
	model = params.get('model') || 'HRRR';
	variable = params.get('variable') || 'CAPE';
	level = params.get('level') || 'lev_surface';
	run1 = params.get('run') || '00';
	document.getElementById("modelIndicator").innerHTML = "Model: " + model;
	document.getElementById("layerIndicator").innerHTML = document.getElementById(variable).innerHTML
	fetchFile(`getListOfFiles.php?request=${request}&model=${model}&variable=${variable}&level=${level}&run=${run}`).then(listOfFiles => {
		data = JSON.parse(listOfFiles);
		console.log(JSON.parse(listOfFiles));
		run = data["run"]*1000;
		runNb = new Date(parseInt(run1)).getUTCHours();
		minValue = data["vmin"];
		maxValue = data["vmax"];
		fetchFile('colormaps/' + variable + '.txt').then(jsonColor => {
			colorTable = JSON.parse(jsonColor);
			let isInvertedColormap = false;
			//inverted colormaps
			if (variable!="CIN"||variable!="SBT124"){
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

function darkMode(dark){
	if (dark){
		container.style.backgroundColor = "#101010";
		map.style.filter = "invert(1)";
	}
	else {
		container.style.backgroundColor = "#ddd";
		map.style.filter = "invert(0)";
	}
}

window.addEventListener('DOMContentLoaded', () => {
	preloadImagesAsync();
});