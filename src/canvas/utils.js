/**
 * Clamp a rectangle to canvas bounds
 * Returns null if completely outside canvas
 */
export function clampRectToCanvas(x, y, width, height, canvasWidth, canvasHeight) {
    const x1 = Math.max(0, Math.floor(x));
    const y1 = Math.max(0, Math.floor(y));
    const x2 = Math.min(canvasWidth, Math.ceil(x + width));
    const y2 = Math.min(canvasHeight, Math.ceil(y + height));
    
    const clampedWidth = x2 - x1;
    const clampedHeight = y2 - y1;
    
    if (clampedWidth <= 0 || clampedHeight <= 0) {
        return null; // Completely outside canvas
    }
    
    return { x: x1, y: y1, width: clampedWidth, height: clampedHeight };
}

/**
 * Check if a pixel should be drawn (canvas + viewport clipping)
 */
export function shouldDrawPixel(x, y, canvas, camera) {
    // Canvas bounds check
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
        return false;
    }
    
    // Viewport clipping (if camera has viewport)
    if (camera && camera.viewport && camera.viewport.shouldClip(x, y)) {
        return false;
    }
    
    return true;
}
