import { PixelBuffer } from "./pixel_buffer.js";
import { DrawingUtils } from "./utils.js";

export class AADrawer {
  /**
   * Wu's line algorithm - anti-aliased line drawing
   * Handles all slopes, all directions
   * @param {PixelBuffer} canvas
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @param {number} a
   * @returns
   */
  static drawLineAA(canvas, x1, y1, x2, y2, r, g, b, a = 255, camera= undefined) {
    const startTime = performance.now();

    // Early camera clipping check
    if (camera) {
      const screen1 = camera.worldToScreen(x1, y1);
      const screen2 = camera.worldToScreen(x2, y2);

      if (DrawingUtils.shouldClipRegion(camera,
        Math.min(screen1.x, screen2.x),
        Math.min(screen1.y, screen2.y),
        Math.abs(screen2.x - screen1.x),
        Math.abs(screen2.y - screen1.y))) {
        return { pixels: 0, time: 0 };
      }
    }

    // edge cases
    if (x1 === x2 && y1 === y2) {
      this._setPixelAACamera(canvas, x1, y1, r, g, b, a, camera);
      return { pixels: 1, time: performance.now() - startTime };
    }

    const steep = Math.abs(y2 - y1) > Math.abs(x2 - x1);

    // For steep lines, swap x and y
    if (steep) {
      [x1, y1] = [y1, x1];
      [x2, y2] = [y2, x2];
    }

    // Ensure left-to-right drawing
    if (x1 > x2) {
      [x1, x2] = [x2, x1];
      [y1, y2] = [y2, y1];
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const gradient = dx === 0 ? 1 : dy / dx;

    let minX = Math.min(x1, x2);
    let minY = Math.min(y1, y2);
    let maxX = Math.max(x1, x2);
    let maxY = Math.max(y1, y2);

    // Expand by 1 pixel for anti-aliased edges
    minX = Math.floor(minX) - 1;
    minY = Math.floor(minY) - 1;
    maxX = Math.ceil(maxX) + 1;
    maxY = Math.ceil(maxY) + 1;

    // Transform bounds if camera is provided
    if (camera) {
      const screenMin = camera.worldToScreen(minX, minY);
      const screenMax = camera.worldToScreen(maxX, maxY);
      minX = Math.min(screenMin.x, screenMax.x);
      minY = Math.min(screenMin.y, screenMax.y);
      maxX = Math.max(screenMin.x, screenMax.x);
      maxY = Math.max(screenMin.y, screenMax.y);
    }

    const data = canvas.data;
    const width = canvas.width;
    const height = canvas.height;

    let pixelsDrawn = 0;

    // First endpoint with anti-aliasing
    let xEnd = Math.round(x1);
    let yEnd = y1 + gradient * (xEnd - x1);
    let xGap = 1 - (x1 + 0.5 - Math.floor(x1 + 0.5));

    let xPx1 = xEnd;
    let yPx1 = Math.floor(yEnd);

    if (steep) {
      this._setPixelAACamera(canvas, yPx1, xPx1, r, g, b, a * (1 - (yEnd - yPx1)) * xGap, camera);
      this._setPixelAACamera(canvas, yPx1 + 1, xPx1, r, g, b, a * (yEnd - yPx1) * xGap, camera);
    } else {
      this._setPixelAACamera(canvas, xPx1, yPx1, r, g, b, a * (1 - (yEnd - yPx1)) * xGap, camera);
      this._setPixelAACamera(canvas, xPx1, yPx1 + 1, r, g, b, a * (yEnd - yPx1) * xGap, camera);
    }
    pixelsDrawn += 2;

    let interY = yEnd + gradient;

    // Second endpoint with anti-aliasing
    xEnd = Math.round(x2);
    yEnd = y2 + gradient * (xEnd - x2);
    xGap = x2 + 0.5 - Math.floor(x2 + 0.5);

    let xPx2 = xEnd;
    let yPx2 = Math.floor(yEnd);

    if (steep) {
      this._setPixelAACamera(canvas, yPx2, xPx2, r, g, b, a * (1 - (yEnd - yPx2)) * xGap, camera);
      this._setPixelAACamera(canvas, yPx2 + 1, xPx2, r, g, b, a * (yEnd - yPx2) * xGap, camera);
    } else {
      this._setPixelAACamera(canvas, xPx2, yPx2, r, g, b, a * (1 - (yEnd - yPx2)) * xGap, camera);
      this._setPixelAACamera(canvas, xPx2, yPx2 + 1, r, g, b, a * (yEnd - yPx2) * xGap, camera);
    }
    pixelsDrawn += 2;

    // draw between endpoints
    if (steep) {
      for (let x = xPx1 + 1; x < xPx2; x++) {
        const iPart = Math.floor(interY);
        const fPart = interY - iPart;

        this._setPixelAACamera(canvas, iPart, x, r, g, b, a * (1 - fPart), camera);
        this._setPixelAACamera(canvas, iPart + 1, x, r, g, b, a * fPart, camera);

        interY += gradient;
        pixelsDrawn += 2;
      }
    } else {
      for (let x = xPx1 + 1; x < xPx2; x++) {
        const iPart = Math.floor(interY);
        const fPart = interY - iPart;

        this._setPixelAACamera(canvas, x, iPart, r, g, b, a * (1 - fPart), camera);
        this._setPixelAACamera(canvas, x, iPart + 1, r, g, b, a * fPart, camera);

        interY += gradient;
        pixelsDrawn += 2;
      }
    }

    // Safe region update
    const clampedRegion = DrawingUtils.clampRegion(canvas, minX, minY, maxX - minX + 1, maxY - minY + 1);

    if (clampedRegion.isValid) {
      const regionData = DrawingUtils.extractRegionSafe(
        data, width, clampedRegion.x, clampedRegion.y,
        clampedRegion.width, clampedRegion.height
      );

      if (regionData.length > 0) {
        DrawingUtils.safeBufferUpdate(
          canvas, regionData, clampedRegion.x, clampedRegion.y,
          clampedRegion.width, clampedRegion.height
        );
        canvas.needsUpload = true;
      }
    }

    const elapsed = performance.now() - startTime;
    return { pixels: pixelsDrawn, time: elapsed };
  }



  static _setPixelAACamera(canvas, x, y, r, g, b, a, camera = undefined) {
    let drawX = x, drawY = y;

    if (camera) {
      const screenPos = camera.worldToScreen(x, y);
      drawX = Math.floor(screenPos.x);
      drawY = Math.floor(screenPos.y);

      if (DrawingUtils.shouldClipPoint(camera, drawX, drawY)) {
        return;
      }
    }

    this._setPixelAA(canvas, drawX, drawY, r, g, b, a);
  }

  static _setPixelAA(canvas, x, y, r, g, b, a) {
    x = Math.floor(x);
    y = Math.floor(y);

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

    const idx = (y * canvas.width + x) * 4;
    const data = canvas.data;

    const alpha = Math.max(0, Math.min(1, a / 255));
    const invAlpha = 1 - alpha;

    data[idx + 0] = Math.floor(r * alpha + data[idx + 0] * invAlpha);
    data[idx + 1] = Math.floor(g * alpha + data[idx + 1] * invAlpha);
    data[idx + 2] = Math.floor(b * alpha + data[idx + 2] * invAlpha);
    data[idx + 3] = 255;
  }


  /**
   * Set pixel with alpha blending
   * This is CRITICAL - without proper blending, AA looks terrible
   */
  static _setPixelAA(canvas, x, y, r, g, b, a) {
    x = Math.floor(x);
    y = Math.floor(y);

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

    const idx = (y * canvas.width + x) * 4;
    const data = canvas.data;

    // alpha blending formula: dst = src*alpha + dst*(1-alpha)
    const alpha = Math.max(0, Math.min(1, a / 255));
    const invAlpha = 1 - alpha;

    data[idx + 0] = Math.floor(r * alpha + data[idx + 0] * invAlpha);
    data[idx + 1] = Math.floor(g * alpha + data[idx + 1] * invAlpha);
    data[idx + 2] = Math.floor(b * alpha + data[idx + 2] * invAlpha);
    // keep existing alpha (or set to 255 for opaque canvas)
    data[idx + 3] = 255;
  }
  /**
   * Anti-aliased circle using analytical coverage
   * For each pixel on the circle's edge, calculate exact coverage
   * @param {PixelBuffer} canvas
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @param {number} a
   * @returns
   */
  static drawCircleAA(canvas, cx, cy, radius, r, g, b, a = 255, camera = undefined) {
    const startTime = performance.now();

    // Early camera clipping
    if (camera) {
      const screenCenter = camera.worldToScreen(cx, cy);
      const screenRadius = radius;

      if (DrawingUtils.shouldClipRegion(camera,
        screenCenter.x - screenRadius, screenCenter.y - screenRadius,
        screenRadius * 2, screenRadius * 2)) {
        return { pixels: 0, time: 0 };
      }
    }

    const x = Math.floor(cx);
    const y = Math.floor(cy);
    const rad = radius;
    if (rad <= 0) return { pixels: 0, time: 0 };

    const inner2 = (rad - 0.5) * (rad - 0.5);
    const outer2 = (rad + 0.5) * (rad + 0.5);

    let minX = x - Math.ceil(rad) - 1;
    let minY = y - Math.ceil(rad) - 1;
    let maxX = x + Math.ceil(rad) + 1;
    let maxY = y + Math.ceil(rad) + 1;

    // Transform bounds if camera is provided
    if (camera) {
      const screenMin = camera.worldToScreen(minX, minY);
      const screenMax = camera.worldToScreen(maxX, maxY);
      minX = Math.min(screenMin.x, screenMax.x);
      minY = Math.min(screenMin.y, screenMax.y);
      maxX = Math.max(screenMin.x, screenMax.x);
      maxY = Math.max(screenMin.y, screenMax.y);
    }

    // Clamp to canvas bounds
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(canvas.width - 1, maxX);
    maxY = Math.min(canvas.height - 1, maxY);

    let pixelsDrawn = 0;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        // Convert to world coordinates for distance calculation
        let worldX = px, worldY = py;
        if (camera) {
          const worldPos = camera.screenToWorld(px, py);
          worldX = worldPos.x;
          worldY = worldPos.y;
        }

        const dx = worldX - cx;
        const dy = worldY - cy;
        const dist2 = dx * dx + dy * dy;

        if (dist2 < inner2 || dist2 > outer2) {
          continue;
        }

        const dist = Math.sqrt(dist2);
        const delta = Math.abs(dist - rad);
        const coverage = 1.0 - delta / 0.5;

        this._setPixelAACamera(canvas, px, py, r, g, b, a * coverage, camera);
        pixelsDrawn++;
      }
    }

    // Safe region update
    const clampedRegion = DrawingUtils.clampRegion(canvas, minX, minY, maxX - minX + 1, maxY - minY + 1);

    if (clampedRegion.isValid) {
      const regionData = DrawingUtils.extractRegionSafe(
        canvas.data, canvas.width, clampedRegion.x, clampedRegion.y,
        clampedRegion.width, clampedRegion.height
      );

      if (regionData.length > 0) {
        DrawingUtils.safeBufferUpdate(
          canvas, regionData, clampedRegion.x, clampedRegion.y,
          clampedRegion.width, clampedRegion.height
        );
        canvas.needsUpload = true;
      }
    }

    const elapsed = performance.now() - startTime;
    return { pixels: pixelsDrawn, time: elapsed, radius: rad };
  }


  /**
   *      * Anti-aliased filled circle
   * Uses distance field for smooth edges
   * @param {PixelBuffer} canvas
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @param {number} a
   * @returns
   */
  static fillCircleAA(canvas, cx, cy, radius, r, g, b, a = 255, camera = undefined) {
    const startTime = performance.now();

    const x = Math.floor(cx);
    const y = Math.floor(cy);
    const rad = radius;

    if (rad <= 0) return { pixels: 0, time: 0 };

    let minX = x - Math.ceil(rad) - 1;
    let minY = y - Math.ceil(rad) - 1;
    let maxX = x + Math.ceil(rad) + 1;
    let maxY = y + Math.ceil(rad) + 1;

    // Transform bounds if camera is provided
    if (camera) {
      const screenMin = camera.worldToScreen(minX, minY);
      const screenMax = camera.worldToScreen(maxX, maxY);
      minX = Math.min(screenMin.x, screenMax.x);
      minY = Math.min(screenMin.y, screenMax.y);
      maxX = Math.max(screenMin.x, screenMax.x);
      maxY = Math.max(screenMin.y, screenMax.y);
    }

    // Clamp to canvas bounds
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(canvas.width - 1, maxX);
    maxY = Math.min(canvas.height - 1, maxY);

    const data = canvas.data;
    const width = canvas.width;
    let pixelsDrawn = 0;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        // Convert to world coordinates for distance calculation
        let worldX = px, worldY = py;
        if (camera) {
          const worldPos = camera.screenToWorld(px, py);
          worldX = worldPos.x;
          worldY = worldPos.y;

          // Check if this screen pixel should be clipped
          if (DrawingUtils.shouldClipPoint(camera, px, py)) {
            continue;
          }
        }

        const dx = worldX - cx;
        const dy = worldY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let coverage;
        if (dist <= rad - 0.5) {
          coverage = 1.0;
        } else if (dist >= rad + 0.5) {
          continue;
        } else {
          coverage = rad + 0.5 - dist;
        }

        const idx = (py * width + px) * 4;
        const alpha = (a / 255) * coverage;
        const invAlpha = 1 - alpha;

        data[idx + 0] = Math.floor(r * alpha + data[idx + 0] * invAlpha);
        data[idx + 1] = Math.floor(g * alpha + data[idx + 1] * invAlpha);
        data[idx + 2] = Math.floor(b * alpha + data[idx + 2] * invAlpha);
        data[idx + 3] = 255;

        pixelsDrawn++;
      }
    }

    // Safe region update
    const clampedRegion = DrawingUtils.clampRegion(canvas, minX, minY, maxX - minX + 1, maxY - minY + 1);

    if (clampedRegion.isValid) {
      const regionData = DrawingUtils.extractRegionSafe(
        data, width, clampedRegion.x, clampedRegion.y,
        clampedRegion.width, clampedRegion.height
      );

      if (regionData.length > 0) {
        DrawingUtils.safeBufferUpdate(
          canvas, regionData, clampedRegion.x, clampedRegion.y,
          clampedRegion.width, clampedRegion.height
        );
        canvas.needsUpload = true;
      }
    }

    const elapsed = performance.now() - startTime;
    return { pixels: pixelsDrawn, time: elapsed };
  }


  static _extractRegion(data, bufferWidth, x, y, width, height) {
    const region = new Uint8Array(width * height * 4);

    for (let row = 0; row < height; row++) {
      const srcOffset = ((y + row) * bufferWidth + x) * 4;
      const dstOffset = row * width * 4;
      const rowBytes = width * 4;

      region.set(data.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
    }

    return region;
  }
}
