let img;
let rgbArray;

const max24BitValue = 256 ** 3;
// Color table as an array of tuples (value, r, g, b)
let colorTable = [
	{ value: 0, color: [116, 78, 173] },
	{ value: 2, color: [131, 91, 178] },
	{ value: 4, color: [147, 104, 182] },
	{ value: 6, color: [162, 117, 186] },
	{ value: 8, color: [177, 130, 190] },
	{ value: 10, color: [67, 97, 162] },
	{ value: 12, color: [81, 123, 172] },
	{ value: 14, color: [95, 148, 182] },
	{ value: 16, color: [109, 173, 191] },
	{ value: 18, color: [111, 214, 232] },
	{ value: 20, color: [80, 213, 96] },
	{ value: 22, color: [17, 213, 24] },
	{ value: 24, color: [23, 168, 20] },
	{ value: 26, color: [29, 120, 16] },
	{ value: 28, color: [35, 73, 12] },
	{ value: 30, color: [255, 226, 0] },
	{ value: 32, color: [229, 205, 0] },
	{ value: 34, color: [204, 185, 0] },
	{ value: 36, color: [178, 165, 0] },
	{ value: 38, color: [153, 144, 0] },
	{ value: 40, color: [255, 0, 0] },
	{ value: 42, color: [229, 0, 0] },
	{ value: 44, color: [204, 0, 0] },
	{ value: 46, color: [178, 0, 0] },
	{ value: 48, color: [153, 0, 0] },
	{ value: 50, color: [255, 255, 255] },
	{ value: 52, color: [242, 224, 242] },
	{ value: 54, color: [229, 193, 229] },
	{ value: 56, color: [216, 163, 216] },
	{ value: 58, color: [203, 132, 203] },
	{ value: 60, color: [255, 117, 255] },
	{ value: 62, color: [217, 100, 217] },
	{ value: 64, color: [178, 82, 178] },
	{ value: 66, color: [140, 65, 140] },
	{ value: 68, color: [101, 47, 101] },
	{ value: 70, color: [178, 0, 255] },
	{ value: 72, color: [147, 0, 211] },
	{ value: 74, color: [117, 0, 167] },
	{ value: 76, color: [86, 0, 124] },
	{ value: 78, color: [55, 0, 80] },
	{ value: 80, color: [5, 236, 240] },
	{ value: 82, color: [4, 212, 216] },
	{ value: 84, color: [3, 189, 192] },
	{ value: 86, color: [2, 165, 168] },
	{ value: 88, color: [1, 141, 144] },
	{ value: 90, color: [1, 32, 32] },
	{ value: 92, color: [1, 32, 32] },
	{ value: 94, color: [1, 32, 32] }
];

var rgbArrayList = [];
var canvasList = [];

colorTable = rescaleColorTable(minValue, maxValue, colorTable);
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


function drawColormap(colorTable) {
	const canvas = document.getElementById("colormapCanvas");
	const ctx = canvas.getContext("2d");
	const width = canvas.width;
	const height = canvas.height;

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
            variable, // Variable name (e.g., 'CIN')
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

            // Optional: Add RGB array (if needed elsewhere in your app)
            // const rgbArray = ... extract or store it here if required

            // Step 4: Update the main canvas if this is the first image
            slider.dispatchEvent(new Event("input"));
		}
        console.log("All images preloaded successfully");
    } catch (error) {
        console.error("Error in preloadImagesAsync:", error);
    }
}

// Helper function to load an image asynchronously
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(`Failed to load image at ${src}: ${err}`);
		img.src = src;
    });
}

window.addEventListener('DOMContentLoaded', () => {
	preloadImagesAsync();
});