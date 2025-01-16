importScripts('image_processing.js');  // Import WebAssembly module
self.onmessage = function (event) {
    const { imageData, width, height, minValue, maxValue, isInvertedColormap, colorTable } = event.data;

    const imageSize = width * height;
    const imageDataArray = new Uint8ClampedArray(imageSize * 4);
    const rgbArray = new Float32Array(imageSize);

    // Initialize the WebAssembly module
    Module.onRuntimeInitialized = () => {

        // Allocate memory for the output buffers
        const imageDataPointer = Module._malloc(imageSize * 4);  // RGBA array size
        const rgbArrayPointer = Module._malloc(imageSize * 4);   // Float32 array size

        // Calculate the total memory required for the color table
        const colorTableSize = colorTable.length * 16;  // 16 bytes per color entry

        // Allocate memory for the color table
        const colorTablePointer = Module._malloc(colorTableSize);

        // Copy the color table data into memory using the correct HEAP array
        for (let i = 0; i < colorTable.length; i++) {
            const offset = colorTablePointer + i * 16;  // Each entry takes 16 bytes
            // Use HEAP32 for float and HEAPU8 for RGBA
            Module.HEAP32[offset >> 2] = colorTable[i].value;  // Write value (float) at 4-byte offset
            Module.HEAPU8[offset + 4] = colorTable[i].color[0];  // r at 1-byte offset
            Module.HEAPU8[offset + 5] = colorTable[i].color[1];  // g at 1-byte offset
            Module.HEAPU8[offset + 6] = colorTable[i].color[2];  // b at 1-byte offset
            Module.HEAPU8[offset + 7] = colorTable[i].color[3];  // a at 1-byte offset
        }

        try {
            // Call the C++ function using WebAssembly
            Module._processImage(imageData.buffer, width, height, minValue, maxValue, isInvertedColormap, colorTablePointer, colorTable.length, imageDataPointer, rgbArrayPointer);

            // Copy the results from the WebAssembly memory to JavaScript memory
            // Extract RGBA data from imageDataPointer and copy it to the imageDataArray
            const rgbaData = new Uint8Array(Module.HEAPU8.buffer, imageDataPointer, imageSize * 4);

            imageDataArray.set(rgbaData);

            // Extract float data from rgbArrayPointer and copy it to the rgbArray
            const floatData = new Float32Array(Module.HEAPF32.buffer, rgbArrayPointer, imageSize);
            rgbArray.set(floatData);
        } catch (error) {
            console.error("Error during WebAssembly function call:", error);
        } finally {
            // Free the allocated memory
            Module._free(colorTablePointer);
            Module._free(imageDataPointer);
            Module._free(rgbArrayPointer);
        }

        // Send the processed image data back to the main thread
        self.postMessage({
            rgbArray: rgbArray.buffer,
            imageDataArray: imageDataArray.buffer
        }, [rgbArray.buffer, imageDataArray.buffer]);
    };
};


