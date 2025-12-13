import { loadRenderer, PixelBuffer, drawAtlasRegionToCanvas, normalizeRGBA, imageToCanvas } from "../../dist/esm/index.js";

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Renderer, FULLSCREEN, RESIZABLE } = loadRenderer();

const renderer = new Renderer();


if (!renderer.initialize(800, 600, "Renderer")) {
    console.error("Failed to initialize renderer");
    process.exit(1);
}
const img = renderer.loadImage(join(__dirname, "./knight.png"))

renderer.setWindowState(RESIZABLE)

const canvas = new PixelBuffer(renderer, 800, 600)

const FRAME_SIZE = { x: 32, y: 32 };


function genFrames(rows, cols, startX, startY, tileSize) {
    const frames = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            frames.push({ offset: { x: startX + c * tileSize, y: startY + r * tileSize } });
        }
    }
    return frames;
}

const frames = genFrames(2, 7, 0, 64, 32);

const ANIMATIONS = {
    idle: {
        name: "idle",
        fps: 8,
        loop: true,
        frames: [
            { offset: { x: 0, y: 0 } },
            { offset: { x: 32, y: 0 } },
            { offset: { x: 64, y: 0 } },
            // { offset: { x: 96, y: 0 } },
        ]
    },
    run: {
        name: "run",
        fps: 24,
        loop: true,
        frames: frames
    }
};
let currentFrame = 0;
let lastFrameTime = Date.now();
function animatesprite(img, animations, current = "idle") {
    const now = Date.now();
    if (now - lastFrameTime >= 1000 / animations[current].fps) {
        currentFrame = (currentFrame + 1) % animations[current].frames.length;
        lastFrameTime = now;
    }
    canvas.clear(40, 40, 50, 255) // <- old frame
    let ani = animations[current]
    drawAtlasRegionToCanvas(img, { x: ani.frames[currentFrame].offset.x, y: ani.frames[currentFrame].offset.y, width: FRAME_SIZE.x, height: FRAME_SIZE.y }, canvas, { x: 100, y: 100, width: 100, height: 100 })
    canvas.upload()
}


renderer.onRender(() => {
    renderer.clear(normalizeRGBA(40, 40, 50, 255))
    canvas.draw(0, 0)
})

function Loop() {
    renderer.input.GetInput()
    animatesprite(img, ANIMATIONS, "run")
    if (renderer.step()) {
        setImmediate(Loop);
    } else {
        console.log('loop ended');
        renderer.shutdown();
    }
}

Loop();


process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    renderer.shutdown();
    process.exit(0);
});