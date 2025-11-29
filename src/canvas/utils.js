
export class DrawingUtils {
    /**
     * Clamp a region to canvas bounds and check if it's valid
     */
    static clampRegion(canvas, x, y, width, height) {
        const clampedX = Math.max(0, Math.floor(x));
        const clampedY = Math.max(0, Math.floor(y));
        const clampedWidth = Math.min(canvas.width - clampedX, Math.ceil(width));
        const clampedHeight = Math.min(canvas.height - clampedY, Math.ceil(height));
        
        return {
            x: clampedX,
            y: clampedY,
            width: clampedWidth,
            height: clampedHeight,
            isValid: clampedWidth > 0 && clampedHeight > 0
        };
    }
    
    /**
     * Check if a point should be clipped by camera viewport
     */
    static shouldClipPoint(camera, canvasX, canvasY) {
        if (!camera || !camera.viewport) return false;
        return camera.viewport.shouldClip(canvasX, canvasY);
    }
    
    /**
     * Check if a region should be clipped by camera viewport
     */
    static shouldClipRegion(camera, x, y, width, height) {
        if (!camera || !camera.viewport) return false;
        
        // Check if any corner of the region is visible
        const corners = [
            [x, y], [x + width, y],
            [x, y + height], [x + width, y + height]
        ];
        
        // If all corners are outside viewport, clip the entire region
        return corners.every(([cx, cy]) => camera.viewport.shouldClip(cx, cy));
    }
    
    /**
     * Safe region extraction with bounds checking
     */
    static extractRegionSafe(data, bufferWidth, x, y, width, height) {
        const clamped = this.clampRegion(
            { width: bufferWidth, height: Math.floor(data.length / (bufferWidth * 4)) },
            x, y, width, height
        );
        
        if (!clamped.isValid) {
            return new Uint8Array(0);
        }
        
        const region = new Uint8Array(clamped.width * clamped.height * 4);
        
        for (let row = 0; row < clamped.height; row++) {
            const srcOffset = ((clamped.y + row) * bufferWidth + clamped.x) * 4;
            const dstOffset = row * clamped.width * 4;
            const rowBytes = clamped.width * 4;
            
            if (srcOffset + rowBytes <= data.length) {
                region.set(data.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
            }
        }
        
        return region;
    }
    
    /**
     * Safe buffer update with error handling
     */
    static safeBufferUpdate(canvas, regionData, x, y, width, height) {
        try {
            const clamped = this.clampRegion(canvas, x, y, width, height);
            
            if (!clamped.isValid || regionData.length === 0) {
                return false;
            }
            
            // Ensure regionData matches the clamped size
            const expectedSize = clamped.width * clamped.height * 4;
            if (regionData.length !== expectedSize) {
                console.warn(`Region data size mismatch: expected ${expectedSize}, got ${regionData.length}`);
                return false;
            }
            
            canvas.renderer.updateBufferData(
                canvas.bufferId,
                regionData,
                clamped.x, clamped.y,
                clamped.width, clamped.height
            );
            
            return true;
        } catch (error) {
            console.error('Buffer update failed:', error);
            return false;
        }
    }
}