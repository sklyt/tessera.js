



export class InputMap {
    /**
     * 
     * @param {*} input - renderer.input 
     */
    constructor(input) {
        this.input = input;
        this.actions = new Map();
        this.mouseActions = new Map();
        this.callbackIds = [];
    }


    /**
     * 
     * @param {string} actionName 
     * @param {Array<string>} keys 
     */
    mapAction(actionName, keys) {
        if (typeof keys === 'string') {
            keys = [keys];
        }
        this.actions.set(actionName, keys);
    }

    /**
     * 
     * @param {string} actionName 
     * @param {Array<string>} keys 
     */
    MapMouseAction(actionName, keys) {
        if (typeof keys === 'string') {
            keys = [keys];
        }
        this.mouseActions.set(actionName, keys)
    }

    /**
     * 
     * @param {string} actionName 
     * @returns {bool}
     */
    isMouseActionActive(actionName) {
        const keys = this.mouseActions.get(actionName);
        if (!keys) return false;

        // console.log("checking mouse: ", keys)

        return keys.some(key => this.input.isMouseButtonDown(key));
    }
    /**
 * 
 * @param {string} actionName 
 * @returns {bool}
 */
    isMousePressed(actionName) {
        const keys = this.mouseActions.get(actionName);
        if (!keys) return false;

        // console.log("checking mouse: ", keys)

        return keys.some(key => this.input.isMouseButtonPressed(key));
    }

    /**
 * 
 * @param {string} actionName 
 * @returns {bool}
 */
    IsMouseActionReleased(actionName) {
        const keys = this.mouseActions.get(actionName);
        if (!keys) return false;

        // console.log("checking mouse: ", keys)

        return keys.some(key => this.input.isMouseButtonReleased(key));
    }

    /**
     * @returns {{x: number, y: number}}
     */
    get mousePosition() {
        return this.input.getMousePosition();
    }


    /**
    * @returns {{x: number, y: number}}
    */
    get mouseDelta() {
        return this.input.getMouseDelta();
    }

    /**
    * @returns {number}
    */
    get mouseWheelDelta() {
        return this.input.getMouseWheelDelta();
    }

    /**
     * 
     * @param {string} actionName - isKeyDown 
     * @returns 
     */
    isActionActive(actionName) {
        const keys = this.actions.get(actionName);
        if (!keys) return false;

        return keys.some(key => this.input.isKeyDown(key));
    }


    /**
     * 
     * @param {string} actionName - isKeyPressed
     * @returns 
     */
    wasActionTriggered(actionName) {
        const keys = this.actions.get(actionName);
        if (!keys) return false;

        return keys.some(key => this.input.isKeyPressed(key));
    }

    /**
     * 
     * @param {string} actionName - isKeyReleased 
     * @returns 
     */
    isActionReleased(actionName) {
        const keys = this.actions.get(actionName);
        if (!keys) return false;

        return keys.some(key => this.input.isKeyReleased(key));
    }


    /**
     * 
     * @param {string} actionName 
     * @param {(actionName: string,event: {type: string, keyCode: number, keyName: string, mouseButton: number,mousePosition: {x: number, y: number}, mouseDelta: {x:number, y: number}, wheelDelta: number, timestamp: number })=> void} callback 
     * @returns 
     */
    onActionDown(actionName, callback) {
        const keys = this.actions.get(actionName);
        if (!keys) {
            console.warn(`Action '${actionName}' not mapped`);
            return;
        }

        keys.forEach(key => {
            const id = this.input.onKeyDown(key, (event) => {
                callback(actionName, event);
            });
            this.callbackIds.push(id);
        });

    }

    /**
     * 
     * @param {string} actionName 
     * @param {(actionName: string,event: {type: string, keyCode: number, keyName: string, mouseButton: number,mousePosition: {x: number, y: number}, mouseDelta: {x:number, y: number}, wheelDelta: number, timestamp: number })=> void} callback 
     * @returns 
     */
    onActionUp(actionName, callback) {
        const keys = this.actions.get(actionName);
        if (!keys) {
            console.warn(`Action '${actionName}' not mapped`);
            return;
        }

        keys.forEach(key => {
            const id = this.input.onKeyUp(key, (event) => {
                callback(actionName, event);
            });
            this.callbackIds.push(id);
        });
    }


    /**
     * 
     * @param {string} actionName 
     * @param {(actionName: string,event: {type: string, keyCode: number, keyName: string, mouseButton: number,mousePosition: {x: number, y: number}, mouseDelta: {x:number, y: number}, wheelDelta: number, timestamp: number })=> void} callback 
     * @returns 
     */
    onMouseDown(actionName, callback) {
        const keys = this.mouseActions.get(actionName);
        if (!keys) {
            console.warn(`Action '${actionName}' not mapped`);
            return;
        }

        keys.forEach(key => {
            const id = this.input.onMouseDown(key, (event) => {
                callback(actionName, event);
            });
            this.callbackIds.push(id);
        });
    }

        /**
     * 
     * @param {string} actionName 
     * @param {(actionName: string,event: {type: string, keyCode: number, keyName: string, mouseButton: number,mousePosition: {x: number, y: number}, mouseDelta: {x:number, y: number}, wheelDelta: number, timestamp: number })=> void} callback 
     * @returns 
     */
    onMouseUp(actionName, callback) {
        const keys = this.mouseActions.get(actionName);
        if (!keys) {
            console.warn(`Action '${actionName}' not mapped`);
            return;
        }

        keys.forEach(key => {
            const id = this.input.onMouseUp(key, (event) => {
                callback(actionName, event);
            });
            this.callbackIds.push(id);
        });
    }

     /**
     * 
     *
     * @param {(event: {type: string, keyCode: number, keyName: string, mouseButton: number,mousePosition: {x: number, y: number}, mouseDelta: {x:number, y: number}, wheelDelta: number, timestamp: number })=> void} callback 
     * @returns 
     */
    onMouseMove(callback) {
 
            const id = this.input.onMouseMove((event) => {
                callback(event);
            });
            this.callbackIds.push(id);
    }

    /**
     * 
     *
     * @param {(event: {type: string, keyCode: number, keyName: string, mouseButton: number,mousePosition: {x: number, y: number}, mouseDelta: {x:number, y: number}, wheelDelta: number, timestamp: number })=> void} callback 
     * @returns 
     */
    onMouseWheel(actionName, callback) {


            const id = this.input.onMouseWheel((event) => {
                callback(event);
            });
            this.callbackIds.push(id);

    }
    cleanup() {
        this.callbackIds.forEach(id => {
            this.input.removeCallback(id);
        });
        this.callbackIds = [];
    }
}

export class InputBuffer {
    constructor(maxSize = 60) { // 1 second at 60 FPS
        this.maxSize = maxSize;
        this.buffer = [];
    }

    recordInput(inputName, timestamp) {
        this.buffer.push({ input: inputName, timestamp });

        if (this.buffer.length > this.maxSize) {
            this.buffer.shift();
        }
    }

    // check for input sequences (useful for combos, cheats, etc.)
    checkSequence(sequence, timeWindow = 1000) { // 1 second window
        if (sequence.length === 0 || this.buffer.length < sequence.length) {
            return false;
        }

        const now = performance.now();
        let sequenceIndex = 0;

        // work backwards through buffer
        for (let i = this.buffer.length - 1; i >= 0 && sequenceIndex < sequence.length; i--) {
            const record = this.buffer[i];

            // check if this record is too old
            if (now - record.timestamp > timeWindow) {
                break;
            }

            // check if this matches the next expected input in sequence
            if (record.input === sequence[sequence.length - 1 - sequenceIndex]) {
                sequenceIndex++;
            }
        }

        return sequenceIndex === sequence.length;
    }
}

