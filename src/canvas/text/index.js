import { Renderer } from "../../loader.js";
import { DirtyRegionTracker } from "../../render_helpers.js";
import { PixelBuffer } from "../pixel_buffer.js";
import { shouldDrawPixel, clampRectToCanvas } from "../utils.js";

class Glyph {
    constructor(char, x, y, width, height, xOffset, yOffset, xAdvance) {
        this.char = char;
        this.x = x;           // Position in atlas
        this.y = y;
        this.width = width;   // Glyph dimensions
        this.height = height;
        this.xOffset = xOffset;  // Rendering offset
        this.yOffset = yOffset;
        this.xAdvance = xAdvance; // Cursor advance
    }
}

export class BitmapFont {
    /**
     * Create bitmap font from atlas image
     * @param {Renderer} renderer
     * @param {string} atlasPath - Path to font atlas image
     * @param {Object} config - Font configuration
     */
    constructor(renderer, atlasPath, config = {}) {
        this.renderer = renderer;

        this.atlasImage = renderer.loadImage(atlasPath);
        if (!this.atlasImage.data)
            console.warn("image data empty")

        // Store configuration
        this.config = {
            bitmapWidth: config.bitmapWidth || this.atlasImage.width,
            bitmapHeight: config.bitmapHeight || this.atlasImage.height,
            cellsPerRow: config.cellsPerRow || 16,
            cellsPerColumn: config.cellsPerColumn || 16,
            cellWidth: config.cellWidth || 32,
            cellHeight: config.cellHeight || 32,
            fontSize: config.fontSize || 16,
            offsetX: config.offsetX || 0,
            offsetY: config.offsetY || 0,
            charOrder: config.charOrder || this.getDefaultCharOrder(),
            lineHeight: config.lineHeight || config.cellHeight,
            lineGap: config.lineGap || 0,
            charSpacing: config.charSpacing || 0
        };

        this.glyphs = new Map();
        this.scaledGlyphCache = new Map();
        this.buildGlyphMap();

        this.lineHeight = this.config.cellHeight;
        this.baseline = Math.floor(this.lineHeight * 0.8);
    }

    getDefaultCharOrder() {
        return ' ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼' +
            ' !"#$%&\'()*+,-./0123456789:;<=>?' +
            '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_' +
            '`abcdefghijklmnopqrstuvwxyz{¦}~⌂' +
            'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
            'áíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
            '└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
            'αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■□';
    }

    buildGlyphMap() {
        const { cellsPerRow, cellsPerColumn, cellWidth, cellHeight, offsetX, offsetY, charOrder } = this.config;

        let charIndex = 0;

        for (let row = 0; row < cellsPerColumn; row++) {
            for (let col = 0; col < cellsPerRow; col++) {
                if (charIndex >= charOrder.length) break;

                const char = charOrder[charIndex];
                const x = col * cellWidth + offsetX;
                const y = row * cellHeight + offsetY;

                const glyph = new Glyph(
                    char,
                    x, y,
                    cellWidth, cellHeight,
                    0, 0,
                    cellWidth
                );

                this.glyphs.set(char, glyph);
                charIndex++;
            }
        }

        console.log(`Built ${this.glyphs.size} glyphs from atlas`);
    }

    getGlyph(char) {
        let glyph = this.glyphs.get(char);

        if (!glyph) {
            if (char === "\n") {
                return this.glyphs.get(' ')
            }
            glyph = this.glyphs.get('?') || this.glyphs.get(' ') || this.glyphs.values().next().value;
        }
        return glyph;
    }

    measureText(text) {
        let width = 0;

        for (let i = 0; i < text.length; i++) {
            const glyph = this.getGlyph(text[i]);
            width += glyph.xAdvance + this.config.charSpacing;
        }

        if (text.length > 0) {
            width -= this.config.charSpacing;
        }

        return { width, height: this.lineHeight };
    }

    /**
     * Draw text with optimized sampling and optional rotation
     * @param {PixelBuffer} canvas 
     * @param {string} text 
     * @param {number} x - Origin X position
     * @param {number} y - Origin Y position
     * @param {Object} color - {r, g, b, a}
     * @param {number} scale - Scale factor
     * @param {number} rotation - Rotation in degrees (0-360)
     * @param {Camera2D} camera - Optional camera for viewport clipping
     */
    drawText(canvas, text, x, y, color = { r: 255, g: 255, b: 255, a: 255 }, scale = 1.0, rotation = 0, camera = undefined) {
        const atlasData = this.atlasImage.data;
        const atlasWidth = this.atlasImage.width;
        const canvasData = canvas.data;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        // Pre-calculate rotation if needed
        const hasRotation = rotation !== 0;
        const radians = hasRotation ? (rotation * Math.PI / 180) : 0;
        const cosTheta = hasRotation ? Math.cos(radians) : 1;
        const sinTheta = hasRotation ? Math.sin(radians) : 0;

        // Pre-calculate color multipliers (normalized 0-1)
        const mR = color.r / 255;
        const mG = color.g / 255;
        const mB = color.b / 255;
        const mA = color.a / 255;
        const neutralTint = (mR === 1 && mG === 1 && mB === 1 && mA === 1);

        let cursorX = 0; // Relative to origin
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const glyph = this.getGlyph(char);

            // Skip spaces
            if (char === ' ') {
                cursorX += (glyph.xAdvance + this.config.charSpacing) * scale;
                continue;
            }

            const glyphX = cursorX + glyph.xOffset * scale;
            const glyphY = glyph.yOffset * scale;
            const scaledWidth = Math.ceil(glyph.width * scale);
            const scaledHeight = Math.ceil(glyph.height * scale);

            // Cache scaled glyph
            const key = `${glyph.char}_${scale}`;
            if (!this.scaledGlyphCache.has(key)) {
                this.cacheScaledGlyph(glyph, scale, atlasData, atlasWidth, key);
            }
            const scaledAlphas = this.scaledGlyphCache.get(key);

            // Draw glyph pixels with optimized paths
            if (hasRotation) {
                this.drawRotatedGlyph(
                    canvas, canvasWidth, canvasHeight,
                    scaledAlphas, scaledWidth, scaledHeight,
                    x, y, glyphX, glyphY,
                    cosTheta, sinTheta,
                    mR, mG, mB, mA, neutralTint,
                    camera
                );
            } else {
                const result = this.drawGlyphFast(
                    canvasData, canvasWidth, canvasHeight,
                    scaledAlphas, scaledWidth, scaledHeight,
                    x + glyphX, y + glyphY,
                    mR, mG, mB, mA, neutralTint,
                    camera
                );
                
                if (result) {
                    minX = Math.min(minX, result.minX);
                    minY = Math.min(minY, result.minY);
                    maxX = Math.max(maxX, result.maxX);
                    maxY = Math.max(maxY, result.maxY);
                }
            }

            cursorX += (glyph.xAdvance + this.config.charSpacing) * scale;
        }

        // Update canvas buffer
        if (minX !== Infinity) {
            this.uploadCanvasRegion(canvas, minX, minY, maxX, maxY);
        }
    }

    /**
     * Cache scaled glyph alpha values
     */
    cacheScaledGlyph(glyph, scale, atlasData, atlasWidth, key) {
        const scaledWidth = Math.ceil(glyph.width * scale);
        const scaledHeight = Math.ceil(glyph.height * scale);
        const scaledAlphas = new Uint8Array(scaledWidth * scaledHeight);

        for (let gy = 0; gy < scaledHeight; gy++) {
            for (let gx = 0; gx < scaledWidth; gx++) {
                const atlasX = glyph.x + Math.floor(gx / scale);
                const atlasY = glyph.y + Math.floor(gy / scale);
                
                if (atlasX >= glyph.x + glyph.width || atlasY >= glyph.y + glyph.height) {
                    scaledAlphas[gy * scaledWidth + gx] = 0;
                    continue;
                }

                const atlasIdx = (atlasY * atlasWidth + atlasX) * 4;
                const atlasR = atlasData[atlasIdx];
                const atlasG = atlasData[atlasIdx + 1];
                const atlasB = atlasData[atlasIdx + 2];
                const atlasA = atlasData[atlasIdx + 3];

                if (atlasA === 0) {
                    scaledAlphas[gy * scaledWidth + gx] = 0;
                    continue;
                }

                const intensity = (atlasR + atlasG + atlasB) / 3;
                const alpha = (intensity / 255) * (atlasA / 255);
                scaledAlphas[gy * scaledWidth + gx] = Math.floor(alpha * 255);
            }
        }

        this.scaledGlyphCache.set(key, scaledAlphas);
    }

    /**
     * Fast non-rotated glyph drawing with optimized paths
     */
    drawGlyphFast(canvasData, canvasWidth, canvasHeight, scaledAlphas, width, height, destX, destY, mR, mG, mB, mA, neutralTint, camera) {
        destX = Math.floor(destX);
        destY = Math.floor(destY);

        // Clamp to canvas bounds
        const clamped = clampRectToCanvas(destX, destY, width, height, canvasWidth, canvasHeight);
        if (!clamped) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        const startX = clamped.x;
        const startY = clamped.y;
        const endX = clamped.x + clamped.width;
        const endY = clamped.y + clamped.height;

        // Optimized path: neutral tint
        if (neutralTint) {
            for (let py = startY; py < endY; py++) {
                const gy = py - destY;
                const rowBase = py * canvasWidth * 4;
                
                for (let px = startX; px < endX; px++) {
                    if (camera && !shouldDrawPixel(px, py, { width: canvasWidth, height: canvasHeight }, camera)) continue;

                    const gx = px - destX;
                    const alpha = scaledAlphas[gy * width + gx];
                    if (alpha < 1) continue;

                    const idx = rowBase + px * 4;
                    const sA = alpha;
                    const inv = 255 - sA;

                    if (sA === 255) {
                        // Fully opaque - direct write
                        canvasData[idx] = Math.floor(mR * 255);
                        canvasData[idx + 1] = Math.floor(mG * 255);
                        canvasData[idx + 2] = Math.floor(mB * 255);
                        canvasData[idx + 3] = 255;
                    } else {
                        // Integer alpha composite
                        const sR = Math.floor(mR * 255);
                        const sG = Math.floor(mG * 255);
                        const sB = Math.floor(mB * 255);
                        
                        canvasData[idx] = ((sR * sA + canvasData[idx] * inv) / 255) | 0;
                        canvasData[idx + 1] = ((sG * sA + canvasData[idx + 1] * inv) / 255) | 0;
                        canvasData[idx + 2] = ((sB * sA + canvasData[idx + 2] * inv) / 255) | 0;
                        canvasData[idx + 3] = ((sA * 255 + canvasData[idx + 3] * inv) / 255) | 0;
                    }

                    minX = Math.min(minX, px);
                    minY = Math.min(minY, py);
                    maxX = Math.max(maxX, px);
                    maxY = Math.max(maxY, py);
                }
            }
        } else {
            // General path with tint
            for (let py = startY; py < endY; py++) {
                const gy = py - destY;
                const rowBase = py * canvasWidth * 4;
                
                for (let px = startX; px < endX; px++) {
                    if (camera && !shouldDrawPixel(px, py, { width: canvasWidth, height: canvasHeight }, camera)) continue;

                    const gx = px - destX;
                    const alphaRaw = scaledAlphas[gy * width + gx];
                    if (alphaRaw < 1) continue;

                    const idx = rowBase + px * 4;
                    const sA = (alphaRaw / 255) * mA;
                    
                    if (sA < 0.01) continue;

                    const invA = 1 - sA;
                    const dR = canvasData[idx] / 255;
                    const dG = canvasData[idx + 1] / 255;
                    const dB = canvasData[idx + 2] / 255;

                    canvasData[idx] = Math.floor((mR * sA + dR * invA) * 255);
                    canvasData[idx + 1] = Math.floor((mG * sA + dG * invA) * 255);
                    canvasData[idx + 2] = Math.floor((mB * sA + dB * invA) * 255);
                    canvasData[idx + 3] = 255;

                    minX = Math.min(minX, px);
                    minY = Math.min(minY, py);
                    maxX = Math.max(maxX, px);
                    maxY = Math.max(maxY, py);
                }
            }
        }

        return minX !== Infinity ? { minX, minY, maxX, maxY } : null;
    }

    drawRotatedGlyph(canvas, canvasWidth, canvasHeight, scaledAlphas, width, height, originX, originY, glyphX, glyphY, cosTheta, sinTheta, mR, mG, mB, mA, neutralTint, camera) {

        const canvasData = canvas.data
        const corners = [
            { x: glyphX, y: glyphY },
            { x: glyphX + width, y: glyphY },
            { x: glyphX, y: glyphY + height },
            { x: glyphX + width, y: glyphY + height }
        ];

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const corner of corners) {
            const rx = corner.x * cosTheta - corner.y * sinTheta;
            const ry = corner.x * sinTheta + corner.y * cosTheta;
            minX = Math.min(minX, rx);
            minY = Math.min(minY, ry);
            maxX = Math.max(maxX, rx);
            maxY = Math.max(maxY, ry);
        }

        const startX = Math.max(0, Math.floor(originX + minX));
        const startY = Math.max(0, Math.floor(originY + minY));
        const endX = Math.min(canvasWidth, Math.ceil(originX + maxX));
        const endY = Math.min(canvasHeight, Math.ceil(originY + maxY));


        let dirtyMinX = canvasWidth;
        let dirtyMinY = canvasHeight;
        let dirtyMaxX = -1;
        let dirtyMaxY = -1;

        for (let py = startY; py < endY; py++) {
            const rowBase = py * canvasWidth * 4;
            
            for (let px = startX; px < endX; px++) {
                if (camera && !shouldDrawPixel(px, py, { width: canvasWidth, height: canvasHeight }, camera)) continue;

                // Inverse rotate to find source pixel
                const dx = px - originX;
                const dy = py - originY;
                const srcX = dx * cosTheta + dy * sinTheta - glyphX;
                const srcY = -dx * sinTheta + dy * cosTheta - glyphY;

                if (srcX < 0 || srcX >= width || srcY < 0 || srcY >= height) continue;

                const gx = Math.floor(srcX);
                const gy = Math.floor(srcY);
                
                const alphaRaw = scaledAlphas[gy * width + gx];
                if (alphaRaw < 1) continue;

                const idx = rowBase + px * 4;
                const sA = (alphaRaw / 255) * mA;
                
                if (sA < 0.01) continue;

                const invA = 1 - sA;
                const dR = canvasData[idx] / 255;
                const dG = canvasData[idx + 1] / 255;
                const dB = canvasData[idx + 2] / 255;

                canvasData[idx] = Math.floor((mR * sA + dR * invA) * 255);
                canvasData[idx + 1] = Math.floor((mG * sA + dG * invA) * 255);
                canvasData[idx + 2] = Math.floor((mB * sA + dB * invA) * 255);
                canvasData[idx + 3] = 255;

                // Track dirty region
                if (px < dirtyMinX) dirtyMinX = px;
                if (py < dirtyMinY) dirtyMinY = py;
                if (px > dirtyMaxX) dirtyMaxX = px;
                if (py > dirtyMaxY) dirtyMaxY = py;
            }
        }

        // Flush dirty region if any pixels were drawn
        if (dirtyMaxX >= 0) {
            const regionWidth = dirtyMaxX - dirtyMinX + 1;
            const regionHeight = dirtyMaxY - dirtyMinY + 1;
            const regionData = new Uint8Array(regionWidth * regionHeight * 4);

            // Extract region data (cache-friendly row-by-row copy)
            for (let row = 0; row < regionHeight; row++) {
                const srcOffset = ((dirtyMinY + row) * canvasWidth + dirtyMinX) * 4;
                const dstOffset = row * regionWidth * 4;
                regionData.set(
                    canvasData.subarray(srcOffset, srcOffset + regionWidth * 4),
                    dstOffset
                );
            }

            // Upload to GPU
            this.renderer.updateBufferData(
                canvas.bufferId,
                regionData,
                dirtyMinX, dirtyMinY,
                regionWidth, regionHeight
            );
            canvas.needsUpload = true;
        }
    }

    /**
     * Upload dirty region to GPU
     */
    uploadCanvasRegion(canvas, minX, minY, maxX, maxY) {
        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;

        const regionData = new Uint8Array(regionWidth * regionHeight * 4);
        for (let row = 0; row < regionHeight; row++) {
            const srcOffset = ((minY + row) * canvas.width + minX) * 4;
            const dstOffset = row * regionWidth * 4;
            const rowBytes = regionWidth * 4;

            regionData.set(
                canvas.data.subarray(srcOffset, srcOffset + rowBytes),
                dstOffset
            );
        }

        canvas.renderer.updateBufferData(
            canvas.bufferId,
            regionData,
            minX, minY,
            regionWidth, regionHeight
        );
        canvas.needsUpload = true;
        canvas.upload();
    }

    drawTextWithTint(canvas, text, x, y, r, g, b, a = 255, scale = 1.0, rotation = 0, camera = undefined) {
        return this.drawText(canvas, text, x, y, { r, g, b, a }, scale, rotation, camera);
    }

    wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = this.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    }

    drawMultilineText(canvas, text, x, y, maxWidth, align = 'left', color = { r: 255, g: 255, b: 255, a: 255 }, scale = 1.0, rotation = 0, camera = undefined) {
        const lines = this.wrapText(text, maxWidth);
        let currentY = 0;

        for (const line of lines) {
            const metrics = this.measureText(line);
            let lineX = 0;

            if (align === 'center') {
                lineX = (maxWidth - metrics.width) / 2;
            } else if (align === 'right') {
                lineX = maxWidth - metrics.width;
            }

            this.drawText(canvas, line, x + lineX, y + currentY, color, scale, rotation, camera);
            currentY += (this.lineHeight + this.config.lineGap) * scale;
        }

        return {
            width: maxWidth,
            height: lines.length * this.lineHeight * scale
        };
    }
}