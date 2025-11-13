# renderer.js

JavaScript graphics library that exposes a shared buffer between JavaScript and C++. Fill it with pixel data (noise, images, textures), pass it to C++, raylib renders it.


## Installation 

```bash
npm i @sk/renderer.js
```

## Core Concepts

**Buffer** - raw pixels  
**Texture** - takes raw pixels and puts them on screen

Every abstraction in this library builds from these two primitives.

## Quick Start

```js
import { loadRenderer, SharedBuffer, Texture } from "@sk/renderer.js";

const {Renderer, FULLSCREEN, RESIZABLE} = loadRenderer();

const renderer = new Renderer();

// width, height, title
if (!renderer.initialize(800, 600, "Renderer")) {
    console.error("Failed to initialize renderer");
    process.exit(1);
}

renderer.setWindowState(RESIZABLE)
renderer.targetFPS = 60;

renderer.onRender(() => {
  // c++ calls you before rendering—this is where you "draw" stuff
})

function Loop() {
    renderer.input.GetInput() // <- get keyboard/mouse input state
    
    if (renderer.step()) { // calls the callback and draws on screen
        setImmediate(Loop);
    } else {
        console.log('loop ended');
        renderer.shutdown();
    }
}

Loop(); // non-blocking because step runs in c++, not js

process.on('SIGINT', () => {
    console.log('\nshutting down gracefully...');
    renderer.shutdown();
    process.exit(0);
});
```

## Examples

### Rendering Simplex Noise

```js

function generateSimplexNoise(data, width, height, options) {
        // Simplified Simplex-like noise
        const scale = options.scale || 0.01;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                // Simple gradient noise approximation
                const value = Math.sin(x * scale) * Math.cos(y * scale);
                const normalized = (value + 1) * 0.5 * 255;

                data[idx] = normalized;     // R
                data[idx + 1] = normalized; // G  
                data[idx + 2] = normalized; // B
                data[idx + 3] = 255;       // A
            }
        }
    }

// Create buffer and texture
const bufferSize = 800 * 600 * 4; // width * height * channels(rgba)
const noise = new SharedBuffer(renderer, bufferSize);

const data = noise.getData();  // "pointer" to raw data -> Uint8Array<ArrayBufferLike>

generateSimplexNoise(data, 800, 600)

noise.updateData(data); // tell c++ to update its state internally

let texture_ = new Texture(renderer, noise.bufferId, 800, 600)

renderer.onRender(() => {
    texture_.update() // runs only if buffer is dirty
    texture_.draw(0, 0);
})
```

### Using PixelCanvas

Utility class for pixel-by-pixel manipulation, like the web canvas but in Node.

```js
import { loadRenderer, PixelCanvas } from "@sk/renderer.js";

const {Renderer} = loadRenderer();
const renderer = new Renderer();

if (!renderer.initialize(800, 600, "Renderer")) {
    console.error("Failed to initialize renderer");
    process.exit(1);
}

renderer.targetFPS = 60;

const canvas = new PixelCanvas(renderer, 400, 300);

// Draw a red square
for (let x = 150; x < 250; x++) {
    for (let y = 100; y < 200; y++) {
        canvas.setPixel(x, y, 255, 0, 0, 255);
    }
}
 
// Draw a green diagonal line
for (let i = 0; i < 300; i++) {
    canvas.setPixel(i, i, 0, 255, 0, 255);
}

renderer.onRender(() => {
    canvas.update();
    canvas.draw(0, 0);
})

function Loop() {
    renderer.input.GetInput()
    if (renderer.step()) {
        setImmediate(Loop);
    } else {
        renderer.shutdown();
    }
}

Loop();
```

### Loading Images

```js
const img = renderer.loadTexture(join(__dirname, "./1.png"))

renderer.onRender(() => {
    renderer.drawTexture(img, {x: 400, y: 500})
})
```

### Drawing Texture Regions (Spritesheets)

```js
const img = renderer.loadTexture(join(__dirname, "./1.png"))

renderer.onRender(() => {
       renderer.drawTexturePro(img, srcPosition, srcSize, destPosition,  destSize, tint?) // tint optional {r: number, g: number, b: number, a: number}
})
```

### Input Handling

```js
import { loadRenderer, InputMap } from "@sk/renderer.js";

const {Renderer} = loadRenderer();
const renderer = new Renderer();

if (!renderer.initialize(800, 600, "Renderer")) {
    console.error("Failed to initialize renderer");
    process.exit(1);
}

// Helper class to capture input in a sane way
const inputMap = new InputMap(renderer.input);

// Map actions to keys (custom name, array of actual keys)
inputMap.mapAction('move_left', ['A', 'ArrowLeft']);
inputMap.mapAction('move_right', ['D', 'ArrowRight']);
inputMap.mapAction('move_up', ['W', 'ArrowUp']);
inputMap.mapAction('move_down', ['S', 'ArrowDown']);
inputMap.mapAction('jump', ['Space']);
inputMap.mapAction('shoot', ['Enter']);

let rectx = 100;
let recty = 100;

renderer.onRender(() => {
    renderer.drawRectangle({ x: rectx, y: recty }, { x: 200, y: 150 }, { r: 1, g: 0, b: 0, a: 1 });
    renderer.drawCircle({ x: 400, y: 300 }, 50, { r: 0, g: 1, b: 0, a: 1 });
    renderer.drawText("Hello Renderer!", { x: 200, y: 50 }, 20, { r: 1, g: 1, b: 1, a: 1 });
})

function Loop() {
    renderer.input.GetInput() // poll input
    
    if (inputMap.isActionActive('move_left')) {
        rectx -= 10;
    }
    if (inputMap.isActionActive('move_right')) {
        rectx += 10;
    }
    
    if (renderer.step()) {
        setImmediate(Loop);
    } else {
        renderer.shutdown();
    }
}

Loop();
```

## API Reference

working on it

## Features

- Direct buffer manipulation for high-performance rendering
- Shared memory between JavaScript and C++ via NAPI
- Built on raylib for reliable cross-platform rendering
- Simple pixel-by-pixel drawing with PixelCanvas
- Texture loading and rendering
- Texturepro support for things like animations
- Input handling with customizable key mappings
- Shape primitives (rectangles, circles)
- Text rendering

## Roadmap


## License

This project is licensed under the **ISC License** - see the `LICENSE` file for details.

SPDX-License-Identifier: ISC

## Contributing

