import { LineDrawer } from "./bresenham.js";
import { GraphicsState } from "./clip";
import { PixelBuffer } from "./pixel_buffer.js";
import { PolygonDrawer } from "./polygon.js";
import { ShapeDrawer } from "./shapes.js";



export class Canvas2D {
    /**
     * Production-ready canvas with unified API
     * Combines all our optimizations with a clean interface
     */
    constructor(renderer, width, height) {
        this.renderer = renderer;
        this.width = width;
        this.height = height;
        
        // Core rendering surface
        this._buffer = new PixelBuffer(renderer, width, height, true);
        
        // Graphics state
        this._state = new GraphicsState();
        this._stateStack = [];
        
        // Current path for complex shapes
        this._currentPath = [];
        
        // Performance tracking
        this._stats = {
            drawCalls: 0,
            pixelsDrawn: 0,
            regionsUpdated: 0,
            totalTime: 0
        };
        
        // Default styles
        this._state.fillStyle = { r: 0, g: 0, b: 0, a: 255 };
        this._state.strokeStyle = { r: 0, g: 0, b: 0, a: 255 };
        this._state.lineWidth = 1;
        this._state.globalAlpha = 1.0;
        
        console.log(`Created Canvas2D: ${width}x${height}`);
    }
    
    // ===== STATE MANAGEMENT =====
    
    /**
     * Save current graphics state
     */
    save() {
        this._stateStack.push(this._state.save());
        return this;
    }
    
    /**
     * Restore previous graphics state
     */
    restore() {
        if (this._stateStack.length > 0) {
            this._state.restore(this._stateStack.pop());
        }
        return this;
    }
    
    /**
     * Set fill color (0-255 or CSS color string)
     */
    fillStyle(color) {
        if (typeof color === 'string') {
            this._state.fillStyle = this._parseColor(color);
        } else if (typeof color === 'number') {
            this._state.fillStyle = { r: color, g: color, b: color, a: 255 };
        } else {
            this._state.fillStyle = color;
        }
        return this;
    }
    
    /**
     * Set stroke color
     */
    strokeStyle(color) {
        if (typeof color === 'string') {
            this._state.strokeStyle = this._parseColor(color);
        } else if (typeof color === 'number') {
            this._state.strokeStyle = { r: color, g: color, b: color, a: 255 };
        } else {
            this._state.strokeStyle = color;
        }
        return this;
    }
    
    /**
     * Set line width
     */
    lineWidth(width) {
        this._state.lineWidth = width;
        return this;
    }
    
    /**
     * Set global alpha (0-1)
     */
    globalAlpha(alpha) {
        this._state.globalAlpha = Math.max(0, Math.min(1, alpha));
        return this;
    }
    
    // ===== TRANSFORMATIONS =====
    
    /**
     * Translate coordinate system
     */
    translate(x, y) {
        this._state.pushTransform(new Transform(x, y, 1, 1, 0));
        return this;
    }
    
    /**
     * Scale coordinate system
     */
    scale(sx, sy = sx) {
        this._state.pushTransform(new Transform(0, 0, sx, sy, 0));
        return this;
    }
    
    /**
     * Rotate coordinate system (radians)
     */
    rotate(angle) {
        this._state.pushTransform(new Transform(0, 0, 1, 1, angle));
        return this;
    }
    
    /**
     * Reset transformations
     */
    resetTransform() {
        this._state.transformStack = [Transform.identity()];
        return this;
    }
    
    // ===== DRAWING OPERATIONS =====
    
    /**
     * Clear entire canvas with color
     */
    clear(r = 0, g = 0, b = 0, a = 255) {
        const startTime = performance.now();
        this._buffer.clear(r, g, b, a);
        this._stats.drawCalls++;
        this._stats.totalTime += performance.now() - startTime;
        return this;
    }
    
    /**
     * Fill a rectangle
     */
    fillRect(x, y, width, height) {
        const startTime = performance.now();
        const style = this._state.fillStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        // Use optimized rectangle filler
        const stats = ShapeDrawer.fillRect(
            this._buffer, x, y, width, height,
            style.r, style.g, style.b, alpha
        );
        
        this._updateStats(stats, startTime);
        return this;
    }
    
    /**
     * Stroke a rectangle outline
     */
    strokeRect(x, y, width, height) {
        const startTime = performance.now();
        const style = this._state.strokeStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        const stats = ShapeDrawer.strokeRect(
            this._buffer, x, y, width, height,
            this._state.lineWidth,
            style.r, style.g, style.b, alpha
        );
        
        this._updateStats(stats, startTime);
        return this;
    }
    
    /**
     * Fill a circle
     */
    fillCircle(cx, cy, radius) {
        const startTime = performance.now();
        const style = this._state.fillStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        const stats = ShapeDrawer.fillCircle(
            this._buffer, cx, cy, radius,
            style.r, style.g, style.b, alpha
        );
        
        this._updateStats(stats, startTime);
        return this;
    }
    
    /**
     * Stroke a circle outline
     */
    strokeCircle(cx, cy, radius) {
        const startTime = performance.now();
        const style = this._state.strokeStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        const stats = ShapeDrawer.strokeCircle(
            this._buffer, cx, cy, radius,
            this._state.lineWidth,
            style.r, style.g, style.b, alpha
        );
        
        this._updateStats(stats, startTime);
        return this;
    }
    
    /**
     * Draw a line (anti-aliased if thin, thick if wide)
     */
    drawLine(x1, y1, x2, y2) {
        const startTime = performance.now();
        const style = this._state.strokeStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        let stats;
        if (this._state.lineWidth === 1) {
            // Use anti-aliased line for thin strokes
            stats = AADrawer.drawLineAA(
                this._buffer, x1, y1, x2, y2,
                style.r, style.g, style.b, alpha
            );
        } else {
            // Use thick line for wider strokes
            stats = LineDrawer.drawThickLine(
                this._buffer, x1, y1, x2, y2,
                this._state.lineWidth,
                style.r, style.g, style.b, alpha
            );
        }
        
        this._updateStats(stats, startTime);
        return this;
    }
    
    // ===== PATH API =====
    
    /**
     * Begin a new path
     */
    beginPath() {
        this._currentPath = [];
        return this;
    }
    
    /**
     * Move to point without drawing
     */
    moveTo(x, y) {
        this._currentPath.push({ type: 'move', x, y });
        return this;
    }
    
    /**
     * Draw line to point
     */
    lineTo(x, y) {
        this._currentPath.push({ type: 'line', x, y });
        return this;
    }
    
    /**
     * Close current path
     */
    closePath() {
        if (this._currentPath.length > 0) {
            const first = this._currentPath[0];
            this._currentPath.push({ 
                type: 'line', 
                x: first.x, 
                y: first.y 
            });
        }
        return this;
    }
    
    /**
     * Stroke the current path
     */
    stroke() {
        if (this._currentPath.length < 2) return this;
        
        const startTime = performance.now();
        const style = this._state.strokeStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        // Convert path to line segments
        let currentX = 0, currentY = 0;
        let stats = { pixels: 0, time: 0 };
        
        for (let i = 0; i < this._currentPath.length; i++) {
            const segment = this._currentPath[i];
            
            if (segment.type === 'move') {
                currentX = segment.x;
                currentY = segment.y;
            } else if (segment.type === 'line') {
                const segmentStats = LineDrawer.drawThickLine(
                    this._buffer, currentX, currentY, segment.x, segment.y,
                    this._state.lineWidth,
                    style.r, style.g, style.b, alpha
                );
                
                stats.pixels += segmentStats.pixels || 0;
                stats.time += segmentStats.time || 0;
                
                currentX = segment.x;
                currentY = segment.y;
            }
        }
        
        this._updateStats(stats, startTime);
        return this;
    }
    
    /**
     * Fill the current path
     */
    fill() {
        if (this._currentPath.length < 3) return this;
        
        const startTime = performance.now();
        const style = this._state.fillStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        // Extract points from path
        const points = [];
        for (const segment of this._currentPath) {
            if (segment.type === 'move' || segment.type === 'line') {
                points.push({ x: segment.x, y: segment.y });
            }
        }
        
        const stats = PolygonDrawer.fillPolygon(
            this._buffer, points,
            style.r, style.g, style.b, alpha
        );
        
        this._updateStats(stats, startTime);
        return this;
    }
    
    // ===== HIGH-LEVEL SHAPES =====
    
    /**
     * Draw a regular polygon
     */
    drawPolygon(cx, cy, radius, sides, filled = true) {
        const points = PolygonDrawer.createRegularPolygon(cx, cy, radius, sides);
        
        if (filled) {
            this._drawPolygonFill(points);
        } else {
            this._drawPolygonStroke(points);
        }
        
        return this;
    }
    
    /**
     * Draw a star
     */
    drawStar(cx, cy, outerRadius, innerRadius, points, filled = true) {
        const verts = PolygonDrawer.createStar(cx, cy, outerRadius, innerRadius, points);
        
        if (filled) {
            this._drawPolygonFill(verts);
        } else {
            this._drawPolygonStroke(verts);
        }
        
        return this;
    }
    
    /**
     * Draw rounded rectangle
     */
    drawRoundedRect(x, y, width, height, radius, filled = true) {
        const points = PolygonDrawer.createRoundedRect(x, y, width, height, radius);
        
        if (filled) {
            this._drawPolygonFill(points);
        } else {
            this._drawPolygonStroke(points);
        }
        
        return this;
    }
    
    // ===== TEXT & UI =====
    
    /**
     * Draw text (basic implementation)
     */
    fillText(text, x, y, size = 16) {
        // Simple bitmap font implementation
        // In production, you'd use a proper font rasterizer
        const style = this._state.fillStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        this._drawText(text, x, y, size, style, alpha, true);
        return this;
    }
    
    strokeText(text, x, y, size = 16) {
        const style = this._state.strokeStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        this._drawText(text, x, y, size, style, alpha, false);
        return this;
    }
    
    // ===== PERFORMANCE & MEMORY =====
    
    /**
     * Upload changes to GPU
     */
    flush() {
        this._buffer.upload();
        return this;
    }
    
    /**
     * Get performance statistics
     */
    getStats() {
        return {
            ...this._stats,
            bufferSize: this.width * this.height * 4,
            memoryUsage: this._getMemoryUsage(),
            fps: this._stats.drawCalls > 0 ? 
                1000 / (this._stats.totalTime / this._stats.drawCalls) : 0
        };
    }
    
    /**
     * Reset performance statistics
     */
    resetStats() {
        this._stats = {
            drawCalls: 0,
            pixelsDrawn: 0,
            regionsUpdated: 0,
            totalTime: 0
        };
        return this;
    }
    
    /**
     * Draw this canvas to screen
     */
    draw(x, y) {
        this._buffer.draw(x, y);
        return this;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this._buffer.destroy();
        this._stateStack = [];
        this._currentPath = [];
        console.log('Canvas2D destroyed');
    }
    
    // ===== PRIVATE METHODS =====
    
    _drawPolygonFill(points) {
        const style = this._state.fillStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        const stats = PolygonDrawer.fillPolygon(
            this._buffer, points,
            style.r, style.g, style.b, alpha
        );
        
        this._updateStats(stats, performance.now());
    }
    
    _drawPolygonStroke(points) {
        const style = this._state.strokeStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        const stats = PolygonDrawer.strokePolygon(
            this._buffer, points,
            this._state.lineWidth,
            style.r, style.g, style.b, alpha
        );
        
        this._updateStats(stats, performance.now());
    }
    
    _drawText(text, x, y, size, style, alpha, filled) {
        // Simple 5x7 bitmap font
        const font = {
            'A': [0x0E, 0x11, 0x1F, 0x11, 0x11],
            'B': [0x1E, 0x11, 0x1E, 0x11, 0x1E],
            // ... more characters
        };
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i].toUpperCase();
            if (font[char]) {
                this._drawChar(font[char], x + i * (size + 2), y, size, style, alpha, filled);
            }
        }
    }
    
    _drawChar(bitmap, x, y, size, style, alpha, filled) {
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                if (bitmap[row] & (1 << (4 - col))) {
                    if (filled) {
                        ShapeDrawer.fillRect(
                            this._buffer, 
                            x + col * size/5, y + row * size/5,
                            size/5, size/5,
                            style.r, style.g, style.b, alpha
                        );
                    } else {
                        ShapeDrawer.strokeRect(
                            this._buffer,
                            x + col * size/5, y + row * size/5,
                            size/5, size/5, 1,
                            style.r, style.g, style.b, alpha
                        );
                    }
                }
            }
        }
    }
    
    _parseColor(colorStr) {
        // Parse CSS color strings like "#FF0000", "rgb(255,0,0)", etc.
        if (colorStr.startsWith('#')) {
            return {
                r: parseInt(colorStr.substr(1, 2), 16),
                g: parseInt(colorStr.substr(3, 2), 16),
                b: parseInt(colorStr.substr(5, 2), 16),
                a: 255
            };
        } else if (colorStr.startsWith('rgb')) {
            const matches = colorStr.match(/\d+/g);
            return {
                r: parseInt(matches[0]),
                g: parseInt(matches[1]),
                b: parseInt(matches[2]),
                a: matches[3] ? parseInt(matches[3]) * 255 : 255
            };
        }
        
        // Default to black
        return { r: 0, g: 0, b: 0, a: 255 };
    }
    
    _updateStats(stats, startTime) {
        this._stats.drawCalls++;
        this._stats.pixelsDrawn += stats.pixels || 0;
        this._stats.regionsUpdated += stats.regionSize ? 1 : 0;
        this._stats.totalTime += performance.now() - startTime;
    }
    
    _getMemoryUsage() {
        return {
            buffer: this.width * this.height * 4,
            stateStack: this._stateStack.length * 512, // Estimate
            currentPath: this._currentPath.length * 16,
            total: this.width * this.height * 4 + 
                   this._stateStack.length * 512 + 
                   this._currentPath.length * 16
        };
    }
}