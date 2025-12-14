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

        // get's copy of buffer from C++, not shared because of ownership complexity and double buffering in c++ side
        this.bufferId = renderer.createSharedBuffer(size, width, height);

        {
            /**
            * @type {Uint8Array}
             */
            let temp = renderer.getBufferData(this.bufferId);
            /**
             * @type {Uint8Array}
             */
            this.data = new Uint8Array(new SharedArrayBuffer(size));
            this.data.set(new Uint8Array(temp));
            temp = null;
        }


        // Create GPU texture for this buffer
        this.textureId = renderer.loadTextureFromBuffer(this.bufferId, width, height);
        this.needsUpload = false;

        if (this.DEBUG)
            console.log(`Created ${width}x${height} buffer (${size} bytes)`);
    }

    /**
     * Convert 2D coordinate to 1D memory index
     * This is THE fundamental operation - understand this and you understand pixel buffers
     * @param {number} x 
     * @param {number} y 
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

        const startTime = performance.now();


        // Pack RGBA into a single 32-bit value: (A << 24) | (B << 16) | (G << 8) | R
        const color = ((a & 0xFF) << 24) | ((b & 0xFF) << 16) | ((g & 0xFF) << 8) | (r & 0xFF);

        const uint32View = new Uint32Array(this.data.buffer);

        // Native fill - much faster than JS loop
        uint32View.fill(color);

        this.renderer.updateBufferData(this.bufferId, this.data);
        this.needsUpload = true;

        const elapsed = performance.now() - startTime;
        if (this.DEBUG)
            console.log(`Clear (${this.width}x${this.height}): ${elapsed.toFixed(2)}ms`);
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
     * Grow the buffer to a larger size, preserving existing pixels.
     * If the requested size is smaller or equal, this is a no-op.
     * @param {number} newWidth
     * @param {number} newHeight
     */
    grow(newWidth, newHeight) {
        // Only allow increases
        if (newWidth <= this.width && newHeight <= this.height) return;

        const newSize = newWidth * newHeight * 4;

        // Create new shared buffer + JS view + texture
        const newBufferId = this.renderer.createSharedBuffer(newSize, newWidth, newHeight);
        const newBuffer = this.renderer.getBufferData(newBufferId);
        const newData = new Uint8Array(new SharedArrayBuffer(newSize));
        newData.set(new Uint8Array(newBuffer));
        const newTextureId = this.renderer.loadTextureFromBuffer(newBufferId, newWidth, newHeight);

        // Copy overlapping region from old buffer to new buffer
        const copyWidth = Math.min(this.width, newWidth);
        const copyHeight = Math.min(this.height, newHeight);

        for (let row = 0; row < copyHeight; row++) {
            const srcStart = row * this.width * 4;
            const srcEnd = srcStart + copyWidth * 4;
            const dstStart = row * newWidth * 4;
            newData.set(this.data.subarray(srcStart, srcEnd), dstStart);
        }

        // Upload entire new buffer to the renderer
        this.renderer.updateBufferData(newBufferId, newData);

        // Replace internals (release of old buffer is handled by native side/RAII)
        try {
            this.renderer.unloadTexture(this.textureId);
        } catch (e) {
            // Some backends may not implement unloadTexture; ignore errors
            if (this.DEBUG) console.warn('unloadTexture failed while growing buffer:', e.message || e);
        }

        this.bufferId = newBufferId;
        this.data = newData;
        this.textureId = newTextureId;
        this.width = newWidth;
        this.height = newHeight;
        this.needsUpload = true;

        if (this.DEBUG) console.log(`Grew buffer to ${newWidth}x${newHeight} (${newSize} bytes)`);
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.renderer.unloadTexture(this.textureId);
        // this.renderer.destroySharedBuffer(this.bufferId); TODO: manual deletion(RAII hanldes this)
    }
}