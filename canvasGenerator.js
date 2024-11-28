const img = document.getElementById("forecast");	
const canvas = document.getElementById('canvas');
let rgbArray;
let minValue = -60; // Min value for the new range
let maxValue = 60;  // Max value for the new range
const max24BitValue = 256**3;
// Color table as an array of tuples (value, r, g, b)
let colorTable = [
  { value: -30, color: [68, 1, 84] },
  { value: -28, color: [70, 12, 95] },
  { value: -26, color: [72, 25, 107] },
  { value: -24, color: [72, 35, 116] },
  { value: -22, color: [70, 47, 124] },
  { value: -20, color: [68, 57, 130] },
  { value: -18, color: [64, 67, 135] },
  { value: -16, color: [61, 76, 137] },
  { value: -14, color: [56, 86, 139] },
  { value: -12, color: [52, 94, 141] },
  { value: -10, color: [48, 103, 141] },
  { value: -8, color: [45, 111, 142] },
  { value: -6, color: [41, 120, 142] },
  { value: -4, color: [38, 127, 142] },
  { value: -2, color: [35, 136, 141] },
  { value: 0, color: [32, 144, 140] },
  { value: 2, color: [30, 152, 138] },
  { value: 4, color: [30, 160, 135] },
  { value: 6, color: [34, 167, 132] },
  { value: 8, color: [42, 176, 126] },
  { value: 10, color: [53, 183, 120] },
  { value: 12, color: [68, 190, 112] },
  { value: 14, color: [83, 197, 103] },
  { value: 16, color: [103, 204, 92] },
  { value: 18, color: [121, 209, 81] },
  { value: 20, color: [144, 214, 67] },
  { value: 22, color: [165, 218, 53] },
  { value: 24, color: [189, 222, 38] },
  { value: 26, color: [210, 225, 27] },
  { value: 28, color: [233, 228, 25] },
  { value: 30, color: [253, 231, 36] },
];
	
function getArray(){
	console.time('getArray');
	// Create a canvas element to draw the image
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");

	// Set canvas size to image size
	canvas.width = img.width;
	canvas.height = img.height;

	// Draw the image onto the canvas
	ctx.drawImage(img, 0, 0);

	// Get the image data (RGBA values)
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const data = imageData.data;  // The RGBA array for the image

	// Create a 2D array to hold 24-bit values
	const width = canvas.width;
	const height = canvas.height;
	let rgbArray = [];
	
	let oldMin = 0;
	let oldMax = 16777215;
	
	// Loop through the image data and convert RGBA to 24-bit RGB values
	for (let y = 0; y < height; y++) {
		let row = [];
		for (let x = 0; x < width; x++) {
			const index = (y * width + x) * 4;
			let r = data[index];       // Red channel (0-255)
			let g = data[index + 1];   // Green channel (0-255)
			let b = data[index + 2];   // Blue channel (0-255)

			// Convert to 24-bit integer (RGB)
			let intValue = (r * 256**2) + (256*g) + b;  // 24-bit integer (RGB)
			let scaledValue = ((intValue / oldMax) * (maxValue - minValue)) + minValue
			row.push(scaledValue);
		}
		rgbArray.push(row);
	}
	console.timeEnd('getArray');

	// Now rgbArray is a 2D array containing the 24-bit values for each pixel
	return rgbArray;

}

// sleep time expects milliseconds
function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
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


/* function convertToCanvas(){
	data = getArray();
	console.time('convertToCanvas');

	// Get canvas element and set its size
	const canvas = document.getElementById('canvas');
	const ctx = canvas.getContext('2d');
	
	for(var i=0; i< data.length; i++){ 
		for(var j=0; j< data[0].length; j++){ 
			r = getColorForValue(data[i][j])[0]; 
			g = getColorForValue(data[i][j])[1];	 
			b = getColorForValue(data[i][j])[2];	
			if (r === 0 && g === 0 && b === 0){
				ctx.fillStyle = "rgba("+r+","+g+","+b+", 0)";
			} else {
			let alpha = Math.max(0, Math.min(255, ((r+g+b)/3))**2);
				ctx.fillStyle = "rgba("+r+","+g+","+b+", "+alpha+")";
			}
			ctx.fillRect( j, i, 1, 1 ); 
		} 
	}
	console.timeEnd('convertToCanvas');
} */
function convertToCanvas(){
	rgbArray = getArray();
	width = rgbArray[0].length;
	height = rgbArray.length;
	
	console.time('convertToCanvas');
	const ctx = canvas.getContext('2d');

	// Create an ImageData object
	const imageData = ctx.createImageData(width, height);

	// Loop through the array and set pixel values
	let i = 0;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			r = imageData.data[i] = getColorForValue(rgbArray[y][x])[0];     // Red
			g = imageData.data[i + 1] = getColorForValue(rgbArray[y][x])[1]; // Green
			b = imageData.data[i + 2] = getColorForValue(rgbArray[y][x])[2]; // Blue
			if (r == 0 && g == 0 && b == 0) {				
				imageData.data[i + 3] = 0; // Alpha (fully opaque)
			} else {
				let alpha = Math.max(0, Math.min(255, ((r+g+b)/3))**2);
				imageData.data[i + 3] = alpha;
			}
			i += 4;  // Move to the next pixel (each pixel has 4 values: RGBA)
		}
	}
		
	// Put the image data on the canvas
	ctx.putImageData(imageData, 0, 0);
	console.timeEnd('convertToCanvas');
}

convertToCanvas()
