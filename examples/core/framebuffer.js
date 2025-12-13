
import { loadRenderer, InputMap, PixelBuffer, LineDrawer, AADrawer, ShapeDrawer, PolygonDrawer, DirtyRegionTracker, PerformanceMonitor } from "../../dist/esm/index.js";



const { Renderer, RESIZABLE, UNDECORATED } = loadRenderer();
const renderer = new Renderer();

const perfMonitor = new PerformanceMonitor()
if (!renderer.initialize(1920, 1060, "Raw Pixels")) {
    console.error("Failed to initialize renderer");
    process.exit(1);
}

renderer.setWindowState(RESIZABLE);
renderer.targetFPS = 120;

const canvas = new PixelBuffer(renderer, 1000, 600);
canvas.clear(15, 15, 35, 255);


let frameCount = 0;


renderer.onRender(() => {
    renderer.clear({ r: 0, g: 0, b: 0, a: 50 });

    canvas.draw(100, 100);


    renderer.drawText(
        "direct Memory Access",
        { x: 20, y: 50 },
        16,
        { r: 1, g: 1, b: 1, a: 1 }
    );

    renderer.drawText(
        `FPS: ${renderer.FPS} | Buffer: ${canvas.width}x${canvas.height} | Memory: ${(canvas.width * canvas.height * 4 / 1024).toFixed(1)}KB`,
        { x: 20, y: 750 },
        16,
        { r: 1, g: 1, b: 1, a: 1 }
    );
})



// two blobs that blend smoothly
// scales the Gaussian peak (1.0 = unchanged). Use >1 to make the peak brighter, <1 to dim
/**
 * 
 * factor in exp(-d2 * factor) — controls falloff width/steepness. In your code factor = 2.0.

factor ↑ → smaller, tighter bright core.

factor ↓ → wider, softer halo.
Typical useful range: 0.5 .. 6.0.
 * 
 * @param {*} x 
 * @param {*} y 
 * @param {*} cx 
 * @param {*} cy 
 * @param {*} rx 
 * @param {*} ry 
 * @param {*} intensity 
 * @returns 
 */
function gaussianEllipse(x, y, cx, cy, rx, ry, intensity = 1) {

    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    const d2 = dx * dx + dy * dy;
    // gaussian falloff: exp(-d2 * factor)

    return Math.exp(-d2 * 2.0) * intensity; // factor=2 controls falloff width
}




/**
 * keep heavy computations cached/static or move to a thread
 */
class StaticCosmicBackground {
    /**
     * 
     * @param {PixelBuffer} canvas 
     * @param {*} width 
     * @param {*} height 
     */
    constructor(canvas, width, height) {
        this.width = width
        this.height = height
        this.canvas = canvas
        this.staticbuffer = new PixelBuffer(renderer, width, height)
        this._init()
    }

    _init() {
     
        const data = this.staticbuffer.data
        const width = this.width
        const height = this.height

        // "stars"
        for (let i = 0; i < 2000; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            const brightness = 100 + Math.random() * 155;
            const idx = (y * width + x) * 4
            data[idx + 0] = brightness
            data[idx + 1] = brightness
            data[idx + 2] = brightness
            data[idx + 3] = 255

        }

        const targetR = 15, targetG = 15, targetB = 35;
        const cx1 = width * 0.35, cy1 = height * 0.6, rx1 = 200, ry1 = 120;
        const cx2 = width * 0.65, cy2 = height * 0.35, rx2 = 220, ry2 = 140;
       // fill areas w/o starts with noise/dust
        for (let y = 0; y < height; y++) {
            const rowStart = y * width * 4;
            for (let x = 0; x < width; x++) {
                const idx = rowStart + (x * 4);
                if (data[idx].r === targetR && data[idx].g === targetG && data[idx].b === targetB) {
                    perfMonitor.start("gaussianEllipse")
                    const g1 = gaussianEllipse(x, y, cx1, cy1, rx1, ry1, 1.0);
                    const g2 = gaussianEllipse(x, y, cx2, cy2, rx2, ry2, 1.0);
                    perfMonitor.end("gaussianEllipse")
                    // final color: add channels (clamp to 0..255)
                    const r = Math.round(Math.min(255, 15 + g1 * 180)); 
                    const g = Math.round(Math.min(255, 15 + g2 * 200));
                    // blue can be base + small noise
                    const b = Math.round(Math.min(255, 35 + (g1 + g2) * 40));

                    data[idx + 0] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = 255;
                }

            }
        }
    
    }

    draw() {
        // this.staticbuffer.data.fill(0)
        // this._init() // <- to animate
        this.canvas.data.set(this.staticbuffer.data)
    }
}




function createDataVisualization() {
    // CPU-style utilization bars
    perfMonitor.start("createDataVisualization")

    const barWidth = 20;
    const barSpacing = 30;
    const maxHeight = 200;
    const tracker = new DirtyRegionTracker(canvas); // always use region tracker for targeted updates in the gpu 
    tracker.markRect(0, 0, canvas.width, canvas.height)
   

    for (let bar = 0; bar < 15; bar++) {
        const x = 50 + bar * barSpacing;
        const height = Math.floor((Math.sin(Date.now() * 0.001 + bar * 0.5) * 0.5 + 0.5) * maxHeight);

        // bar with gradient
        for (let y = 0; y < height; y++) {
            const progress = y / maxHeight;
            const r = Math.floor(50 + progress * 200);
            const g = Math.floor(100 + progress * 100);
            const b = Math.floor(150 - progress * 100);

            for (let px = 0; px < barWidth; px++) {
                //     canvas.setPixel(x + px, canvas.height - 50 - y, r, g, b, 255);  <- expensive updates gpu texture on every call
                const idx = canvas.coordToIndex(x + px, canvas.height - 50 - y); // <- direct memory access w/o freq updates cheap
                canvas.data[idx + 0] = r;
                canvas.data[idx + 1] = g;
                canvas.data[idx + 2] = b;
                canvas.data[idx + 3] = 255;
                // tracker.mark(x + px, canvas.height - 50 - y);

            }
        }
    }


    tracker.flush() // update gpu texture only once
    canvas.upload() // commit to gpu
    perfMonitor.end("createDataVisualization")

}


function createParticleSystem() {
    const particles = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < 100; i++) {
        particles.push({
            x: centerX,
            y: centerY,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1.0,
            decay: 0.0005 + Math.random() * 0.01,
            color: {
                r: Math.floor(100 + Math.random() * 155),
                g: Math.floor(100 + Math.random() * 155),
                b: Math.floor(200 + Math.random() * 55)
            }
        });
    }

    return particles;
}

const background = new StaticCosmicBackground(canvas, canvas.width, canvas.height)  // precompute
createDataVisualization();
const particles = createParticleSystem();


function animate() {
    perfMonitor.start("animate")

    frameCount++;
    const tracker = new DirtyRegionTracker(canvas);
    particles.forEach(particle => {
        // clear previous position (simplified - in real systems you'd track previous positions)
        // for now, we'll let them trail naturally

        // update physics

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay;

        // bounce of wall and lose some energy
        if (particle.x <= 0 || particle.x >= canvas.width - 1) {
            particle.vx *= -0.8;
            particle.x = Math.max(0, Math.min(canvas.width - 1, particle.x));
        }
        if (particle.y <= 0 || particle.y >= canvas.height - 1) {
            particle.vy *= -0.8;
            particle.y = Math.max(0, Math.min(canvas.height - 1, particle.y));
        }

        // add some gravity toward center
        const dx = canvas.width / 2 - particle.x;
        const dy = canvas.height / 2 - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) { // particle in is in the center
            particle.vx += dx * 0.0001;
            particle.vy += dy * 0.0001;
        }

        // draw particle with alpha based on life
        if (particle.life > 0) {
            const alpha = Math.floor(particle.life * 255);
            const size = Math.floor(particle.life * 3) + 1;

            // draw particle as a small circle
            for (let py = -size; py <= size; py++) {
                for (let px = -size; px <= size; px++) {
                    if (px * px + py * py <= size * size) {
                        const x = Math.floor(particle.x + px);
                        const y = Math.floor(particle.y + py);

                        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                            // blend with background
                            const bg = canvas.getPixel(x, y);
                            const blendR = Math.floor((particle.color.r * particle.life + bg.r * (1 - particle.life * 0.5)));
                            const blendG = Math.floor((particle.color.g * particle.life + bg.g * (1 - particle.life * 0.5)));
                            const blendB = Math.floor((particle.color.b * particle.life + bg.b * (1 - particle.life * 0.5)));

                            // canvas.setPixel(x, y, blendR, blendG, blendB, 255);
                            const idx = canvas.coordToIndex(x, y)
                            canvas.data[idx + 0] = blendR
                            canvas.data[idx + 1] = blendG
                            canvas.data[idx + 2] = blendB
                            canvas.data[idx + 3] = 255
                            tracker.mark(x, y)
                        }
                    }
                }
            }
        } else {
            // reset dead particle
            particle.x = canvas.width / 2;
            particle.y = canvas.height / 2;
            particle.vx = (Math.random() - 0.5) * 4;
            particle.vy = (Math.random() - 0.5) * 4;
            particle.life = 1.0;
        }
    })


    tracker.flush()
    canvas.upload()
    perfMonitor.end("animate")

}


function Loop() {
    const frameStart = performance.now();
    renderer.input.GetInput() // <- get keyboard/mouse input state
    perfMonitor.start('frame');
    canvas.clear(15, 15, 35, 255); 
    background.draw()
    createDataVisualization();
    animate()
    perfMonitor.end('frame');
    perfMonitor.recordFrameTime(frameStart);
    if (frameCount % 240 === 0) {
        perfMonitor.logMetrics();
    }
    if (renderer.step()) { // calls the callback and draws on screen
        setTimeout(Loop, 0);
    } else {
        console.log('loop ended');
        renderer.shutdown();
    }
}



Loop()


process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    canvas.destroy();
    renderer.shutdown();
    process.exit(0);
});