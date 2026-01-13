import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import os from "node:os"
import fs from "node:fs"
import path from "node:path"

// Use a function to safely get these values
const getModulePaths = () => {
    try {
        // Try ESM first
        if (typeof import.meta !== 'undefined' && import.meta.url) {
            const filename = fileURLToPath(import.meta.url);
            return {
                __filename: filename,
                __dirname: dirname(filename),
                require: createRequire(import.meta.url)
            };
        }
    } catch (e) {
        // Fall through to CJS
    }

    // CJS fallback
    return {
        __filename: typeof __filename !== 'undefined' ? __filename : '',
        __dirname: typeof __dirname !== 'undefined' ? __dirname : '',
        require: typeof require !== 'undefined' ? require : () => { throw new Error('require not available'); }
    };
};

const { __filename: moduleFilename, __dirname: moduleDirname } = getModulePaths();
const __filename = moduleFilename;
const __dirname = moduleDirname;


function bufferFromAsset(a) {
    if (!a) return null;
    if (Buffer.isBuffer(a)) return a;
    if (a instanceof ArrayBuffer) return Buffer.from(a);
    if (ArrayBuffer.isView(a)) return Buffer.from(a.buffer, a.byteOffset, a.byteLength);
    if (typeof a === 'string') return Buffer.from(a, 'utf8');
    throw new TypeError('Unsupported asset type: ' + typeof a);
}

function writeFileAtomicSync(dest, buf) {
    const tmp = `${dest}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, dest);
}

function ensureDirSync(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function prependPathForLibraries(dir) {
    if (process.platform === 'win32') {
        process.env.PATH = `${dir};${process.env.PATH || ''}`;
    } else if (process.platform === 'linux') {
        process.env.LD_LIBRARY_PATH = `${dir}:${process.env.LD_LIBRARY_PATH || ''}`;
    } else if (process.platform === 'darwin') {
        process.env.DYLD_LIBRARY_PATH = `${dir}:${process.env.DYLD_LIBRARY_PATH || ''}`;
    }

}

function createRunTempDir(prefix = 'assets-extract') {
    const root = path.join(os.tmpdir(), prefix);
    ensureDirSync(root);
    // reuse per-process id so repeated requires in same process reuse files:
    const runId = process.env.ASSETS_EXTRACT_RUN_ID || (process.env.ASSETS_EXTRACT_RUN_ID = `${process.pid}-${crypto.randomUUID()}`);
    const dir = path.join(root, runId);
    ensureDirSync(dir);
    return dir;
}

function cleanupDirBestEffort(dir) {
    try {
        // attempt to remove files first (ignore failures)
        if (fs.existsSync(dir)) {
            console.log(`trying to clean temp: ${dir}`)
            for (const f of fs.readdirSync(dir)) {
                const p = path.join(dir, f);
                try { fs.unlinkSync(p); } catch (e) { /* ignore */ }
            }
            try { fs.rmdirSync(dir); } catch (e) { /* ignore */ }
        }
    } catch (e) {
        // ignore
        console.log(e)
    }
}


function cleanupOldTempDirs(prefix = 'assets-extract', maxAgeMs = 24 * 60 * 60 * 1000) {
    try {
        const root = path.join(os.tmpdir(), prefix);
        if (!fs.existsSync(root)) return;

        const now = Date.now();
        for (const entry of fs.readdirSync(root)) {
            const dirPath = path.join(root, entry);
            // Skip current process ID
            if (entry.startsWith(`${process.pid}-`)) continue;

            try {
                const stats = fs.statSync(dirPath);
                if (now - stats.mtimeMs > maxAgeMs) {
                    cleanupDirBestEffort(dirPath);
                }
            } catch (e) { /* ignore */ }
        }
    } catch (e) { /* ignore */ }
}


/**
 * @typedef {{ x: number, y: number }} Vec2
 */

/**
 * @typedef {{ r: number, g: number, b: number, a: number }} Color4
 */

/**
 * @typedef {{ data: ArrayBuffer, width: number, height: number, mipmaps: number, format: number }} Image
 */

/**
 * @typedef {number} TextureId
 */





class Input_ {
    constructor() { }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    isKeyDown(key) { }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    isKeyReleased(key) { }

    /**
     * @param {string} key
     * @param {(actionName: string, event: {type: string, keyCode: number, keyName: string, mouseButton: number, mousePosition: {x:number,y:number}, mouseDelta: {x:number,y:number}, wheelDelta: number, timestamp: number}) => void} callback
     */
    onKeyDown(key, callback) { }

    /**
     * @param {string} key
     * @param {(actionName: string, event: {type: string, keyCode: number, keyName: string, mouseButton: number, mousePosition: {x:number,y:number}, mouseDelta: {x:number,y:number}, wheelDelta: number, timestamp: number}) => void} callback
     */
    onKeyUp(key, callback) { }

    /**
     * @param {number} button
     * @param {(actionName: string, event: {type: string, keyCode: number, keyName: string, mouseButton: number, mousePosition: {x:number,y:number}, mouseDelta: {x:number,y:number}, wheelDelta: number, timestamp: number}) => void} callback
     */
    onMouseDown(button, callback) { }

    /**
     * @param {number} button
     * @param {(actionName: string, event: {type: string, keyCode: number, keyName: string, mouseButton: number, mousePosition: {x:number,y:number}, mouseDelta: {x:number,y:number}, wheelDelta: number, timestamp: number}) => void} callback
     */
    onMouseUp(button, callback) { }

    /**
     * @param {(actionName: string, event: {type: string, keyCode: number, keyName: string, mouseButton: number, mousePosition: {x:number,y:number}, mouseDelta: {x:number,y:number}, wheelDelta: number, timestamp: number}) => void} callback
     */
    onMouseMove(callback) { }

    /**
     * @param {(actionName: string, event: {type: string, keyCode: number, keyName: string, mouseButton: number, mousePosition: {x:number,y:number}, mouseDelta: {x:number,y:number}, wheelDelta: number, timestamp: number}) => void} callback
     */
    onMouseWheel(callback) { }
}



class Audio_ {
    constructor() { }

    /**
     * Initialize audio device
     * @returns {boolean}
     */
    initialize() { }

    /**
     * Shutdown audio device and free resources
     * @returns {void}
     */
    shutdown() { }

    /**
     * Load sound from disk
     * @param {string} filePath
     * @returns {number} handle (0 on failure)
     */
    loadSound(filePath) { }

    /**
     * Load sound from memory buffer
     * @param {string} fileType - e.g. '.wav' or '.ogg' (leading dot accepted/required by backend)
     * @param {Buffer|ArrayBuffer|TypedArray|SharedArrayBuffer} buffer
     * @returns {number} handle (0 on failure)
     */
    loadSoundFromMemory(fileType, buffer) { }

    /**
     * Play a loaded sound (one-shot)
     * @param {number} handle
     * @returns {void}
     */
    playSound(handle) { }

    /**
     * Stop a sound
     * @param {number} handle
     * @returns {void}
     */
    stopSound(handle) { }

    /**
     * Pause a sound
     * @param {number} handle
     * @returns {void}
     */
    pauseSound(handle) { }

    /**
     * Resume a paused sound
     * @param {number} handle
     * @returns {void}
     */
    resumeSound(handle) { }

    /**
     * Set per-sound volume (0..1) multiplied by master volume internally
     * @param {number} handle
     * @param {number} volume
     * @returns {void}
     */
    setSoundVolume(handle, volume) { }

    /**
     * Query whether a sound is playing
     * @param {number} handle
     * @returns {boolean}
     */
    isSoundPlaying(handle) { }

    /**
     * Unload sound and free resources
     * @param {number} handle
     * @returns {void}
     */
    unloadSound(handle) { }

    /**
     * Register callback for sound end (fired once when the sound finishes)
     * @param {number} handle
     * @param {(handle: number) => void} callback
     * @returns {void}
     */
    onSoundEnd(handle, callback) { }

    /**
     * Load music (streamed) from disk
     * @param {string} filePath
     * @returns {number} handle (0 on failure)
     */
    loadMusic(filePath) { }

    /**
     * Load music (streamed) from memory
     * @param {string} fileType
     * @param {Buffer|ArrayBuffer|TypedArray|SharedArrayBuffer} buffer
     * @returns {number} handle (0 on failure)
     */
    loadMusicFromMemory(fileType, buffer) { }

    /**
     * Play music stream
     * @param {number} handle
     * @returns {void}
     */
    playMusic(handle) { }

    /**
     * Stop music stream
     * @param {number} handle
     * @returns {void}
     */
    stopMusic(handle) { }

    /**
     * Pause music stream
     * @param {number} handle
     * @returns {void}
     */
    pauseMusic(handle) { }

    /**
     * Resume music stream
     * @param {number} handle
     * @returns {void}
     */
    resumeMusic(handle) { }

    /**
     * Set music volume (0..1) multiplied by master volume
     * @param {number} handle
     * @param {number} volume
     * @returns {void}
     */
    setMusicVolume(handle, volume) { }

    /**
     * Query whether music is playing
     * @param {number} handle
     * @returns {boolean}
     */
    isMusicPlaying(handle) { }

    /**
     * Unload music stream and free resources
     * @param {number} handle
     * @returns {void}
     */
    unloadMusic(handle) { }

    /**
     * Register callback fired when music stream ends
     * @param {number} handle
     * @param {(handle: number) => void} callback
     * @returns {void}
     */
    onMusicEnd(handle, callback) { }

    /**
     * Create a low-level audio stream for procedural audio
     * @param {number} sampleRate
     * @param {number} sampleSizeBits
     * @param {number} channels
     * @returns {number} streamHandle
     */
    loadAudioStream(sampleRate, sampleSizeBits, channels) { }

    /**
     * Update an audio stream by pushing PCM frames (interleaved)
     * @param {number} streamHandle
     * @param {Buffer|Float32Array|Int16Array} data - frames * channels samples
     * @param {number} frameCount
     * @returns {void}
     */
    updateAudioStream(streamHandle, data, frameCount) { }

    /**
     * Play an audio stream
     * @param {number} streamHandle
     * @returns {void}
     */
    playAudioStream(streamHandle) { }

    /**
     * Pause an audio stream
     * @param {number} streamHandle
     * @returns {void}
     */
    pauseAudioStream(streamHandle) { }

    /**
     * Resume an audio stream
     * @param {number} streamHandle
     * @returns {void}
     */
    resumeAudioStream(streamHandle) { }

    /**
     * Stop an audio stream
     * @param {number} streamHandle
     * @returns {void}
     */
    stopAudioStream(streamHandle) { }

    /**
     * Set per-stream volume
     * @param {number} streamHandle
     * @param {number} volume
     * @returns {void}
     */
    setAudioStreamVolume(streamHandle, volume) { }

    /**
     * Attach a processor callback to a specific stream
     * @param {number} streamHandle
     * @param {(bufferData: Float32Array, frames: number) => void} processor
     * @returns {void}
     */
    attachAudioStreamProcessor(streamHandle, processor) { }

    /**
     * Detach a previously attached stream processor
     * @param {number} streamHandle
     * @param {(bufferData: Float32Array, frames: number) => void} processor
     * @returns {void}
     */
    detachAudioStreamProcessor(streamHandle, processor) { }

    /**
     * Attach a global mixed audio processor (receives mixed frames)
     * @param {(bufferData: Float32Array, frames: number) => void} processor
     * @returns {void}
     */
    attachAudioMixedProcessor(processor) { }

    /**
     * Detach a global mixed audio processor
     * @param {(bufferData: Float32Array, frames: number) => void} processor
     * @returns {void}
     */
    detachAudioMixedProcessor(processor) { }

    /**
     * Set default buffer size (frames) for new audio streams
     * @param {number} size
     * @returns {void}
     */
    setAudioStreamBufferSizeDefault(size) { }

    /**
     * Set master volume (0..1)
     * @param {number} volume
     * @returns {void}
     */
    setMasterVolume(volume) { }

    /**
     * Get master volume
     * @returns {number}
     */
    getMasterVolume() { }
}



export class Renderer {

    constructor() {
        /** @type {Input_} */
        this.input = new Input_();

        /** @type {Audio_} */
        this.audio = new Audio_()
        /** @type {number} */
        this.targetFPS = 60;
    }
    /**
     * 
     * @param {string} title - window title
     * @param {number} width 
     * @param {number} height 
     * @param {boolean} isSea - is running in single executable context 
     * @param {()=> void} assetGetterSync - function to load assets
     * @returns {[Renderer, {RESIZABLE: number, UNDECORATED: number, ALWAYS_RUN: number, VSYNC_HINT: number, MSAA_4X_HINT: number, hideConsole: ()=> void, showConsole: ()=> void}]}
     */
    static create(title, width, height, isSea = false, assetGetterSync = undefined) {


        //          * @returns {{
        //  *   Renderer: new(...args: any[]) => Renderer,
        //  *   FULLSCREEN: number,
        //  *   RESIZABLE: number,
        //  *   UNDECORATED: number,
        //  *   ALWAYS_RUN: number,
        //  *   VSYNC_HINT: number,
        //  *   MSAA_4X_HINT: number,
        //  *   hideConsole: ()=> void,
        //  *   showConsole: () => void,
        //  * }}
        const { Renderer, RESIZABLE, UNDECORATED, ALWAYS_RUN, VSYNC_HINT, MSAA_4X_HINT, hideConsole, showConsole } = isSea ? loadRendererSea({ assetGetterSync }) : loadRenderer()
        this.ops = {
            RESIZABLE,
            UNDECORATED,
            ALWAYS_RUN,
            VSYNC_HINT,
            MSAA_4X_HINT,
            hideConsole,
            showConsole
        }
        const renderer = new Renderer()
        if (!renderer.initialize(width, height, title)) {
            console.error("Failed to initialize renderer");
            process.exit(1);
        }

        return [renderer, this.ops]

    }

    /**
     * Boot up the renderer & create the window.
     * @param {number} width
     * @param {number} height
     * @param {string} title
     * @returns {boolean} success
     */
    initialize(width, height, title) { }

    /**
     * Tear down renderer & input
     * @returns {void}
     */
    shutdown() { }

    /**
     * Call before drawing a frame
     * @returns {void}
     */
    beginFrame() { }

    /**
     * Call after drawing a frame
     * @returns {void}
     */
    endFrame() { }

    /**
     * Clear the screen with optional color
     * @param {Color4=} color
     * @returns {void}
     */
    clear(color) { }

    /**
     * Draw rectangle
     * @param {Vec2} position
     * @param {Vec2} size
     * @param {Color4} color
     * @returns {void}
     */
    drawRectangle(position, size, color) { }

    /**
     * Draw circle.
     * @param {Vec2} center
     * @param {number} radius
     * @param {Color4} color
     * @returns {void}
     */
    drawCircle(center, radius, color) { }

    /**
     * Draw line.
     * @param {Vec2} start
     * @param {Vec2} end
     * @param {Color4} color
     * @param {number=} thickness
     * @returns {void}
     */
    drawLine(start, end, color, thickness) { }

    /**
     * Draw text.
     * @param {string} text
     * @param {Vec2} position
     * @param {number} fontSize
     * @param {Color4} color
     * @returns {void}
     */
    drawText(text, position, fontSize, color) { }

    // texture related

    /**
     * Load a texture from disk path.
     * @param {string} path
     * @returns {TextureId}
     */
    loadTexture(path) { return 0; }

    /**
     * Unload a previously loaded texture.
     * @param {TextureId} textureId
     * @returns {void}
     */
    unloadTexture(textureId) { }

    /**
     * Draw texture at a position. Optional size and tint.
     * @param {TextureId} textureId
     * @param {Vec2} position
     * @param {Vec2=} size
     * @param {Color4=} color
     * @returns {void}
     */
    drawTexture(textureId, position, size, color) { }

    /**
     * Create an offscreen render texture, returns id.
     * @param {number} width
     * @param {number} height
     * @returns {TextureId}
     */
    createRenderTexture(width, height) { return 0; }

    /**
     * Destroy a render texture ID.
     * @param {TextureId} textureId
     * @returns {void}
     */
    destroyRenderTexture(textureId) { }

    /**
     * Set a render target (texture id) or 0 for screen.
     * @param {TextureId} textureId
     * @returns {void}
     */
    setRenderTarget(textureId) { }

    /**
     * Create a shared buffer for CPU->GPU uploads.
     * @param {number} size
     * @param {number} width - for dirty region tracking and update
     * @param {number} height - for dirty region tracking and update
     *
     * @returns {number} bufferId
     */
    createSharedBuffer(size, width, height) { return 0; }

    /**
     * Mark a shared buffer as dirty.
     * @param {number} bufferId
     * @returns {void}
     */
    markBufferDirty(bufferId) { }


    /**
     * 
     * @param {number} bufferId 
     *
     * @param {number} x 
     * @param {number} y 
     * @param {number} width  
     * @param {number} height
     * */
    markBufferRegionDirty(bufferId, x, y, width, height) { }

    /**
     * Is the shared buffer dirty?
     * @param {number} bufferId
     * @returns {boolean}
     */
    isBufferDirty(bufferId) { return false; }

    /**
     * Get buffer bytes as Uint8Array
     * @param {number} bufferId
     * @returns {Uint8Array}
     */
    getBufferData(bufferId) { return new Uint8Array(0); }

    /**
     * Update buffer bytes from a TypedArray (Uint8Array)
     * @param {number} bufferId
     * @param {Uint8Array} data
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @returns {void}
     */
    updateBufferData(bufferId, data, x = 0, y = 0, width = 0, height = 0) { }

    /**
     * Upload an existing shared buffer to a GPU texture.
     * @param {TextureId} textureId
     * @param {number} bufferId
     * @returns {void}
     */
    updateTextureFromBuffer(textureId, bufferId) { }

    /**
     * Load a texture directly from an existing shared buffer (RGBA)
     * @param {number} bufferId
     * @param {number} width
     * @param {number} height
     * @returns {TextureId}
     */
    loadTextureFromBuffer(bufferId, width, height) { return 0; }

    /**
     * Draw a texture sized to a destination rectangle
     * @param {TextureId} textureId
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {Object=} colorObj
     * @returns {void}
     */
    drawTextureSized(textureId, x, y, width, height, colorObj) { }


    /**
      * Draw a texture sized to a destination rectangle
      * @param {TextureId} textureId
      * @param {{x:number, y: number}} srcPos
      * @param {{x: number, y: number}} srcSize
      * @param {{x: number, y: number}} destPos
      * @param {{x: number, y: number}} destSize
      * @param {Object=} colorObj optional
      * @returns {void}
      */
    drawTexturePro(textureId, srcPos, srcSize, destPos, destSize) { }

    /**
     * Returns current width.
     * @returns {number}
     */
    get width() { return 0; }

    /**
     * Returns current height.
     * @returns {number}
     */
    get height() { return 0; }

    /**
     * @returns {boolean}
     */
    get WindowShouldClose() { return false; }

    /**
     * onRender(callback) register a JS callback to be fired each frame.
     * @param {Function} callback
     * @returns {void}
     */
    onRender(callback) { }

    /**
     * step the renderer loop once (returns whether to continue)
     * @returns {boolean}
     */
    step() { return false; }

    /**
     * Get a JS Input object wrapper
     * @returns {Input_}
     */
    get input() { return new Input_(); }

    /**
     * Current FPS readout
     * @returns {number}
     */
    get FPS() { return 0; }


    /**
     * On resize callback
     */
    set onResize(cb) { }


    /**
    * Set target fps 
    */
    set targetFPS(fps) { }
    /**
     * Set various window states, e.g. flags.
     * @param {number} state
     * @returns {void}
     */
    setWindowState(state) { }


    /**
     * 
     * @param {string} path
     * @returns {{width: number, height: number, format: number, data: Uint8Array}} 
     */
    loadImage(path) { }

    /**
     * poll for input
     */
    GetInput() { }
}

/**
 * Load the native renderer module.
 * The JSDoc return type tells Rollup/TS that the native exports include a constructor `Renderer`.
 * @deprecated - use const [renderer, ops] = Renderer.create("Image", 800, 600)
 * @returns {{
 *   Renderer: new(...args: any[]) => Renderer,
 *   FULLSCREEN: number,
 *   RESIZABLE: number,
 *   UNDECORATED: number,
 *   ALWAYS_RUN: number,
 *   VSYNC_HINT: number,
 *   MSAA_4X_HINT: number
 * }}
 */
export function loadRenderer() {
    const require = createRequire(import.meta.url);
    try {
        return require('node-gyp-build')(join(__dirname, '..'));
    } catch (error) {
        console.log('method 1 failed:', error.message);
        try {
            return require(join(__dirname, '..', 'prebuilds', process.platform + '-' + process.arch, 'renderer.node'));
        } catch (error2) {
            console.log('method 2 failed:', error2.message);
            try {
                const rendererPath = join(__dirname, '..', 'prebuilds', process.platform + '-' + process.arch, 'renderer.node');
                return require(rendererPath);
            } catch (error3) {
                console.log('method 3 failed:', error3.message);
                throw new Error('all methods to load the native module failed: please open an issue');
            }
        }
    }
}


/**
 * Load the native renderer module.
 * The JSDoc return type tells Rollup/TS that the native exports include a constructor `Renderer`.
 * @deprecated - use const [renderer, ops] = Renderer.create("Image", 800, 600)
 * @returns {{
 *   Renderer: new(...args: any[]) => Renderer,
 *   FULLSCREEN: number,
 *   RESIZABLE: number,
 *   UNDECORATED: number,
 *   ALWAYS_RUN: number,
 *   VSYNC_HINT: number,
 *   MSAA_4X_HINT: number,
 *   hideConsole: ()=> void,
 *   showConsole: () => void,
 * }}
 */
export function loadRendererSea({ assetGetterSync = null } = {}) {
    const require = createRequire(__filename || import.meta.url);

    cleanupOldTempDirs('assets-extract');

    // 1) dev: node-gyp-build
    try {
        return require('node-gyp-build')(path.join(__dirname, '..'));
    } catch (e) { /* fall through */ }

    // 2) dev: on-disk prebuild path
    try {
        const platformTag = `${process.platform}-${process.arch}`;
        const p = path.join(__dirname, '..', 'prebuilds', platformTag, 'renderer.node');
        return require(p);
    } catch (e) { /* fall through */ }

    // 3) embedded assets extraction path (synchronous)
    // if assetGetterSync not provided, try node:sea synchronously
    let getter = assetGetterSync;
    if (!getter) {
        try {
            const sea = require('node:sea');
            if (sea && typeof sea.getAsset === 'function') {
                // node:sea.getAsset is usually sync; wrap to unify return value
                getter = (name) => {
                    try {
                        return sea.getAsset(name); // may return string or ArrayBuffer
                    } catch (err) {
                        return null;
                    }
                };
            }
        } catch (err) {
            // no node:sea available - we can't extract assets
            getter = null;
        }
    }

    if (!getter) {
        throw new Error('Could not locate renderer native module: tried node-gyp-build, prebuilds on disk, and no asset getter available for embedded assets.');
    }

    // platform-specific asset names
    const platformTag = `${process.platform}-${process.arch}`;
    const nodeAssetName = path.posix.join('prebuilds', platformTag, 'renderer.node');
    const dllAssetName1 = process.platform === 'win32' ? path.posix.join('prebuilds', platformTag, 'glfw3.dll') : null;
    const dllAssetName2 = process.platform === 'win32' ? path.posix.join('prebuilds', platformTag, 'raylib.dll') : null;


    // get assets
    const nodeAsset = getter(nodeAssetName);
    if (!nodeAsset) {
        throw new Error(`Embedded asset not found: ${nodeAssetName}`);
    }
    const nodeBuf = bufferFromAsset(nodeAsset);
    if (!nodeBuf) throw new Error('Failed to convert node asset to Buffer');

    // prepare temp
    const tempDir = createRunTempDir('assets-extract');
    const nodeDestName = `renderer.node`;
    const nodeDest = path.join(tempDir, nodeDestName);

    // extract node
    writeFileAtomicSync(nodeDest, nodeBuf);
    try { fs.chmodSync(nodeDest, 0o755); } catch (e) { /* ignore */ }

    // extract dll if present and prepend to PATH/LD...
    if (dllAssetName1) {
        const dllAsset = getter(dllAssetName1);
        const dllAsset2 = getter(dllAssetName2);
        if (dllAsset) {
            const dllBuf = bufferFromAsset(dllAsset);
            const dllDestName = dllAssetName1.split("/").pop();
            const dllDest = path.join(tempDir, dllDestName);
            writeFileAtomicSync(dllDest, dllBuf);
            prependPathForLibraries(tempDir);
            // do not chmod DLL; Windows doesn't use exec bits
        } else {
            // Not fatal but warn (dependent DLL missing)
            console.warn(`Warning: embedded DLL not found: ${dllAssetName1}`);
        }

        if (dllAsset2) {
            const dllBuf = bufferFromAsset(dllAsset2);
            const dllDestName = dllAssetName2.split("/").pop();
            const dllDest = path.join(tempDir, dllDestName);
            writeFileAtomicSync(dllDest, dllBuf);
            prependPathForLibraries(tempDir);
            // do not chmod DLL; Windows doesn't use exec bits
        } else {
            // Not fatal but warn (dependent DLL missing)
            console.warn(`Warning: embedded DLL not found: ${dllAssetName2}`);
        }
    } else {
        // On linux/darwin we still add tempDir to dynamic loader search paths as a best-effort
        prependPathForLibraries(tempDir);
    }

    // schedule best-effort cleanup at process exit (ignore errors)
    // process.on('exit', () => {
    //     try { cleanupDirBestEffort(tempDir); } catch (e) { /* ignore */ }
    // });

    // console.log(nodeDest);

    return require(nodeDest);
}


