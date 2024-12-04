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


rgbArrayList = []
function getArray(imgSrc) {
	console.time('getArray');

	// Create a canvas element to draw the image
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");

	// Set canvas size to image size
	canvas.width = imgSrc.width;
	canvas.height = imgSrc.height;

	// Draw the image onto the canvas
	ctx.drawImage(imgSrc, 0, 0);

	// Get the image data (RGBA values)
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const data = imageData.data;  // The RGB array for the image

	// Create a 2D array to hold 24-bit values
	const width = canvas.width;
	const height = canvas.height;
	let rgbArray = new Float32Array(height * width); // Pre-allocate the array

	let oldMin = 0;
	let oldMax = 16777215;

	// Loop through the image data and convert RGBA to 24-bit RGB values
	let y = 0;
	while (y < height) {
		let row = [];
		let x = 0;
		while (x < width) {
			const index = (y * width + x) * 4;
			let r = data[index];       // Red channel (0-255)
			let g = data[index + 1];   // Green channel (0-255)
			let b = data[index + 2];   // Blue channel (0-255)
			let a = data[index + 3];  // Aplha channel (0-255)

			// Convert to 24-bit integer (RGB)
			let scaledValue = null;
			if (a != 0) { 
				let intValue = (r * 256 ** 2) + (256 * g) + b;  // 24-bit integer (RGB)
				scaledValue = ((intValue / oldMax) * (maxValue - minValue)) + minValue;
			}

			rgbArray[y * width + x] = scaledValue;


			x++; // Increment x for the inner loop
		}

		y++; // Increment y for the outer loop
	}

	console.timeEnd('getArray');

	// Now rgbArray is a 2D array containing the 24-bit values for each pixel
	rgbArrayList.push(rgbArray);
	return rgbArray;

}

// Function to get the color for a given value
function getColorForValue(value) {
	for (let i = colorTable.length - 1; i >= 0; i--) {
		if (value >= colorTable[i].value) {
			return colorTable[i].color;
		}
	}
	return [0, 0, 0]; // Default to black if value is below the range
}


var canvasList = [];
function convertToCanvas(imgSrc) {
	rgbArray = getArray(imgSrc);
	width = imgSrc.width;
	height = imgSrc.height;

	const canvas = document.createElement('canvas');

	console.log(width, height)
	canvas.width = width;
	canvas.height = height;


	console.time('convertToCanvas');
	const ctx = canvas.getContext('2d');

	// Create an ImageData object
	const imageData = ctx.createImageData(width, height);

	// Loop through the array and set pixel values
	let i = 0;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			// Get the 1D index for the 2D position in rgbClampedArray
			const rgbIndex = y * width + x;

			// Retrieve the scaled value
			const value = rgbArray[rgbIndex];

			// Map the value to an RGB color
			let [r, g, b] = getColorForValue(value);

			// Assign colors to the imageData array
			imageData.data[i] = r;       // Red
			imageData.data[i + 1] = g;   // Green
			imageData.data[i + 2] = b;   // Blue

			let nodataRGB;
			//if inverted colormap
			if (variable == "CIN") {
				nodataRGB = (value == maxValue);
			} else {
				nodataRGB = (value == minValue);
			}
			if (nodataRGB) {
				imageData.data[i + 3] = 0; // Alpha (transparent)
				
			} else {
				//imageData.data[i + 3] = Math.max(0, Math.min(255, ((r + g + b) / 3)) ** 2);
				imageData.data[i + 3] = 255;
			}

			i += 4; // Move to the next pixel in the imageData array
		}
	}

	// Put the image data on the canvas
	ctx.putImageData(imageData, 0, 0);
	canvasList.push(ctx);
	console.timeEnd('convertToCanvas');
	forecastTimeText.innerHTML = epochToTimestamp(data["files"][0]["forecastTime"]);
}

function epochToTimestamp(epoch) {
	const date = new Date(epoch * 1000); // Convert epoch to milliseconds
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function downloadImage(imgsrc) {
	new Promise(function (resolve, reject) {
		//download image
		let img = new Image()
		img.src = imgsrc;
		img.onerror = (error) => reject(`Failed to load image at ${url}`);
		img.onload = function () {
			convertToCanvas(img);
			//if first image loaded
			if (canvasList.length <= 1) {
				canvas.getContext('2d').clearRect(0, 0, img.width, img.height);
				canvas.getContext('2d').drawImage(canvasList[0].canvas, 0, 0, img.width, img.height);
				determineDistance(canvasList[0].canvas);
			}
		};
		
	})

}

async function preloadImages() {
	for (let i = 0; i <= data["files"].length; i++){
		await downloadImage("downloads/" + model + "/" + runNb.toString().padStart(2, "0") + "/" + data["files"][i]["file"]);
	}
}

preloadImages();