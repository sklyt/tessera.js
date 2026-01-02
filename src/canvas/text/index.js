import { Renderer } from "../../loader.js";
import { DirtyRegionTracker } from "../../render_helpers.js";
import { PixelBuffer } from "../pixel_buffer.js";
import { shouldDrawPixel } from "../utils.js";


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
        // console.log(`Loaded font atlas: ${this.atlasImage.width}x${this.atlasImage.height}`);
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
            lineGap: config.lineGap || 0,      // Extra space between lines
            charSpacing: config.charSpacing || 0  // Extra space between characters
        };


        this.glyphs = new Map();
        this.scaledGlyphCache = new Map();
        this.buildGlyphMap();


        this.lineHeight = this.config.cellHeight;
        this.baseline = Math.floor(this.lineHeight * 0.8);
    }

    /**
     * Default ASCII character order (same as https://lucide.github.io/Font-Atlas-Generator/)
     */
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

    /**
     * Build glyph map from grid layout
     */
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
                    0, 0,  // No offset by default
                    cellWidth  // Advance = cell width
                );

                this.glyphs.set(char, glyph);
                charIndex++;
            }
        }

        console.log(`Built ${this.glyphs.size} glyphs from atlas`);
    }

    /**
     * Get glyph for character (with fallback)
     */
    getGlyph(char) {
        let glyph = this.glyphs.get(char);

        if (!glyph) {

            if (glyph == "\n") {
                return this.glyphs.get(' ')
            }

            // Fallback to '?' or first character
            glyph = this.glyphs.get('?') || this.glyphs.get(' ') || this.glyphs.values().next().value;
        }
        return glyph;
    }

    /**
     * measure text dimensions from altas
     */
    measureText(text) {
        let width = 0;

        for (let i = 0; i < text.length; i++) {
            const glyph = this.getGlyph(text[i]);
            width += glyph.xAdvance + this.config.charSpacing;
        }

        if (text.length > 0) {
            width -= this.config.charSpacing;  // Don't add spacing after last char
        }

        return { width, height: this.lineHeight };
    }

    // Add to your BitmapFont class
    drawTextDebug(canvas, text, x, y, color = { r: 255, g: 0, b: 0, a: 128 }) {
        console.log(`Drawing text: "${text}" at (${x}, ${y})`);
        const tracker = new DirtyRegionTracker(canvas)
        tracker.markRect(0, 0, canvas.width, canvas.height)
        // Draw bounding box for each glyph
        let cursorX = x;
        for (let i = 0; i < text.length; i++) {
            const glyph = this.getGlyph(text[i]);
            const destX = Math.floor(cursorX + glyph.xOffset);
            const destY = Math.floor(y + glyph.yOffset);

            // Draw red outline around glyph bounds
            for (let dx = 0; dx < glyph.width; dx++) {
                this.drawDebugPixel(canvas, destX + dx, destY, color);
                this.drawDebugPixel(canvas, destX + dx, destY + glyph.height - 1, color);
            }
            for (let dy = 0; dy < glyph.height; dy++) {
                this.drawDebugPixel(canvas, destX, destY + dy, color);
                this.drawDebugPixel(canvas, destX + glyph.width - 1, destY + dy, color);
            }

            cursorX += glyph.xAdvance + this.config.charSpacing;
        }
        tracker.flush()
    }

    drawDebugPixel(canvas, x, y, color) {
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            const idx = (y * canvas.width + x) * 4;
            canvas.data[idx] = color.r;
            canvas.data[idx + 1] = color.g;
            canvas.data[idx + 2] = color.b;
            canvas.data[idx + 3] = Math.min(255, canvas.data[idx + 3] + color.a);
        }
    }

    /**
     * draw text to canvas buffer
     this copies glyph pixels from atlas to canvas
     * @param {PixelBuffer} canvas 
     * @param {string} text 
     * @param {number} x 
     * @param {number} y 
     * @param {r: 255, g: 255, b: 255, a: 255}} color 
     * @returns 
     */
    drawText(canvas, text, x, y, color = { r: 255, g: 255, b: 255, a: 255 }, scale = 1.0, camera = undefined) {
        // const startTime = performance.now();

        let cursorX = x;
        const cursorY = y;

        const atlasData = this.atlasImage.data;
        const atlasWidth = this.atlasImage.width;
        const canvasData = canvas.data;
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        let pixelsDrawn = 0;
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const glyph = this.getGlyph(char);
            // Skip spaces (don't draw, just advance)
            if (char === ' ') {
                cursorX += (glyph.xAdvance + this.config.charSpacing) * scale;
                continue;

            }



            const destX = Math.floor(cursorX + glyph.xOffset * scale);
            const destY = Math.floor(cursorY + glyph.yOffset * scale);
            const scaledWidth = Math.floor(glyph.width * scale);
            const scaledHeight = Math.floor(glyph.height * scale);

            // Cache scaled glyph alphas
            const key = `${glyph.char}_${scale}`;
            if (!this.scaledGlyphCache.has(key)) {
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
                        const atlasR = atlasData[atlasIdx + 0];
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
            const scaledAlphas = this.scaledGlyphCache.get(key);

            // Copy glyph pixels from atlas to canvas
            for (let gy = 0; gy < scaledHeight; gy++) {
                for (let gx = 0; gx < scaledWidth; gx++) {
                    const px = destX + gx;
                    const py = destY + gy;

                    // Bounds check canvas
                    if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight) continue;

                    if (!shouldDrawPixel(px, py, canvas, camera)) continue;

                    const alpha = (scaledAlphas[gy * scaledWidth + gx] / 255) * (color.a / 255);

                    if (alpha < 0.01) continue; // Skip nearly transparent

                    // Write to canvas with alpha blending
                    const canvasIdx = (py * canvasWidth + px) * 4;
                    const invAlpha = 1 - alpha;

                    canvasData[canvasIdx + 0] = Math.floor(color.r * alpha + canvasData[canvasIdx + 0] * invAlpha);
                    canvasData[canvasIdx + 1] = Math.floor(color.g * alpha + canvasData[canvasIdx + 1] * invAlpha);
                    canvasData[canvasIdx + 2] = Math.floor(color.b * alpha + canvasData[canvasIdx + 2] * invAlpha);
                    canvasData[canvasIdx + 3] = 255; // Opaque output

                    minX = Math.min(minX, px);
                    minY = Math.min(minY, py);
                    maxX = Math.max(maxX, px);
                    maxY = Math.max(maxY, py);

                    pixelsDrawn++;
                }
            }

            // Advance cursor
            cursorX += (glyph.xAdvance + this.config.charSpacing) * scale;
        }

        // Update canvas region
        if (minX !== Infinity) {
            const regionWidth = maxX - minX + 1;
            const regionHeight = maxY - minY + 1;

            const regionData = new Uint8Array(regionWidth * regionHeight * 4);
            for (let row = 0; row < regionHeight; row++) {
                const srcOffset = ((minY + row) * canvasWidth + minX) * 4;
                const dstOffset = row * regionWidth * 4;
                const rowBytes = regionWidth * 4;

                regionData.set(
                    canvasData.subarray(srcOffset, srcOffset + rowBytes),
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
            canvas.upload()
        }

        // const elapsed = performance.now() - startTime;
        // return { 
        //     pixels: pixelsDrawn, 
        //     time: elapsed,
        //     width: cursorX - x,
        //     height: this.lineHeight
        // };
    }

    /**
     * Draw text with custom tint color
     * @param {PixelBuffer} canvas 
     * @param {string} text 
     * @param {number} x 
     * @param {number} y 
     * @param {number} r 
     * @param {number} g 
     * @param {number} b 
     * @param {number} a 
     * @returns 
     */
    drawTextWithTint(canvas, text, x, y, r, g, b, a = 255, camera = undefined) {
        return this.drawText(canvas, text, x, y, { r, g, b, a }, camera);
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

    /**
     * 
     * @param {PixelBuffer} canvas 
     * @param {*} text 
     * @param {*} x 
     * @param {*} y 
     * @param {*} maxWidth 
     * @param {*} align 
     * @param {*} color 
     * @returns 
     */
    drawMultilineText(canvas, text, x, y, maxWidth, align = 'left', color = { r: 255, g: 255, b: 255, a: 255 }, camera = undefined) {
        const lines = this.wrapText(text, maxWidth);
        let currentY = y;

        lines.forEach(line => {
            const metrics = this.measureText(line);
            let lineX = x;

            // Apply alignment
            if (align === 'center') {
                lineX = x + (maxWidth - metrics.width) / 2;
            } else if (align === 'right') {
                lineX = x + maxWidth - metrics.width;
            }

            this.drawText(canvas, line, lineX, currentY, color, camera);
            currentY += this.lineHeight + this.config.lineGap;
        });

        return {
            width: maxWidth,
            height: lines.length * this.lineHeight
        };
    }
}
