self.onmessage = function (event) {
    const { imageData, width, height, minValue, maxValue, isInvertedColormap, colorTable } = event.data;
    importScripts('https://d3js.org/d3.v7.min.js');
    // Precompute constants
    const imageSize = width * height;
    const imageDataArray = new Uint8ClampedArray(imageSize * 4);
    const rgbArray = new Float32Array(imageSize);
    const maxUint24 = 256 ** 3 - 1; // Maximum 24-bit value as a float
    const valueScale = (maxValue - minValue) / maxUint24;


    // Define colormap domain and range
    const domain = colorTable.map(d => d.value);
    // If colortable does contain or not alpha channel
    let range;
    if (colorTable[0].color[3] === undefined) {
        range = colorTable.map(d => `rgba(${d.color[0]},${d.color[1]},${d.color[2]},1)`);
    } else {
        range = colorTable.map(d => `rgba(${d.color[0]},${d.color[1]},${d.color[2]},${d.color[3] / 255})`);
    }

    // Create color scale
    const colormap = d3.scaleLinear()
        .domain(domain)
        .range(range)
        .clamp(true); // Ensure values outside the domain are clamped

    // Pre-compute color values for the entire 256-point range
    const colorCache = new Array(256);
    for (let i = 0; i < 256; i++) {
        const value = domain[0] + (domain[domain.length - 1] - domain[0]) * (i / 255);
        const color = d3.color(colormap(value));
        if (color) {
            colorCache[i] = [color.r, color.g, color.b, color.opacity * 255];
        } else {
            // Default to black if color is undefined
            colorCache[i] = [0, 0, 0, 0];
        }
    }

    // Render the array on imageData
	let i = 0;
	while (i < imageSize) {
		const index = i * 4;
		
		// Extract RGB value and scale
		const value = ((imageData[index] << 16) | (imageData[index + 1] << 8) | imageData[index + 2]) * valueScale + minValue;
		rgbArray[i] = value === minValue ? undefined : value;
		
		// Normalize value to fit the colormap domain
		const normalizedValue = Math.max(domain[0], Math.min(domain[domain.length - 1], rgbArray[i]));
		const colorIndex = Math.floor(((normalizedValue - domain[0]) / (domain[domain.length - 1] - domain[0])) * 255);

		// Use precomputed color or fallback to black
		const color = colorCache[colorIndex] || [0, 0, 0, 0];

		// Update imageDataArray
		imageDataArray[index] = color[0];       // Red
		imageDataArray[index + 1] = color[1];   // Green
		imageDataArray[index + 2] = color[2];   // Blue
		imageDataArray[index + 3] = color[3];   // Alpha

		i++; // Increment index
	}

    self.postMessage({
        rgbArray: rgbArray.buffer,
        imageDataArray: imageDataArray.buffer
    }, [rgbArray.buffer, imageDataArray.buffer]);
}
