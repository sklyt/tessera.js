import { LineDrawer } from "./bresenham.js";
import { PixelBuffer } from "./pixel_buffer.js";



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
    static fillRect(canvas, x, y, width, height, r, g, b, a = 255) {
        // const startTime = performance.now();
        
        // Clamp to canvas bounds - CRITICAL for safety!
        const x1 = Math.max(0, Math.floor(x));
        const y1 = Math.max(0, Math.floor(y));
        const x2 = Math.min(canvas.width, Math.ceil(x + width));
        const y2 = Math.min(canvas.height, Math.ceil(y + height));
        
        const actualWidth = x2 - x1;
        const actualHeight = y2 - y1;
        
        if (actualWidth <= 0 || actualHeight <= 0) {
            return { pixels: 0, time: 0 }; // Nothing to draw
        }
        

        const data = canvas.data;
        const bufferWidth = canvas.width;
        
        // Write scanlines
        let pixelsDrawn = 0;
        for (let py = y1; py < y2; py++) {
            const rowStart = (py * bufferWidth + x1) * 4;
            
            // Fill entire row in one go
            for (let px = 0; px < actualWidth; px++) {
                const idx = rowStart + px * 4;
                data[idx + 0] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
                pixelsDrawn++;
            }
        }
        

        const regionData = ShapeDrawer._extractRegion(
            data, bufferWidth, x1, y1, actualWidth, actualHeight
        );
        
        canvas.renderer.updateBufferData(
            canvas.bufferId,
            regionData,
            x1, y1,
            actualWidth, actualHeight
        );
        
        canvas.needsUpload = true;
        
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
 * @returns 
 */
    static strokeRect(canvas, x, y, width, height, thickness, r, g, b, a = 255) {
        // const startTime = performance.now();
    
        
        // Top edge
        LineDrawer.drawThickLine(canvas, x, y, x + width, y, thickness, r, g, b, a);
        // Right edge  
        LineDrawer.drawThickLine(canvas, x + width, y, x + width, y + height, thickness, r, g, b, a);
        // Bottom edge
        LineDrawer.drawThickLine(canvas, x + width, y + height, x, y + height, thickness, r, g, b, a);
        // Left edge
        LineDrawer.drawThickLine(canvas, x, y + height, x, y, thickness, r, g, b, a);
        
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
 * @returns 
 */
    static fillCircle(canvas, cx, cy, radius, r, g, b, a = 255) {
        // const startTime = performance.now();
        
        // Convert to integers and validate
        const x = Math.floor(cx);
        const y = Math.floor(cy);
        const rad = Math.floor(radius);
        
        if (rad <= 0) return { pixels: 0, time: 0 };
        
  
        const minX = Math.max(0, x - rad);
        const minY = Math.max(0, y - rad);
        const maxX = Math.min(canvas.width - 1, x + rad);
        const maxY = Math.min(canvas.height - 1, y + rad);
        

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
            if (y < 0 || y >= height) return;
            
            const clampedX1 = Math.max(0, x1);
            const clampedX2 = Math.min(width - 1, x2);
            
            // Fill the entire horizontal span
            for (let px = clampedX1; px <= clampedX2; px++) {
                const idx = (y * width + px) * 4;
                data[idx + 0] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
                pixelsDrawn++;
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
        
        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;
        const regionData = ShapeDrawer._extractRegion(
            data, width, minX, minY, regionWidth, regionHeight
        );
        
        canvas.renderer.updateBufferData(
            canvas.bufferId,
            regionData,
            minX, minY,
            regionWidth, regionHeight
        );
        
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
     * @returns 
     */
    static strokeCircle(canvas, cx, cy, radius, thickness, r, g, b, a = 255) {
        const startTime = performance.now();
        
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
        
        let px = rad;
        let py = 0;
        let d = 1 - rad;
        
        let pixelsDrawn = 0;
        
        const setPixelSafe = (x, y) => {
            if (x >= 0 && x < width && y >= 0 && y < height) {
                const idx = (y * width + x) * 4;
                data[idx + 0] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = a;
                pixelsDrawn++;
            }
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
        

        const minX = Math.max(0, x - rad);
        const minY = Math.max(0, y - rad);
        const maxX = Math.min(width - 1, x + rad);
        const maxY = Math.min(height - 1, y + rad);
        
        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;
        const regionData = ShapeDrawer._extractRegion(
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
        return { pixels: pixelsDrawn, time: elapsed };
    }
    
    /**
     * Thick circle stroke - draw outer circle, cut out inner circle
     */
    static _strokeCircleThick(canvas, cx, cy, radius, thickness, r, g, b, a) {
        const startTime = performance.now();
        
        const outerRad = radius;
        const innerRad = Math.max(0, radius - thickness);
        
        // Get the data for both circles
        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;
        
        let pixelsDrawn = 0;
        
        // For each pixel in the bounding box, check if it's in the ring
        const minX = Math.max(0, cx - outerRad);
        const minY = Math.max(0, cy - outerRad);
        const maxX = Math.min(width - 1, cx + outerRad);
        const maxY = Math.min(height - 1, cy + outerRad);
        
        const outerRadSq = outerRad * outerRad;
        const innerRadSq = innerRad * innerRad;
        
        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                const dx = px - cx;
                const dy = py - cy;
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
        
        // Extract and update region
        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;
        const regionData = ShapeDrawer._extractRegion(
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