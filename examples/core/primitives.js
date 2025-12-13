import { loadRenderer, PixelBuffer, LineDrawer, AADrawer, ShapeDrawer, PolygonDrawer, InputMap, normalizeRGBA } from "../../dist/esm/index.js";

const { Renderer, RESIZABLE } = loadRenderer();
const renderer = new Renderer();

if (!renderer.initialize(1920, 990, "Primitives")) {
    console.error("Failed to initialize renderer");
    process.exit(1);
}

renderer.targetFPS = 60;
renderer.setWindowState(RESIZABLE)
renderer.onResize = (event) => {
    console.log(event)
}

const canvasBasic = new PixelBuffer(renderer, 650, 400);
const canvasAA = new PixelBuffer(renderer, 650, 400);
const canvasShapes = new PixelBuffer(renderer, 650, 400);
const canvasPolygons = new PixelBuffer(renderer, 650, 400);


canvasBasic.clear(20, 25, 35, 255);
canvasAA.clear(20, 25, 35, 255);
canvasShapes.clear(20, 25, 35, 255);
canvasPolygons.clear(20, 25, 35, 255);

let animationTime = 0;
let demoState = 0;



renderer.onRender(() => {
    animationTime += 0.016; // Roughly 60 FPS
    renderer.clear(normalizeRGBA(10, 15, 25, 255));

    canvasBasic.draw(50, 100);
    canvasAA.draw(750, 100);
    canvasShapes.draw(50, 550);
    canvasPolygons.draw(750, 550);


    renderer.drawText(
        "PRIMITIVES",
        { x: 20, y: 20 },
        28,
        normalizeRGBA(255, 255, 255, 255)
    );

    renderer.drawText(
        "Bresenham Lines - Anti-Aliasing - Mathematical Shapes - Polygon Tessellation",
        { x: 20, y: 55 },
        16,
        normalizeRGBA(200, 200, 255, 255)
    );


    renderer.drawText(
        "BASIC LINES (Bresenham)",
        { x: 50, y: 80 },
        18,
        normalizeRGBA(255, 200, 100, 255)
    );

    renderer.drawText(
        "ANTI-ALIASED LINES & CIRCLES",
        { x: 750, y: 80 },
        18,
        normalizeRGBA(100, 100, 100, 255)

    );

    renderer.drawText(
        "SHAPES & FILLING ALGORITHMS",
        { x: 50, y: 530 },
        18,
        normalizeRGBA(255, 100, 200, 255)
    );

    renderer.drawText(
        "POLYGONS & TESSELLATION",
        { x: 750, y: 530 },
        18,
        normalizeRGBA(100, 255, 150, 255)
    );

    renderer.drawText(
        `FPS: ${renderer.FPS} | Algorithm Demo: ${demoState + 1}/4 | Time: ${animationTime.toFixed(1)}s`,
        { x: 20, y: 870 },
        16,
        normalizeRGBA(255, 255, 0, 255)

    );
})


const inputMap = new InputMap(renderer.input);
inputMap.mapAction('next_demo', ['Space']);
inputMap.mapAction('prev_demo', ['ArrowLeft']);


function demoBasicLines() {
    canvasBasic.clear(20, 25, 35, 255);


    ShapeDrawer.fillRect(canvasBasic, 10, 10, 200, 30, 40, 45, 55, 200);
    // renderer.drawText("Bresenham Line Algorithm", { x: 70, y: 120 }, 16, normalizeRGBA(255, 255, 255, 255)); change to use bitmapfont

    // demonstrate different line slopes
    const centerX = canvasBasic.width / 2;
    const centerY = canvasBasic.height / 2;
    const radius = 150;

    // radial lines showing all angles
    for (let i = 0; i < 360; i += 15) {
        const angle = (i * Math.PI) / 180;
        const endX = centerX + Math.cos(angle) * radius;
        const endY = centerY + Math.sin(angle) * radius;

        // color based on angle
        const r = Math.floor(128 + 127 * Math.sin(angle));
        const g = Math.floor(128 + 127 * Math.sin(angle + Math.PI * 2 / 3));
        const b = Math.floor(128 + 127 * Math.sin(angle + Math.PI * 4 / 3));

        LineDrawer.drawLine(canvasBasic, centerX, centerY, endX, endY, r, g, b, 255);
    }

    // thick lines demonstration
    const thickY = 50;
    for (let thickness = 1; thickness <= 8; thickness++) {
        const x = 50 + thickness * 70;
        LineDrawer.drawThickLine(
            canvasBasic,
            x, thickY,
            x, thickY + 250,
            thickness,
            255, 200, 100, 255
        );
    }

    // animated line
    const animatedAngle = animationTime * 2;
    const animX = centerX + Math.cos(animatedAngle) * 100;
    const animY = centerY + Math.sin(animatedAngle) * 100;

    LineDrawer.drawThickLine(
        canvasBasic,
        centerX, centerY,
        animX, animY,
        3,
        255, 255, 255, 255
    );

    canvasBasic.upload();
}


function demoAntiAliasing() {
    canvasAA.clear(20, 25, 35, 255);


    ShapeDrawer.fillRect(canvasAA, 10, 10, 250, 30, 40, 45, 55, 200);
    // renderer.drawText("Anti-Aliasing Algorithms", { x: 750 + 70, y: 120 }, 16, normalizeRGBA(255, 255, 255, 255));

    const centerX = canvasAA.width / 2;
    const centerY = canvasAA.height / 2;

    // anti-aliased lines at various angles
    for (let i = 0; i < 180; i += 12) {
        const angle = (i * Math.PI) / 180;
        const length = 120;
        const endX = centerX + Math.cos(angle) * length;
        const endY = centerY + Math.sin(angle) * length;

        // subtle color variation
        const hue = (i / 180) * 360;
        const r = Math.floor(128 + 127 * Math.sin(hue * Math.PI / 180));
        const g = Math.floor(128 + 127 * Math.sin((hue + 120) * Math.PI / 180));
        const b = Math.floor(128 + 127 * Math.sin((hue + 240) * Math.PI / 180));

        AADrawer.drawLineAA(canvasAA, centerX, centerY, endX, endY, r, g, b);
    }

    // anti-aliased circles demonstration
    const circleRadius = 25;
    const circleSpacing = 60;

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 5; col++) {
            const x = 80 + col * circleSpacing;
            const y = 200 + row * circleSpacing;
            const radius = circleRadius - col * 2;

            if (row === 0) {
                // Stroked circles
                AADrawer.drawCircleAA(canvasAA, x, y, radius, 100, 200, 255, 255);
            } else {
                // Filled circles
                AADrawer.fillCircleAA(canvasAA, x, y, radius, 255, 200, 100, 255);
            }
        }
    }

    // animated AA circle
    const pulseRadius = 30 + Math.sin(animationTime * 3) * 15;
    AADrawer.fillCircleAA(
        canvasAA,
        centerX,
        centerY - 50,
        pulseRadius,
        255, 100, 150,
        200 + Math.sin(animationTime * 5) * 55
    );

    // comparison: Aliased vs Anti-aliased line
    const compareY = 350;
    LineDrawer.drawLine(canvasAA, 100, compareY, 300, compareY + 25, 255, 100, 100, 255);
    AADrawer.drawLineAA(canvasAA, 100, compareY + 20, 300, compareY + 45, 100, 255, 100, 255);

    canvasAA.upload();
}


function demoShapes() {
    canvasShapes.clear(20, 25, 35, 255);


    ShapeDrawer.fillRect(canvasShapes, 10, 10, 280, 30, 40, 45, 55, 200);
    // renderer.drawText("Shape Drawing & Filling Algorithms", { x: 70, y: 570 }, 16, { r: 255, g: 255, b: 255, a: 255 });

    const gridSize = 80;
    const startX = 50;
    const startY = 50;

    //grid of shapes
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 6; col++) {
            const x = startX + col * gridSize;
            const y = startY + row * gridSize;
            const size = 25;

            const hue = (row * 6 + col) * 15;
            const r = Math.floor(128 + 127 * Math.sin(hue * Math.PI / 180));
            const g = Math.floor(128 + 127 * Math.sin((hue + 120) * Math.PI / 180));
            const b = Math.floor(128 + 127 * Math.sin((hue + 240) * Math.PI / 180));

            const shapeType = (row * 6 + col) % 8;

            switch (shapeType) {
                case 0: // Filled circle
                    ShapeDrawer.fillCircle(canvasShapes, x, y, size, r, g, b, 255);
                    break;
                case 1: // Stroked circle
                    ShapeDrawer.strokeCircle(canvasShapes, x, y, size, 3, r, g, b, 255);
                    break;
                case 2: // Filled rectangle
                    ShapeDrawer.fillRect(canvasShapes, x - size / 2, y - size / 2, size, size, r, g, b, 255);
                    break;
                case 3: // Stroked rectangle
                    ShapeDrawer.strokeRect(canvasShapes, x - size / 2, y - size / 2, size, size, 3, r, g, b, 255);
                    break;
                case 4: // Rounded filled rectangle
                    ShapeDrawer.fillRect(canvasShapes, x - size / 2, y - size / 2, size, size, r, g, b, 255);
                    // Manual rounding by drawing circles at corners
                    ShapeDrawer.fillCircle(canvasShapes, x - size / 2, y - size / 2, 8, 20, 25, 35, 255);
                    ShapeDrawer.fillCircle(canvasShapes, x + size / 2, y - size / 2, 8, 20, 25, 35, 255);
                    ShapeDrawer.fillCircle(canvasShapes, x - size / 2, y + size / 2, 8, 20, 25, 35, 255);
                    ShapeDrawer.fillCircle(canvasShapes, x + size / 2, y + size / 2, 8, 20, 25, 35, 255);
                    break;
                case 5: // triangle (using polygon)
                    const triPoints = [
                        { x: x, y: y - size / 2 },
                        { x: x + size / 2, y: y + size / 2 },
                        { x: x - size / 2, y: y + size / 2 }
                    ];
                    PolygonDrawer.fillPolygon(canvasShapes, triPoints, r, g, b, 255);
                    break;
                case 6: // diamond
                    const diamondPoints = [
                        { x: x, y: y - size / 2 },
                        { x: x + size / 2, y: y },
                        { x: x, y: y + size / 2 },
                        { x: x - size / 2, y: y }
                    ];
                    PolygonDrawer.fillPolygon(canvasShapes, diamondPoints, r, g, b, 255);
                    break;
                case 7: // Hexagon
                    const hexPoints = PolygonDrawer.createRegularPolygon(x, y, size, 6);
                    PolygonDrawer.fillPolygon(canvasShapes, hexPoints, r, g, b, 255);
                    break;
            }
        }
    }

    // animated shape demonstration
    const animX = 400 + Math.sin(animationTime) * 50;
    const animY = 300 + Math.cos(animationTime * 1.5) * 30;
    const animSize = 30 + Math.sin(animationTime * 2) * 10;

    // pulsing circle with outline
    ShapeDrawer.fillCircle(canvasShapes, animX, animY, animSize, 255, 255, 100, 200);
    ShapeDrawer.strokeCircle(canvasShapes, animX, animY, animSize, 2, 255, 200, 50, 255);

    canvasShapes.upload();
}

function demoPolygons() {
    canvasPolygons.clear(20, 25, 35, 255);


    ShapeDrawer.fillRect(canvasPolygons, 10, 10, 230, 30, 40, 45, 55, 200);
    // renderer.drawText("Polygon Tessellation", { x: 750 + 70, y: 570 }, 16, { r: 255, g: 255, b: 255, a: 255 });

    const centerX = canvasPolygons.width / 2;
    const centerY = canvasPolygons.height / 2;

    // regular polygons from triangle to dodecagon
    const maxSides = 12;
    const radius = 120;

    for (let sides = 3; sides <= maxSides; sides++) {
        const angle = (sides - 3) * (2 * Math.PI / (maxSides - 2));
        const x = centerX + Math.cos(angle) * radius * 0.7;
        const y = centerY + Math.sin(angle) * radius * 0.7;
        const polyRadius = 25 + sides * 2;

        const hue = (sides / maxSides) * 360;
        const r = Math.floor(128 + 127 * Math.sin(hue * Math.PI / 180));
        const g = Math.floor(128 + 127 * Math.sin((hue + 120) * Math.PI / 180));
        const b = Math.floor(128 + 127 * Math.sin((hue + 240) * Math.PI / 180));

        const points = PolygonDrawer.createRegularPolygon(x, y, polyRadius, sides);
        PolygonDrawer.fillPolygon(canvasPolygons, points, r, g, b, 255);
    }

    // star demonstration
    const starY = 300;
    for (let i = 0; i < 5; i++) {
        const x = 100 + i * 100;
        const points = i % 2 === 0
            ? PolygonDrawer.createStar(x, starY, 25, 12, 5 + i)
            : PolygonDrawer.createStar(x, starY, 20, 15, 7);

        const r = 100 + i * 30;
        const g = 150 + i * 20;
        const b = 200 - i * 20;

        PolygonDrawer.fillPolygon(canvasPolygons, points, r, g, b, 255);
    }

    // animated morphing polygon
    const animSides = 3 + Math.floor(Math.abs(Math.sin(animationTime * 0.5)) * 7);
    const animPoints = PolygonDrawer.createRegularPolygon(centerX, centerY + 100, 40, animSides);

    // rotate the polygon
    const rotation = animationTime * 2;
    const rotatedPoints = animPoints.map(p => {
        const dx = p.x - centerX;
        const dy = p.y - (centerY + 100);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) + rotation;
        return {
            x: centerX + Math.cos(angle) * dist,
            y: centerY + 100 + Math.sin(angle) * dist
        };
    });

    PolygonDrawer.fillPolygon(canvasPolygons, rotatedPoints, 255, 255, 100, 255);

    // rounded rectangle example
    const roundedRectPoints = PolygonDrawer.createRoundedRect(400, 350, 150, 80, 20);
    PolygonDrawer.fillPolygon(canvasPolygons, roundedRectPoints, 100, 200, 255, 255);

    canvasPolygons.upload();
}

// animation and demo control
function updateDemo() {
    switch (demoState) {
        case 0:
            demoBasicLines();
            break;
        case 1:
            demoAntiAliasing();
            break;
        case 2:
            demoShapes();
            break;
        case 3:
            demoPolygons();
            break;
    }


}

demoBasicLines();
demoAntiAliasing();
demoShapes();
demoPolygons();



function animate() {
    renderer.input.GetInput();
    if (inputMap.wasActionTriggered('next_demo')) {
        demoState = (demoState + 1) % 4;
        console.log(`Switching to demo ${demoState + 1}`);
    }

    if (inputMap.wasActionTriggered('prev_demo')) {
        demoState = (demoState - 1 + 4) % 4;
        console.log(`Switching to demo ${demoState + 1}`);
    }
    updateDemo();

    if (renderer.step()) {
        setTimeout(animate, 0);
    } else {
        console.log('Animation ended');
        canvasBasic.destroy();
        canvasAA.destroy();
        canvasShapes.destroy();
        canvasPolygons.destroy();
        renderer.shutdown();
    }
}


animate()

process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    canvasBasic.destroy();
    canvasAA.destroy();
    canvasShapes.destroy();
    canvasPolygons.destroy();
    renderer.shutdown();
    process.exit(0);
});
