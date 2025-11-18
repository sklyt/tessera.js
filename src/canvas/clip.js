import { ShapeDrawer } from "./shapes.js";


export class ClipRect {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    /**
     *  Check if rectangle intersects this clip rect
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @returns {boolean}
     */
    intersects(x, y, width, height) {
        return !(x + width < this.x ||
            x > this.x + this.width ||
            y + height < this.y ||
            y > this.y + this.height);
    }

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     * @returns {boolean}
     */
    contains(x, y) {
        return x >= this.x && x < this.x + this.width &&
            y >= this.y && y < this.y + this.height;
    }

    /**
     *  Get intersection with another rect
     * @param {ClipRect} other 
     * @returns 
     */
    intersect(other) {
        const x1 = Math.max(this.x, other.x);
        const y1 = Math.max(this.y, other.y);
        const x2 = Math.min(this.x + this.width, other.x + other.width);
        const y2 = Math.min(this.y + this.height, other.y + other.height);

        if (x2 <= x1 || y2 <= y1) {
            return null; // No intersection
        }

        return new ClipRect(x1, y1, x2 - x1, y2 - y1);
    }

    // Cohen-Sutherland outcode for line clipping
    computeOutcode(x, y) {
        let code = 0;

        if (x < this.x) code |= 1;              // Left
        if (x >= this.x + this.width) code |= 2; // Right
        if (y < this.y) code |= 4;              // Top
        if (y >= this.y + this.height) code |= 8; // Bottom

        return code;
    }
}

export class Transform {
    constructor(translateX = 0, translateY = 0, scaleX = 1, scaleY = 1, rotation = 0) {
        this.translateX = translateX;
        this.translateY = translateY;
        this.scaleX = scaleX;
        this.scaleY = scaleY;
        this.rotation = rotation; // radians
    }

    /**
     * Transform a point
     * @param {number} x 
     * @param {number} y 
     * @returns 
     */
    apply(x, y) {
        // handle rotation
        if (this.rotation !== 0) {
            const cos = Math.cos(this.rotation);
            const sin = Math.sin(this.rotation);
            const tx = x * cos - y * sin;
            const ty = x * sin + y * cos;
            x = tx;
            y = ty;
        }

        // apply scale and translation
        return {
            x: x * this.scaleX + this.translateX,
            y: y * this.scaleY + this.translateY
        };
    }

    /**
     * transform a rectangle (returns bounding box)
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @returns 
     */
    applyRect(x, y, width, height) {
        const points = [
            this.apply(x, y),
            this.apply(x + width, y),
            this.apply(x, y + height),
            this.apply(x + width, y + height)
        ];

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const pt of points) {
            minX = Math.min(minX, pt.x);
            minY = Math.min(minY, pt.y);
            maxX = Math.max(maxX, pt.x);
            maxY = Math.max(maxY, pt.y);
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    // Combine with another transform
    compose(other) {
        // For simplicity, we'll handle translation and scale composition
        // Full matrix composition would be more complex
        return new Transform(
            this.translateX + other.translateX * this.scaleX,
            this.translateY + other.translateY * this.scaleY,
            this.scaleX * other.scaleX,
            this.scaleY * other.scaleY,
            this.rotation + other.rotation
        );
    }

    /**
     *  Create identity transform
     * @returns 
     */
    static identity() {
        return new Transform(0, 0, 1, 1, 0);
    }
}

export class GraphicsState {
    /**
     * a stack to keep draw state
     */
    constructor() {
        this.clipStack = [];
        this.transformStack = [Transform.identity()];
        this.globalAlpha = 1.0;
        this.fillStyle = { r: 0, g: 0, b: 0, a: 255 };
        this.strokeStyle = { r: 0, g: 0, b: 0, a: 255 };
        this.lineWidth = 1;
    }

    get currentClip() {
        return this.clipStack.length > 0 ?
            this.clipStack[this.clipStack.length - 1] : null;
    }

    get currentTransform() {
        return this.transformStack[this.transformStack.length - 1];
    }

    /**
     * 
     * @param {ClipRect} clipRect 
     */
    pushClip(clipRect) {
        this.clipStack.push(clipRect);
    }

    /**
     * 
     * @returns {ClipRect}
     */
    popClip() {
        return this.clipStack.pop();
    }

    /**
     * 
     * @param {Transform} transform 
     */
    pushTransform(transform) {
        const current = this.currentTransform;
        this.transformStack.push(current.compose(transform));
    }

    /**
     * 
     * @returns {Transform}
     */
    popTransform() {
        if (this.transformStack.length > 1) {
            return this.transformStack.pop();
        }
        return this.currentTransform;
    }

/**
 * save state
 * @returns 
 */
    save() {
        return {
            clipStack: [...this.clipStack],
            transformStack: [...this.transformStack],
            globalAlpha: this.globalAlpha,
            fillStyle: { ...this.fillStyle },
            strokeStyle: { ...this.strokeStyle },
            lineWidth: this.lineWidth
        };
    }

    /**
     * restore saved state
     * @param {GraphicsState} state 
     */
    restore(state) {
        this.clipStack = state.clipStack;
        this.transformStack = state.transformStack;
        this.globalAlpha = state.globalAlpha;
        this.fillStyle = state.fillStyle;
        this.strokeStyle = state.strokeStyle;
        this.lineWidth = state.lineWidth;
    }
}

export class ClippingContext {
    constructor(canvas) {
        this.canvas = canvas;
        this.state = new GraphicsState();

        // Initial clip is entire canvas
        this.state.pushClip(new ClipRect(0, 0, canvas.width, canvas.height));
    }

    // Save current state
    save() {
        return this.state.save();
    }

    // Restore state
    restore(state) {
        this.state.restore(state);
    }

    // Push clip rectangle (intersects with current)
    pushClipRect(x, y, width, height) {
        const transform = this.state.currentTransform;
        const transformed = transform.applyRect(x, y, width, height);

        const newClip = new ClipRect(
            transformed.x, transformed.y,
            transformed.width, transformed.height
        );

        // Intersect with current clip
        const current = this.state.currentClip;
        if (current) {
            const intersected = current.intersect(newClip); // creates a new bounding box
            if (intersected) {
                this.state.pushClip(intersected);
            } else {
                // No intersection - push empty clip
                this.state.pushClip(new ClipRect(0, 0, 0, 0));
            }
        } else {
            this.state.pushClip(newClip);
        }
    }

    // Pop clip rectangle
    popClipRect() {
        this.state.popClip();
    }

    // Push transform
    pushTransform(translateX = 0, translateY = 0, scaleX = 1, scaleY = 1, rotation = 0) {
        const transform = new Transform(translateX, translateY, scaleX, scaleY, rotation);
        this.state.pushTransform(transform);
    }

    // Pop transform
    popTransform() {
        this.state.popTransform();
    }

    // Check if rectangle is visible (intersects clip)
    isRectVisible(x, y, width, height) {
        const transform = this.state.currentTransform;
        const transformed = transform.applyRect(x, y, width, height);
        const clip = this.state.currentClip;

        if (!clip) return true; // No clipping active

        return clip.intersects(
            transformed.x, transformed.y,
            transformed.width, transformed.height
        );
    }

    // Transform point from local to screen coordinates
    transformPoint(x, y) {
        return this.state.currentTransform.apply(x, y);
    }

    // Clip line using Cohen-Sutherland algorithm
    clipLine(x1, y1, x2, y2) {
        const clip = this.state.currentClip;
        if (!clip) {
            return { x1, y1, x2, y2 }; // No clipping
        }

        // Transform endpoints
        const transform = this.state.currentTransform;
        let p1 = transform.apply(x1, y1);
        let p2 = transform.apply(x2, y2);

        let code1 = clip.computeOutcode(p1.x, p1.y);
        let code2 = clip.computeOutcode(p2.x, p2.y);

        let accept = false;

        while (true) {
            if ((code1 | code2) === 0) {
                // Both points inside clip region
                accept = true;
                break;
            } else if ((code1 & code2) !== 0) {
                // Both points on same outside edge
                break;
            } else {
                // Line crosses boundary - clip it
                let x, y;
                const codeOut = code1 !== 0 ? code1 : code2;

                // Find intersection point
                if (codeOut & 8) { // Bottom
                    x = p1.x + (p2.x - p1.x) * (clip.y + clip.height - p1.y) / (p2.y - p1.y);
                    y = clip.y + clip.height;
                } else if (codeOut & 4) { // Top
                    x = p1.x + (p2.x - p1.x) * (clip.y - p1.y) / (p2.y - p1.y);
                    y = clip.y;
                } else if (codeOut & 2) { // Right
                    y = p1.y + (p2.y - p1.y) * (clip.x + clip.width - p1.x) / (p2.x - p1.x);
                    x = clip.x + clip.width;
                } else if (codeOut & 1) { // Left
                    y = p1.y + (p2.y - p1.y) * (clip.x - p1.x) / (p2.x - p1.x);
                    x = clip.x;
                }

                // Update point and outcode
                if (codeOut === code1) {
                    p1.x = x;
                    p1.y = y;
                    code1 = clip.computeOutcode(p1.x, p1.y);
                } else {
                    p2.x = x;
                    p2.y = y;
                    code2 = clip.computeOutcode(p2.x, p2.y);
                }
            }
        }

        if (accept) {
            return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
        }

        return null; // Line completely outside clip region
    }

    // Clipped drawing methods

    fillRect(x, y, width, height, r, g, b, a = 255) {
        if (!this.isRectVisible(x, y, width, height)) return;

        const transform = this.state.currentTransform;
        const transformed = transform.applyRect(x, y, width, height);

        // Calculate clipped bounds
        const clip = this.state.currentClip;
        const x1 = Math.max(clip.x, transformed.x);
        const y1 = Math.max(clip.y, transformed.y);
        const x2 = Math.min(clip.x + clip.width, transformed.x + transformed.width);
        const y2 = Math.min(clip.y + clip.height, transformed.y + transformed.height);

        if (x2 > x1 && y2 > y1) {
            // Apply global alpha
            const finalAlpha = a * this.state.globalAlpha;
            ShapeDrawer.fillRect(
                this.canvas, x1, y1, x2 - x1, y2 - y1,
                r, g, b, finalAlpha
            );
        }
    }

    strokeRect(x, y, width, height, lineWidth, r, g, b, a = 255) {
        if (!this.isRectVisible(x, y, width, height)) return;

        const finalAlpha = a * this.state.globalAlpha;

        // Use the transformed coordinates for drawing
        const transform = this.state.currentTransform;
        const p1 = transform.apply(x, y);
        const p2 = transform.apply(x + width, y);
        const p3 = transform.apply(x + width, y + height);
        const p4 = transform.apply(x, y + height);

        // Draw clipped lines
        this._drawClippedLine(p1.x, p1.y, p2.x, p2.y, lineWidth, r, g, b, finalAlpha);
        this._drawClippedLine(p2.x, p2.y, p3.x, p3.y, lineWidth, r, g, b, finalAlpha);
        this._drawClippedLine(p3.x, p3.y, p4.x, p4.y, lineWidth, r, g, b, finalAlpha);
        this._drawClippedLine(p4.x, p4.y, p1.x, p1.y, lineWidth, r, g, b, finalAlpha);
    }

    drawLine(x1, y1, x2, y2, lineWidth, r, g, b, a = 255) {
        const clipped = this.clipLine(x1, y1, x2, y2);
        if (!clipped) return;

        const finalAlpha = a * this.state.globalAlpha;

        if (lineWidth === 1) {
            LineDrawer.drawLine(
                this.canvas,
                clipped.x1, clipped.y1, clipped.x2, clipped.y2,
                r, g, b, finalAlpha
            );
        } else {
            LineDrawer.drawThickLine(
                this.canvas,
                clipped.x1, clipped.y1, clipped.x2, clipped.y2,
                lineWidth, r, g, b, finalAlpha
            );
        }
    }

    fillCircle(cx, cy, radius, r, g, b, a = 255) {
        if (!this.isRectVisible(cx - radius, cy - radius, radius * 2, radius * 2)) return;

        const transform = this.state.currentTransform;
        const center = transform.apply(cx, cy);

        // Scale radius by average scale (approximation)
        const scaledRadius = radius * (Math.abs(transform.scaleX) + Math.abs(transform.scaleY)) / 2;

        const finalAlpha = a * this.state.globalAlpha;

        // Draw with per-pixel clip checking
        this._fillCircleClipped(center.x, center.y, scaledRadius, r, g, b, finalAlpha);
    }

    // Helper methods

    _drawClippedLine(x1, y1, x2, y2, lineWidth, r, g, b, a) {
        const clipped = this.clipLine(
            x1, y1, x2, y2
        );

        if (clipped) {
            if (lineWidth === 1) {
                LineDrawer.drawLine(
                    this.canvas,
                    clipped.x1, clipped.y1, clipped.x2, clipped.y2,
                    r, g, b, a
                );
            } else {
                LineDrawer.drawThickLine(
                    this.canvas,
                    clipped.x1, clipped.y1, clipped.x2, clipped.y2,
                    lineWidth, r, g, b, a
                );
            }
        }
    }

    _fillCircleClipped(cx, cy, radius, r, g, b, a) {
        const clip = this.state.currentClip;
        const data = this.canvas.data;
        const width = this.canvas.width;
        const height = this.canvas.height;

        const minX = Math.max(0, Math.floor(cx - radius));
        const maxX = Math.min(width - 1, Math.ceil(cx + radius));
        const minY = Math.max(0, Math.floor(cy - radius));
        const maxY = Math.min(height - 1, Math.ceil(cy + radius));

        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                // Check if inside clip rect
                if (clip && !clip.contains(px, py)) continue;

                const dx = px - cx;
                const dy = py - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= radius) {
                    const idx = (py * width + px) * 4;
                    data[idx + 0] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = a;
                }
            }
        }

        // Update region
        this.canvas.renderer.updateBufferData(
            this.canvas.bufferId,
            this.canvas.data.subarray(0, width * height * 4),
            minX, minY,
            maxX - minX + 1, maxY - minY + 1
        );
        this.canvas.needsUpload = true;
    }

    // State setters
    setFillStyle(r, g, b, a = 255) {
        this.state.fillStyle = { r, g, b, a };
    }

    setStrokeStyle(r, g, b, a = 255) {
        this.state.strokeStyle = { r, g, b, a };
    }

    setLineWidth(width) {
        this.state.lineWidth = width;
    }

    setGlobalAlpha(alpha) {
        this.state.globalAlpha = Math.max(0, Math.min(1, alpha));
    }
}