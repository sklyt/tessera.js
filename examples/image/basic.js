import { loadRenderer, InputMap, imageToCanvas, PixelBuffer, drawAtlasRegionToCanvas, normalizeRGBA } from "../../dist/esm/index.js";

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


renderer.setWindowState(RESIZABLE)

const canvas = new PixelBuffer(renderer, 800, 600)

const img = renderer.loadImage(join(__dirname, "./1.png"))  // fails to load jpg for some reason ffmpeg -i img.jpg img.png

imageToCanvas(img, canvas, "nn", 400, 400)
drawAtlasRegionToCanvas(img, {x: 0, y: 0, width:58, height:58}, canvas, {x: 400, y: 100, width: 32, height: 32})
canvas.upload()

renderer.onRender(() => {
    renderer.clear(normalizeRGBA(40, 40, 50, 255)) // clears the window not canvas
    // canvas.clear(40, 40, 50, 255) <- clears the pixels 
    canvas.draw(0, 0)
})

function Loop() {
    renderer.input.GetInput()

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