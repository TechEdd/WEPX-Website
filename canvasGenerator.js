let img;
let rgbArray;

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

async function mapColorsWithWorker(imageData, width, height, minValue, maxValue, variable, colorTable) {
	return new Promise((resolve, reject) => {
		const worker = new Worker("arrayWorkers.js"); // Create the worker

        worker.onmessage = (e) => {
            let { rgbArray, imageDataArray } = e.data; // Received processed RGBA array
			rgbArray = new Float32Array(rgbArray);
			imageDataArray = new Uint8ClampedArray(imageDataArray);
			resolve({rgbArray, imageDataArray}); // Resolve with the imageDataArray
            worker.terminate(); // Clean up the worker
        };

        worker.onerror = (err) => {
            console.error("Worker encountered an error:", err);
            reject(err); // Reject on error
            worker.terminate(); // Clean up the worker
        };

        // Post data to the worker
        worker.postMessage({
            imageData, // Raw RGBA data from the canvas
            width, // Width of the image
            height, // Height of the image
            minValue, // Minimum value for scaling
            maxValue, // Maximum value for scaling
            isInvertedColormap, // if colormap inverted
            colorTable // Color mapping table
        });
    });
}

async function convertToCanvasAsync(imgSrc) {
    try {
        // Step 1: Create a canvas and get raw RGBA data
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = imgSrc.width;
        canvas.height = imgSrc.height;
        ctx.drawImage(imgSrc, 0, 0);
		
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Step 2: Use the worker to process the RGBA data and apply the color mapping
        const { rgbArray, imageDataArray } = await mapColorsWithWorker(
            imageData.data, // Raw image data
            canvas.width,
            canvas.height,
            minValue,
            maxValue,
            variable,
            colorTable
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
        for (const file of data["files"]) {
            // Step 1: Load the image
            const imgSrc = "downloads/" + model + "/" + runNb.toString().padStart(2, "0") + "/" + file["file"];
			const img = await loadImage(imgSrc); // Helper function to load images asynchronously
			
			
			// Step 2: Process the image with convertToCanvasAsync
			console.time(imgSrc);
            const { rgbArray, canvas } = await convertToCanvasAsync(img);
			console.timeEnd(imgSrc);
            // Step 3: Add to canvasList and rgbArrayList
            canvasList.push(canvas);
			rgbArrayList.push(rgbArray);

            // Step 4: Update the main canvas if this is the first image
            slider.dispatchEvent(new Event("input"));
		}
        console.log("All images preloaded successfully");
    } catch (error) {
        console.error("Error in preloadImagesAsync:", error);
    }
}

// Helper function to load an image asynchronously
async function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
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
	level = params.get('level') || 'all_lev';
	run = params.get('run') || '00';
	fetchFile(`getListOfFiles.php?request=${request}&model=${model}&variable=${variable}&level=${level}&run=${run}`).then(listOfFiles => {
		data = JSON.parse(listOfFiles);
		console.log(JSON.parse(listOfFiles));
		run = data["run"]*1000;
		runNb = new Date(parseInt(run)).getUTCHours();
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



window.addEventListener('DOMContentLoaded', () => {
	preloadImagesAsync();
});