import { Camera } from "../camera/index.js";
import { PixelBuffer } from "./pixel_buffer.js";
import { DrawingUtils } from "./utils.js";



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
     * @param {Camera} camera
     * @returns 
     */
    static drawLine(canvas, x1, y1, x2, y2, r, g, b, a = 255, camera = undefined) {
        // const startTime = performance.now();

        // Convert to integers
        x1 = Math.floor(x1); y1 = Math.floor(y1);
        x2 = Math.floor(x2); y2 = Math.floor(y2);
        if (camera) {
            const screen1 = camera.worldToScreen(x1, y1);
            const screen2 = camera.worldToScreen(x2, y2);

            if (DrawingUtils.shouldClipRegion(camera,
                Math.min(screen1.x, screen2.x),
                Math.min(screen1.y, screen2.y),
                Math.abs(screen2.x - screen1.x),
                Math.abs(screen2.y - screen1.y))) {
                return { pixels: 0, time: 0, regionSize: 0 };
            }
        }

        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;  // Step direction for x
        const sy = y1 < y2 ? 1 : -1;  // Step direction for y

        let err = dx - dy;  // Initial error term
        let x = x1;
        let y = y1;

        // Calculate bounding box for region update
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const maxX = Math.max(x1, x2);
        const maxY = Math.max(y1, y2);

        // Direct buffer access for performance
        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;

        let pixelCount = 0;

        // Bresenham's main loop - all integer operations
        while (true) {
            let drawX = x, drawY = y;
            if (camera) {
                const screenPos = camera.worldToScreen(x, y);
                drawX = screenPos.x;
                drawY = screenPos.y;

                if (DrawingUtils.shouldClipPoint(camera, drawX, drawY)) {
                    // Skip this pixel but continue the line
                    if (x === x2 && y === y2) break;

                    const e2 = err * 2;
                    if (e2 > -dy) { err -= dy; x += sx; }
                    if (e2 < dx) { err += dx; y += sy; }
                    continue;
                }
            }
            // Draw current pixel if within bounds
            if (x >= 0 && x < width && y >= 0 && y < height) {
                const idx = (y * width + x) * 4;
                data[idx + 0] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
                pixelCount++;
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

        // Calculate final region for update (considering camera transform)
        let updateMinX = minX, updateMinY = minY, updateMaxX = maxX, updateMaxY = maxY;

        if (camera) {
            // Transform bounds to screen space for update region
            const screenMin = camera.worldToScreen(minX, minY);
            const screenMax = camera.worldToScreen(maxX, maxY);
            updateMinX = Math.min(screenMin.x, screenMax.x);
            updateMinY = Math.min(screenMin.y, screenMax.y);
            updateMaxX = Math.max(screenMin.x, screenMax.x);
            updateMaxY = Math.max(screenMin.y, screenMax.y);
        }

        const regionWidth = updateMaxX - updateMinX + 1;
        const regionHeight = updateMaxY - updateMinY + 1;

        const regionData = DrawingUtils.extractRegionSafe(
            data, width, updateMinX, updateMinY, regionWidth, regionHeight
        );

        if (regionData.length > 0) {
            DrawingUtils.safeBufferUpdate(
                canvas, regionData, updateMinX, updateMinY, regionWidth, regionHeight
            );
            canvas.needsUpload = true;
        }

        // Extract and update only the affected region
        // const regionWidth = maxX - minX + 1;
        // const regionHeight = maxY - minY + 1;
        // const regionData = LineDrawer._extractRegion(
        //     data, width, minX, minY, regionWidth, regionHeight
        // );

        // canvas.renderer.updateBufferData(
        //     canvas.bufferId,
        //     regionData,
        //     minX, minY,
        //     regionWidth, regionHeight
        // );

        // canvas.needsUpload = true;

        // const elapsed = performance.now() - startTime;
        // return {
        //     pixels: pixelCount,
        //     time: elapsed,
        //     regionSize: regionWidth * regionHeight
        // };
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
     * @param {Camera} camera 
     * @returns 
     */
    static drawThickLine(canvas, x1, y1, x2, y2, thickness, r, g, b, a = 255, camera = undefined) {
        x1 = Math.floor(x1); y1 = Math.floor(y1);
        x2 = Math.floor(x2); y2 = Math.floor(y2);
        thickness = Math.max(1, Math.floor(thickness));
        // const startTime = performance.now();



        // Create circular brush stamp (once per thickness)
        const radius = Math.ceil(thickness / 2);
        if (camera) {
            const screen1 = camera.worldToScreen(x1, y1);
            const screen2 = camera.worldToScreen(x2, y2);

            if (DrawingUtils.shouldClipRegion(camera,
                Math.min(screen1.x, screen2.x) - radius,
                Math.min(screen1.y, screen2.y) - radius,
                Math.abs(screen2.x - screen1.x) + radius * 2,
                Math.abs(screen2.y - screen1.y) + radius * 2)) {
                // return { pixels: 0, time: 0, regionSize: 0 };
            }
        }

        const brushStamp = LineDrawer._createBrushStamp(radius, r, g, b, a);

        // Calculate extended bounding box (includes brush radius)
        // const minX = Math.max(0, Math.min(x1, x2) - radius);
        // const minY = Math.max(0, Math.min(y1, y2) - radius);
        // const maxX = Math.min(canvas.width - 1, Math.max(x1, x2) + radius);
        // const maxY = Math.min(canvas.height - 1, Math.max(y1, y2) + radius);

        let minX = Math.min(x1, x2) - radius;
        let minY = Math.min(y1, y2) - radius;
        let maxX = Math.max(x1, x2) + radius;
        let maxY = Math.max(y1, y2) + radius;

        if (camera) {
            const screenMin = camera.worldToScreen(minX, minY);
            const screenMax = camera.worldToScreen(maxX, maxY);
            minX = Math.min(screenMin.x, screenMax.x);
            minY = Math.min(screenMin.y, screenMax.y);
            maxX = Math.max(screenMin.x, screenMax.x);
            maxY = Math.max(screenMin.y, screenMax.y);
        }
        // Clamp to canvas bounds
        minX = Math.max(0, minX);
        minY = Math.max(0, minY);
        maxX = Math.min(canvas.width - 1, maxX);
        maxY = Math.min(canvas.height - 1, maxY);

        // Get all points along the line using Bresenham
        const points = LineDrawer._bresenhamPoints(x1, y1, x2, y2);

        // Direct buffer manipulation for performance
        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;

        // Stamp brush at each point along the line with camera checks
        let pixelsDrawn = 0;
        for (const { x, y } of points) {
            let stampX = x, stampY = y;

            // Transform to screen coordinates if camera provided
            if (camera) {
                const screenPos = camera.worldToScreen(x, y);
                stampX = Math.floor(screenPos.x);
                stampY = Math.floor(screenPos.y);
            }

            pixelsDrawn += LineDrawer._stampBrush(
                data, width, height,
                stampX, stampY, radius, brushStamp, camera
            );
        }

        // Extract and update the affected region

        // Extract and update the affected region
        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;

        const clampedRegion = DrawingUtils.clampRegion(canvas, minX, minY, regionWidth, regionHeight);

        if (clampedRegion.isValid) {
            const regionData = DrawingUtils.extractRegionSafe(
                data, width, clampedRegion.x, clampedRegion.y,
                clampedRegion.width, clampedRegion.height
            );

            if (regionData.length > 0) {
                DrawingUtils.safeBufferUpdate(
                    canvas, regionData, clampedRegion.x, clampedRegion.y,
                    clampedRegion.width, clampedRegion.height
                );
                canvas.needsUpload = true;
            }
        }

        // const regionWidth = maxX - minX + 1;
        // const regionHeight = maxY - minY + 1;
        // const regionData = LineDrawer._extractRegion(
        //     data, width, minX, minY, regionWidth, regionHeight
        // );

        // canvas.renderer.updateBufferData(
        //     canvas.bufferId,
        //     regionData,
        //     minX, minY,
        //     regionWidth, regionHeight
        // );

        // canvas.needsUpload = true;

        // const elapsed = performance.now() - startTime;
        // return {
        //     pixels: pixelsDrawn,
        //     linePoints: points.length,
        //     time: elapsed,
        //     regionSize: regionWidth * regionHeight
        // };
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
    static _stampBrush(data, width, height, cx, cy, radius, stamp, camera = undefined) {
        let pixelsDrawn = 0;

        for (const { dx, dy, r, g, b, a } of stamp) {
            const x = cx + dx;
            const y = cy + dy;

            if (camera) {
                // For brush stamping, we're already in screen coordinates
                // Just check if we should clip
                if (DrawingUtils.shouldClipPoint(camera, x, y)) {
                    continue;
                }
            }

            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const idx = (y * width + x) * 4;

            // Alpha blending: new = src*alpha + dst*(1-alpha)
            const alpha = a / 255;
            const invAlpha = 1 - alpha;

            data[idx + 0] = Math.floor(r * alpha + data[idx + 0] * invAlpha);
            data[idx + 1] = Math.floor(g * alpha + data[idx + 1] * invAlpha);
            data[idx + 2] = Math.floor(b * alpha + data[idx + 2] * invAlpha);
            data[idx + 3] = 255;  // Output is opaque

            pixelsDrawn++;
        }

        return pixelsDrawn;
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