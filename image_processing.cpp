#include <vector>
#include <cstdint>
#include <emscripten.h>
#include <emscripten/bind.h>

struct Color {
    uint8_t r, g, b, a;
};

struct ColorEntry {
    float value;
    Color color;
};

extern "C" {

    // Declare and define the function inside extern "C"
    EMSCRIPTEN_KEEPALIVE
        Color getColorForValue(float value, ColorEntry* colorTable, size_t colorTableSize, bool isInverted) {
        size_t i = colorTableSize - 1;
        while (i > 0) {
            if (value >= colorTable[i].value) {
                return isInverted ? colorTable[colorTableSize - 1 - i].color : colorTable[i].color;
            }
            i--;
        }
        return { 0, 0, 0, 0 }; // Default to black if below the range
    }

    EMSCRIPTEN_KEEPALIVE
        void processImage(
            uint8_t* imageData, size_t width, size_t height,
            float minValue, float maxValue, bool isInvertedColormap,
            ColorEntry* colorTable, size_t colorTableSize,
            uint8_t* imageDataArray, float* rgbArray
        ) {

        size_t imageSize = width * height;
        const float oldMax = 16777215.0f;
        const float valueRange = maxValue - minValue;
        const float valueScale = valueRange / oldMax;

        size_t index = 0;
        while (index < imageSize) {
            size_t pixelIndex = index * 4;

            uint8_t r = imageData[pixelIndex];
            uint8_t g = imageData[pixelIndex + 1];
            uint8_t b = imageData[pixelIndex + 2];
            uint8_t a = imageData[pixelIndex + 3];

            float scaledValue = 0.0f;  // Initialize to 0.0f
            bool nodataRGB = false;

            if (a != 0) {
                uint32_t intValue = (r << 16) | (g << 8) | b; // 24-bit RGB
                scaledValue = (intValue * valueScale) + minValue;

                nodataRGB = isInvertedColormap
                    ? scaledValue == maxValue
                    : scaledValue == minValue;
            }
            else {
                nodataRGB = true;
            }

            rgbArray[index] = scaledValue;

            printf("rgbArray[%zu] = %f\n", index, rgbArray[index]);

            if (nodataRGB) {
                imageDataArray[pixelIndex] = 0;
                imageDataArray[pixelIndex + 1] = 0;
                imageDataArray[pixelIndex + 2] = 0;
                imageDataArray[pixelIndex + 3] = 0;
            }
            else {
                Color color = getColorForValue(scaledValue, colorTable, colorTableSize, isInvertedColormap);
                imageDataArray[pixelIndex] = color.r;
                imageDataArray[pixelIndex + 1] = color.g;
                imageDataArray[pixelIndex + 2] = color.b;
                imageDataArray[pixelIndex + 3] = color.a;
            }

            index++;
        }
    }


} // extern "C"
