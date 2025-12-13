import Matter from 'matter-js';
import { 
    loadRenderer, 
    PixelBuffer, 
    PolygonDrawer, 
    ShapeDrawer,
    InputMap 
} from '../../dist/esm/index.js';

const { Renderer, RESIZABLE } = loadRenderer();
const renderer = new Renderer();

if (!renderer.initialize(1200, 800, "Matter.js")) {
    console.error("Failed to initialize renderer");
    process.exit(1);
}

renderer.targetFPS = 60;
renderer.setWindowState(RESIZABLE);

const canvas = new PixelBuffer(renderer, 1200, 800);


const engine = Matter.Engine.create({
    gravity: { x: 0, y: 0.98 }
});
const world = engine.world;


const ground = Matter.Bodies.rectangle(600, 750, 1200, 100, { 
    isStatic: true 
});
Matter.World.add(world, ground);

// walls
const wallLeft = Matter.Bodies.rectangle(0, 400, 50, 800, { isStatic: true });
const wallRight = Matter.Bodies.rectangle(1200, 400, 50, 800, { isStatic: true });
Matter.World.add(world, [wallLeft, wallRight]);

// some initial boxes
for (let i = 0; i < 5; i++) {
    const box = Matter.Bodies.rectangle(
        200 + i * 150, 
        100, 
        60, 
        60,
        {
            restitution: 0.6, // bounciness
            friction: 0.1
        }
    );
    Matter.World.add(world, box);
}

/**
 * 
 * @param {Matter.Body} body 
 * @param {*} r 
 * @param {*} g 
 * @param {*} b 
 */
function renderBody(body, r, g, b) {
    // matter.js vertices are already in world space
    const points = body.vertices.map(v => ({ x: Math.floor(v.x), y: Math.floor(v.y) }));
    PolygonDrawer.fillPolygon(canvas, points, r, g, b, 255); // TODO: add cam boundries for draw
}


function renderWorld() {
    canvas.clear(15, 18, 25, 255);
    
    const bodies = Matter.Composite.allBodies(world);
    
    for (const body of bodies) {
        if (body.isStatic) {
            renderBody(body, 60, 60, 70); // dark gray for static
        } else {
            // color based on velocity (faster = brighter)
            const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
            const brightness = Math.min(255, 100 + speed * 3);
            renderBody(body, brightness * 0.8, brightness * 0.5, brightness);
        }
    }
    
    canvas.upload();
}

const inputMap = new InputMap(renderer.input);
inputMap.MapMouseAction('spawn', [0]); // left click

let lastMouseDown = false;

function handleInput() {
    const mouseDown = inputMap.isMouseActionActive('spawn');
    const mousePos = inputMap.mousePosition;
    
    // spawn box on click (not hold)
    if (mouseDown && !lastMouseDown) {
        const size = 40 + Math.random() * 40;
        const box = Matter.Bodies.rectangle(
            mousePos.x,
            mousePos.y,
            size,
            size,
            {
                restitution: 0.3 + Math.random() * 0.5,
                friction: 0.1,
                density: 0.001 // lighter boxes
            }
        );
        Matter.World.add(world, box);
    }
    
    lastMouseDown = mouseDown;
}



const FIXED_DT = 1000 / 60; // 16.666ms
const MAX_ACCUMULATOR = FIXED_DT * 5; // prevent spiral of death
let accumulator = 0;
let lastTime = performance.now();

renderer.onRender(() => {
    renderer.clear({ r: 0, g: 0, b: 0, a: 1 });
    canvas.draw(0, 0);
    
    // debug info
    renderer.drawText(
        `Bodies: ${Matter.Composite.allBodies(world).length} | FPS: ${renderer.FPS}`,
        { x: 20, y: 20 },
        16,
        { r: 1, g: 1, b: 0, a: 1 }
    );
    
    renderer.drawText(
        `Click to spawn boxes | Physics: 60 Hz fixed`,
        { x: 20, y: 750 },
        14,
        { r: 0.7, g: 0.7, b: 0.7, a: 1 }
    );
});


function Loop() {
    renderer.input.GetInput();
    
    const now = performance.now();
    let frameTime = now - lastTime;
    lastTime = now;
    
    // cap frame time to prevent spiral
    if (frameTime > 250) frameTime = 250; // max 250ms (4 FPS minimum)
    
    accumulator += frameTime;
    
    // clamp accumulator 
    if (accumulator > MAX_ACCUMULATOR) {
        accumulator = MAX_ACCUMULATOR;
    }
    
    // fixed timestep physics updates
    while (accumulator >= FIXED_DT) {
        handleInput(); // input is part of simulation
        Matter.Engine.update(engine, FIXED_DT);
        accumulator -= FIXED_DT;
    }
    
    // render (once per frame, regardless of physics ticks)
    renderWorld();
    
    if (renderer.step()) {
        setImmediate(Loop);
    } else {
        renderer.shutdown();
    }
}

Loop();

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    canvas.destroy();
    renderer.shutdown();
    process.exit(0);
});