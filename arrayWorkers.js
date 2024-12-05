self.onmessage = function (event) {
    const { imageData, width, height, minValue, maxValue, variable, colorTable } = event.data;

    // Create the RGBA array for image data
    const imageDataArray = new Uint8ClampedArray(width * height * 4);
    const rgbArray = new Float32Array(height * width); // Ensure Float32Array
    const oldMax = 16777215; // Maximum 24-bit value as a float

	let index = 0; // Start index for while loop
	while (index < width * height) {
		const y = Math.floor(index / width); // Calculate row (y)
		const x = index % width; // Calculate column (x)
		
		const pixelIndex = index * 4; // Corresponding pixel RGBA index
		const r = imageData[pixelIndex];
		const g = imageData[pixelIndex + 1];
		const b = imageData[pixelIndex + 2];
		const a = imageData[pixelIndex + 3];

		let scaledValue = NaN;
		let nodataRGB;

		// Convert RGBA to scaled value
		if (a !== 0) {
			//const intValue = (r * 256 ** 2) + (256 * g) + b
			const intValue = (r << 16) | (g << 8) | b; // 24-bit RGB
			scaledValue = ((intValue / oldMax) * (maxValue - minValue)) + minValue;

			if (variable === "CIN") {
				nodataRGB = scaledValue === maxValue;
			} else {
				nodataRGB = scaledValue === minValue;
			}
		} else {
			nodataRGB = true;
		}

		rgbArray[index] = scaledValue; // Store float value in Float32Array

		// Set RGBA values in the imageDataArray
		if (nodataRGB) {
			// Mark as transparent
			imageDataArray[pixelIndex] = 0; // Red
			imageDataArray[pixelIndex + 1] = 0; // Green
			imageDataArray[pixelIndex + 2] = 0; // Blue
			imageDataArray[pixelIndex + 3] = 0; // Fully transparent
		} else {
			// Map value to a color
			const [colorR, colorG, colorB] = getColorForValue(scaledValue, colorTable);
			imageDataArray[pixelIndex] = colorR; // Red
			imageDataArray[pixelIndex + 1] = colorG; // Green
			imageDataArray[pixelIndex + 2] = colorB; // Blue
			imageDataArray[pixelIndex + 3] = 255; // Fully opaque
		}

		
		index++; // Increment index for the next pixel
	}

    // Send the processed image data back to the main thread
    self.postMessage({
        rgbArray: rgbArray.buffer,
        imageDataArray: imageDataArray.buffer
    }, [rgbArray.buffer, imageDataArray.buffer]);
};

// Helper function to find color for a value
function getColorForValue(value, colorTable) {
    for (let i = colorTable.length - 1; i >= 0; i--) {
        if (value >= colorTable[i].value) {
            return colorTable[i].color;
        }
    }
    return [0, 0, 0]; // Default to black if value is below the range
}
