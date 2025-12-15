// polygon.js

import { Camera } from "../camera/index.js";
import { LineDrawer } from "./bresenham.js";
import { PixelBuffer } from "./pixel_buffer.js";
import { shouldDrawPixel } from "./utils.js";

export class PolygonDrawer {
    /**
     *      * Fill a polygon defined by an array of points
         * Uses scanline algorithm with edge table
         * Handles convex, concave, and self-intersecting polygons
     * @param {PixelBuffer} canvas 
     * @param {Array<{x: number, y: number}>} points 
     * @param {number} r 
     * @param {number} g 
     * @param {number} b 
     * @param {number} a 
     * @param {Camera} camera 
     * @returns 
     */
    static fillPolygon(canvas, points, r, g, b, a = 255, camera = undefined) {
        if (points.length < 3) return { pixels: 0 };

        const edges = PolygonDrawer._buildEdgeTable(points);
        if (edges.length === 0) return { pixels: 0 };

        let yMin = Infinity, yMax = -Infinity;
        for (const edge of edges) {
            yMin = Math.min(yMin, edge.yMin);
            yMax = Math.max(yMax, edge.yMax);
        }

        yMin = Math.max(0, Math.floor(yMin));
        yMax = Math.min(canvas.height - 1, Math.ceil(yMax));

        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        let pixelsDrawn = 0;

        for (let y = yMin; y <= yMax; y++) {
            const intersections = [];

            for (const edge of edges) {
                if (y >= edge.yMin && y < edge.yMax) {
                    const x = edge.x + (y - edge.yMin) * edge.dx;
                    intersections.push(x);
                }
            }

            intersections.sort((a, b) => a - b);

            for (let i = 0; i < intersections.length - 1; i += 2) {
                const x1 = Math.floor(intersections[i]);
                const x2 = Math.ceil(intersections[i + 1]);

                for (let x = x1; x <= x2; x++) {
                    if (!shouldDrawPixel(x, y, canvas, camera)) continue;

                    const idx = (y * width + x) * 4;
                    data[idx + 0] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = a;
                    pixelsDrawn++;

                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        if (pixelsDrawn === 0) return { pixels: 0 };

        const regionWidth = maxX - minX + 1;
        const regionHeight = maxY - minY + 1;
        const regionData = PolygonDrawer._extractRegion(
            data, width, minX, minY, regionWidth, regionHeight
        );

        canvas.renderer.updateBufferData(
            canvas.bufferId,
            regionData,
            minX, minY,
            regionWidth, regionHeight
        );

        canvas.needsUpload = true;

        return {
            pixels: pixelsDrawn,
            vertices: points.length,
            scanlines: maxY - minY + 1
        };
    }

    /**
     * Build edge table from vertices
     * Each edge stores: yMin, yMax, x at yMin, and dx (inverse slope)
     */
    static _buildEdgeTable(points) {
        const edges = [];
        const n = points.length;

        for (let i = 0; i < n; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % n];

            if (Math.abs(p1.y - p2.y) < 0.001) continue;

            let x1 = p1.x, y1 = p1.y;
            let x2 = p2.x, y2 = p2.y;

            if (y1 > y2) {
                [x1, x2] = [x2, x1];
                [y1, y2] = [y2, y1];
            }

            const dx = (x2 - x1) / (y2 - y1);

            edges.push({
                yMin: y1,
                yMax: y2,
                x: x1,
                dx: dx
            });
        }

        return edges;
    }

    /**
     * 
     * @param {PixelBuffer} canvas 
     * @param {Array<{x: number, y: number}>} points 
     * @param {number} thickness 
     * @param {number} r 
     * @param {number} g 
     * @param {number} b 
     * @param {number} a 
     * @param {Camera} camera 
     * @returns 
     */
    static strokePolygon(canvas, points, thickness, r, g, b, a = 255, camera = undefined) {
        if (points.length < 2) return;

        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];

            LineDrawer.drawThickLine(
                canvas,
                p1.x, p1.y,
                p2.x, p2.y,
                thickness,
                r, g, b, a,
                camera
            );
        }
    }

    /**
     * 
     * @param {number} cx 
     * @param {number} cy 
     * @param {number} radius 
     * @param {number} sides 
     * @returns 
     */
    static createRegularPolygon(cx, cy, radius, sides) {
        const points = [];
        const angleStep = (Math.PI * 2) / sides;

        for (let i = 0; i < sides; i++) {
            const angle = i * angleStep - Math.PI / 2;
            points.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            });
        }

        return points;
    }

    /**
     * 
     * @param {number} cx 
     * @param {number} cy 
     * @param {number} outerRadius 
     * @param {number} innerRadius 
     * @param {number} points 
     * @returns 
     */
    static createStar(cx, cy, outerRadius, innerRadius, points) {
        const verts = [];
        const angleStep = (Math.PI * 2) / (points * 2);

        for (let i = 0; i < points * 2; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;

            verts.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            });
        }

        return verts;
    }

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     * @param {number} radius 
     * @returns 
     */
    static createRoundedRect(x, y, width, height, radius) {
        const segments = 8;
        const points = [];

        const addArc = (cx, cy, r, startAngle, endAngle) => {
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const angle = startAngle + (endAngle - startAngle) * t;
                points.push({
                    x: cx + Math.cos(angle) * r,
                    y: cy + Math.sin(angle) * r
                });
            }
        };

        const r = Math.min(radius, width / 2, height / 2);

        addArc(x + width - r, y + r, r, -Math.PI / 2, 0);
        addArc(x + width - r, y + height - r, r, 0, Math.PI / 2);
        addArc(x + r, y + height - r, r, Math.PI / 2, Math.PI);
        addArc(x + r, y + r, r, Math.PI, Math.PI * 1.5);

        return points;
    }

    static _extractRegion(data, bufferWidth, x, y, width, height) {
        const region = new Uint8Array(width * height * 4);

        for (let row = 0; row < height; row++) {
            const srcOffset = ((y + row) * bufferWidth + x) * 4;
            const dstOffset = row * width * 4;
            const rowBytes = width * 4;

            region.set(
                data.subarray(srcOffset, srcOffset + rowBytes),
                dstOffset
            );
        }

        return region;
    }
}

