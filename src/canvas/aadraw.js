import { PixelBuffer } from "./pixel_buffer.js";
// TODO: add cam
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
  static drawLineAA(canvas, x1, y1, x2, y2, r, g, b, a = 255) {
    // const startTime = performance.now(); TODO: make a optional scoped profiler

    // edge cases
    if (x1 === x2 && y1 === y2) {
      AADrawer._setPixelAA(canvas, x1, y1, r, g, b, a);
      // return { pixels: 1, time: performance.now() - startTime };
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
    minX = Math.max(0, Math.floor(minX) - 1);
    minY = Math.max(0, Math.floor(minY) - 1);
    maxX = Math.min(canvas.width - 1, Math.ceil(maxX) + 1);
    maxY = Math.min(canvas.height - 1, Math.ceil(maxY) + 1);

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
      AADrawer._setPixelAA(
        canvas,
        yPx1,
        xPx1,
        r,
        g,
        b,
        a * (1 - (yEnd - yPx1)) * xGap,
      );
      AADrawer._setPixelAA(
        canvas,
        yPx1 + 1,
        xPx1,
        r,
        g,
        b,
        a * (yEnd - yPx1) * xGap,
      );
    } else {
      AADrawer._setPixelAA(
        canvas,
        xPx1,
        yPx1,
        r,
        g,
        b,
        a * (1 - (yEnd - yPx1)) * xGap,
      );
      AADrawer._setPixelAA(
        canvas,
        xPx1,
        yPx1 + 1,
        r,
        g,
        b,
        a * (yEnd - yPx1) * xGap,
      );
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
      AADrawer._setPixelAA(
        canvas,
        yPx2,
        xPx2,
        r,
        g,
        b,
        a * (1 - (yEnd - yPx2)) * xGap,
      );
      AADrawer._setPixelAA(
        canvas,
        yPx2 + 1,
        xPx2,
        r,
        g,
        b,
        a * (yEnd - yPx2) * xGap,
      );
    } else {
      AADrawer._setPixelAA(
        canvas,
        xPx2,
        yPx2,
        r,
        g,
        b,
        a * (1 - (yEnd - yPx2)) * xGap,
      );
      AADrawer._setPixelAA(
        canvas,
        xPx2,
        yPx2 + 1,
        r,
        g,
        b,
        a * (yEnd - yPx2) * xGap,
      );
    }
    pixelsDrawn += 2;

    // draw between endpoints
    if (steep) {
      for (let x = xPx1 + 1; x < xPx2; x++) {
        const iPart = Math.floor(interY);
        const fPart = interY - iPart;

        AADrawer._setPixelAA(canvas, iPart, x, r, g, b, a * (1 - fPart));
        AADrawer._setPixelAA(canvas, iPart + 1, x, r, g, b, a * fPart);

        interY += gradient;
        pixelsDrawn += 2;
      }
    } else {
      for (let x = xPx1 + 1; x < xPx2; x++) {
        const iPart = Math.floor(interY);
        const fPart = interY - iPart;

        AADrawer._setPixelAA(canvas, x, iPart, r, g, b, a * (1 - fPart));
        AADrawer._setPixelAA(canvas, x, iPart + 1, r, g, b, a * fPart);

        interY += gradient;
        pixelsDrawn += 2;
      }
    }

    // extract and update region
    const regionWidth = maxX - minX + 1;
    const regionHeight = maxY - minY + 1;
    const regionData = AADrawer._extractRegion(
      data,
      width,
      minX,
      minY,
      regionWidth,
      regionHeight,
    );

    canvas.renderer.updateBufferData(
      // dirty region tracking in c++
      canvas.bufferId,
      regionData,
      minX,
      minY,
      regionWidth,
      regionHeight,
    );

    canvas.needsUpload = true;

    // const elapsed = performance.now() - startTime;
    // return { pixels: pixelsDrawn, time: elapsed };
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
  static drawCircleAA(canvas, cx, cy, radius, r, g, b, a = 255) {
    // const startTime = performance.now();

    const x = Math.floor(cx);
    const y = Math.floor(cy);
    const rad = radius;
    if (rad <= 0) return;

    const inner2 = (rad - 0.5) * (rad - 0.5);
    const outer2 = (rad + 0.5) * (rad + 0.5);

    const minX = Math.max(0, x - Math.ceil(rad) - 1);
    const minY = Math.max(0, y - Math.ceil(rad) - 1);
    const maxX = Math.min(canvas.width - 1, x + Math.ceil(rad) + 1);
    const maxY = Math.min(canvas.height - 1, y + Math.ceil(rad) + 1);

    let pixelsDrawn = 0;

    for (let py = minY; py <= maxY; py++) {
      const dy = py - cy;
      for (let px = minX; px <= maxX; px++) {
        const dx = px - cx;
        const dist2 = dx * dx + dy * dy;

        if (dist2 < inner2 || dist2 > outer2) {
          // outside the 1px-wide annulus: either well inside or well outside
          continue;
        }

        // inside the annulus — compute exact dist once
        const dist = Math.sqrt(dist2);
        const delta = Math.abs(dist - rad); // 0..0.5
        const coverage = 1.0 - delta / 0.5;

        AADrawer._setPixelAA(canvas, px, py, r, g, b, a * coverage);
        pixelsDrawn++;
      }
    }

    const regionWidth = maxX - minX + 1;
    const regionHeight = maxY - minY + 1;
    const regionData = AADrawer._extractRegion(
      canvas.data,
      canvas.width,
      minX,
      minY,
      regionWidth,
      regionHeight,
    );

    canvas.renderer.updateBufferData(
      canvas.bufferId,
      regionData,
      minX,
      minY,
      regionWidth,
      regionHeight,
    );

    canvas.needsUpload = true;

    // const elapsed = performance.now() - startTime;
    // return { pixels: pixelsDrawn, time: elapsed, radius: rad };
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
  static fillCircleAA(canvas, cx, cy, radius, r, g, b, a = 255) {
    // const startTime = performance.now();

    const x = Math.floor(cx);
    const y = Math.floor(cy);
    const rad = radius;

    if (rad <= 0) return { pixels: 0, time: 0 };

    const minX = Math.max(0, x - Math.ceil(rad) - 1);
    const minY = Math.max(0, y - Math.ceil(rad) - 1);
    const maxX = Math.min(canvas.width - 1, x + Math.ceil(rad) + 1);
    const maxY = Math.min(canvas.height - 1, y + Math.ceil(rad) + 1);

    const data = canvas.data;
    const width = canvas.width;
    let pixelsDrawn = 0;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let coverage;
        if (dist <= rad - 0.5) {
          coverage = 1.0;
        } else if (dist >= rad + 0.5) {
          continue; // Skip fully outside pixels
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

    const regionWidth = maxX - minX + 1;
    const regionHeight = maxY - minY + 1;
    const regionData = AADrawer._extractRegion(
      data,
      width,
      minX,
      minY,
      regionWidth,
      regionHeight,
    );

    canvas.renderer.updateBufferData(
      canvas.bufferId,
      regionData,
      minX,
      minY,
      regionWidth,
      regionHeight,
    );

    canvas.needsUpload = true;

    // const elapsed = performance.now() - startTime;
    // return { pixels: pixelsDrawn, time: elapsed };
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
