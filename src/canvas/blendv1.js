// blending.js
import { PixelBuffer } from "./pixel_buffer.js";

/** @enum {number} */
export const BlendMode = {
    NORMAL: 0,
    MULTIPLY: 1,
    SCREEN: 2,
    OVERLAY: 3,
    ADD: 4,
    SUBTRACT: 5,
    DARKEN: 6,
    LIGHTEN: 7,
    DIFFERENCE: 8,
    COLOR_DODGE: 9,
    COLOR_BURN: 10
};

/**
 * High-performance compositor with zero allocations in hot paths
 * All functions are inlined and branch-reduced for maximum performance
 */
export class Compositor {
    static tempCanvas = undefined;
    
    /**
     *
     * No object allocations, minimal branching, precomputed values
     * @param {PixelBuffer} canvas - Target pixel buffer
     * @param {Function} drawFunc - Drawing function that operates on temp canvas
     * @param {number} blendMode - Blend mode from BlendMode enum
     */
    static drawWithBlend(canvas, drawFunc, blendMode = BlendMode.NORMAL) {
        const width = canvas.width;
        const height = canvas.height;
        const data = canvas.data;
        
        
        if (!this.tempCanvas) {
            this.tempCanvas = new PixelBuffer(canvas.renderer, width, height);
        }
        
        this.tempCanvas.clear(0, 0, 0, 0);
        drawFunc(this.tempCanvas);
        
        const tempData = this.tempCanvas.data;
        const length = data.length;
        

        const blendFunc = this._getBlendFunction(blendMode);
        
        // Unrolled loop - process 4 pixels at a time for better cache performance
        for (let i = 0; i < length; i += 16) {
            // Pixel 0
            if (tempData[i + 3] !== 0) {
                blendFunc(
                    tempData[i], tempData[i + 1], tempData[i + 2], tempData[i + 3],
                    data[i], data[i + 1], data[i + 2], data[i + 3],
                    data, i
                );
            }
            
            // Pixel 1  
            if (tempData[i + 7] !== 0) {
                blendFunc(
                    tempData[i + 4], tempData[i + 5], tempData[i + 6], tempData[i + 7],
                    data[i + 4], data[i + 5], data[i + 6], data[i + 7],
                    data, i + 4
                );
            }
            
            // Pixel 2
            if (tempData[i + 11] !== 0) {
                blendFunc(
                    tempData[i + 8], tempData[i + 9], tempData[i + 10], tempData[i + 11],
                    data[i + 8], data[i + 9], data[i + 10], data[i + 11],
                    data, i + 8
                );
            }
            
            // Pixel 3
            if (tempData[i + 15] !== 0) {
                blendFunc(
                    tempData[i + 12], tempData[i + 13], tempData[i + 14], tempData[i + 15],
                    data[i + 12], data[i + 13], data[i + 14], data[i + 15],
                    data, i + 12
                );
            }
        }
        
        canvas.renderer.updateBufferData(canvas.bufferId, data);
        canvas.needsUpload = true;
    }
    
    /**
     * Get pre-bound blend function to eliminate switch statement in hot loop
     * @param {number} blendMode 
     * @returns {Function}
     */
    static _getBlendFunction(blendMode) {
        switch (blendMode) {
            case BlendMode.MULTIPLY: return this._blendMultiply;
            case BlendMode.SCREEN: return this._blendScreen;
            case BlendMode.OVERLAY: return this._blendOverlay;
            case BlendMode.ADD: return this._blendAdd;
            case BlendMode.SUBTRACT: return this._blendSubtract;
            case BlendMode.DARKEN: return this._blendDarken;
            case BlendMode.LIGHTEN: return this._blendLighten;
            case BlendMode.DIFFERENCE: return this._blendDifference;
            case BlendMode.COLOR_DODGE: return this._blendColorDodge;
            case BlendMode.COLOR_BURN: return this._blendColorBurn;
            default: return this._blendNormal;
        }
    }
    
    /**
     * Normal blend - direct source over destination
     * Inlined Porter-Duff source over composition
     */
    static _blendNormal(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx) {
        if (srcA === 255) {
            // Fast path: fully opaque source
            data[idx] = srcR;
            data[idx + 1] = srcG;
            data[idx + 2] = srcB;
            data[idx + 3] = 255;
            return;
        }
        
        if (srcA === 0) return;
        
        // Porter-Duff source over with precomputed values
        const sa = srcA * 0.00392156862745098; // srcA / 255
        const da = dstA * 0.00392156862745098; // dstA / 255
        const outA = sa + da * (1 - sa);
        
        if (outA < 0.001) { // ~0.25 alpha value threshold
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = 0;
            return;
        }
        
        const invOutA = 1 / outA;
        data[idx] = (srcR * sa + dstR * da * (1 - sa)) * invOutA;
        data[idx + 1] = (srcG * sa + dstG * da * (1 - sa)) * invOutA;
        data[idx + 2] = (srcB * sa + dstB * da * (1 - sa)) * invOutA;
        data[idx + 3] = outA * 255;
    }
    
    /**
     * Multiply blend - colors are multiplied
     */
    static _blendMultiply(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx) {
        if (srcA === 0) return;
        
        const sa = srcA * 0.00392156862745098;
        const da = dstA * 0.00392156862745098;
        const outA = sa + da * (1 - sa);
        
        if (outA < 0.001) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            return;
        }
        
        const invOutA = 1 / outA;
        const r = (srcR * dstR) * 0.00392156862745098; // / 255
        const g = (srcG * dstG) * 0.00392156862745098;
        const b = (srcB * dstB) * 0.00392156862745098;
        
        data[idx] = (r * sa + dstR * da * (1 - sa)) * invOutA;
        data[idx + 1] = (g * sa + dstG * da * (1 - sa)) * invOutA;
        data[idx + 2] = (b * sa + dstB * da * (1 - sa)) * invOutA;
        data[idx + 3] = outA * 255;
    }
    
    /**
     * Screen blend - opposite of multiply
     */
    static _blendScreen(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx) {
        if (srcA === 0) return;
        
        const sa = srcA * 0.00392156862745098;
        const da = dstA * 0.00392156862745098;
        const outA = sa + da * (1 - sa);
        
        if (outA < 0.001) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            return;
        }
        
        const invOutA = 1 / outA;
        const r = 255 - ((255 - srcR) * (255 - dstR)) * 0.00392156862745098;
        const g = 255 - ((255 - srcG) * (255 - dstG)) * 0.00392156862745098;
        const b = 255 - ((255 - srcB) * (255 - dstB)) * 0.00392156862745098;
        
        data[idx] = (r * sa + dstR * da * (1 - sa)) * invOutA;
        data[idx + 1] = (g * sa + dstG * da * (1 - sa)) * invOutA;
        data[idx + 2] = (b * sa + dstB * da * (1 - sa)) * invOutA;
        data[idx + 3] = outA * 255;
    }
    
    /**
     * Overlay blend - multiply or screen based on destination
     */
    static _blendOverlay(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx) {
        if (srcA === 0) return;
        
        const sa = srcA * 0.00392156862745098;
        const da = dstA * 0.00392156862745098;
        const outA = sa + da * (1 - sa);
        
        if (outA < 0.001) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            return;
        }
        
        const invOutA = 1 / outA;
        
        // inlined overlay per channel
        const r = dstR < 128 ? 
            (2 * srcR * dstR) * 0.00392156862745098 : 
            255 - (2 * (255 - srcR) * (255 - dstR)) * 0.00392156862745098;
            
        const g = dstG < 128 ? 
            (2 * srcG * dstG) * 0.00392156862745098 : 
            255 - (2 * (255 - srcG) * (255 - dstG)) * 0.00392156862745098;
            
        const b = dstB < 128 ? 
            (2 * srcB * dstB) * 0.00392156862745098 : 
            255 - (2 * (255 - srcB) * (255 - dstB)) * 0.00392156862745098;
        
        data[idx] = (r * sa + dstR * da * (1 - sa)) * invOutA;
        data[idx + 1] = (g * sa + dstG * da * (1 - sa)) * invOutA;
        data[idx + 2] = (b * sa + dstB * da * (1 - sa)) * invOutA;
        data[idx + 3] = outA * 255;
    }
    
    /**
     * Add blend - add source and destination
     */
    static _blendAdd(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx) {
        if (srcA === 0) return;
        
        const sa = srcA * 0.00392156862745098;
        const da = dstA * 0.00392156862745098;
        const outA = sa + da * (1 - sa);
        
        if (outA < 0.001) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            return;
        }
        
        const invOutA = 1 / outA;
        const r = srcR + dstR; if (r > 255) r = 255;
        const g = srcG + dstG; if (g > 255) g = 255;
        const b = srcB + dstB; if (b > 255) b = 255;
        
        data[idx] = (r * sa + dstR * da * (1 - sa)) * invOutA;
        data[idx + 1] = (g * sa + dstG * da * (1 - sa)) * invOutA;
        data[idx + 2] = (b * sa + dstB * da * (1 - sa)) * invOutA;
        data[idx + 3] = outA * 255;
    }
    
    /**
     * Subtract blend - subtract source from destination
     */
    static _blendSubtract(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx) {
        if (srcA === 0) return;
        
        const sa = srcA * 0.00392156862745098;
        const da = dstA * 0.00392156862745098;
        const outA = sa + da * (1 - sa);
        
        if (outA < 0.001) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            return;
        }
        
        const invOutA = 1 / outA;
        const r = dstR - srcR; if (r < 0) r = 0;
        const g = dstG - srcG; if (g < 0) g = 0;
        const b = dstB - srcB; if (b < 0) b = 0;
        
        data[idx] = (r * sa + dstR * da * (1 - sa)) * invOutA;
        data[idx + 1] = (g * sa + dstG * da * (1 - sa)) * invOutA;
        data[idx + 2] = (b * sa + dstB * da * (1 - sa)) * invOutA;
        data[idx + 3] = outA * 255;
    }
    
    /**
     * Darken blend - take minimum of source and destination
     */
    static _blendDarken(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx) {
        if (srcA === 0) return;
        
        const sa = srcA * 0.00392156862745098;
        const da = dstA * 0.00392156862745098;
        const outA = sa + da * (1 - sa);
        
        if (outA < 0.001) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            return;
        }
        
        const invOutA = 1 / outA;
        const r = srcR < dstR ? srcR : dstR;
        const g = srcG < dstG ? srcG : dstG;
        const b = srcB < dstB ? srcB : dstB;
        
        data[idx] = (r * sa + dstR * da * (1 - sa)) * invOutA;
        data[idx + 1] = (g * sa + dstG * da * (1 - sa)) * invOutA;
        data[idx + 2] = (b * sa + dstB * da * (1 - sa)) * invOutA;
        data[idx + 3] = outA * 255;
    }
    
    /**
     * Lighten blend - take maximum of source and destination
     */
    static _blendLighten(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx) {
        if (srcA === 0) return;
        
        const sa = srcA * 0.00392156862745098;
        const da = dstA * 0.00392156862745098;
        const outA = sa + da * (1 - sa);
        
        if (outA < 0.001) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            return;
        }
        
        const invOutA = 1 / outA;
        const r = srcR > dstR ? srcR : dstR;
        const g = srcG > dstG ? srcG : dstG;
        const b = srcB > dstB ? srcB : dstB;
        
        data[idx] = (r * sa + dstR * da * (1 - sa)) * invOutA;
        data[idx + 1] = (g * sa + dstG * da * (1 - sa)) * invOutA;
        data[idx + 2] = (b * sa + dstB * da * (1 - sa)) * invOutA;
        data[idx + 3] = outA * 255;
    }
    
    /**
     * Difference blend - absolute difference between source and destination
     */
    static _blendDifference(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx) {
        if (srcA === 0) return;
        
        const sa = srcA * 0.00392156862745098;
        const da = dstA * 0.00392156862745098;
        const outA = sa + da * (1 - sa);
        
        if (outA < 0.001) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            return;
        }
        
        const invOutA = 1 / outA;
        const r = Math.abs(srcR - dstR);
        const g = Math.abs(srcG - dstG);
        const b = Math.abs(srcB - dstB);
        
        data[idx] = (r * sa + dstR * da * (1 - sa)) * invOutA;
        data[idx + 1] = (g * sa + dstG * da * (1 - sa)) * invOutA;
        data[idx + 2] = (b * sa + dstB * da * (1 - sa)) * invOutA;
        data[idx + 3] = outA * 255;
    }
    
    /**
     * Color dodge blend - brighten destination based on source
     */
    static _blendColorDodge(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx) {
        if (srcA === 0) return;
        
        const sa = srcA * 0.00392156862745098;
        const da = dstA * 0.00392156862745098;
        const outA = sa + da * (1 - sa);
        
        if (outA < 0.001) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            return;
        }
        
        const invOutA = 1 / outA;
        
        //color dodge per channel
        const r = srcR === 255 ? 255 : Math.min(255, (dstR * 255) / (255 - srcR));
        const g = srcG === 255 ? 255 : Math.min(255, (dstG * 255) / (255 - srcG));
        const b = srcB === 255 ? 255 : Math.min(255, (dstB * 255) / (255 - srcB));
        
        data[idx] = (r * sa + dstR * da * (1 - sa)) * invOutA;
        data[idx + 1] = (g * sa + dstG * da * (1 - sa)) * invOutA;
        data[idx + 2] = (b * sa + dstB * da * (1 - sa)) * invOutA;
        data[idx + 3] = outA * 255;
    }
    
    /**
     * Color burn blend - darken destination based on source
     */
    static _blendColorBurn(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx) {
        if (srcA === 0) return;
        
        const sa = srcA * 0.00392156862745098;
        const da = dstA * 0.00392156862745098;
        const outA = sa + da * (1 - sa);
        
        if (outA < 0.001) {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
            return;
        }
        
        const invOutA = 1 / outA;
        
        // inlined color burn per channel
        const r = srcR === 0 ? 0 : Math.max(0, 255 - ((255 - dstR) * 255) / srcR);
        const g = srcG === 0 ? 0 : Math.max(0, 255 - ((255 - dstG) * 255) / srcG);
        const b = srcB === 0 ? 0 : Math.max(0, 255 - ((255 - dstB) * 255) / srcB);
        
        data[idx] = (r * sa + dstR * da * (1 - sa)) * invOutA;
        data[idx + 1] = (g * sa + dstG * da * (1 - sa)) * invOutA;
        data[idx + 2] = (b * sa + dstB * da * (1 - sa)) * invOutA;
        data[idx + 3] = outA * 255;
    }
    
    /**
     *  single pixel blend
     * @param {PixelBuffer} canvas
     * @param {number} x
     * @param {number} y
     * @param {number} srcR
     * @param {number} srcG
     * @param {number} srcB
     * @param {number} srcA
     * @param {number} blendMode
     */
    static setPixelBlended(canvas, x, y, srcR, srcG, srcB, srcA, blendMode = BlendMode.NORMAL) {
        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height || srcA === 0) return;
        
        const idx = (y * canvas.width + x) * 4;
        const data = canvas.data;
        const dstR = data[idx];
        const dstG = data[idx + 1];
        const dstB = data[idx + 2];
        const dstA = data[idx + 3];
        
        // inlined normal blend (most common case)
        if (blendMode === BlendMode.NORMAL) {
            if (srcA === 255) {
                data[idx] = srcR;
                data[idx + 1] = srcG;
                data[idx + 2] = srcB;
                data[idx + 3] = 255;
                return;
            }
            
            const sa = srcA * 0.00392156862745098;
            const da = dstA * 0.00392156862745098;
            const outA = sa + da * (1 - sa);
            
            if (outA < 0.001) {
                data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
                return;
            }
            
            const invOutA = 1 / outA;
            data[idx] = (srcR * sa + dstR * da * (1 - sa)) * invOutA;
            data[idx + 1] = (srcG * sa + dstG * da * (1 - sa)) * invOutA;
            data[idx + 2] = (srcB * sa + dstB * da * (1 - sa)) * invOutA;
            data[idx + 3] = outA * 255;
            return;
        }
        
        // for other blend modes, use the pre-bound functions
        const blendFunc = this._getBlendFunction(blendMode);
        blendFunc(srcR, srcG, srcB, srcA, dstR, dstG, dstB, dstA, data, idx);
    }
    
    /**
     * Create test gradient
     */
    static createTestGradient(canvas) {
        const width = canvas.width;
        const height = canvas.height;
        const data = canvas.data;
        
        for (let y = 0; y < height; y++) {
            const g = (y / height) * 255;
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                data[idx] = (x / width) * 255;     
                data[idx + 1] = g;                  
                data[idx + 2] = 128;               
                data[idx + 3] = 255;              
            }
        }
        canvas.upload();
    }
}