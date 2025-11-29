import { PixelBuffer } from "./pixel_buffer.js";
import { shouldDrawPixel } from "./utils.js";

import { Camera } from "../camera/index.js"


export class LineDrawer {
    /**
     *   * Draw a line using Bresenham's algorithm
     * @param {PixelBuffer} canvas 
     * @param {*} x1 
     * @param {*} y1 
     * @param {*} x2 
     * @param {*} y2 
     * @param {*} r 
     * @param {*} g 
     * @param {*} b 
     * @param {*} a 
     * @param {Camera}
     * @returns 
     */
    static drawLine(canvas, x1, y1, x2, y2, r, g, b, a = 255, camera = undefined) {
        const startTime = performance.now();

        // Convert to integers
        x1 = Math.floor(x1); y1 = Math.floor(y1);
        x2 = Math.floor(x2); y2 = Math.floor(y2);

        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;  // Step direction for x
        const sy = y1 < y2 ? 1 : -1;  // Step direction for y

        let err = dx - dy;  // Initial error term
        let x = x1;
        let y = y1;


        // Track actual drawn region
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        // Direct buffer access for performance
        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;

        let pixelCount = 0;

        // Bresenham's main loop - all integer operations
        while (true) {
            // Draw current pixel if within bounds
            if (shouldDrawPixel(x, y, canvas, camera)) {
                const idx = (y * width + x) * 4;
                data[idx + 0] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
                pixelCount++;

                // Track bounds
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }

            // Reached end point?
            if (x === x2 && y === y2) break;

            // Calculate error for next step
            const e2 = err * 2;

            // Step horizontally?
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }

            // Step vertically?
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        if (pixelCount === 0) {
            return { pixels: 0, time: 0, regionSize: 0 };
        }

        // Extract and update only the affected region
        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;
        const regionData = LineDrawer._extractRegion(
            data, width, minX, minY, regionWidth, regionHeight
        );

        canvas.renderer.updateBufferData(
            canvas.bufferId,
            regionData,
            minX, minY,
            regionWidth, regionHeight
        );

        canvas.needsUpload = true;

        const elapsed = performance.now() - startTime;
        return {
            pixels: pixelCount,
            time: elapsed,
            regionSize: regionWidth * regionHeight
        };
    }

    /**
     *   Draw thick line using circular brush - pre-calculate brush stamp, stamp along line path
     * @param {*} canvas 
     * @param {*} x1 
     * @param {*} y1 
     * @param {*} x2 
     * @param {*} y2 
     * @param {*} thickness 
     * @param {*} r 
     * @param {*} g 
     * @param {*} b 
     * @param {*} a 
     * @param {Camera}
     * @returns 
     */
    static drawThickLine(canvas, x1, y1, x2, y2, thickness, r, g, b, a = 255, camera = undefined) {
        x1 = Math.floor(x1); y1 = Math.floor(y1);
        x2 = Math.floor(x2); y2 = Math.floor(y2);
        thickness = Math.max(1, Math.floor(thickness));
        const startTime = performance.now();

        // Create circular brush stamp (once per thickness)
        const radius = Math.ceil(thickness / 2);
        const brushStamp = LineDrawer._createBrushStamp(radius, r, g, b, a);

        // Calculate extended bounding box (includes brush radius)
        // const minX = Math.max(0, Math.min(x1, x2) - radius);
        // const minY = Math.max(0, Math.min(y1, y2) - radius);
        // const maxX = Math.min(canvas.width - 1, Math.max(x1, x2) + radius);
        // const maxY = Math.min(canvas.height - 1, Math.max(y1, y2) + radius);



        // Get all points along the line using Bresenham
        const points = LineDrawer._bresenhamPoints(x1, y1, x2, y2);

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        // Direct buffer manipulation for performance
        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;

        // Stamp brush at each point along the line
        let pixelsDrawn = 0;
        for (const { x, y } of points) {
            const result = LineDrawer._stampBrush(
                data, width, height,
                x, y, radius, brushStamp,
                camera
            );

            pixelsDrawn += result.pixels;

            if (result.pixels > 0) {
                minX = Math.min(minX, result.minX);
                minY = Math.min(minY, result.minY);
                maxX = Math.max(maxX, result.maxX);
                maxY = Math.max(maxY, result.maxY);
            }
        }

        if (pixelsDrawn === 0) {
            return { pixels: 0, linePoints: points.length, regionSize: 0 };
        }

        // Extract and update the affected region
        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;
        const regionData = LineDrawer._extractRegion(
            data, width, minX, minY, regionWidth, regionHeight
        );

        canvas.renderer.updateBufferData(
            canvas.bufferId,
            regionData,
            minX, minY,
            regionWidth, regionHeight
        );

        canvas.needsUpload = true;

        const elapsed = performance.now() - startTime;
        return {
            pixels: pixelsDrawn,
            linePoints: points.length,
            time: elapsed,
            regionSize: regionWidth * regionHeight
        };
    }

    /**
     * Get all points along a line (Bresenham)
     * Useful for collision detection, path following, etc.
     */
    static _bresenhamPoints(x1, y1, x2, y2) {
        const points = [];
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;

        let err = dx - dy;
        let x = x1;
        let y = y1;

        while (true) {
            points.push({ x, y });
            if (x === x2 && y === y2) break;

            const e2 = err * 2;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        return points;
    }

    /**
     * Create a circular brush stamp
     * Pre-calculated, reusable across multiple stamps
     */
    static _createBrushStamp(radius, r, g, b, a) {
        const size = radius * 2 + 1;
        const stamp = [];

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= radius) {
                    // Edge fading for smooth brush
                    const edgeFade = Math.max(0, 1 - (dist / radius));
                    const finalAlpha = Math.floor(a * edgeFade);

                    stamp.push({
                        dx, dy,
                        r, g, b,
                        a: finalAlpha
                    });
                }
            }
        }

        return stamp;
    }

    /**
     * Stamp brush at position with alpha blending
     */
    static _stampBrush(data, width, height, cx, cy, radius, stamp, camera) {
        let pixelsDrawn = 0;
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const { dx, dy, r, g, b, a } of stamp) {
            const x = cx + dx;
            const y = cy + dy;

            if (!shouldDrawPixel(x, y, { width, height, data }, camera)) continue;

            const idx = (y * width + x) * 4;

            const alpha = a / 255;
            const invAlpha = 1 - alpha;

            data[idx + 0] = Math.floor(r * alpha + data[idx + 0] * invAlpha);
            data[idx + 1] = Math.floor(g * alpha + data[idx + 1] * invAlpha);
            data[idx + 2] = Math.floor(b * alpha + data[idx + 2] * invAlpha);
            data[idx + 3] = 255;

            pixelsDrawn++;

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }

        return { pixels: pixelsDrawn, minX, minY, maxX, maxY };
    }

    /**
     * Extract a rectangular region from buffer
     * Critical for region-based updates
     */
    static _extractRegion(data, bufferWidth, x, y, width, height) {
        const region = new Uint8Array(width * height * 4);

        for (let row = 0; row < height; row++) {
            const srcOffset = ((y + row) * bufferWidth + x) * 4;
            const dstOffset = row * width * 4;
            const rowBytes = width * 4;

            // Fast copy: use TypedArray.set instead of loop
            region.set(
                data.subarray(srcOffset, srcOffset + rowBytes),
                dstOffset
            );
        }

        return region;
    }
}