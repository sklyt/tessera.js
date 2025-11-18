// blending.js

import { PixelBuffer } from "./pixel_buffer.js";

export class BlendMode {
    static NORMAL = 'normal';
    static MULTIPLY = 'multiply';
    static SCREEN = 'screen';
    static OVERLAY = 'overlay';
    static ADD = 'add';
    static SUBTRACT = 'subtract';
    static DARKEN = 'darken';
    static LIGHTEN = 'lighten';
    static DIFFERENCE = 'difference';
    static COLOR_DODGE = 'color_dodge';
    static COLOR_BURN = 'color_burn';
}

export class Compositor {

    static tempCanvas = undefined;
    /**
     *  Blend two colors using specified blend mode(colors on top of each other don't override but blend)
     * Returns the blended color (before alpha compositing)
     * @param {number} srcR 
     * @param {number} srcG 
     * @param {number} srcB 
     * @param {number} dstR 
     * @param {number} dstG 
     * @param {number} dstB 
     * @param {BlendMode} mode 
     * @returns 
     */
    static blendColors(srcR, srcG, srcB, dstR, dstG, dstB, mode) {
        switch (mode) {
            case BlendMode.NORMAL:
                return { r: srcR, g: srcG, b: srcB };

            case BlendMode.MULTIPLY:
                return {
                    r: Math.floor((srcR * dstR) / 255),
                    g: Math.floor((srcG * dstG) / 255),
                    b: Math.floor((srcB * dstB) / 255)
                };

            case BlendMode.SCREEN:
                return {
                    r: 255 - Math.floor(((255 - srcR) * (255 - dstR)) / 255),
                    g: 255 - Math.floor(((255 - srcG) * (255 - dstG)) / 255),
                    b: 255 - Math.floor(((255 - srcB) * (255 - dstB)) / 255)
                };

            case BlendMode.OVERLAY:
                return {
                    r: Compositor._overlayChannel(srcR, dstR),
                    g: Compositor._overlayChannel(srcG, dstG),
                    b: Compositor._overlayChannel(srcB, dstB)
                };

            case BlendMode.ADD:
                return {
                    r: Math.min(255, srcR + dstR),
                    g: Math.min(255, srcG + dstG),
                    b: Math.min(255, srcB + dstB)
                };

            case BlendMode.SUBTRACT:
                return {
                    r: Math.max(0, dstR - srcR),
                    g: Math.max(0, dstG - srcG),
                    b: Math.max(0, dstB - srcB)
                };

            case BlendMode.DARKEN:
                return {
                    r: Math.min(srcR, dstR),
                    g: Math.min(srcG, dstG),
                    b: Math.min(srcB, dstB)
                };

            case BlendMode.LIGHTEN:
                return {
                    r: Math.max(srcR, dstR),
                    g: Math.max(srcG, dstG),
                    b: Math.max(srcB, dstB)
                };

            case BlendMode.DIFFERENCE:
                return {
                    r: Math.abs(srcR - dstR),
                    g: Math.abs(srcG - dstG),
                    b: Math.abs(srcB - dstB)
                };

            case BlendMode.COLOR_DODGE:
                return {
                    r: Compositor._dodgeChannel(srcR, dstR),
                    g: Compositor._dodgeChannel(srcG, dstG),
                    b: Compositor._dodgeChannel(srcB, dstB)
                };

            case BlendMode.COLOR_BURN:
                return {
                    r: Compositor._burnChannel(srcR, dstR),
                    g: Compositor._burnChannel(srcG, dstG),
                    b: Compositor._burnChannel(srcB, dstB)
                };

            default:
                return { r: srcR, g: srcG, b: srcB };
        }
    }

    /**
     * Overlay blend for a single channel
     */
    static _overlayChannel(src, dst) {
        if (dst < 128) {
            // Multiply mode for dark areas
            return Math.floor((2 * src * dst) / 255);
        } else {
            // Screen mode for light areas
            return 255 - Math.floor((2 * (255 - src) * (255 - dst)) / 255);
        }
    }

    /**
     * Color dodge: brightens destination based on source
     */
    static _dodgeChannel(src, dst) {
        if (src === 255) return 255;
        return Math.min(255, Math.floor((dst * 255) / (255 - src)));
    }

    /**
     * Color burn: darkens destination based on source
     */
    static _burnChannel(src, dst) {
        if (src === 0) return 0;
        return Math.max(0, 255 - Math.floor(((255 - dst) * 255) / src));
    }

/**
 * Composite source over destination (Porter-Duff Source Over)
 * This is THE standard compositing operation
 * @param {number} srcR 
 * @param {number} srcG 
 * @param {number} srcB 
 * @param {number} srcA 
 * @param {number} dstR 
 * @param {number} dstG 
 * @param {number} dstB 
 * @param {number} dstA 
 * @param {BlendMode} blendMode 
 * @returns 
 */
    static sourceOver(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, blendMode = BlendMode.NORMAL) {
        // normalize
        const sa = srcA / 255;
        const da = dstA / 255;

        // Porter-Duff Source Over alpha calculation
        const outA = sa + da * (1 - sa);

        // fully transparent output
        if (outA === 0) {
            return { r: 0, g: 0, b: 0, a: 0 };
        }


        const blended = Compositor.blendColors(srcR, srcG, srcB, dstR, dstG, dstB, blendMode);

        // Composite using Source Over formula
        // out.rgb = (src.rgb × src.a + dst.rgb × dst.a × (1 - src.a)) / out.a
        const outR = Math.floor((blended.r * sa + dstR * da * (1 - sa)) / outA);
        const outG = Math.floor((blended.g * sa + dstG * da * (1 - sa)) / outA);
        const outB = Math.floor((blended.b * sa + dstB * da * (1 - sa)) / outA);

        return {
            r: Math.max(0, Math.min(255, outR)),
            g: Math.max(0, Math.min(255, outG)),
            b: Math.max(0, Math.min(255, outB)),
            a: Math.floor(outA * 255)
        };
    }

    /**
     * Draw with blend mode support
     * This wraps any drawing operation with proper compositing
     * @param {PixelBuffer} canvas 
     * @param {Function} drawFunc 
     * @param {BlendMode} blendMode 
     * @returns 
     */
    static drawWithBlend(canvas, drawFunc, blendMode = BlendMode.NORMAL) {
        // const startTime = performance.now();

    
        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;


        if(!this.tempCanvas)
            this.tempCanvas = new PixelBuffer(canvas.renderer, canvas.width, canvas.height);
       
        this.tempCanvas.clear(0, 0, 0, 0); // Transparent

        // Execute the draw function on temporary canvas
        drawFunc(this.tempCanvas);

        // Composite temp onto main canvas with blend mode
        const tempData = this.tempCanvas.data;
        let pixelsComposited = 0;

        for (let i = 0; i < data.length; i += 4) {
            const srcR = tempData[i + 0];
            const srcG = tempData[i + 1];
            const srcB = tempData[i + 2];
            const srcA = tempData[i + 3];

            // Skip fully transparent source pixels
            if (srcA === 0) continue;

            const dstR = data[i + 0];
            const dstG = data[i + 1];
            const dstB = data[i + 2];
            const dstA = data[i + 3];

            // Composite
            const result = Compositor.sourceOver(
                srcR, srcG, srcB, srcA,
                dstR, dstG, dstB, dstA,
                blendMode
            );

            data[i + 0] = result.r;
            data[i + 1] = result.g;
            data[i + 2] = result.b;
            data[i + 3] = result.a;

            pixelsComposited++;
        }

        canvas.renderer.updateBufferData(canvas.bufferId, data);
        canvas.needsUpload = true;

        // TODO: cleanup temp canvas? or leave it in cache for reuse, recreating all the time is a waste, creates an extra c++ texture too
        // this.tempCanvas.destroy();

        // const elapsed = performance.now() - startTime;
        // return { pixels: pixelsComposited, time: elapsed };
    }

   /**
     * Optimized version: draw directly with blend mode (no temp buffer)
     * Use this for single shape operations
    * @param {PixelBuffer} canvas 
    * @param {number} x 
    * @param {number} y 
    * @param {number} srcR 
    * @param {number} srcG 
    * @param {number} srcB 
    * @param {number} srcA 
    * @param {BlendMode} blendMode 
    * @returns 
    */
    static setPixelBlended(canvas, x, y, srcR, srcG, srcB, srcA, blendMode = BlendMode.NORMAL) {
        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

        const idx = (y * canvas.width + x) * 4;
        const data = canvas.data;

        const dstR = data[idx + 0];
        const dstG = data[idx + 1];
        const dstB = data[idx + 2];
        const dstA = data[idx + 3];

        const result = Compositor.sourceOver(
            srcR, srcG, srcB, srcA,
            dstR, dstG, dstB, dstA,
            blendMode
        );

        data[idx + 0] = result.r;
        data[idx + 1] = result.g;
        data[idx + 2] = result.b;
        data[idx + 3] = result.a;
    }

    /**
 * Create a gradient for testing blend modes
 */
    static createTestGradient(canvas) {
        for (let x = 0; x < canvas.width; x++) {
            for (let y = 0; y < canvas.height; y++) {
                const r = Math.floor((x / canvas.width) * 255);
                const g = Math.floor((y / canvas.height) * 255);
                const b = 128;
                canvas.setPixel(x, y, r, g, b, 255);
            }
        }
        canvas.upload();
    }
}

