export class Matrix4 {
    constructor() {
        this.elements = new Float32Array(16);
        this.identity();
    }

    identity() {
        this.elements.set([
            1, 0, 0, 0,
            0, 1, 0, 0, 
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
        return this;
    }

   /**
    * 
    * @param {Matrix4} other 
    * @returns 
    */
    multiply(other) {
        const a = this.elements;
        const b = other.elements;
        const result = new Float32Array(16);

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result[i * 4 + j] = 
                    a[i * 4 + 0] * b[0 * 4 + j] +
                    a[i * 4 + 1] * b[1 * 4 + j] + 
                    a[i * 4 + 2] * b[2 * 4 + j] +
                    a[i * 4 + 3] * b[3 * 4 + j];
            }
        }

        this.elements.set(result);
        return this;
    }

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns {Matrix4}
     */
    translate(x, y, z) {
        const translation = new Matrix4();
        translation.elements.set([
            1, 0, 0, x,
            0, 1, 0, y,
            0, 0, 1, z,
            0, 0, 0, 1
        ]);
        return this.multiply(translation);
    }

    /**
     * 
     * @param {number} angle 
     * @returns {Matrix4}
     */
    rotateX(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const rotation = new Matrix4();
        rotation.elements.set([
            1, 0,  0, 0,
            0, c, -s, 0,
            0, s,  c, 0,
            0, 0,  0, 1
        ]);
        return this.multiply(rotation);
    }

    /**
     * 
     * @param {number} angle 
     * @returns {Matrix4}
     */ 
    rotateY(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const rotation = new Matrix4();
        rotation.elements.set([
            c, 0, s, 0,
            0, 1, 0, 0,
           -s, 0, c, 0,
            0, 0, 0, 1
        ]);
        return this.multiply(rotation);
    }

    /**
     * 
     * @param {number} angle 
     * @returns {Matrix4}
     */
    rotateZ(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const rotation = new Matrix4();
        rotation.elements.set([
            c, -s, 0, 0,
            s,  c, 0, 0,
            0,  0, 1, 0,
            0,  0, 0, 1
        ]);
        return this.multiply(rotation);
    }

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns 
     */
    scale(x, y, z) {
        const scale = new Matrix4();
        scale.elements.set([
            x, 0, 0, 0,
            0, y, 0, 0,
            0, 0, z, 0,
            0, 0, 0, 1
        ]);
        return this.multiply(scale);
    }

    /**
     *  Transform a 3D point (returns new array [x, y, z, w])
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns 
     */
    transformPoint(x, y, z) {
        const m = this.elements;
        const w = m[3] * x + m[7] * y + m[11] * z + m[15];
        
        return [
            (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
            (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
            (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
            w
        ];
    }
    /**
     * 
     * @returns {Matrix4}
     */
    clone() {
        const matrix = new Matrix4();
        matrix.elements.set(this.elements);
        return matrix;
    }
}