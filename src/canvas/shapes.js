import { Camera } from "../camera/index.js";
import { LineDrawer } from "./bresenham.js";
import { PixelBuffer } from "./pixel_buffer.js";
import { clampRectToCanvas, shouldDrawPixel } from "./utils.js";



export class ShapeDrawer {
    /**
     * Fill a rectangle - optimized scanline approach
      * This is the fastest primitive 
     * @param {PixelBuffer} canvas 
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {number} r 
     * @param {number} g 
     * @param {number} b 
     * @param {number} a 
     * @param {Camera}
     * @returns 
     */
    static fillRect(canvas, x, y, width, height, r, g, b, a = 255, camera = undefined) {
        // const startTime = performance.now();
        const clamped = clampRectToCanvas(x, y, width, height, canvas.width, canvas.height);
        if (!clamped) return { pixels: 0 };
        // Clamp to canvas bounds - CRITICAL for safety!
        // const x1 = Math.max(0, Math.floor(x));
        // const y1 = Math.max(0, Math.floor(y));
        // const x2 = Math.min(canvas.width, Math.ceil(x + width));
        // const y2 = Math.min(canvas.height, Math.ceil(y + height));

        let { x: x1, y: y1, width: actualWidth, height: actualHeight } = clamped;

        // const actualWidth = x2 - x1;
        // const actualHeight = y2 - y1;

        // if (actualWidth <= 0 || actualHeight <= 0) {
        //     return { pixels: 0, time: 0 }; // Nothing to draw
        // }


        const data = canvas.data;
        const bufferWidth = canvas.width;
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        // Write scanlines
        let pixelsDrawn = 0;
        for (let py = y1; py < y1 + actualHeight; py++) {
            for (let px = x1; px < x1 + actualWidth; px++) {
                if (!shouldDrawPixel(px, py, canvas, camera)) continue;

                const idx = (py * bufferWidth + px) * 4;
                data[idx + 0] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
                pixelsDrawn++;

                minX = Math.min(minX, px);
                minY = Math.min(minY, py);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
            }
        }

        if (pixelsDrawn === 0) return { pixels: 0 };

        // const regionWidth = maxX - minX + 1;
        // const regionHeight = maxY - minY + 1;
        // const regionData = ShapeDrawer._extractRegion(
        //     data, bufferWidth, minX, minY, regionWidth, regionHeight
        // );

        // canvas.renderer.updateBufferData(
        //     canvas.bufferId,
        //     regionData,
        //     minX, minY,
        //     regionWidth, regionHeight
        // );

        canvas.needsUpload = true;

        // return { pixels: pixelsDrawn };
        // const elapsed = performance.now() - startTime;
        // return { pixels: pixelsDrawn, time: elapsed };

    }

    /**
     *      * Stroke a rectangle outline
         * Draws 4 lines - could be optimized further but this is clear
     * @param {PixelBuffer} canvas 
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {number} thickness 
     * @param {number} r 
     * @param {number} g 
     * @param {number} b 
     * @param {number} a 
     * @param {Camera}
     * @returns 
     */
    static strokeRect(canvas, x, y, width, height, thickness, r, g, b, a = 255, camera = undefined) {
        // const startTime = performance.now();

        x = Math.floor(x);
        y = Math.floor(y);
        width = Math.ceil(width)
        height = Math.ceil(height)

        thickness = Math.max(1, Math.floor(thickness));

        // Top edge
        LineDrawer.drawThickLine(canvas, x, y, x + width, y, thickness, r, g, b, a, camera);
        // Right edge  
        LineDrawer.drawThickLine(canvas, x + width, y, x + width, y + height, thickness, r, g, b, a, camera);
        // Bottom edge
        LineDrawer.drawThickLine(canvas, x + width, y + height, x, y + height, thickness, r, g, b, a, camera);
        // Left edge
        LineDrawer.drawThickLine(canvas, x, y + height, x, y, thickness, r, g, b, a, camera);

        // const elapsed = performance.now() - startTime;
        // return { time: elapsed };
    }

    /**
     * Fill a circle using midpoint algorithm with scanline filling
     * This is THE way to draw filled circles efficiently
     * @param {PixelBuffer} canvas 
     * @param {number} cx 
     * @param {number} cy 
     * @param {number} radius 
     * @param {number} r 
     * @param {number} g 
     * @param {number} b 
     * @param {number} a 
     * @param {Camera}
     * @returns 
     */
    static fillCircle(canvas, cx, cy, radius, r, g, b, a = 255, camera = undefined) {
        // const startTime = performance.now();

        // Convert to integers and validate
        const x = Math.floor(cx);
        const y = Math.floor(cy);
        const rad = Math.floor(radius);

        if (rad <= 0) return { pixels: 0, time: 0 };


        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;


        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;

        // Midpoint circle algorithm - calculate horizontal spans
        let px = rad;
        let py = 0;
        let d = 1 - rad;  // Decision parameter

        let pixelsDrawn = 0;

        // Helper to draw horizontal span - this is the key optimization!
        const drawSpan = (y, x1, x2) => {
            for (let px = x1; px <= x2; px++) {
                if (!shouldDrawPixel(px, y, canvas, camera)) continue;

                const idx = (y * width + px) * 4;
                data[idx + 0] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
                pixelsDrawn++;

                minX = Math.min(minX, px);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, y);
            }
        };

        // Special case: initial horizontal spans
        drawSpan(y, x - px, x + px);  // Middle horizontal

        // Main circle algorithm loop
        while (px > py) {
            py++;

            // Update decision parameter
            if (d < 0) {
                d += 2 * py + 1;
            } else {
                px--;
                d += 2 * (py - px) + 1;
            }

            // Draw 4 horizontal spans (using 8-way symmetry)
            // Top half
            drawSpan(y + py, x - px, x + px);  // Octants 1 & 4
            drawSpan(y + px, x - py, x + py);  // Octants 2 & 3

            // Bottom half  
            drawSpan(y - py, x - px, x + px);  // Octants 5 & 8
            drawSpan(y - px, x - py, x + py);  // Octants 6 & 7
        }

        if (pixelsDrawn === 0) return { pixels: 0 };
        // const regionWidth = maxX - minX + 1;
        // const regionHeight = maxY - minY + 1;
        // const regionData = ShapeDrawer._extractRegion(
        //     data, width, minX, minY, regionWidth, regionHeight
        // );

        // canvas.renderer.updateBufferData(
        //     canvas.bufferId,
        //     regionData,
        //     minX, minY,
        //     regionWidth, regionHeight
        // );

        canvas.needsUpload = true;

        // const elapsed = performance.now() - startTime;
        // return { pixels: pixelsDrawn, time: elapsed, radius: rad };
    }

    /**
     * Stroke a circle outline using midpoint algorithm
     * Draws the circle perimeter without filling
     * @param {PixelBuffer} canvas 
     * @param {number} cx 
     * @param {number} cy 
     * @param {number} radius 
     * @param {number} thickness 
     * @param {number} r 
     * @param {number} g 
     * @param {number} b 
     * @param {number} a 
     * @param {Camera}
     * @returns 
     */
    static strokeCircle(canvas, cx, cy, radius, thickness, r, g, b, a = 255, camera = undefined) {
        // const startTime = performance.now();

        const x = Math.floor(cx);
        const y = Math.floor(cy);
        const rad = Math.floor(radius);

        if (rad <= 0) return { pixels: 0, time: 0 };

        // For thick strokes, draw filled circles with inner cutout
        if (thickness > 1) {
            return ShapeDrawer._strokeCircleThick(canvas, x, y, rad, thickness, r, g, b, a);
        }

        // Thin stroke: just the perimeter points
        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        let px = rad;
        let py = 0;
        let d = 1 - rad;

        let pixelsDrawn = 0;

        const setPixelSafe = (x, y) => {
            if (!shouldDrawPixel(x, y, canvas, camera)) return;

            const idx = (y * width + x) * 4;
            data[idx + 0] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
            pixelsDrawn++;

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        };

        // 8-way symmetry for perimeter - only draw outline
        while (px >= py) {
            setPixelSafe(x + px, y + py);
            setPixelSafe(x + py, y + px);
            setPixelSafe(x - px, y + py);
            setPixelSafe(x - py, y + px);
            setPixelSafe(x - px, y - py);
            setPixelSafe(x - py, y - px);
            setPixelSafe(x + px, y - py);
            setPixelSafe(x + py, y - px);

            py++;

            if (d < 0) {
                d += 2 * py + 1;
            } else {
                px--;
                d += 2 * (py - px) + 1;
            }
        }


        if (pixelsDrawn === 0) return { pixels: 0 };

        // const regionWidth = maxX - minX + 1;
        // const regionHeight = maxY - minY + 1;
        // const regionData = ShapeDrawer._extractRegion(
        //     data, width, minX, minY, regionWidth, regionHeight
        // );

        // canvas.renderer.updateBufferData(
        //     canvas.bufferId,
        //     regionData,
        //     minX, minY,
        //     regionWidth, regionHeight
        // );

        canvas.needsUpload = true;

        // const elapsed = performance.now() - startTime;
        // return { pixels: pixelsDrawn, time: elapsed };
    }

    /**
     * Thick circle stroke - draw outer circle, cut out inner circle
     */
    static _strokeCircleThick(canvas, cx, cy, radius, thickness, r, g, b, a, camera) {
        const outerRad = radius;
        const innerRad = Math.max(0, radius - thickness);

        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        let pixelsDrawn = 0;

        const outerRadSq = outerRad * outerRad;
        const innerRadSq = innerRad * innerRad;

        const checkMinX = Math.max(0, cx - outerRad);
        const checkMinY = Math.max(0, cy - outerRad);
        const checkMaxX = Math.min(width - 1, cx + outerRad);
        const checkMaxY = Math.min(height - 1, cy + outerRad);

        for (let py = checkMinY; py <= checkMaxY; py++) {
            for (let px = checkMinX; px <= checkMaxX; px++) {
                const dx = px - cx;
                const dy = py - cy;
                const distSq = dx * dx + dy * dy;

                if (distSq <= outerRadSq && distSq >= innerRadSq) {
                    if (!shouldDrawPixel(px, py, canvas, camera)) continue;

                    const idx = (py * width + px) * 4;
                    data[idx + 0] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = a;
                    pixelsDrawn++;

                    minX = Math.min(minX, px);
                    minY = Math.min(minY, py);
                    maxX = Math.max(maxX, px);
                    maxY = Math.max(maxY, py);
                }
            }
        }

        if (pixelsDrawn === 0) return { pixels: 0 };

        // const regionWidth = maxX - minX + 1;
        // const regionHeight = maxY - minY + 1;
        // const regionData = ShapeDrawer._extractRegion(
        //     data, width, minX, minY, regionWidth, regionHeight
        // );

        // canvas.renderer.updateBufferData(
        //     canvas.bufferId,
        //     regionData,
        //     minX, minY,
        //     regionWidth, regionHeight
        // );

        canvas.needsUpload = true;

        // return { pixels: pixelsDrawn };
    }


    /**
     * Extract rectangular region from buffer
     */
    // static _extractRegion(data, bufferWidth, x, y, width, height) {
    //     const region = new Uint8Array(width * height * 4);

    //     for (let row = 0; row < height; row++) {
    //         const srcOffset = ((y + row) * bufferWidth + x) * 4;
    //         const dstOffset = row * width * 4;
    //         const rowBytes = width * 4;

    //         region.set(
    //             data.subarray(srcOffset, srcOffset + rowBytes),
    //             dstOffset
    //         );
    //     }

    //     return region;
    // }
}