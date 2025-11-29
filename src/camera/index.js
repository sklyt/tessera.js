export class Camera {
    constructor(x = 0, y = 0, width = 800, height = 600) {
        this.x = x;           // Camera position in world space
        this.y = y;
        this.width = width;   // Viewport size
        this.height = height;
        this.viewport = null;
    }

    // World → Screen
    worldToScreen(worldX, worldY) {
        // Step 1: World to camera space
        const camX = worldX - this.x;
        const camY = worldY - this.y;

        // Step 2: Camera to screen (center of viewport)
        const screenX = camX + this.width / 2;
        const screenY = camY + this.height / 2;


        // Step 2: Apply viewport transform if set
        if (this.viewport) {
            // Scale to viewport size (if different from camera size)
            const scaleX = this.viewport.width / this.width;
            const scaleY = this.viewport.height / this.height;

            return {
                x: screenX * scaleX + this.viewport.x,
                y: screenY * scaleY + this.viewport.y
            };
        }

        return { x: screenX, y: screenY };
    }
    /**
     * 
     * @param {Viewport} viewport 
     */
    setViewport(viewport) {
        this.viewport = viewport;
    }

    // Screen → World  
    screenToWorld(screenX, screenY) {
        // // Inverse: remove centering, then add camera position
        // const camX = screenX - this.width / 2;
        // const camY = screenY - this.height / 2;

        // const worldX = camX + this.x;
        // const worldY = camY + this.y;

        // return { x: worldX, y: worldY };

        let camX, camY;

        // Step 1: Remove viewport offset if set
        if (this.viewport) {
            const scaleX = this.width / this.viewport.width;
            const scaleY = this.height / this.viewport.height;

            camX = (screenX - this.viewport.x) * scaleX;
            camY = (screenY - this.viewport.y) * scaleY;
        } else {
            camX = screenX;
            camY = screenY;
        }

        // Step 2: Camera to world space
        const worldX = camX - this.width / 2 + this.x;
        const worldY = camY - this.height / 2 + this.y;

        return { x: worldX, y: worldY };
    }

    isVisible(worldX, worldY) {
        const screen = this.worldToScreen(worldX, worldY);

        if (this.viewport) {
            return this.viewport.contains(screen.x, screen.y);
        }

        return screen.x >= 0 && screen.x < this.width &&
            screen.y >= 0 && screen.y < this.height;
    }
    // Get world-space bounds of what's visible
    getVisibleBounds() {
        const halfW = this.width / 2;
        const halfH = this.height / 2;

        return {
            left: this.x - halfW,
            right: this.x + halfW,
            top: this.y - halfH,
            bottom: this.y + halfH
        };
    }

    // Move camera (with bounds checking optional)
    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
}



export class Viewport {
    constructor(x, y, width, height) {
        this.x = x;           // Position on canvas
        this.y = y;
        this.width = width;   // Size of viewport
        this.height = height;
        this.scissorEnabled = true;
    }

    // Check if a point is inside viewport
    contains(screenX, screenY) {
        return screenX >= this.x && screenX < this.x + this.width &&
            screenY >= this.y && screenY < this.y + this.height;
    }

    // Convert viewport-local coords to canvas coords
    toCanvas(localX, localY) {
        return {
            x: localX + this.x,
            y: localY + this.y
        };
    }

    // Convert canvas coords to viewport-local coords
    toLocal(canvasX, canvasY) {
        return {
            x: canvasX - this.x,
            y: canvasY - this.y
        };
    }

    // Get aspect ratio
    getAspectRatio() {
        return this.width / this.height;
    }

    // Enable/disable scissor clipping
    setScissor(enabled) {
        this.scissorEnabled = enabled;
    }

    // Check if should clip a pixel (used during rendering)
    shouldClip(canvasX, canvasY) {
        if (!this.scissorEnabled) return false;

        return canvasX < this.x || canvasX >= this.x + this.width ||
            canvasY < this.y || canvasY >= this.y + this.height;
    }
}



export function createLetterboxedViewport(canvasWidth, canvasHeight, targetAspect) {
    const canvasAspect = canvasWidth / canvasHeight;
    
    let vpX, vpY, vpWidth, vpHeight;
    
    if (canvasAspect > targetAspect) {
        // Canvas is wider - add side bars
        vpHeight = canvasHeight;
        vpWidth = canvasHeight * targetAspect;
        vpX = (canvasWidth - vpWidth) / 2;
        vpY = 0;
    } else {
        // Canvas is taller - add top/bottom bars
        vpWidth = canvasWidth;
        vpHeight = canvasWidth / targetAspect;
        vpX = 0;
        vpY = (canvasHeight - vpHeight) / 2;
    }
    
    return new Viewport(vpX, vpY, vpWidth, vpHeight);
}


export function drawLetterboxBars(canvas, viewport) {
    // Top bar
    if (viewport.y > 0) {
        for (let y = 0; y < viewport.y; y++) {
            for (let x = 0; x < canvas.width; x++) {
                canvas.setPixel(x, y, 0, 0, 0, 255);
            }
        }
    }
    
    // Bottom bar
    const bottomY = viewport.y + viewport.height;
    if (bottomY < canvas.height) {
        for (let y = bottomY; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                canvas.setPixel(x, y, 0, 0, 0, 255);
            }
        }
    }
    
    // Left bar
    if (viewport.x > 0) {
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < viewport.x; x++) {
                canvas.setPixel(x, y, 0, 0, 0, 255);
            }
        }
    }
    
    // Right bar
    const rightX = viewport.x + viewport.width;
    if (rightX < canvas.width) {
        for (let y = 0; y < canvas.height; y++) {
            for (let x = rightX; x < canvas.width; x++) {
                canvas.setPixel(x, y, 0, 0, 0, 255);
            }
        }
    }
}