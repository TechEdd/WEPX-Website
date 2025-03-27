// Persistent WebGL resources
let gl, program, vao, positionBuffer, texture, colorTexture, fb, colorTextureOut, valueTextureOut, canvas;

// Initialize WebGL context and resources once
function initializeWebGL() {
    canvas = new OffscreenCanvas(1, 1); // Initial size
    gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL 2 not supported');

    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) throw new Error('Floating-point render targets not supported');

    const vertexShaderSource = `#version 300 es
        in vec2 a_position;
        in float a_vertexId;
        out vec2 v_texCoord;
        out float v_vertexId;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = (a_position + 1.0) * 0.5;
            v_vertexId = a_vertexId;
        }
    `;

    const fragmentShaderSource = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        in float v_vertexId;
        uniform sampler2D u_image;
        uniform sampler2D u_colorTable;
        uniform float u_minValue;
        uniform float u_maxValue;
        uniform float u_valueScale;
        uniform int u_isInverted;
        uniform int u_radar;
        uniform float u_colorTableSize;
        uniform vec2 u_texelSize;

        layout(location = 0) out vec4 fragColor;
        layout(location = 1) out float fragValue;

        vec4 getColorForValue(float value) {
            float t = clamp((value - u_minValue) / (u_maxValue - u_minValue), 0.0, 1.0);
            return texture(u_colorTable, vec2(t, 0.5));
        }

        void main() {
            vec2 offsets[4] = vec2[](
                vec2(0.0, 0.0),
                vec2(1.0, 0.0),
                vec2(0.0, 1.0),
                vec2(1.0, 1.0)
            );
            int batchIdx = int(mod(v_vertexId, 4.0)); // Fixed typo: 'flor' -> '4.0'
            vec2 baseCoord = v_texCoord + (u_texelSize * 0.5);
            vec2 coord = baseCoord + (offsets[batchIdx] * u_texelSize);

            vec4 pixel = texture(u_image, coord);
            float intValue = (pixel.r * 255.0 * 65536.0) + (pixel.g * 255.0 * 256.0) + (pixel.b * 255.0);
            float scaledValue = (intValue * u_valueScale) + u_minValue;
            bool nodataRGB = (u_radar == 0 && pixel.a == 0.0) || 
                            (u_isInverted == 1 ? scaledValue == u_maxValue : scaledValue == u_minValue);

            fragColor = nodataRGB ? vec4(0.0) : getColorForValue(scaledValue);
            fragValue = nodataRGB ? 0.0 : scaledValue;
        }
    `;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) throw new Error('Shader compilation failed');

    program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) throw new Error('Program creation failed');
    gl.useProgram(program);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
        -1, -1, 0, 1, -1, 1, -1, 1, 2,
        1, -1, 3, 1, 1, 4, -1, 1, 5
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const vertexIdLocation = gl.getAttribLocation(program, 'a_vertexId');
    gl.enableVertexAttribArray(positionLocation);
    gl.enableVertexAttribArray(vertexIdLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 12, 0);
    gl.vertexAttribPointer(vertexIdLocation, 1, gl.FLOAT, false, 12, 8);

    texture = gl.createTexture();
    colorTexture = gl.createTexture();
    fb = gl.createFramebuffer();
    colorTextureOut = gl.createTexture();
    valueTextureOut = gl.createTexture();

    return canvas;
}

// Main worker message handler
self.onmessage = async function (event) {
    const { imageData, width, height, minValue, maxValue, isInvertedColormap, colorTable, radar } = event.data;

    try {
        if (!gl) {
            initializeWebGL();
        }

        if (!canvas) {
            throw new Error('Canvas is undefined after initialization');
        }

        canvas.width = width;
        canvas.height = height;

        const { rgbArray, imageDataArray } = await processWithGPU(
            imageData,
            width,
            height,
            minValue,
            maxValue,
            isInvertedColormap,
            colorTable,
            radar
        );

        self.postMessage({
            rgbArray: rgbArray,
            imageDataArray: imageDataArray
        }, [rgbArray.buffer, imageDataArray.buffer]);
    } catch (error) {
        console.error('Error in worker:', error);
        const { rgbArray, imageDataArray } = processWithCPU(
            imageData,
            width,
            height,
            minValue,
            maxValue,
            isInvertedColormap,
            colorTable,
            radar
        );

        self.postMessage({
            rgbArray: rgbArray,
            imageDataArray: imageDataArray
        }, [rgbArray.buffer, imageDataArray.buffer]);
    }
};

async function processWithGPU(imageData, width, height, minValue, maxValue, isInvertedColormap, colorTable, radar) {

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const colorTableSize = 256;
    const colorTableData = new Uint8Array(colorTableSize * 4);
    for (let i = 0; i < colorTableSize; i++) {
        const t = i / (colorTableSize - 1);
        const value = minValue + t * (maxValue - minValue);
        const [r, g, b, a] = getColorForValue(value, colorTable, isInvertedColormap);
        const idx = i * 4;
        colorTableData[idx] = r;
        colorTableData[idx + 1] = g;
        colorTableData[idx + 2] = b;
        colorTableData[idx + 3] = a ?? 255;
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, colorTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, colorTableSize, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, colorTableData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, colorTextureOut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindTexture(gl.TEXTURE_2D, valueTextureOut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTextureOut, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, valueTextureOut, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

    const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`Framebuffer incomplete: ${fbStatus}`);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, colorTexture);

    const valueScale = (maxValue - minValue) / 16777215.0;
    gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_colorTable'), 1);
    gl.uniform1f(gl.getUniformLocation(program, 'u_minValue'), minValue);
    gl.uniform1f(gl.getUniformLocation(program, 'u_maxValue'), maxValue);
    gl.uniform1f(gl.getUniformLocation(program, 'u_valueScale'), valueScale);
    gl.uniform1i(gl.getUniformLocation(program, 'u_isInverted'), isInvertedColormap ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_radar'), radar ? 1 : 0);
    gl.uniform1f(gl.getUniformLocation(program, 'u_colorTableSize'), colorTableSize);
    gl.uniform2f(gl.getUniformLocation(program, 'u_texelSize'), 1.0 / width, 1.0 / height);

    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
        throw new Error(`WebGL error after drawArrays: ${error}`);
    }

    const imageDataArray = new Uint8ClampedArray(width * height * 4);
    const rgbArray = new Float32Array(width * height);

    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, imageDataArray);
    if (gl.getError() !== gl.NO_ERROR) {
        throw new Error('WebGL error during readPixels (COLOR_ATTACHMENT0)');
    }

    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    gl.readPixels(0, 0, width, height, gl.RED, gl.FLOAT, rgbArray);
    if (gl.getError() !== gl.NO_ERROR) {
        throw new Error('WebGL error during readPixels (COLOR_ATTACHMENT1)');
    }

    for (let i = 0; i < width * height; i++) {
        if (rgbArray[i] === 0.0 && imageDataArray[i * 4] === 0) {
            rgbArray[i] = NaN;
        }
    }

    return { rgbArray, imageDataArray };
}

// CPU fallback and helper functions (unchanged)
function processWithCPU(imageData, width, height, minValue, maxValue, isInvertedColormap, colorTable, radar) {
    const imageSize = width * height;
    const imageDataArray = new Uint8ClampedArray(imageSize * 4);
    const rgbArray = new Float32Array(imageSize);
    const valueScale = (maxValue - minValue) / 16777215;

    let index = 0;
    while (index < imageSize) {
        const pixelIndex = index * 4;
        const r = imageData[pixelIndex];
        const g = imageData[pixelIndex + 1];
        const b = imageData[pixelIndex + 2];
        const a = imageData[pixelIndex + 3];

        let scaledValue = NaN;
        let nodataRGB;

        if (!radar) {
            if (a !== 0) {
                const intValue = (r << 16) | (g << 8) | b;
                scaledValue = (intValue * valueScale) + minValue;
                nodataRGB = isInvertedColormap ? scaledValue === maxValue : scaledValue === minValue;
            } else {
                nodataRGB = true;
            }
        } else {
            const intValue = (r << 16) | (g << 8) | b;
            scaledValue = (intValue * valueScale) + minValue;
            nodataRGB = isInvertedColormap ? scaledValue === maxValue : scaledValue === minValue;
        }

        rgbArray[index] = scaledValue;

        if (nodataRGB) {
            imageDataArray[pixelIndex] = 0;
            imageDataArray[pixelIndex + 1] = 0;
            imageDataArray[pixelIndex + 2] = 0;
            imageDataArray[pixelIndex + 3] = 0;
        } else {
            const [colorR, colorG, colorB, colorA] = getColorForValue(scaledValue, colorTable, isInvertedColormap);
            imageDataArray[pixelIndex] = colorR;
            imageDataArray[pixelIndex + 1] = colorG;
            imageDataArray[pixelIndex + 2] = colorB;
            imageDataArray[pixelIndex + 3] = colorA ?? 255;
        }

        index++;
    }

    return { rgbArray, imageDataArray };
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

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
    return [0, 0, 0, 0];
}