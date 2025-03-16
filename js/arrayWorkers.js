self.onmessage = function (event) {
    const { imageData, width, height, minValue, maxValue, isInvertedColormap, colorTable, radar } = event.data;

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
		if (!radar) {
			if (a !== 0) {
				const intValue = (r << 16) | (g << 8) | b; // 24-bit RGB
				scaledValue = (intValue * valueScale) + minValue;

				nodataRGB = isInvertedColormap
					? scaledValue === maxValue
					: scaledValue === minValue;
			} else {
				nodataRGB = true;
			}
		} else {
			scaledValue = (intValue * valueScale) + minValue;
			nodataRGB = isInvertedColormap
				? scaledValue === maxValue
				: scaledValue === minValue;
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
    if (value <= colorTable[0].value) return colorTable[0].color;
    if (value >= colorTable[colorTable.length - 1].value) return colorTable[colorTable.length - 1].color;

    for (let i = 0; i < colorTable.length - 1; i++) {
        let c1 = colorTable[i], c2 = colorTable[i + 1];
        if (value >= c1.value && value <= c2.value) {
            let t = (value - c1.value) / (c2.value - c1.value);
            let color = c1.color.map((c, j) => Math.round(c + (c2.color[j] - c) * t));
            return isInverted ? color.reverse() : color;
        }
    }

    return [0, 0, 0, 0]; // Default if something goes wrong
}


