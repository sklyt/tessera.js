export class PixelBuffer {
    /**
     * Create a pixel buffer - our fundamental drawing surface
     * @param {Renderer} renderer - The rendering backend (C++/NAPI)
     * @param {number} width - Buffer width in pixels
     * @param {number} height - Buffer height in pixels
     */
    constructor(renderer, width, height, debug = false) {
        this.renderer = renderer;
        this.width = width;
        this.height = height;
        this.DEBUG = debug

      
        const size = width * height * 4; // RGBA = 4 bytes per pixel

        // Create shared buffer between JS and C++
        this.bufferId = renderer.createSharedBuffer(size, width, height);

        // Get JS view of the buffer data
        this.data = renderer.getBufferData(this.bufferId);

        // Create GPU texture for this buffer
        this.textureId = renderer.loadTextureFromBuffer(this.bufferId, width, height);
        this.needsUpload = false;

        if (this.DEBUG)
            console.log(`Created ${width}x${height} buffer (${size} bytes)`);
    }

    /**
     * Convert 2D coordinate to 1D memory index
     * This is THE fundamental operation - understand this and you understand pixel buffers
     */
    coordToIndex(x, y) {
        // Bounds checking is critical - out of bounds = memory corruption or crash (nasty segfault)
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return -1; // Invalid coordinate
        }
        return (y * this.width + x) * 4;
    }

/**
 * Set a single pixel (0-255 color values) 
 * Atomic operation - everything builds from this
 * @param {number} x 
 * @param {number} y 
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @param {number} a 
 * @returns 
 */
    setPixel(x, y, r, g, b, a = 255) {
        const idx = this.coordToIndex(x, y);
        if (idx === -1) return; // Out of bounds, silently ignore

        // Write RGBA values to buffer
        this.data[idx + 0] = r;     // Red
        this.data[idx + 1] = g;     // Green  
        this.data[idx + 2] = b;     // Blue
        this.data[idx + 3] = a;     // Alpha

        // Update the C++ buffer with just this pixel
        this.renderer.updateBufferData(
            this.bufferId,
            this.data.subarray(idx, idx + 4), // Only send the 4 bytes we changed
            x, y,
            1, 1
        );

        this.needsUpload = true;
    }

/**
 * Get pixel color at coordinate
 * @param {number} x 
 * @param {number} y 
 * @returns 
 */
    getPixel(x, y) {
        const idx = this.coordToIndex(x, y);
        if (idx === -1) return null;

        return {
            r: this.data[idx + 0],
            g: this.data[idx + 1],
            b: this.data[idx + 2],
            a: this.data[idx + 3]
        };
    }

/**
 * Fill entire buffer with a color
* This is a FULL buffer update - no region tracking neede
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @param {number} a 
 */
    clear(r, g, b, a = 255) {

        // const startTime = performance.now();


        for (let i = 0; i < this.data.length; i += 4) {
            this.data[i + 0] = r;
            this.data[i + 1] = g;
            this.data[i + 2] = b;
            this.data[i + 3] = a;
        }

        // update entire buffer in one call
        this.renderer.updateBufferData(this.bufferId, this.data);
        this.needsUpload = true;

    //     const elapsed = performance.now() - startTime;
    // if (this.DEBUG)
    //     console.log(`Clear (${this.width}x${this.height}): ${elapsed.toFixed(2)}ms`);
    }

    /**
     * Upload buffer changes to GPU texture
     * Call this after all your pixel operations are done
     */
    upload() {
        if (!this.needsUpload) return;

        // const startTime = performance.now();
        this.renderer.updateTextureFromBuffer(this.textureId, this.bufferId);
        this.needsUpload = false;

    //     const elapsed = performance.now() - startTime;
    // if (this.DEBUG) 
    //     console.log(`GPU upload: ${elapsed.toFixed(2)}ms`);
    }

  /**
   * Draw this buffer to the screen at specified position
   * @param {number} x 
   * @param {number} y 
   */
    draw(x, y) {
        this.renderer.drawTexture(this.textureId, { x, y });
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.renderer.unloadTexture(this.textureId);
        // this.renderer.destroySharedBuffer(this.bufferId); TODO: manual deletion(RAII hanldes this)
    }
}