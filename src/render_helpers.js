

import { PixelBuffer } from './canvas/pixel_buffer.js';
import { CTRL_DIRTY_FLAG, CTRL_DIRTY_COUNT, CTRL_DIRTY_REGIONS, MAX_DIRTY_REGIONS } from './buffer_constants.js';





// new zero copy control bufer tracker 

export class DirtyRegionTracker {
    constructor(controlBuffer) {
        // controlBuffer is the Uint32Array pixel_buffer passed to C++
        this.control = controlBuffer;
        this.maxRegions = 256;
    }

    addRegion(x, y, w, h) {
        const count = Atomics.load(this.control, CTRL_DIRTY_COUNT); // CTRL_DIRTY_COUNT offset

        if (count >= this.maxRegions) {
            this.control[CTRL_DIRTY_REGIONS + 0] = 0;
            this.control[CTRL_DIRTY_REGIONS + 1] = 0;
            this.control[CTRL_DIRTY_REGIONS + 2] = 9999;
            this.control[CTRL_DIRTY_REGIONS + 3] = 9999;
            Atomics.store(this.control, CTRL_DIRTY_COUNT, 1);
            return
        }

        const offset = 5 + (count * 4);
        this.control[offset + 0] = x | 0;  // Ensure u32
        this.control[offset + 1] = y | 0;
        this.control[offset + 2] = w | 0;
        this.control[offset + 3] = h | 0;

        // Increment count
        Atomics.store(this.control, CTRL_DIRTY_COUNT, count + 1);
    }

    markDirty() {
        Atomics.store(this.control, CTRL_DIRTY_FLAG, 1);  // CTRL_DIRTY_FLAG
    }

    clear() {
        Atomics.store(this.control, CTRL_DIRTY_COUNT, 0);
    }

    optimize() {
        const count = Atomics.load(this.control, CTRL_DIRTY_COUNT);
        if (count <= 1) return;

        // Simple optimization: merge regions that overlap
        let writeIdx = 0;
        for (let i = 0; i < count; i++) {
            const offset = 5 + (i * 4);
            let x = this.control[offset + 0];
            let y = this.control[offset + 1];
            let w = this.control[offset + 2];
            let h = this.control[offset + 3];

            // Check if this region overlaps with any previous
            let merged = false;
            for (let j = 0; j < writeIdx; j++) {
                const prevOffset = 5 + (j * 4);
                const px = this.control[prevOffset + 0];
                const py = this.control[prevOffset + 1];
                const pw = this.control[prevOffset + 2];
                const ph = this.control[prevOffset + 3];

                // Check overlap
                if (!(x > px + pw || x + w < px || y > py + ph || y + h < py)) {
                    // Merge: expand previous region to contain both
                    const minX = Math.min(px, x);
                    const minY = Math.min(py, y);
                    const maxX = Math.max(px + pw, x + w);
                    const maxY = Math.max(py + ph, y + h);

                    this.control[prevOffset + 0] = minX;
                    this.control[prevOffset + 1] = minY;
                    this.control[prevOffset + 2] = maxX - minX;
                    this.control[prevOffset + 3] = maxY - minY;

                    merged = true;
                    break;
                }
            }

            if (!merged) {
                // Copy region to write position
                if (writeIdx !== i) {
                    const writeOffset = 5 + (writeIdx * 4);
                    this.control[writeOffset + 0] = x;
                    this.control[writeOffset + 1] = y;
                    this.control[writeOffset + 2] = w;
                    this.control[writeOffset + 3] = h;
                }
                writeIdx++;
            }
        }

        Atomics.store(this.control, CTRL_DIRTY_COUNT, writeIdx);
    }

}


export class BatchedDirtyTracker extends DirtyRegionTracker {
    constructor(controlBuffer) {
        super(controlBuffer);
        this.pendingFlush = false;
    }

    addRegion(x, y, w, h) {
        super.addRegion(x, y, w, h);

        // schedule flush if not already scheduled
        if (!this.pendingFlush) {
            this.pendingFlush = true;
            queueMicrotask(() => this.flush());
        }
    }

    flush() {
        this.pendingFlush = false;
        this.optimize();
        this.markDirty();
    }
}



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
        console.log(`  Frame Time: ${avgFrameTime.toFixed(2)}ms (${(1000 / avgFrameTime).toFixed(1)} FPS)`);
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
        normalized.a = a / 255;
    }

    return normalized;
}



// /**
//  * 
//  * @param {{data: Uint8Array, width: number, height: number}} img 
//  * @param {} canvas 
//  */
// export function imageToCanvasNN(img, canvas) {
//     const tracker = new DirtyRegionTracker(canvas)
//     const cdata = canvas.data;
//     const idata = img.data;
//     const srcWidth = img.width;
//     const srcHeight = img.height;
//     const destWidth = canvas.width
//     const destHeight = canvas.height
//     const scaleX = srcWidth / destWidth;
//     const scaleY = srcHeight / destHeight;

//     for (let y = 0; y < destHeight; y++) {
//         for (let x = 0; x < destWidth; x++) {
//             const srcX = Math.min(Math.floor(x * scaleX), srcWidth - 1);
//             const srcY = Math.min(Math.floor(y * scaleY), srcHeight - 1);
//             const idxSrc = (srcY * srcWidth + srcX) * 4;
//             const idxDest = (y * destWidth + x) * 4;

//             cdata[idxDest] = idata[idxSrc];
//             cdata[idxDest + 1] = idata[idxSrc + 1];
//             cdata[idxDest + 2] = idata[idxSrc + 2];
//             cdata[idxDest + 3] = idata[idxSrc + 3];
//         }
//     }

//     tracker.markRect(0, 0, canvas.width, canvas.height);
//     tracker.flush();
//     canvas.upload();
// }


/**
 * @param {PixelBuffer} canvas
 * @param {{data: Uint8Array, width: number, height: number}} img 
 * @param {{data: Uint8Array, width: number, height: number}} canvas 
 * @param {"bilinear" | "nn"} algorithm - The resizing algorithm: 'bilinear' for bilinear interpolation or 'nn' for nearest neighbor. Defaults to 'bi'.
 * @param {number} destWidth - The destination width. Defaults to canvas.width.
 * @param {number} destHeight - The destination height. Defaults to canvas.height.
 */
export function imageToCanvas(img, canvas, algorithm = 'bilinear', destWidth = canvas.width, destHeight = canvas.height) {
    const tracker = canvas.dirtyTracker
    const cdata = canvas.data;
    const idata = img.data;
    const srcWidth = img.width;
    const srcHeight = img.height;
    const scaleX = srcWidth / destWidth;
    const scaleY = srcHeight / destHeight;

    for (let y = 0; y < destHeight; y++) {
        for (let x = 0; x < destWidth; x++) {
            const idxDest = (y * destWidth + x) * 4;

            if (algorithm === 'nn') {

                const srcX = Math.floor((x + 0.5) * scaleX);
                const srcY = Math.floor((y + 0.5) * scaleY);
                const clampedX = Math.max(0, Math.min(srcX, srcWidth - 1));
                const clampedY = Math.max(0, Math.min(srcY, srcHeight - 1));
                for (let c = 0; c < 4; c++) {
                    cdata[idxDest + c] = idata[(clampedY * srcWidth + clampedX) * 4 + c];
                }
            } else {

                const srcX = (x + 0.5) * scaleX - 0.5;
                const srcY = (y + 0.5) * scaleY - 0.5;
                const x1 = Math.floor(srcX);
                const y1 = Math.floor(srcY);
                const x2 = Math.min(x1 + 1, srcWidth - 1);
                const y2 = Math.min(y1 + 1, srcHeight - 1);
                const dx = srcX - x1;
                const dy = srcY - y1;

                for (let c = 0; c < 4; c++) {
                    const p11 = idata[(y1 * srcWidth + x1) * 4 + c];
                    const p12 = idata[(y1 * srcWidth + x2) * 4 + c];
                    const p21 = idata[(y2 * srcWidth + x1) * 4 + c];
                    const p22 = idata[(y2 * srcWidth + x2) * 4 + c];
                    const interpX1 = p11 * (1 - dx) + p12 * dx;
                    const interpX2 = p21 * (1 - dx) + p22 * dx;
                    const interp = interpX1 * (1 - dy) + interpX2 * dy;
                    cdata[idxDest + c] = Math.round(interp);
                }
            }
        }
    }
    // writing to real canvas not cache
    if (tracker) {
        tracker.addRegion(0, 0, destWidth, destHeight);
        canvas.needsUpload = true
    }

    // tracker.flush();
    // canvas.upload();
}


/**
 * @param {PixelBuffer} canvas
 * @param {{data: Uint8Array, width: number, height: number}} atlas 
 * @param {{x: number, y: number, width: number, height: number}} srcRect 
 * @param {{data: Uint8Array, width: number, height: number}} canvas 
 * @param {{x: number, y: number, width: number, height: number}} destRect 
 * @param {"bilinear" | "nn"} algorithm - The resizing algorithm: 'bi' for bilinear interpolation or 'nn' for nearest neighbor. Defaults to 'bi'.
 */
export function drawAtlasRegionToCanvas(atlas, srcRect, canvas, destRect, algorithm = 'bilinear') {
    const tracker = canvas.dirtyTracker
    const cdata = canvas.data;
    const adata = atlas.data;
    const atlasWidth = atlas.width;
    const srcWidth = srcRect.width;
    const srcHeight = srcRect.height;
    const destWidth = destRect.width;
    const destHeight = destRect.height;
    const scaleX = srcWidth / destWidth;
    const scaleY = srcHeight / destHeight;

    for (let dy = 0; dy < destHeight; dy++) {
        for (let dx = 0; dx < destWidth; dx++) {
            const idxDest = ((dy + destRect.y) * canvas.width + (dx + destRect.x)) * 4;

            if (algorithm === 'nn') {
                // Nearest neighbor interpolation
                const srcX = srcRect.x + Math.floor((dx + 0.5) * scaleX);
                const srcY = srcRect.y + Math.floor((dy + 0.5) * scaleY);
                const clampedX = Math.max(srcRect.x, Math.min(srcX, srcRect.x + srcWidth - 1));
                const clampedY = Math.max(srcRect.y, Math.min(srcY, srcRect.y + srcHeight - 1));
                for (let c = 0; c < 4; c++) { // RGBA channels
                    cdata[idxDest + c] = adata[(clampedY * atlasWidth + clampedX) * 4 + c];
                }
            } else {
                // Bilinear interpolation (default)
                const srcX = srcRect.x + (dx + 0.5) * scaleX - 0.5;
                const srcY = srcRect.y + (dy + 0.5) * scaleY - 0.5;
                const x1 = Math.floor(srcX);
                const y1 = Math.floor(srcY);
                const x2 = Math.min(x1 + 1, atlasWidth - 1);
                const y2 = Math.min(y1 + 1, atlas.height - 1);
                const dxFrac = srcX - x1;
                const dyFrac = srcY - y1;

                for (let c = 0; c < 4; c++) { // RGBA channels
                    const p11 = adata[(y1 * atlasWidth + x1) * 4 + c];
                    const p12 = adata[(y1 * atlasWidth + x2) * 4 + c];
                    const p21 = adata[(y2 * atlasWidth + x1) * 4 + c];
                    const p22 = adata[(y2 * atlasWidth + x2) * 4 + c];
                    const interpX1 = p11 * (1 - dxFrac) + p12 * dxFrac;
                    const interpX2 = p21 * (1 - dxFrac) + p22 * dxFrac;
                    const interp = interpX1 * (1 - dyFrac) + interpX2 * dyFrac;
                    cdata[idxDest + c] = Math.round(interp);
                }
            }
        }
    }

    if (tracker) {
        tracker.addRegion(destRect.x, destRect.y, destRect.width, destRect.height);
        canvas.needsUpload = true
    }



    // tracker.flush();
    // canvas.upload();
}


/**
 * utility for spritesheet to frames
 * @param {number} rows 
 * @param {number} cols 
 * @param {number} startX 
 * @param {number} startY 
 * @param {number} tileSize 
 * @returns {Array<{offset: {x: number, y: number}>}
 */
export function genFrames(rows, cols, startX, startY, tileSize) {
    const frames = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            frames.push({ offset: { x: startX + c * tileSize, y: startY + r * tileSize } });
        }
    }
    return frames;
}
