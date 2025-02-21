self.onmessage = function (event) {
    const { imageData, width, height, minValue, maxValue, isInvertedColormap, colorTable } = event.data;

	// Precompute constants
	const imageSize = width * height;
	const imageDataArray = new Uint8Array(imageSize * 4);
	const rgbArray = new Float32Array(imageSize);
	const oldMax = 16777215; // Maximum 24-bit value as a float
	const valueRange = maxValue - minValue;
	const valueScale = valueRange / oldMax;

	let index = 0; // Start index for while loop

	while (index < imageSize) {
		const pixelIndex = index * 4; // Corresponding pixel RGBA index
		const r = imageData[pixelIndex];
		const g = imageData[pixelIndex + 1];
		const b = imageData[pixelIndex + 2];
		const a = imageData[pixelIndex + 3];

		let scaledValue = NaN;
		let nodataRGB;

		// Convert RGBA to scaled value
		if (a !== 0) {
			const intValue = (r << 16) | (g << 8) | b; // 24-bit RGB
			scaledValue = (intValue * valueScale) + minValue;

			nodataRGB = isInvertedColormap
				? scaledValue === maxValue
				: scaledValue === minValue;
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
			const [colorR, colorG, colorB, colorA] = getColorForValue(scaledValue, colorTable);
			imageDataArray[pixelIndex] = colorR; // Red
			imageDataArray[pixelIndex + 1] = colorG; // Green
			imageDataArray[pixelIndex + 2] = colorB; // Blue
			imageDataArray[pixelIndex + 3] = colorA ?? 255; //Alpha, if no alpha, defaults to 255
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
    let len = colorTable.length;
    if (len < 2) return new Uint8Array([0, 0, 0, 0]);

    // Early returns
    if (value <= colorTable[0].value) return colorTable[0].color;
    if (value >= colorTable[len - 1].value) return colorTable[len - 1].color;

    // Binary search
    let low = 0, high = len - 1, mid;
    while (low < high - 1) {
        mid = (low + high) >> 1;
        low = colorTable[mid].value <= value ? mid : low;
        high = colorTable[mid].value > value ? mid : high;
    }

    // Compute interpolation factor
    let stop1 = colorTable[low], stop2 = colorTable[high];
    let t = (value - stop1.value) / (stop2.value - stop1.value);
    let c1 = stop1.color, c2 = stop2.color;

    // Pre-allocate typed array for speed
    return new Uint8Array([
        c1[0] + t * (c2[0] - c1[0]) | 0,
        c1[1] + t * (c2[1] - c1[1]) | 0,
        c1[2] + t * (c2[2] - c1[2]) | 0,
        c1[3] + t * (c2[3] - c1[3]) | 0
    ]);
}



