import { CTRL_JS_WRITE_IDX, CONTROL_BUFFER_SIZE } from '../buffer_constants.js';
import { DirtyRegionTracker } from '../render_helpers.js';


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


        // const size = width * height * 4; // RGBA = 4 bytes per pixel

        // // get's copy of buffer from C++, not shared because of ownership complexity and double buffering in c++ side
        // this.bufferId = renderer.createSharedBuffer(size, width, height);

        // {
        //     /**
        //     * @type {Uint8Array}
        //      */
        //     let temp = renderer.getBufferData(this.bufferId);
        //     /**
        //      * @type {Uint8Array}
        //      */
        //     this.data = new Uint8Array(new SharedArrayBuffer(size));
        //     this.data.set(new Uint8Array(temp));
        //     temp = null;
        // }


        // // Create GPU texture for this buffer
        // this.textureId = renderer.loadTextureFromBuffer(this.bufferId, width, height);
        // this.needsUpload = false;
        // new: createa  zero copy buffer 

        // triple buffering
        const bufferSize = width * height * 4;
        this.buffers = [
            new ArrayBuffer(bufferSize),
            new ArrayBuffer(bufferSize),
            new ArrayBuffer(bufferSize)
        ];


        this.controlBuffer = new Uint32Array(new ArrayBuffer(CONTROL_BUFFER_SIZE));

        // iinitialize zero copy shared memory in C++
        this.textureId = renderer.initSharedBuffers(
            this.buffers[0],
            this.buffers[1],
            this.buffers[2],
            this.controlBuffer.buffer,
            width,
            height
        );

        //    console.log(this.textureId)
        this.views = [
            new Uint8ClampedArray(this.buffers[0]),
            new Uint8ClampedArray(this.buffers[1]),
            new Uint8ClampedArray(this.buffers[2])
        ];

        this.dirtyTracker = new DirtyRegionTracker(this.controlBuffer);
        this.data = this.getCurrentBuffer();

        if (this.DEBUG)
            console.log(`Created ${width}x${height} buffer (${width * height * 4} bytes)`);
    }

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     * @param {number} w 
     * @param {number} h 
     */
    markRegion(x, y , w  = 1, h = 1){
      this.dirtyTracker.addRegion(x, y, w, h)
      this.needsUpload = true
    }

    getCurrentBuffer() {
        const idx = Atomics.load(this.controlBuffer, CTRL_JS_WRITE_IDX);
        return this.views[idx];
    }

    setPixel(x, y, r, g, b, a = 255) {
        const buffer = this.getCurrentBuffer();
        const idx = (y * this.width + x) * 4;

        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = a;

        this.dirtyTracker.addRegion(x, y, 1, 1);
    }

    getPixel(x, y) {
        const buffer = this.getCurrentBuffer();
        const idx = (y * this.width + x) * 4;
        return {
            r: buffer[idx],
            g: buffer[idx + 1],
            b: buffer[idx + 2],
            a: buffer[idx + 3]
        };
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
     * Fill entire buffer with a color
    * 
     * @param {number} r 
     * @param {number} g 
     * @param {number} b 
     * @param {number} a 
     */
    clear(r, g, b, a = 255) {

        const startTime = performance.now();


        // Pack RGBA into a single 32-bit value: (A << 24) | (B << 16) | (G << 8) | R
        const color = ((a & 0xFF) << 24) | ((b & 0xFF) << 16) | ((g & 0xFF) << 8) | (r & 0xFF);

        // const uint32View = new Uint32Array(this.data.buffer); old way 
        const uint32View = new Uint32Array(this.data.buffer); // new way

        // Native fill - much faster than JS loop
        uint32View.fill(color);
        this.dirtyTracker.addRegion(0, 0, this.width, this.height); // proc the control buffer dirty region count

        // this.renderer.updateBufferData(this.bufferId, this.data);
        this.needsUpload = true;

        const elapsed = performance.now() - startTime;
        if (this.DEBUG)
            console.log(`Clear (${this.width}x${this.height}): ${elapsed.toFixed(2)}ms`);
    }

    /**
     * Upload buffer changes to GPU texture
     * Call this after all your pixel operations are done
     *
     */
    upload() {
        if (!this.needsUpload) return;

        this.dirtyTracker.markDirty()
        // const startTime = performance.now();
        // this.renderer.updateTextureFromBuffer(this.textureId, this.bufferId);


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
        if (this.needsUpload) {
            this.needsUpload = false;
            this.data = this.getCurrentBuffer(); // rotate
        }

    }

    /**
     * Grow the buffer to a larger size, preserving existing pixels.
     * If the requested size is smaller or equal, this is a no-op.
     * @param {number} newWidth
     * @param {number} newHeight
     */
    grow(newWidth, newHeight) {
        // TODO: implement
    }

    /**
     * Clean up resources
     */
    destroy() {
        // TODO: implement
    }


    /**
 * Copy from cache buffer to canvas
 * @param {CacheBuffer|PixelBuffer} source - Source buffer
 * @param {number} sx - Source X
 * @param {number} sy - Source Y  
 * @param {number} sw - Source width (or full width)
 * @param {number} sh - Source height (or full height)
 * @param {number} dx - Dest X (default 0)
 * @param {number} dy - Dest Y (default 0)
 */
blitFrom(source, sx = 0, sy = 0, sw = source.width, sh = source.height, dx = 0, dy = 0) {
        const srcData = source.data;
        const dstData = this.data;

        // Clamp to bounds
        sw = Math.min(sw, source.width - sx, this.width - dx);
        sh = Math.min(sh, source.height - sy, this.height - dy);

        if (sw <= 0 || sh <= 0) return;

        // Fast path: full-width copy (can use set() directly)
        if (sx === 0 && dx === 0 && sw === source.width && sw === this.width) {
            const srcStart = sy * source.width * 4;
            const dstStart = dy * this.width * 4;
            const length = sh * this.width * 4;
            dstData.set(srcData.subarray(srcStart, srcStart + length), dstStart);
        } else {
            // Row-by-row copy
            for (let row = 0; row < sh; row++) {
                const srcOffset = ((sy + row) * source.width + sx) * 4;
                const dstOffset = ((dy + row) * this.width + dx) * 4;
                const rowBytes = sw * 4;
                dstData.set(srcData.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
            }
        }

        // Mark region dirty
        this.dirtyTracker.addRegion(dx, dy, sw, sh);
        this.needsUpload = true;
    }

    /**
     * Shorthand: blit entire source to (0,0)
     */
    blit(source) {
        this.blitFrom(source, 0, 0, source.width, source.height, 0, 0);
    }
}



export class CacheBuffer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
        this.needsUpload = false // TODO: remove, use for now to trick primitives to think they are writing to a pixel buffer
    }

    clear(r, g, b, a = 255) {
        const color = ((a & 0xFF) << 24) | ((b & 0xFF) << 16) |
            ((g & 0xFF) << 8) | (r & 0xFF);
        new Uint32Array(this.data.buffer).fill(color);
    }
}