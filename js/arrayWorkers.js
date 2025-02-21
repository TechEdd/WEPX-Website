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
			const [colorR, colorG, colorB, colorA] = getColorForValue(scaledValue, colorTable, isInvertedColormap);
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
function getColorForValue(value, colorTable, isInverted) {
    let lastIndex = colorTable.length - 1;

    // Fast return for out-of-bounds values
    if (value <= colorTable[0].value) return colorTable[0].color;
    if (value >= colorTable[lastIndex].value) return colorTable[lastIndex].color;

    // Binary search for efficiency
    let low = 0, high = lastIndex;
    while (low < high - 1) {
        let mid = (low + high) >> 1;
        if (colorTable[mid].value <= value) low = mid;
        else high = mid;
    }

    let c1 = colorTable[low], c2 = colorTable[high];
    let t = (value - c1.value) / (c2.value - c1.value);

    let color = [
        c1.color[0] + t * (c2.color[0] - c1.color[0]),
        c1.color[1] + t * (c2.color[1] - c1.color[1]),
        c1.color[2] + t * (c2.color[2] - c1.color[2]),
        c1.color[3] + t * (c2.color[3] - c1.color[3])
    ];

    if (isInverted) {
        let temp = color;
        color = [
            temp[3], temp[2], temp[1], temp[0] // Reverse manually for speed
        ];
    }

    return color;
}



