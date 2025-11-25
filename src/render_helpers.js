


// Helper: extract a rectangular region from a full RGBA buffer
function extractRegion(data, fullWidth, minX, minY, regionWidth, regionHeight) {
    const rowBytes = regionWidth * 4;
    const out = new Uint8ClampedArray(regionWidth * regionHeight * 4);
    for (let row = 0; row < regionHeight; row++) {
        const srcStart = ((minY + row) * fullWidth + minX) * 4;
        const dstStart = row * rowBytes;
        out.set(data.subarray(srcStart, srcStart + rowBytes), dstStart);
    }
    return out;
}

export class DirtyRegionTracker {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = canvas.width;    // Cache dimensions
        this.height = canvas.height;
        this.reset();
    }

    reset() {
        this.minX = this.width;       // Start inverted (any value will update)
        this.minY = this.height;
        this.maxX = -1;
        this.maxY = -1;
        this.modified = false;
    }

    // Optimized: no Math.floor, no clamping, raw updates
    markRect(x, y, w, h) {
        const x0 = x | 0;
        const y0 = y | 0;
        const x1 = (x + w - 1) | 0;
        const y1 = (y + h - 1) | 0;
        
        // Update extremes (branch prediction friendly: usually all four update)
        if (x0 < this.minX) this.minX = x0;
        if (y0 < this.minY) this.minY = y0;
        if (x1 > this.maxX) this.maxX = x1;
        if (y1 > this.maxY) this.maxY = y1;
        
        this.modified = true;
    }

    // kept for API compatibility, but internally just marks a 1x1 rect
    mark(x, y) {
        this.markRect(x, y, 1, 1);
    }

    flush() {
        if (!this.modified) {
            return null;
        }

        // Clamp to valid canvas bounds ONCE
        const minX = Math.max(0, this.minX);
        const minY = Math.max(0, this.minY);
        const maxX = Math.min(this.width - 1, this.maxX);
        const maxY = Math.min(this.height - 1, this.maxY);

        // Validate bounds
        if (minX > maxX || minY > maxY) {
            this.reset();
            return null;
        }

        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;

        // Extract region data
        const regionData = this._extractRegion(minX, minY, regionWidth, regionHeight);
        
        // Upload to GPU
        this.canvas.renderer.updateBufferData(
            this.canvas.bufferId,
            regionData,
            minX, minY,
            regionWidth, regionHeight
        );
        this.canvas.needsUpload = true;

        const result = { minX, minY, regionWidth, regionHeight };
        this.reset();
        return result;
    }

    // Optimized extraction: direct subarray slicing
    _extractRegion(x, y, w, h) {
        const data = this.canvas.data;
        const canvasWidth = this.width;
        const region = new Uint8Array(w * h * 4);

        // Copy row by row (cache-friendly)
        for (let row = 0; row < h; row++) {
            const srcOffset = ((y + row) * canvasWidth + x) * 4;
            const dstOffset = row * w * 4;
            region.set(
                data.subarray(srcOffset, srcOffset + w * 4),
                dstOffset
            );
        }

        return region;
    }
}



export class SharedBuffer {
    /**
    * 
    * @param {Renderer} renderer 
    * @param {Number} size - buffer size
    */
    constructor(renderer, width, height) {
        this.renderer = renderer;
        this.size = width * height * 4;
        this.bufferId = renderer.createSharedBuffer(this.size, width, height);
        this.dirty = false;
    }

    markDirty() {
        this.renderer.markBufferDirty(this.bufferId);
        this.dirty = true;
    }

    isDirty() {
        return this.renderer.isBufferDirty(this.bufferId);
    }

    getData() {
        this.dirty = false;
        return this.renderer.getBufferData(this.bufferId);
    }

    /**
     * 
     * @param {Uint8Array<ArrayBufferLike>} data 
     */
    updateData(data) {
        if (!(data instanceof Uint8Array)) {
            throw new Error('Data must be Uint8Array');
        }
        if (data.length !== this.size) {
            throw new Error(`Data size mismatch: expected ${this.size}, got ${data.length}`);
        }
        this.renderer.updateBufferData(this.bufferId, data);
        this.dirty = true;
    }
}

export class Texture {
    /**
     * 
     * @param {Renderer} renderer 
     * @param {SharedBuffer} bufferId - already created buffer SharedBuffer.bufferId 
     * @param {number} width 
     * @param {number} height 
     */
    constructor(renderer, bufferId, width, height) {
        this.renderer = renderer;
        this.textureId = renderer.loadTextureFromBuffer(bufferId, width, height);
        this.width = width;
        this.height = height;
        this.bufferId = bufferId
    }

    /**
     * coordinates
     * @param {number} x 
     * @param {number} y 
     */
    draw(x, y) {
        this.renderer.drawTexture(this.textureId, x, y);
    }

    /**
     * draw texture with custom size and offset
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     */
    drawTexturePro(x, y, width, height) {
        this.renderer.drawTextureSized(this.textureId, x, y, width, height);
    }


    /**
     * draw texture with custom size and offset with custom tint
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {{r: number, g: number, b: number, a: number}} rgba
     */
    drawTexturePro(x, y, width, height, rgba) {

        this.renderer.drawTextureSized(this.textureId, x, y, width, height, rgba);
    }



    /**
     * 
     * @description delete texture
     */
    unload() {
        this.renderer.unloadTexture(this.textureId);
    }

    /**
     * 
     * @description update texture with given buffer
     */
    update() {
        if (!this.renderer.isBufferDirty(this.bufferId)) {

            return
        }

        this.renderer.updateTextureFromBuffer(this.textureId, this.bufferId);
    }
}


/**
 * Like Web Canvas?  a way to put pixels in a buffer and screen
 */
// export class PixelCanvas {
//     /**
//      * 
//      * @param {Renderer} renderer 
//      * @param {number} width 
//      * @param {number} height 
//      */
//     constructor(renderer, width, height) {
//         this.renderer = renderer;
//         this.width = width;
//         this.height = height;

//         this.bufferSize = width * height * 4;
//         this.sharedBuffer = new SharedBuffer(renderer, this.bufferSize);
//         this.texture = new Texture(renderer, this.sharedBuffer.bufferId, width, height);


//         this.pixelData = this.sharedBuffer.getData();

//         this.clear();
//     }

//     clear() {
//         for (let i = 0; i < this.pixelData.length; i += 4) {
//             this.pixelData[i] = 0;     // R
//             this.pixelData[i + 1] = 0; // G
//             this.pixelData[i + 2] = 0; // B  
//             this.pixelData[i + 3] = 0; // A (0 = transparent)
//         }
//         this.sharedBuffer.markDirty();
//     }

//     setPixel(x, y, r, g, b, a = 255) {
//         if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
//             return;
//         }

//         const index = (y * this.width + x) * 4;
//         this.pixelData[index] = r;
//         this.pixelData[index + 1] = g;
//         this.pixelData[index + 2] = b;
//         this.pixelData[index + 3] = a;

//         this.sharedBuffer.markDirty();
//     }

//     getPixel(x, y) {
//         if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
//             return null;
//         }

//         const index = (y * this.width + x) * 4;
//         return {
//             r: this.pixelData[index],
//             g: this.pixelData[index + 1],
//             b: this.pixelData[index + 2],
//             a: this.pixelData[index + 3]
//         };
//     }

//     update() {
//         if (!this.sharedBuffer.isDirty()) {
//             // console.log("buffer not dirty")
//             return;
//         }
//         this.sharedBuffer.updateData(this.pixelData)
//         this.texture.update();
//     }

//     draw(x, y) {
//         this.texture.draw(x, y);
//     }

//     // color utils
//     setPixelColor(x, y, color) {
//         this.setPixel(x, y, color.r, color.g, color.b, color.a);
//     }


//     fillColor(r, g, b, a = 255) {
//         for (let i = 0; i < this.pixelData.length; i += 4) {
//             this.pixelData[i] = r;
//             this.pixelData[i + 1] = g;
//             this.pixelData[i + 2] = b;
//             this.pixelData[i + 3] = a;
//         }

//         this.sharedBuffer.markDirty();
//     }


//     fillGradient(color1, color2, direction = 'horizontal') {
//         for (let y = 0; y < this.height; y++) {
//             for (let x = 0; x < this.width; x++) {
//                 let t;
//                 if (direction === 'horizontal') {
//                     t = x / this.width;
//                 } else {
//                     t = y / this.height;
//                 }

//                 const r = Math.floor(color1.r + (color2.r - color1.r) * t);
//                 const g = Math.floor(color1.g + (color2.g - color1.g) * t);
//                 const b = Math.floor(color1.b + (color2.b - color1.b) * t);
//                 const a = Math.floor(color1.a + (color2.a - color1.a) * t);

//                 this.setPixel(x, y, r, g, b, a);
//             }
//         }
//         this.sharedBuffer.markDirty();
//     }

// }


export class CoordinateSystem {
    constructor(canvasX, canvasY, canvasWidth, canvasHeight) {
        this.canvasX = canvasX;
        this.canvasY = canvasY;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.scale = 1.0;
    }

    screenToCanvas(screenX, screenY) {
        return {
            x: Math.floor((screenX - this.canvasX) / this.scale),
            y: Math.floor((screenY - this.canvasY) / this.scale)
        };
    }

    canvasToScreen(canvasX, canvasY) {
        return {
            x: Math.floor(canvasX * this.scale + this.canvasX),
            y: Math.floor(canvasY * this.scale + this.canvasY)
        };
    }

    isPointInCanvas(screenX, screenY) {
        const canvasPos = this.screenToCanvas(screenX, screenY);
        return canvasPos.x >= 0 && canvasPos.x < this.canvasWidth &&
            canvasPos.y >= 0 && canvasPos.y < this.canvasHeight;
    }

    setScale(newScale) {
        this.scale = Math.max(0.1, Math.min(5.0, newScale));
    }
}

export class DrawingTools {

    constructor(canvas) {
        /**
         * @type {PixelCanvas}
         */
        this.canvas = canvas;
    }

    // bresenham's line algorithm
    drawLine(x0, y0, x1, y1, color) {
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;

        while (true) {
            this.canvas.setPixelColor(x0, y0, color);

            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
        this.canvas.sharedBuffer.markDirty();
    }

    // Draw rectangle - two approaches
    drawRectangle(x, y, width, height, color, filled = true) {
        if (filled) {
            for (let py = y; py < y + height; py++) {
                for (let px = x; px < x + width; px++) {
                    this.canvas.setPixelColor(px, py, color);
                }
            }
        } else {
            // Outline only
            this.drawLine(x, y, x + width, y, color);
            this.drawLine(x + width, y, x + width, y + height, color);
            this.drawLine(x + width, y + height, x, y + height, color);
            this.drawLine(x, y + height, x, y, color);
        }
        this.canvas.sharedBuffer.markDirty();
    }

    // Circle using midpoint circle algorithm
    drawCircle(centerX, centerY, radius, color, filled = true) {
        let x = radius;
        let y = 0;
        let err = 0;

        while (x >= y) {
            if (filled) {
                this.drawLine(centerX - x, centerY + y, centerX + x, centerY + y, color);
                this.drawLine(centerX - x, centerY - y, centerX + x, centerY - y, color);
                this.drawLine(centerX - y, centerY + x, centerX + y, centerY + x, color);
                this.drawLine(centerX - y, centerY - x, centerX + y, centerY - x, color);
            } else {
                // Just the perimeter points
                this.canvas.setPixelColor(centerX + x, centerY + y, color);
                this.canvas.setPixelColor(centerX + y, centerY + x, color);
                this.canvas.setPixelColor(centerX - y, centerY + x, color);
                this.canvas.setPixelColor(centerX - x, centerY + y, color);
                this.canvas.setPixelColor(centerX - x, centerY - y, color);
                this.canvas.setPixelColor(centerX - y, centerY - x, color);
                this.canvas.setPixelColor(centerX + y, centerY - x, color);
                this.canvas.setPixelColor(centerX + x, centerY - y, color);
            }

            y += 1;
            err += 1 + 2 * y;
            if (2 * (err - x) + 1 > 0) {
                x -= 1;
                err += 1 - 2 * x;
            }
        }
        this.canvas.sharedBuffer.markDirty();
    }
}




export class ColorTheory {
    static RGBtoHSV(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        let h = 0, s = 0, v = max;

        if (delta !== 0) {
            s = delta / max;
            if (r === max) h = (g - b) / delta;
            else if (g === max) h = 2 + (b - r) / delta;
            else h = 4 + (r - g) / delta;

            h *= 60;
            if (h < 0) h += 360;
        }

        return { h, s: s * 100, v: v * 100 };
    }

    static HSVtoRGB(h, s, v) {
        s /= 100; v /= 100;
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;

        let r, g, b;
        if (h >= 0 && h < 60) [r, g, b] = [c, x, 0];
        else if (h < 120) [r, g, b] = [x, c, 0];
        else if (h < 180) [r, g, b] = [0, c, x];
        else if (h < 240) [r, g, b] = [0, x, c];
        else if (h < 300) [r, g, b] = [x, 0, c];
        else[r, g, b] = [c, 0, x];

        return {
            r: Math.floor((r + m) * 255),
            g: Math.floor((g + m) * 255),
            b: Math.floor((b + m) * 255)
        };
    }


    static complementary(color) {
        const hsv = this.RGBtoHSV(color.r, color.g, color.b);
        hsv.h = (hsv.h + 180) % 360;
        return this.HSVtoRGB(hsv.h, hsv.s, hsv.v);
    }

    static analogous(color, spread = 30) {
        const hsv = this.RGBtoHSV(color.r, color.g, color.b);
        return [
            this.HSVtoRGB((hsv.h - spread + 360) % 360, hsv.s, hsv.v),
            color,
            this.HSVtoRGB((hsv.h + spread) % 360, hsv.s, hsv.v)
        ];
    }
}



export class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.frameTimes = [];
        this.samples = 60; // Keep last 60 frames
    }
    
    start(name) {
        this.metrics.set(name, {
            start: performance.now(),
            calls: (this.metrics.get(name)?.calls || 0) + 1
        });
    }
    
    end(name) {
        const metric = this.metrics.get(name);
        if (metric) {
            const duration = performance.now() - metric.start;
            metric.total = (metric.total || 0) + duration;
            metric.max = Math.max(metric.max || 0, duration);
            metric.min = Math.min(metric.min || Infinity, duration);
        }
    }
    
    recordFrameTime(startTime) {
        const frameTime = performance.now() - startTime;
        this.frameTimes.push(frameTime);
        if (this.frameTimes.length > this.samples) {
            this.frameTimes.shift();
        }
    }
    
    logMetrics() {
        console.log('Performance Report:');
        for (const [name, metric] of this.metrics) {
            const avg = metric.total / metric.calls;
            console.log(`  ${name}: ${avg.toFixed(2)}ms avg (${metric.min.toFixed(2)}-${metric.max.toFixed(2)}ms)`);
        }
        
        const avgFrameTime = this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length;
        console.log(`  Frame Time: ${avgFrameTime.toFixed(2)}ms (${(1000/avgFrameTime).toFixed(1)} FPS)`);
    }
}




/**
 * Normalizes RGB(A) color components to the range of 0.0 to 1.0.
 * 
 * @param {number} r The red component (0-255).
 * @param {number} g The green component (0-255).
 * @param {number} b The blue component (0-255).
 * @param {number} [a] The optional alpha component (0.0-1.0).
 * @returns {{r: number, g: number, b: number, a?: number}} An object with normalized values.
 */
export function normalizeRGBA(r, g, b, a) {
  const normalized = {
    r: r / 255.0,
    g: g / 255.0,
    b: b / 255.0
  };

  // If the 'a' parameter is provided, add the alpha channel (which is already 0.0-1.0 in standard usage)
  if (typeof a !== 'undefined' && a !== null) {
    normalized.a = a/255;
  }

  return normalized;
}
