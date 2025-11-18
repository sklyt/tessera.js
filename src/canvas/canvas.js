import { LineDrawer } from "./bresenham.js";
import { GraphicsState } from "./clip";
import { PixelBuffer } from "./pixel_buffer.js";
import { PolygonDrawer } from "./polygon.js";
import { ShapeDrawer } from "./shapes.js";


export class Canvas2D {
    // ... existing constructor and properties ...
    
    // ===== CLIPPING OPERATIONS =====
    
    /**
     * Set clipping rectangle (intersects with current clip)
     */
    clipRect(x, y, width, height) {
        this._clippingContext.pushClipRect(x, y, width, height);
        return this;
    }
    
    /**
     * Remove current clipping rectangle
     */
    resetClip() {
        // Pop back to the initial canvas clip
        while (this._clippingContext.state.clipStack.length > 1) {
            this._clippingContext.state.popClip();
        }
        return this;
    }
    
    /**
     * Use current path as clipping region
     */
    clip() {
        if (this._currentPath.length < 3) return this;
        
        // Convert path to polygon for clipping
        const points = [];
        for (const segment of this._currentPath) {
            if (segment.type === 'move' || segment.type === 'line') {
                points.push({ x: segment.x, y: segment.y });
            }
        }
        
        // Calculate bounding box of path
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const point of points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }
        
        this._clippingContext.pushClipRect(minX, minY, maxX - minX, maxY - minY);
        return this;
    }
    
    // ===== BLEND MODES =====
    
    /**
     * Set global blend mode for all drawing operations
     */
    globalCompositeOperation(blendMode) {
        this._state.blendMode = blendMode;
        return this;
    }
    
    /**
     * Draw with specific blend mode (temporary override)
     */
    withBlendMode(blendMode, drawCallback) {
        const previousBlendMode = this._state.blendMode;
        this._state.blendMode = blendMode;
        
        drawCallback(this);
        
        this._state.blendMode = previousBlendMode;
        return this;
    }
    
    // ===== UPDATED DRAWING METHODS WITH BLEND SUPPORT =====
    
    /**
     * Fill a rectangle with blend mode support
     */
    fillRect(x, y, width, height) {
        const startTime = performance.now();
        const style = this._state.fillStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        if (this._state.blendMode === BlendMode.NORMAL) {
            // Use optimized path for normal blend mode
            const stats = ShapeDrawer.fillRect(
                this._buffer, x, y, width, height,
                style.r, style.g, style.b, alpha
            );
            this._updateStats(stats, startTime);
        } else {
            // Use compositor for special blend modes
            const stats = Compositor.drawWithBlend(
                this._buffer,
                (tempCanvas) => {
                    ShapeDrawer.fillRect(
                        tempCanvas, x, y, width, height,
                        style.r, style.g, style.b, alpha
                    );
                },
                this._state.blendMode
            );
            this._updateStats(stats, startTime);
        }
        
        return this;
    }
    
    /**
     * Stroke a rectangle with blend mode support
     */
    strokeRect(x, y, width, height) {
        const startTime = performance.now();
        const style = this._state.strokeStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        if (this._state.blendMode === BlendMode.NORMAL) {
            const stats = ShapeDrawer.strokeRect(
                this._buffer, x, y, width, height,
                this._state.lineWidth,
                style.r, style.g, style.b, alpha
            );
            this._updateStats(stats, startTime);
        } else {
            const stats = Compositor.drawWithBlend(
                this._buffer,
                (tempCanvas) => {
                    ShapeDrawer.strokeRect(
                        tempCanvas, x, y, width, height,
                        this._state.lineWidth,
                        style.r, style.g, style.b, alpha
                    );
                },
                this._state.blendMode
            );
            this._updateStats(stats, startTime);
        }
        
        return this;
    }
    
    /**
     * Draw a line with blend mode support
     */
    drawLine(x1, y1, x2, y2) {
        const startTime = performance.now();
        const style = this._state.strokeStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        let stats;
        
        if (this._state.blendMode === BlendMode.NORMAL) {
            if (this._state.lineWidth === 1) {
                stats = AADrawer.drawLineAA(
                    this._buffer, x1, y1, x2, y2,
                    style.r, style.g, style.b, alpha
                );
            } else {
                stats = LineDrawer.drawThickLine(
                    this._buffer, x1, y1, x2, y2,
                    this._state.lineWidth,
                    style.r, style.g, style.b, alpha
                );
            }
        } else {
            stats = Compositor.drawWithBlend(
                this._buffer,
                (tempCanvas) => {
                    if (this._state.lineWidth === 1) {
                        AADrawer.drawLineAA(
                            tempCanvas, x1, y1, x2, y2,
                            style.r, style.g, style.b, alpha
                        );
                    } else {
                        LineDrawer.drawThickLine(
                            tempCanvas, x1, y1, x2, y2,
                            this._state.lineWidth,
                            style.r, style.g, style.b, alpha
                        );
                    }
                },
                this._state.blendMode
            );
        }
        
        this._updateStats(stats, startTime);
        return this;
    }
    
    /**
     * Fill a circle with blend mode support
     */
    fillCircle(cx, cy, radius) {
        const startTime = performance.now();
        const style = this._state.fillStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        if (this._state.blendMode === BlendMode.NORMAL) {
            const stats = ShapeDrawer.fillCircle(
                this._buffer, cx, cy, radius,
                style.r, style.g, style.b, alpha
            );
            this._updateStats(stats, startTime);
        } else {
            const stats = Compositor.drawWithBlend(
                this._buffer,
                (tempCanvas) => {
                    ShapeDrawer.fillCircle(
                        tempCanvas, cx, cy, radius,
                        style.r, style.g, style.b, alpha
                    );
                },
                this._state.blendMode
            );
            this._updateStats(stats, startTime);
        }
        
        return this;
    }
    
    // ===== UPDATED PATH OPERATIONS WITH CLIPPING =====
    
    /**
     * Stroke the current path with clipping support
     */
    stroke() {
        if (this._currentPath.length < 2) return this;
        
        const startTime = performance.now();
        const style = this._state.strokeStyle;
        const alpha = style.a * this._state.globalAlpha;
        
        // Check if any part of the path is visible
        let pathBounds = this._getPathBounds();
        if (!this._clippingContext.isRectVisible(
            pathBounds.x, pathBounds.y, 
            pathBounds.width, pathBounds.height
        )) {
            return this;
        }
        
        // Convert path to line segments with clipping
        let currentX = 0, currentY = 0;
        let stats = { pixels: 0, time: 0 };
        
        for (let i = 0; i < this._currentPath.length; i++) {
            const segment = this._currentPath[i];
            
            if (segment.type === 'move') {
                currentX = segment.x;
                currentY = segment.y;
            } else if (segment.type === 'line') {
                // Clip the line segment
                const clipped = this._clippingContext.clipLine(
                    currentX, currentY, segment.x, segment.y
                );
                
                if (clipped) {
                    const segmentStats = this._drawLineSegment(
                        clipped.x1, clipped.y1, clipped.x2, clipped.y2,
                        style, alpha
                    );
                    stats.pixels += segmentStats.pixels || 0;
                    stats.time += segmentStats.time || 0;
                }
                
                currentX = segment.x;
                currentY = segment.y;
            }
        }
        
        this._updateStats(stats, startTime);
        return this;
    }
    
    /**
     * Fill the current path with clipping support
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
        
        // Check visibility
        let pathBounds = this._getPathBounds();
        if (!this._clippingContext.isRectVisible(
            pathBounds.x, pathBounds.y, 
            pathBounds.width, pathBounds.height
        )) {
            return this;
        }
        
        let stats;
        if (this._state.blendMode === BlendMode.NORMAL) {
            stats = PolygonDrawer.fillPolygon(
                this._buffer, points,
                style.r, style.g, style.b, alpha
            );
        } else {
            stats = Compositor.drawWithBlend(
                this._buffer,
                (tempCanvas) => {
                    PolygonDrawer.fillPolygon(
                        tempCanvas, points,
                        style.r, style.g, style.b, alpha
                    );
                },
                this._state.blendMode
            );
        }
        
        this._updateStats(stats, startTime);
        return this;
    }
    
    // ===== PRIVATE HELPER METHODS =====
    
    /**
     * Draw a line segment with current style
     */
    _drawLineSegment(x1, y1, x2, y2, style, alpha) {
        if (this._state.lineWidth === 1) {
            return AADrawer.drawLineAA(
                this._buffer, x1, y1, x2, y2,
                style.r, style.g, style.b, alpha
            );
        } else {
            return LineDrawer.drawThickLine(
                this._buffer, x1, y1, x2, y2,
                this._state.lineWidth,
                style.r, style.g, style.b, alpha
            );
        }
    }
    
    /**
     * Get bounding box of current path
     */
    _getPathBounds() {
        if (this._currentPath.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const segment of this._currentPath) {
            if (segment.type === 'move' || segment.type === 'line') {
                minX = Math.min(minX, segment.x);
                minY = Math.min(minY, segment.y);
                maxX = Math.max(maxX, segment.x);
                maxY = Math.max(maxY, segment.y);
            }
        }
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    // ... rest of existing methods ...
}