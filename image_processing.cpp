// C++ Code (WebAssembly)
#include <vector>
#include <cmath>
#include <emscripten/bind.h>

struct ColorEntry {
    float value;
    int r, g, b, a;
};

std::vector<int> interpolateColor(float value, const std::vector<ColorEntry>& colorTable) {
    const ColorEntry* lower = &colorTable[0];
    const ColorEntry* upper = &colorTable[colorTable.size() - 1];
    if (value <= lower->value) return {lower->r, lower->g, lower->b, lower->a};
    if (value >= upper->value) return {upper->r, upper->g, upper->b, upper->a};

    for (size_t i = 0; i < colorTable.size() - 1; i++) {
        if (value <= colorTable[i + 1].value) {
            lower = &colorTable[i];
            upper = &colorTable[i + 1];
            break;
        }
    }

    float t = (value - lower->value) / (upper->value - lower->value);
    return {
        static_cast<int>(lower->r + t * (upper->r - lower->r)),
        static_cast<int>(lower->g + t * (upper->g - lower->g)),
        static_cast<int>(lower->b + t * (upper->b - lower->b)),
        static_cast<int>(lower->a + t * (upper->a - lower->a))
    };
}

EMSCRIPTEN_BINDINGS(my_module) {
    emscripten::register_vector<ColorEntry>("VectorColorEntry");
    emscripten::register_vector<int>("VectorInt");
    emscripten::function("interpolateColor", &interpolateColor);
}

// JavaScript Worker Code (Optimized for WASM)
