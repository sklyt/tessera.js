import { LineDrawer } from "./bresenham.js";
import { PixelBuffer } from "./pixel_buffer.js";
import { DrawingUtils } from "./utils.js";



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
     * @returns 
     */
    static fillRect(canvas, x, y, width, height, r, g, b, a = 255, camera = undefined) {
        const startTime = performance.now();

        // Early camera clipping check
        if (camera) {
            const screenPos = camera.worldToScreen(x, y);
            const screenSize = camera.worldToScreen(x + width, y + height);

            if (DrawingUtils.shouldClipRegion(camera,
                screenPos.x, screenPos.y,
                screenSize.x - screenPos.x,
                screenSize.y - screenPos.y)) {
                return { pixels: 0, time: 0 };
            }
        }

        // Clamp to canvas bounds
        let x1 = Math.max(0, Math.floor(x));
        let y1 = Math.max(0, Math.floor(y));
        let x2 = Math.min(canvas.width, Math.ceil(x + width));
        let y2 = Math.min(canvas.height, Math.ceil(y + height));

        // Transform bounds if camera is provided
        if (camera) {
            const screen1 = camera.worldToScreen(x1, y1);
            const screen2 = camera.worldToScreen(x2, y2);
            x1 = Math.max(0, Math.floor(screen1.x));
            y1 = Math.max(0, Math.floor(screen1.y));
            x2 = Math.min(canvas.width, Math.ceil(screen2.x));
            y2 = Math.min(canvas.height, Math.ceil(screen2.y));
        }

        const actualWidth = x2 - x1;
        const actualHeight = y2 - y1;

        if (actualWidth <= 0 || actualHeight <= 0) {
            return { pixels: 0, time: 0 };
        }

        const data = canvas.data;
        const bufferWidth = canvas.width;

        let pixelsDrawn = 0;
        for (let py = y1; py < y2; py++) {
            for (let px = x1; px < x2; px++) {
                // Final camera check for each pixel
                if (camera && DrawingUtils.shouldClipPoint(camera, px, py)) {
                    continue;
                }

                const idx = (py * bufferWidth + px) * 4;
                data[idx + 0] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
                pixelsDrawn++;
            }
        }

        const regionData = DrawingUtils.extractRegionSafe(
            data, bufferWidth, x1, y1, actualWidth, actualHeight
        );

        if (regionData.length > 0) {
            DrawingUtils.safeBufferUpdate(
                canvas, regionData, x1, y1, actualWidth, actualHeight
            );
            canvas.needsUpload = true;
        }

        const elapsed = performance.now() - startTime;
        return { pixels: pixelsDrawn, time: elapsed };
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
     * @returns 
     */
    static strokeRect(canvas, x, y, width, height, thickness, r, g, b, a = 255, camera = undefined) {
        const startTime = performance.now();

        // Use the updated LineDrawer with camera support
        LineDrawer.drawThickLine(canvas, x, y, x + width, y, thickness, r, g, b, a, camera);
        LineDrawer.drawThickLine(canvas, x + width, y, x + width, y + height, thickness, r, g, b, a, camera);
        LineDrawer.drawThickLine(canvas, x + width, y + height, x, y + height, thickness, r, g, b, a, camera);
        LineDrawer.drawThickLine(canvas, x, y + height, x, y, thickness, r, g, b, a, camera);

        const elapsed = performance.now() - startTime;
        return { time: elapsed };
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
     * @returns 
     */
    static fillCircle(canvas, cx, cy, radius, r, g, b, a = 255, camera = undefined) {
        const startTime = performance.now();

        // Early camera clipping
        if (camera) {
            const screenCenter = camera.worldToScreen(cx, cy);
            const screenRadius = radius;

            if (DrawingUtils.shouldClipRegion(camera,
                screenCenter.x - screenRadius, screenCenter.y - screenRadius,
                screenRadius * 2, screenRadius * 2)) {
                return { pixels: 0, time: 0 };
            }
        }

        const x = Math.floor(cx);
        const y = Math.floor(cy);
        const rad = Math.floor(radius);

        if (rad <= 0) return { pixels: 0, time: 0 };

        let minX = x - rad;
        let minY = y - rad;
        let maxX = x + rad;
        let maxY = y + rad;

        // Transform bounds if camera is provided
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

        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;

        // Midpoint circle algorithm - calculate horizontal spans
        let px = rad;
        let py = 0;
        let d = 1 - rad;

        let pixelsDrawn = 0;

        // Helper to draw horizontal span with camera checks
        const drawSpan = (drawY, x1, x2) => {
            if (drawY < 0 || drawY >= height) return;

            const clampedX1 = Math.max(0, x1);
            const clampedX2 = Math.min(width - 1, x2);

            for (let drawX = clampedX1; drawX <= clampedX2; drawX++) {
                // Final camera check
                if (camera && DrawingUtils.shouldClipPoint(camera, drawX, drawY)) {
                    continue;
                }

                const idx = (drawY * width + drawX) * 4;
                data[idx + 0] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
                pixelsDrawn++;
            }
        };

        // Special case: initial horizontal spans
        let drawY = y;
        if (camera) {
            const screenPos = camera.worldToScreen(x, y);
            drawY = Math.floor(screenPos.y);
        }
        drawSpan(drawY, x - px, x + px);

        // Main circle algorithm loop
        while (px > py) {
            py++;

            if (d < 0) {
                d += 2 * py + 1;
            } else {
                px--;
                d += 2 * (py - px) + 1;
            }

            // Calculate screen coordinates for spans
            let topY = y + py, bottomY = y - py;
            let rightY = y + px, leftY = y - px;

            if (camera) {
                const screenTop = camera.worldToScreen(x, topY);
                const screenBottom = camera.worldToScreen(x, bottomY);
                const screenRight = camera.worldToScreen(x, rightY);
                const screenLeft = camera.worldToScreen(x, leftY);

                topY = Math.floor(screenTop.y);
                bottomY = Math.floor(screenBottom.y);
                rightY = Math.floor(screenRight.y);
                leftY = Math.floor(screenLeft.y);
            }

            // Draw 4 horizontal spans (using 8-way symmetry)
            drawSpan(topY, x - px, x + px);
            drawSpan(rightY, x - py, x + py);
            drawSpan(bottomY, x - px, x + px);
            drawSpan(leftY, x - py, x + py);
        }

        // Safe region update
        const clampedRegion = DrawingUtils.clampRegion(canvas, minX, minY, maxX - minX + 1, maxY - minY + 1);

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

        const elapsed = performance.now() - startTime;
        return { pixels: pixelsDrawn, time: elapsed, radius: rad };
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
     * @returns 
     */
    static strokeCircle(canvas, cx, cy, radius, thickness, r, g, b, a = 255, camera = undefined) {
        const startTime = performance.now();

        // For thick strokes, draw filled circles with inner cutout
        if (thickness > 1) {
            return this._strokeCircleThick(canvas, cx, cy, radius, thickness, r, g, b, a, camera);
        }

        const x = Math.floor(cx);
        const y = Math.floor(cy);
        const rad = Math.floor(radius);

        if (rad <= 0) return { pixels: 0, time: 0 };

        let minX = x - rad;
        let minY = y - rad;
        let maxX = x + rad;
        let maxY = y + rad;

        // Transform bounds if camera is provided
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

        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;

        let px = rad;
        let py = 0;
        let d = 1 - rad;

        let pixelsDrawn = 0;

        const setPixelSafe = (worldX, worldY) => {
            let drawX = worldX, drawY = worldY;

            if (camera) {
                const screenPos = camera.worldToScreen(worldX, worldY);
                drawX = Math.floor(screenPos.x);
                drawY = Math.floor(screenPos.y);

                if (DrawingUtils.shouldClipPoint(camera, drawX, drawY)) {
                    return;
                }
            }

            if (drawX >= 0 && drawX < width && drawY >= 0 && drawY < height) {
                const idx = (drawY * width + drawX) * 4;
                data[idx + 0] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
                pixelsDrawn++;
            }
        };

        // 8-way symmetry for perimeter
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

        // Safe region update
        const clampedRegion = DrawingUtils.clampRegion(canvas, minX, minY, maxX - minX + 1, maxY - minY + 1);

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

        const elapsed = performance.now() - startTime;
        return { pixels: pixelsDrawn, time: elapsed };
    }

    /**
     * Thick circle stroke - draw outer circle, cut out inner circle
     */

    static _strokeCircleThick(canvas, cx, cy, radius, thickness, r, g, b, a, camera = undefined) {
        const startTime = performance.now();

        const outerRad = radius;
        const innerRad = Math.max(0, radius - thickness);

        let minX = cx - outerRad;
        let minY = cy - outerRad;
        let maxX = cx + outerRad;
        let maxY = cy + outerRad;

        // Transform bounds if camera is provided
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

        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;

        const outerRadSq = outerRad * outerRad;
        const innerRadSq = innerRad * innerRad;

        let pixelsDrawn = 0;

        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                // Convert to world coordinates for distance calculation
                let worldX = px, worldY = py;
                if (camera) {
                    const worldPos = camera.screenToWorld(px, py);
                    worldX = worldPos.x;
                    worldY = worldPos.y;

                    // Check if this screen pixel should be clipped
                    if (DrawingUtils.shouldClipPoint(camera, px, py)) {
                        continue;
                    }
                }

                const dx = worldX - cx;
                const dy = worldY - cy;
                const distSq = dx * dx + dy * dy;

                // Inside ring? (between inner and outer radius)
                if (distSq <= outerRadSq && distSq >= innerRadSq) {
                    const idx = (py * width + px) * 4;
                    data[idx + 0] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = a;
                    pixelsDrawn++;
                }
            }
        }
        // Safe region update
        const clampedRegion = DrawingUtils.clampRegion(canvas, minX, minY, maxX - minX + 1, maxY - minY + 1);

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

        const elapsed = performance.now() - startTime;
        return { pixels: pixelsDrawn, time: elapsed };
    }

    /**
     * Extract rectangular region from buffer
     */
    static _extractRegion(data, bufferWidth, x, y, width, height) {
        const region = new Uint8Array(width * height * 4);

        for (let row = 0; row < height; row++) {
            const srcOffset = ((y + row) * bufferWidth + x) * 4;
            const dstOffset = row * width * 4;
            const rowBytes = width * 4;

            region.set(
                data.subarray(srcOffset, srcOffset + rowBytes),
                dstOffset
            );
        }

        return region;
    }
}