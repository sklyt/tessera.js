// polygon.js

import { LineDrawer } from "./bresenham.js";
// TODO: add cam
export class PolygonDrawer {
    /**
     * Fill a polygon defined by an array of points
     * Uses scanline algorithm with edge table
     * Handles convex, concave, and self-intersecting polygons
     */
    static fillPolygon(canvas, points, r, g, b, a = 255) {
        if (points.length < 3) return { pixels: 0, time: 0 };
        
        const startTime = performance.now();
        
        // Build edge table
        const edges = PolygonDrawer._buildEdgeTable(points);
        if (edges.length === 0) return { pixels: 0, time: 0 };
        
        // Find y-range
        let yMin = Infinity, yMax = -Infinity;
        for (const edge of edges) {
            yMin = Math.min(yMin, edge.yMin);
            yMax = Math.max(yMax, edge.yMax);
        }
        
        // Clamp to canvas bounds
        yMin = Math.max(0, Math.floor(yMin));
        yMax = Math.min(canvas.height - 1, Math.ceil(yMax));
        
        // Calculate bounding box for region update
        let minX = Infinity, maxX = -Infinity;
        for (const pt of points) {
            minX = Math.min(minX, pt.x);
            maxX = Math.max(maxX, pt.x);
        }
        minX = Math.max(0, Math.floor(minX));
        maxX = Math.min(canvas.width - 1, Math.ceil(maxX));
        
        // Direct buffer access
        const data = canvas.data;
        const width = canvas.width;
        const height = canvas.height;
        
        let pixelsDrawn = 0;
        
        // Process each scanline
        for (let y = yMin; y <= yMax; y++) {
            // Find all edges that intersect this scanline
            const intersections = [];
            
            for (const edge of edges) {
                if (y >= edge.yMin && y < edge.yMax) {
                    // Calculate x intersection for this scanline
                    const x = edge.x + (y - edge.yMin) * edge.dx;
                    intersections.push(x);
                }
            }
            
            // Sort intersections left to right
            intersections.sort((a, b) => a - b);
            
            // Fill between pairs of intersections (even-odd rule)
            for (let i = 0; i < intersections.length - 1; i += 2) {
                const x1 = Math.max(0, Math.floor(intersections[i]));
                const x2 = Math.min(width - 1, Math.ceil(intersections[i + 1]));
                
                // Fill scanline segment
                for (let x = x1; x <= x2; x++) {
                    const idx = (y * width + x) * 4;
                    data[idx + 0] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = a;
                    pixelsDrawn++;
                }
            }
        }
        
        // Extract region for GPU upload
        const regionWidth = maxX - minX + 1;
        const regionHeight = yMax - yMin + 1;
        const regionData = PolygonDrawer._extractRegion(
            data, width, minX, yMin, regionWidth, regionHeight
        );
        
        canvas.renderer.updateBufferData(
            canvas.bufferId,
            regionData,
            minX, yMin,
            regionWidth, regionHeight
        );
        
        canvas.needsUpload = true;
        
        const elapsed = performance.now() - startTime;
        return { 
            pixels: pixelsDrawn, 
            time: elapsed,
            vertices: points.length,
            scanlines: yMax - yMin + 1
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
            
            // Skip horizontal edges (they don't contribute to fill)
            if (Math.abs(p1.y - p2.y) < 0.001) continue;
            
            // Ensure p1 is the lower point (smaller y)
            let x1 = p1.x, y1 = p1.y;
            let x2 = p2.x, y2 = p2.y;
            
            if (y1 > y2) {
                [x1, x2] = [x2, x1];
                [y1, y2] = [y2, y1];
            }
            
            // Calculate inverse slope (dx/dy instead of dy/dx)
            // This is how much x changes per scanline
            const dx = (x2 - x1) / (y2 - y1);
            
            edges.push({
                yMin: y1,
                yMax: y2,
                x: x1,      // x at yMin
                dx: dx      // x increment per scanline
            });
        }
        
        return edges;
    }
    
    /**
     * Draw polygon outline (stroke)
     */
    static strokePolygon(canvas, points, thickness, r, g, b, a = 255) {
        if (points.length < 2) return { time: 0 };
        
        const startTime = performance.now();
        
        // Draw lines between consecutive vertices
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            
            LineDrawer.drawThickLine(
                canvas, 
                p1.x, p1.y, 
                p2.x, p2.y, 
                thickness, 
                r, g, b, a
            );
        }
        
        const elapsed = performance.now() - startTime;
        return { time: elapsed, vertices: points.length };
    }
    
    /**
     * Create common polygon shapes
     */
    static createRegularPolygon(cx, cy, radius, sides) {
        const points = [];
        const angleStep = (Math.PI * 2) / sides;
        
        for (let i = 0; i < sides; i++) {
            const angle = i * angleStep - Math.PI / 2; // Start at top
            points.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            });
        }
        
        return points;
    }
    
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
    
    static createRoundedRect(x, y, width, height, radius) {
        // Approximate rounded corners with line segments
        const segments = 8; // Segments per corner
        const points = [];
        
        // Helper to add arc points
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
        
        // Top-right corner
        addArc(x + width - r, y + r, r, -Math.PI/2, 0);
        
        // Bottom-right corner
        addArc(x + width - r, y + height - r, r, 0, Math.PI/2);
        
        // Bottom-left corner
        addArc(x + r, y + height - r, r, Math.PI/2, Math.PI);
        
        // Top-left corner
        addArc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
        
        return points;
    }
    
    /**
     * Extract rectangular region from buffer
     */
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

