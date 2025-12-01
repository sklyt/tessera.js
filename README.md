# renderer.js

Node.js graphics library that exposes a shared framebuffer between JavaScript
and C++. Fill it with pixel data (noise, images, textures), pass it to C++,
raylib renders it.


- [renderer.js](#rendererjs)
  * [Installation](#installation)
  * [Core Concepts](#core-concepts)
  * [Quick Start](#quick-start)
  * [Examples](#examples)
    + [Rendering Simplex Noise](#rendering-simplex-noise)
    + [Animation](#animation)
    + [Input Handling](#input-handling)
  * [API Reference](#api-reference)
    + [Pixel Buffer](#pixel-buffer)
    + [Primitives](#primitives)
      - [Lines](#lines)
        * [Anti-aliased](#anti-aliased)
      - [Shapes](#shapes)
      - [Polygons](#polygons)
      - [Camera](#camera)
      - [Font](#font)
    + [Input](#input)
    + [Utils](#utils)
  * [License](#license)


## Installation

```bash
npm i rayrenderer.js
```

## Core Concepts

**Frame Buffer** - raw pixels that map to a screen

```js
import { PixelBuffer } from "rayrenderer.js"; // raw memory
```

Every abstraction in this library builds from this primitive.

## Quick Start

```js
import { loadRenderer, PixelBuffer, Texture, DirtyRegionTracker } from "rayrenderer.js";

const { Renderer, FULLSCREEN, RESIZABLE } = loadRenderer();

const renderer = new Renderer();

// width, height, title
if (!renderer.initialize(1920, 910, "Renderer")) {
    console.error("Failed to initialize renderer");
    process.exit(1);
}

renderer.setWindowState(RESIZABLE);
renderer.targetFPS = 60;

const canvas = new PixelBuffer(renderer, 650, 400); // where every pixel goes
canvas.clear(1, 1, 1, 255)
const data = canvas.data; // "pointer" to raw buffer for direct memory access
const width = canvas.width; // prefer variables outside loop, constant access in tight loop can be bad
const height = canvas.height;
const tracker = new DirtyRegionTracker(canvas) // VERY IMPORTANT (in direct memory access): tells the renderer which parts to update
// random star like noise (direct memory access)
for (let i = 0; i < 2000; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const brightness = 100 + Math.random() * 155;
    const idx = (y * width + x) * 4; // formula from screen(x, y) to buffer(linear memory)
    data[idx] = brightness;
    data[idx + 1] = brightness;
    data[idx + 2] = brightness;
    data[idx + 3] = 255;
    tracker.mark(x, y) 
}

tracker.flush() // updates the internal c++ data buffer
canvas.upload() // tell the Graphics card to catch up and show changes

renderer.onRender(() => {
    // c++ calls you before rendering, this is where you "draw" stuff
    renderer.clear({ r: 0, g: 0, b: 0, a: 50 }); // use if drawing on the window directly like fps text below
    animationTime += 0.016;
    canvas.draw(0, 0); // draw at 0,0 top left

    // draw on the window directly (see font to draw on the canvas)
    renderer.drawText(
        `FPS: ${renderer.FPS} | Buffer: ${canvas.width}x${canvas.height} | Memory: ${(canvas.width * canvas.height * 4 / 1024).toFixed(1)}KB`,
        { x: 20, y: 750 },
        16,
        { r: 1, g: 1, b: 1, a: 1 }
    );
});

function Loop() {
    renderer.input.GetInput(); // <- get keyboard/mouse input state

    if (renderer.step()) { // calls the callback and draws on screen
        setImmediate(Loop);
    } else {
        console.log("loop ended");
        renderer.shutdown();
    }
}

Loop(); // non-blocking because step runs in c++, not js

process.on("SIGINT", () => {
    console.log("\nshutting down gracefully...");
    renderer.shutdown();
    process.exit(0);
});
```

## Examples

### Rendering Simplex Noise

```js

function generateSimplexNoise(data, width, height, options = {}) {
    const simplextracker = new DirtyRegionTracker(canvas) 
    simplextracker.markRect(0, 0, width, height) // mark a huge region at once very fast
    // simplified Simplex-like noise
    const scale = options.scale || 0.01;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;

            // Simple gradient noise approximation
            const value = Math.sin(x * scale) * Math.cos(y * scale);
            const normalized = (value + 1) * 0.5 * 255;

            data[idx] = normalized; // R
            data[idx + 1] = normalized; // G
            data[idx + 2] = normalized; // B
            data[idx + 3] = 255; // A
        }
    }

    simplextracker.flush()
}

generateSimplexNoise(canvas.data, canvas.width, canvas.height);
canvas.upload();

renderer.onRender(() => {
    canvas.draw(0, 0);
});
```

### Animation

Concepts are the same all you do is clear the canvas every frame

```js
import { LineDrawer } from "rayrenderer.js"; // line drawing utility handles tracking and flushing
let animationTime = 0;
function demoBasicLines() {
    canvas.clear(20, 25, 35, 255);

    //different line slopes
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 150;

    // Radial lines showing all angles
    for (let i = 0; i < 360; i += 15) {
        const angle = (i * Math.PI) / 180;
        const endX = centerX + Math.cos(angle) * radius;
        const endY = centerY + Math.sin(angle) * radius;

        // Color based on angle
        const r = Math.floor(128 + 127 * Math.sin(angle));
        const g = Math.floor(128 + 127 * Math.sin(angle + Math.PI * 2 / 3));
        const b = Math.floor(128 + 127 * Math.sin(angle + Math.PI * 4 / 3));

        LineDrawer.drawLine(canvas, centerX, centerY, endX, endY, r, g, b, 255);
    }

    // thick lines demonstration
    const thickY = 50;
    for (let thickness = 1; thickness <= 8; thickness++) {
        const x = 50 + thickness * 70;
        LineDrawer.drawThickLine(
            canvas,
            x,
            thickY,
            x,
            thickY + 250,
            thickness,
            255,
            200,
            100,
            255,
        );
    }

    // Animated line
    const animatedAngle = animationTime * 2;
    const animX = centerX + Math.cos(animatedAngle) * 100;
    const animY = centerY + Math.sin(animatedAngle) * 100;

    LineDrawer.drawThickLine(
        canvas,
        centerX,
        centerY,
        animX,
        animY,
        3,
        255,
        255,
        255,
        255,
    );

    canvas.upload();
}
renderer.onRenderer(() => {
    animationTime += 0.016; // Roughly 60 FPS
});
function Loop() {
    renderer.input.GetInput();
    demoBasicLines();
    if (renderer.step()) {
        setImmediate(Loop);
    } else {
        console.log("loop ended");
        renderer.shutdown();
    }
}
```

### Input Handling

```js
import { InputMap, loadRenderer, ShapeDrawer } from "rayrenderer.js";

// helper class to capture input in a sane way
const inputMap = new InputMap(renderer.input);

// map actions to keys (custom name, array of actual keys)
inputMap.mapAction("move_left", ["A", "ArrowLeft"]);
inputMap.mapAction("move_right", ["D", "ArrowRight"]);
inputMap.mapAction("move_up", ["W", "ArrowUp"]);
inputMap.mapAction("move_down", ["S", "ArrowDown"]);
inputMap.mapAction("jump", ["Space"]);
inputMap.mapAction("shoot", ["Enter"]);

let rectx = 100;
let recty = 100;

renderer.onRender(() => {
    canvas.clear(20, 25, 35, 255);
    ShapeDrawer.fillRect(canvas, rectx, recty, 280, 100, 40, 45, 55, 200);
    canvas.upload();
    canvas.draw(0, 0);
});

function Loop() {
     renderer.input.GetInput(); // poll input

    if (inputMap.isActionActive("move_left")) {
        rectx -= 10;
    }
    if (inputMap.isActionActive("move_right")) {
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

### Pixel Buffer

```js
const canvas = new PixelBuffer(renderer, width, height);
canvas.coordToIndex(x, y); // convert 2D coordinate to 1D memory index
canvas.setPixel(x, y, r, g, b, a = 255); // don't use in hot paths prefer direct memory access, this calls c++ on every call compared to direct access
canvas.getPixel(x, y); // => {r, g, b, a}
canvas.clear(r, g, b, a = 255);
canvas.upload(); // commit buffer changes
canvas.draw(x, y); // draw this buffer to the screen at specified position
canvas.grow(newWidth, newHeight); //  If the requested size is smaller or equal, this is a no-op.
canvas.destroy();
```

### Primitives

#### Lines

```js
import { LineDrawer } from "rayrenderer.js";

// draw a 1px Bresenham line.
LineDrawer.drawLine(canvas, x1, y1, x2, y2, r, g, b, a = 255, camera = undefined,
);

// draw a thick line by stamping a precomputed circular brush along Bresenham points.
LineDrawer.drawThickLine(
    canvas, x1, y1, x2, y2, thickness, r, g, b, a = 255, camera = undefined,
);
```

##### Anti-aliased

```js
import { AADrawer } from "rayrenderer.js";

AADrawer.drawLineAA(
    canvas, x1, y1,  x2, y2, r, g,b, a = 255,
    camera = undefined,
);
AADrawer.drawCircleAA( canvas, cx, cy, radius, r, g, b, a = 255,
    camera = undefined,
);
AADrawer.fillCircleAA(canvas, cx, cy,  radius,  r,  g,  b, a = 255,
    camera = undefined,
);
```

#### Shapes

```js
import { ShapeDrawer } from "rayrenderer.js";

ShapeDrawer.fillRect(
    canvas, x,  y, width, height, r, g, b, a = 255,
    camera = undefined,
);
ShapeDrawer.strokeRect(
    canvas, x, y, width, height, thickness, r, g, b, a = 255,
    camera = undefined,
);
ShapeDrawer.fillCircle(
    canvas, cx, cy, radius, r, g, b, a = 255,
    camera = undefined,
);
ShapeDrawer.strokeCircle(
    canvas, cx, cy, radius, thickness, r, g, b, a = 255,
    camera = undefined,
);
```

#### Polygons

```js
import { PolygonDrawer } from "rayrenderer.js";

// Create common polygon shapes (return array of points [{x,y}])
PolygonDrawer.createRegularPolygon(cx, cy, radius, sides);
PolygonDrawer.createStar(cx, cy, outerRadius, innerRadius, points);
PolygonDrawer.createRoundedRect(x, y, width, height, radius);

PolygonDrawer.fillPolygon(canvas, points, r, g, b, a = 255); // Fill a polygon using scanline edge-table (handles concave / self-intersecting).
PolygonDrawer.strokePolygon(canvas, points, thickness, r, g, b, a = 255);
```

#### Camera

```js
import { Camera } from "rayrenderer.js";
// camera - world <-> screen transforms
const cam = new Camera(x = 0, y = 0, width = 800, height = 600);
cam.worldToScreen(worldX, worldY); // => { x, y } (applies viewport if set)
cam.screenToWorld(screenX, screenY); // => { x, y } (inverse, considers viewport)
cam.setViewport(viewport); // attach a Viewport
cam.isVisible(worldX, worldY); // => boolean
cam.getVisibleBounds(); // => { left, right, top, bottom }
cam.move(dx, dy);
cam.setPosition(x, y);

// viewport - canvas sub-region / scissor
const vp = new Viewport(x, y, width, height);
vp.contains(screenX, screenY); // => boolean
vp.toCanvas(localX, localY); // => { x, y }   // local -> canvas coords
vp.toLocal(canvasX, canvasY); // => { x, y }   // canvas -> local coords
vp.getAspectRatio(); // => number
vp.setScissor(enabled); // enable/disable scissor clipping
vp.shouldClip(canvasX, canvasY); // => boolean (true if pixel is outside viewport)
```

#### Font

```js
// BitmapFont - simple API (bitmap atlas text rendering)

// Constructor
// new BitmapFont(renderer, atlasPath, config = {})
// config keys: bitmapWidth, bitmapHeight, cellsPerRow, cellsPerColumn,
//              cellWidth, cellHeight, fontSize, offsetX, offsetY, charOrder
const font = new BitmapFont(renderer, "fonts/atlas.png", {
    cellWidth: 32,
    cellHeight: 32,
});

// Properties
font.renderer; // Renderer instance used to load atlas
font.atlasImage; // { data: Uint8Array, width, height }
font.config; // resolved config object
font.glyphs; // Map<char, Glyph>
font.lineHeight; // number
font.baseline; // number

// Glyph (internal structure)
class Glyph {
    // fields: char, x, y, width, height, xOffset, yOffset, xAdvance
}

// Lookup, measurement & drawing
font.getGlyph(char); // => Glyph (with fallback)
font.measureText(text); // => { width: number, height: number }
font.drawText(canvas, text, x, y, color = { r, g, b, a }, camera = undefined); //  draws text into PixelBuffer (alpha blended). Commits minimal region and sets canvas.needsUpload to true
font.drawMultilineText(
    canvas,
    text,
    x,
    y,
    maxWidth,
    align = "left",
    color = { r: 255, g: 255, b: 255, a: 255 },
    camera = undefined,
); //   draws wrapped lines; returns { width, height }
font.drawTextWithTint(canvas, text, x, y, r, g, b, a = 255, camera = undefined);
```

### Input 

```js
import {InputMap} from "rayrenderer.js"

// InputMap - action mapping & callback helpers
const im = new InputMap(renderer.input)

im.mapAction(actionName, keys)        // map keyboard keys (string|[string]) -> action
im.MapMouseAction(actionName, keys)   // map mouse buttons (string|[string]) -> action

im.isMouseActionActive(actionName)    // => boolean (mouse button down)
im.isMousePressed(actionName)         // => boolean (mouse button pressed)
im.IsMouseActionReleased(actionName)  // => boolean (mouse button released)

im.mousePosition                      // getter => { x:number, y:number }
im.mouseDelta                         // getter => { x:number, y:number }
im.mouseWheelDelta                    // getter => number

im.isActionActive(actionName)         // => boolean (key down)
im.wasActionTriggered(actionName)     // => boolean (key pressed)  // note: implementation uses isKeyDown
im.isActionReleased(actionName)       // => boolean (key released)

im.onActionDown(actionName, callback) // register callback on mapped key down; returns nothing (stores callback ids)
im.onActionUp(actionName, callback)   // register callback on mapped key up
im.onMouseDown(actionName, callback)  // register callback on mapped mouse down
im.onMouseUp(actionName, callback)    // register callback on mapped mouse up
im.onMouseMove(callback)              // register mouse-move callback (event)
im.onMouseWheel(callback)             // register mouse-wheel callback (event)

im.cleanup()                          // remove all registered callbacks

// callback signature used:
// (actionName, event) or (event) where event = {
//   type, keyCode, keyName, mouseButton,
//   mousePosition: {x,y}, mouseDelta: {x,y},
//   wheelDelta, timestamp
// }


```

### Load Image helper 

```js
    renderer.loadImage(path) // @returns {width: number, height: number, format: number, data: Uint8Array}
```

### Utils


```js

import {DirtyRegionTracker, ColorTheory, PerformanceMonitor, normalizeRGBA} from "rayrenderer.js"
// DirtyRegionTracker
// constructor(canvas: PixelBuffer)
new DirtyRegionTracker(canvas)
tracker.reset()                       // reset internal bounds
tracker.markRect(x, y, w, h)         // mark changed rectangle (fast, integer ops)
tracker.mark(x, y)                   // mark single pixel (alias)
tracker.flush() -> {minX, minY, regionWidth, regionHeight} | null
  // extracts region, calls canvas.renderer.updateBufferData(...), sets canvas.needsUpload = true
  // returns null if nothing to flush



// ColorTheory (pure functions)
ColorTheory.RGBtoHSV(r, g, b) -> {h, s, v}    // s,v in 0..100
ColorTheory.HSVtoRGB(h, s, v) -> {r, g, b}    // r,g,b 0..255
ColorTheory.complementary({r,g,b}) -> {r,g,b}
ColorTheory.analogous({r,g,b}, spread = 30) -> [{r,g,b}, {r,g,b}, {r,g,b}]

// PerformanceMonitor
// constructor()
new PerformanceMonitor()
pm.start(name)                       // begin timing a named metric
pm.end(name)                         // end timing, accumulate stats
pm.recordFrameTime(startTime)        // push frame time sample
pm.logMetrics()                      // console.log aggregated metrics

// normalizeRGBA
// normalizeRGBA(r, g, b, a?) -> { r, g, b, a? }
// r,g,b returned in 0.0..1.0. If 'a' provided, returned as a/255.
normalizeRGBA(r, g, b, a)


```

## License

This project is licensed under the **AGPL-3.0-or-later License** - see the
`LICENSE` file for details.

SPDX-License-Identifier: AGPL-3.0-or-later

