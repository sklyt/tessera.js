import { PixelBuffer } from "./pixel_buffer.js";
import { shouldDrawPixel } from "./utils.js";
import { Camera } from "../camera/index.js"
// TODO: add region tracker for all primitives
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
   * @param {Camera}
   * @returns
   */
  static drawLineAA(canvas, x1, y1, x2, y2, r, g, b, a = 255, camera = undefined) {
    // const startTime = performance.now(); TODO: make a optional scoped profiler
    // Track actual drawn region
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let pixelsDrawn = 0;
    const data = canvas.data;
    const width = canvas.width;
    const height = canvas.height;
    // edge cases
    if (x1 === x2 && y1 === y2) {
      if (AADrawer._setPixelAA(canvas, x1, y1, r, g, b, a, camera)) {
        const px = Math.floor(x1);
        const py = Math.floor(y1);
        pixelsDrawn = 1;
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    } else {
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
      // First endpoint with anti-aliasing
      let xEnd = Math.round(x1);
      let yEnd = y1 + gradient * (xEnd - x1);
      let xGap = 1 - (x1 + 0.5 - Math.floor(x1 + 0.5));
      let xPx1 = xEnd;
      let yPx1 = Math.floor(yEnd);
      let drew = false;
      if (steep) {
        drew = AADrawer._setPixelAA(
          canvas,
          yPx1,
          xPx1,
          r,
          g,
          b,
          a * (1 - (yEnd - yPx1)) * xGap,
          camera,
        );
        if (drew) {
          pixelsDrawn++;
          minX = Math.min(minX, yPx1);
          minY = Math.min(minY, xPx1);
          maxX = Math.max(maxX, yPx1);
          maxY = Math.max(maxY, xPx1);
        }
        drew = AADrawer._setPixelAA(
          canvas,
          yPx1 + 1,
          xPx1,
          r,
          g,
          b,
          a * (yEnd - yPx1) * xGap,
          camera,
        );
        if (drew) {
          pixelsDrawn++;
          minX = Math.min(minX, yPx1 + 1);
          minY = Math.min(minY, xPx1);
          maxX = Math.max(maxX, yPx1 + 1);
          maxY = Math.max(maxY, xPx1);
        }
      } else {
        drew = AADrawer._setPixelAA(
          canvas,
          xPx1,
          yPx1,
          r,
          g,
          b,
          a * (1 - (yEnd - yPx1)) * xGap,
          camera,
        );
        if (drew) {
          pixelsDrawn++;
          minX = Math.min(minX, xPx1);
          minY = Math.min(minY, yPx1);
          maxX = Math.max(maxX, xPx1);
          maxY = Math.max(maxY, yPx1);
        }
        drew = AADrawer._setPixelAA(
          canvas,
          xPx1,
          yPx1 + 1,
          r,
          g,
          b,
          a * (yEnd - yPx1) * xGap,
          camera,
        );
        if (drew) {
          pixelsDrawn++;
          minX = Math.min(minX, xPx1);
          minY = Math.min(minY, yPx1 + 1);
          maxX = Math.max(maxX, xPx1);
          maxY = Math.max(maxY, yPx1 + 1);
        }
      }
      let interY = yEnd + gradient;
      // Second endpoint with anti-aliasing
      xEnd = Math.round(x2);
      yEnd = y2 + gradient * (xEnd - x2);
      xGap = x2 + 0.5 - Math.floor(x2 + 0.5);
      let xPx2 = xEnd;
      let yPx2 = Math.floor(yEnd);
      if (steep) {
        drew = AADrawer._setPixelAA(
          canvas,
          yPx2,
          xPx2,
          r,
          g,
          b,
          a * (1 - (yEnd - yPx2)) * xGap,
          camera,
        );
        if (drew) {
          pixelsDrawn++;
          minX = Math.min(minX, yPx2);
          minY = Math.min(minY, xPx2);
          maxX = Math.max(maxX, yPx2);
          maxY = Math.max(maxY, xPx2);
        }
        drew = AADrawer._setPixelAA(
          canvas,
          yPx2 + 1,
          xPx2,
          r,
          g,
          b,
          a * (yEnd - yPx2) * xGap,
          camera,
        );
        if (drew) {
          pixelsDrawn++;
          minX = Math.min(minX, yPx2 + 1);
          minY = Math.min(minY, xPx2);
          maxX = Math.max(maxX, yPx2 + 1);
          maxY = Math.max(maxY, xPx2);
        }
      } else {
        drew = AADrawer._setPixelAA(
          canvas,
          xPx2,
          yPx2,
          r,
          g,
          b,
          a * (1 - (yEnd - yPx2)) * xGap,
          camera,
        );
        if (drew) {
          pixelsDrawn++;
          minX = Math.min(minX, xPx2);
          minY = Math.min(minY, yPx2);
          maxX = Math.max(maxX, xPx2);
          maxY = Math.max(maxY, yPx2);
        }
        drew = AADrawer._setPixelAA(
          canvas,
          xPx2,
          yPx2 + 1,
          r,
          g,
          b,
          a * (yEnd - yPx2) * xGap,
          camera,
        );
        if (drew) {
          pixelsDrawn++;
          minX = Math.min(minX, xPx2);
          minY = Math.min(minY, yPx2 + 1);
          maxX = Math.max(maxX, xPx2);
          maxY = Math.max(maxY, yPx2 + 1);
        }
      }
      // draw between endpoints
      if (steep) {
        for (let x = xPx1 + 1; x < xPx2; x++) {
          const iPart = Math.floor(interY);
          const fPart = interY - iPart;
          drew = AADrawer._setPixelAA(canvas, iPart, x, r, g, b, a * (1 - fPart), camera);
          if (drew) {
            pixelsDrawn++;
            minX = Math.min(minX, iPart);
            minY = Math.min(minY, x);
            maxX = Math.max(maxX, iPart);
            maxY = Math.max(maxY, x);
          }
          drew = AADrawer._setPixelAA(canvas, iPart + 1, x, r, g, b, a * fPart, camera);
          if (drew) {
            pixelsDrawn++;
            minX = Math.min(minX, iPart + 1);
            minY = Math.min(minY, x);
            maxX = Math.max(maxX, iPart + 1);
            maxY = Math.max(maxY, x);
          }
          interY += gradient;
        }
      } else {
        for (let x = xPx1 + 1; x < xPx2; x++) {
          const iPart = Math.floor(interY);
          const fPart = interY - iPart;
          drew = AADrawer._setPixelAA(canvas, x, iPart, r, g, b, a * (1 - fPart), camera);
          if (drew) {
            pixelsDrawn++;
            minX = Math.min(minX, x);
            minY = Math.min(minY, iPart);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, iPart);
          }
          drew = AADrawer._setPixelAA(canvas, x, iPart + 1, r, g, b, a * fPart, camera);
          if (drew) {
            pixelsDrawn++;
            minX = Math.min(minX, x);
            minY = Math.min(minY, iPart + 1);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, iPart + 1);
          }
          interY += gradient;
        }
      }
    }
    if (pixelsDrawn === 0) {
      // return { pixels: 0, time: performance.now() - startTime };
      return;
    }
    // extract and update region
    // const regionWidth = maxX - minX + 1;
    // const regionHeight = maxY - minY + 1;
    // const regionData = AADrawer._extractRegion(
    //   data,
    //   width,
    //   minX,
    //   minY,
    //   regionWidth,
    //   regionHeight,
    // );
    // canvas.renderer.updateBufferData(
    //   // dirty region tracking in c++
    //   canvas.bufferId,
    //   regionData,
    //   minX,
    //   minY,
    //   regionWidth,
    //   regionHeight,
    // );
    canvas.needsUpload = true;
    // const elapsed = performance.now() - startTime;
    // return { pixels: pixelsDrawn, time: elapsed };
  }
  /**
   * Set pixel with alpha blending
   * This is CRITICAL - without proper blending, AA looks terrible
   */
  static _setPixelAA(canvas, x, y, r, g, b, a, camera) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!shouldDrawPixel(x, y, canvas, camera)) return false;
    const alpha = Math.max(0, Math.min(1, a / 255));
    if (alpha <= 0) return false;
    const idx = (y * canvas.width + x) * 4;
    const data = canvas.data;
    // alpha blending formula: dst = src*alpha + dst*(1-alpha)
    const invAlpha = 1 - alpha;
    data[idx + 0] = Math.floor(r * alpha + data[idx + 0] * invAlpha);
    data[idx + 1] = Math.floor(g * alpha + data[idx + 1] * invAlpha);
    data[idx + 2] = Math.floor(b * alpha + data[idx + 2] * invAlpha);
    // keep existing alpha (or set to 255 for opaque canvas)
    data[idx + 3] = 255;
    return true;
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
   * @param {Camera}
   * @returns
   */
  static drawCircleAA(canvas, cx, cy, radius, r, g, b, a = 255, camera = undefined) {
    // const startTime = performance.now();
    const x = Math.floor(cx);
    const y = Math.floor(cy);
    const rad = radius;
    if (rad <= 0) return;
    const inner2 = (rad - 0.5) * (rad - 0.5);
    const outer2 = (rad + 0.5) * (rad + 0.5);
    const minXLoop = Math.max(0, x - Math.ceil(rad) - 1);
    const minYLoop = Math.max(0, y - Math.ceil(rad) - 1);
    const maxXLoop = Math.min(canvas.width - 1, x + Math.ceil(rad) + 1);
    const maxYLoop = Math.min(canvas.height - 1, y + Math.ceil(rad) + 1);
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let pixelsDrawn = 0;
    for (let py = minYLoop; py <= maxYLoop; py++) {
      const dy = py - cy;
      for (let px = minXLoop; px <= maxXLoop; px++) {
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
        if (AADrawer._setPixelAA(canvas, px, py, r, g, b, a * coverage, camera)) {
          pixelsDrawn++;
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        }
      }
    }
    if (pixelsDrawn === 0) {
      // return { pixels: 0, time: performance.now() - startTime, radius: rad };
      return;
    }
    // const regionWidth = maxX - minX + 1;
    // const regionHeight = maxY - minY + 1;
    // const regionData = AADrawer._extractRegion(
    //   canvas.data,
    //   canvas.width,
    //   minX,
    //   minY,
    //   regionWidth,
    //   regionHeight,
    // );
    // canvas.renderer.updateBufferData(
    //   canvas.bufferId,
    //   regionData,
    //   minX,
    //   minY,
    //   regionWidth,
    //   regionHeight,
    // );
    canvas.needsUpload = true;
    // const elapsed = performance.now() - startTime;
    // return { pixels: pixelsDrawn, time: elapsed, radius: rad };
  }
  /**
   * * Anti-aliased filled circle
   * Uses distance field for smooth edges
   * @param {PixelBuffer} canvas
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @param {number} a
   * @param {Camera}
   * @returns
   */
  static fillCircleAA(canvas, cx, cy, radius, r, g, b, a = 255, camera = undefined) {
    // const startTime = performance.now();
    const x = Math.floor(cx);
    const y = Math.floor(cy);
    const rad = radius;
    if (rad <= 0) return { pixels: 0, time: 0 };
    const minXLoop = Math.max(0, x - Math.ceil(rad) - 1);
    const minYLoop = Math.max(0, y - Math.ceil(rad) - 1);
    const maxXLoop = Math.min(canvas.width - 1, x + Math.ceil(rad) + 1);
    const maxYLoop = Math.min(canvas.height - 1, y + Math.ceil(rad) + 1);
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let pixelsDrawn = 0;
    for (let py = minYLoop; py <= maxYLoop; py++) {
      for (let px = minXLoop; px <= maxXLoop; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > rad + 0.5) continue;
        const coverage = (dist <= rad - 0.5) ? 1.0 : (rad + 0.5 - dist);
        if (AADrawer._setPixelAA(canvas, px, py, r, g, b, a * coverage, camera)) {
          pixelsDrawn++;
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        }
      }
    }
    if (pixelsDrawn === 0) {
      // return { pixels: 0, time: performance.now() - startTime };
      return;
    }
    // const regionWidth = maxX - minX + 1;
    // const regionHeight = maxY - minY + 1;
    // const regionData = AADrawer._extractRegion(
    //   canvas.data,
    //   canvas.width,
    //   minX,
    //   minY,
    //   regionWidth,
    //   regionHeight,
    // );
    // canvas.renderer.updateBufferData(
    //   canvas.bufferId,
    //   regionData,
    //   minX,
    //   minY,
    //   regionWidth,
    //   regionHeight,
    // );
    canvas.needsUpload = true;
    // const elapsed = performance.now() - startTime;
    // return { pixels: pixelsDrawn, time: elapsed };
  }
  // static _extractRegion(data, bufferWidth, x, y, width, height) {
  //   const region = new Uint8Array(width * height * 4);
  //   for (let row = 0; row < height; row++) {
  //     const srcOffset = ((y + row) * bufferWidth + x) * 4;
  //     const dstOffset = row * width * 4;
  //     const rowBytes = width * 4;
  //     region.set(data.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
  //   }
  //   return region;
  // }
}