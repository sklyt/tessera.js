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

    recordInput(inputRecord) {
        this.buffer.unshift(inputRecord); // Add to beginning (most recent first)

        if (this.buffer.length > this.maxSize) {
            this.buffer.pop(); // Remove oldest
        }
    }


    // check for input sequences (useful for combos, cheats, etc.)
    checkSequence(sequence, timeWindow = 1000) {
        if (sequence.length === 0 || this.buffer.length < sequence.length) {
            return false;
        }

        const now = Date.now();
        let sequenceIndex = 0;

        // Work backwards through buffer (most recent to oldest)
        for (let i = 0; i < this.buffer.length && sequenceIndex < sequence.length; i++) {
            const record = this.buffer[i];

            // Check if this record is too old
            if (now - record.timestamp > timeWindow) {
                break;
            }

            // Check if this matches the next expected input in sequence
            // Compare key names (ignore case for letters)
            const recordKey = record.key.toUpperCase();
            const sequenceKey = sequence[sequence.length - 1 - sequenceIndex].toUpperCase();

            if (recordKey === sequenceKey && record.type === 'down') {
                sequenceIndex++;
            }
        }

        return sequenceIndex === sequence.length;
    }

    // Clear the entire buffer
    clear() {
        this.buffer = [];
    }

    // Clear recent N events
    clearRecent(count) {
        this.buffer = this.buffer.slice(count);
    }

    // Get buffer as string (for debugging)
    toString() {
        return this.buffer.map(record =>
            `${record.key}(${record.type})[${record.modifiers?.join(',') || ''}]`
        ).join(' → ');
    }

    // Find patterns in buffer
    findPattern(pattern, timeWindow = 2000) {
        // Pattern is an array of key names or objects with key and optional modifiers
        const matches = [];

        for (let i = 0; i <= this.buffer.length - pattern.length; i++) {
            let match = true;
            const matchedEvents = [];

            for (let j = 0; j < pattern.length; j++) {
                const bufferEvent = this.buffer[i + j];
                const patternStep = pattern[j];

                // Check time window
                if (this.buffer[i].timestamp - bufferEvent.timestamp > timeWindow) {
                    match = false;
                    break;
                }

                // Check key match
                if (typeof patternStep === 'string') {
                    if (bufferEvent.key !== patternStep || bufferEvent.type !== 'down') {
                        match = false;
                        break;
                    }
                } else {
                    // Object pattern
                    if (bufferEvent.key !== patternStep.key ||
                        bufferEvent.type !== (patternStep.type || 'down')) {
                        match = false;
                        break;
                    }

                    // Check modifiers if specified
                    if (patternStep.modifiers) {
                        const hasAllModifiers = patternStep.modifiers.every(mod =>
                            bufferEvent.modifiers?.includes(mod)
                        );
                        if (!hasAllModifiers) {
                            match = false;
                            break;
                        }
                    }
                }

                matchedEvents.push(bufferEvent);
            }

            if (match) {
                matches.push({
                    pattern,
                    events: matchedEvents,
                    startIndex: i,
                    timestamp: matchedEvents[0].timestamp
                });
            }
        }

        return matches;
    }
}



export class Input {
    /**
     * 
     * @param {*} input 
     * @param {number} maxBufferSize - default 120 = 2 seconds at 60 fps 
     */
    constructor(input, maxBufferSize = 120) { // 2 seconds at 60 FPS
        this.input = input;
        this.buffer = new InputBuffer(maxBufferSize);
        this.sequences = new Map(); // Map of sequence names to config
        this.comboSequences = new Map();
        this.globalKeyCallbacks = {
            onKeyDown: new Map(),
            onKeyUp: new Map()
        };
        this.currentModifiers = new Set();
        this.capsLockActive = false;
        this.callbackIds = [];

        this.startRecording();
    }

    static printKeyMappings() {
        const mappings = Input.getAllKeyMappings();

        console.group('Key Mappings:');

        console.group('Letters:');
        mappings.letters.forEach(key => console.log(key));
        console.groupEnd();

        console.group('Numbers:');
        mappings.numbers.forEach(key => console.log(key));
        console.groupEnd();

        console.group('Special Keys:');
        mappings.special.forEach(key => console.log(key));
        console.groupEnd();

        console.group('Function Keys:');
        mappings.function.forEach(key => console.log(key));
        console.groupEnd();

        console.group('Punctuation Keys:');
        mappings.punctuation.forEach(key => console.log(key));
        console.groupEnd();

        console.group('Additional Special Keys:');
        mappings.additionalSpecial.forEach(key => console.log(key));
        console.groupEnd();

        console.group('Right Modifier Keys:');
        mappings.rightModifiers.forEach(key => console.log(key));
        console.groupEnd();

        console.group('Keypad Keys:');
        mappings.keypad.forEach(key => console.log(key));
        console.groupEnd();

        console.group('Menu Keys:');
        mappings.menu.forEach(key => console.log(key));
        console.groupEnd();

        console.groupEnd();

        return mappings;
    }


    static getAllKeyMappings() {
        const mappings = {
            letters: [],
            numbers: [],
            special: [],
            function: [],
            punctuation: [],
            additionalSpecial: [],
            rightModifiers: [],
            keypad: [],
            menu: []
        };

        // Letters
        for (let c = 'A'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
            mappings.letters.push(String.fromCharCode(c));
        }

        // Numbers
        for (let c = '0'.charCodeAt(0); c <= '9'.charCodeAt(0); c++) {
            mappings.numbers.push(String.fromCharCode(c));
        }

        // Special keys
        mappings.special = [
            "Space", "Enter", "Escape", "Backspace", "Tab",
            "Shift", "Control", "Alt",
            "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"
        ];

        // Function keys
        mappings.function = [];
        for (let i = 1; i <= 12; i++) {
            mappings.function.push(`F${i}`);
        }

        // Punctuation keys
        mappings.punctuation = [",", ".", "/", ";", "'", "[", "]", "\\", "-", "=", "`"];

        // Additional special keys
        mappings.additionalSpecial = [
            "Insert", "Delete", "Home", "End", "PageUp", "PageDown",
            "CapsLock", "ScrollLock", "NumLock", "PrintScreen", "Pause"
        ];

        // Right modifier keys
        mappings.rightModifiers = ["RightShift", "RightControl", "RightAlt", "RightSuper"];

        // Keypad keys
        for (let i = 0; i <= 9; i++) {
            mappings.keypad.push(`Keypad${i}`);
        }
        mappings.keypad.push("KeypadDecimal", "KeypadDivide", "KeypadMultiply", "KeypadSubtract", "KeypadAdd", "KeypadEnter", "KeypadEqual");

        // Menu
        mappings.menu = ["Menu"];

        return mappings;
    }


    startRecording() {
        if (this.recording) return;


        const allKeys = this.getAllKeyNames();


        allKeys.forEach(key => {

            const downId = this.input.onKeyDown(key, (event) => {
                this.handleKeyEvent('down', key, event);
            });
            this.callbackIds.push(downId);


            const upId = this.input.onKeyUp(key, (event) => {
                this.handleKeyEvent('up', key, event);
            });
            this.callbackIds.push(upId);
        });

        this.recording = true;
        console.log('InputHelper: Started recording all keyboard events');
    }

    stopRecording() {
        if (!this.recording) return;

        // Remove all callbacks
        this.callbackIds.forEach(id => {
            this.input.removeCallback(id);
        });
        this.callbackIds = [];

        this.recording = false;
    }

    handleKeyEvent(type, key, event) {
        const timestamp = event.timestamp || Date.now();

        const modifierMap = {
            'Shift': 'Shift',
            'RightShift': 'Shift',
            'Control': 'Control',
            'RightControl': 'Control',
            'Alt': 'Alt',
            'RightAlt': 'Alt'
        };

        if (modifierMap[key]) {
            const mod = modifierMap[key];
            if (type === 'down') {
                this.currentModifiers.add(mod);
            } else {
                this.currentModifiers.delete(mod);
            }
        }

        if (key === 'CapsLock' && type === 'down' && !event.repeat) {
            this.capsLockActive = !this.capsLockActive;
        }

        const inputRecord = {
            key,
            type,
            modifiers: Array.from(this.currentModifiers),
            timestamp
        };
        this.buffer.recordInput(inputRecord);

        const callbacks = this.globalKeyCallbacks[`onKey${type === 'down' ? 'Down' : 'Up'}`];
        if (callbacks.has(key)) {
            callbacks.get(key).forEach(callback => callback(event));
        }


        this.checkSequences();


        this.checkCombos();
    }


    onAnyKeyDown(callback) {
        return this.onSpecificKeyDown('*any*', callback);
    }

    onAnyKeyUp(callback) {
        return this.onSpecificKeyUp('*any*', callback);
    }


    onSpecificKeyDown(key, callback) {
        return this.registerGlobalCallback('onKeyDown', key, callback);
    }

    onSpecificKeyUp(key, callback) {
        return this.registerGlobalCallback('onKeyUp', key, callback);
    }

    registerGlobalCallback(type, key, callback) {
        if (!this.globalKeyCallbacks[type].has(key)) {
            this.globalKeyCallbacks[type].set(key, []);
        }

        this.globalKeyCallbacks[type].get(key).push(callback);


        return () => {
            const callbacks = this.globalKeyCallbacks[type].get(key);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index !== -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }


    /**
     * Register a sequence to watch for
     * @param {string} name - Sequence name
     * @param {Array} sequence - Array of key names to match
     * @param {Function} callback - Called when sequence is matched
     * @param {Object} options - Additional options
     */
    registerSequence(name, sequence, callback, options = {}) {
        const config = {
            sequence,
            callback,
            timeWindow: options.timeWindow || 2000, // 2 seconds default
            requireExactModifiers: options.requireExactModifiers || false,
            clearOnMatch: options.clearOnMatch !== false, // Clear buffer on match by default
            description: options.description || ''
        };

        this.sequences.set(name, config);
        console.log(`🎹 InputHelper: Registered sequence "${name}" - ${config.description}`);

        // Return deregister function
        return () => {
            this.sequences.delete(name);
        };
    }

    /**
     * Register a combo sequence (like Shift+6 for ^)
     * @param {string} name - Combo name
     * @param {Array} modifiers - Modifier keys (e.g., ['Shift'])
     * @param {string} key - Main key (e.g., '6')
     * @param {string} output - Output character/action (e.g., '^')
     * @param {Function} callback - Called when combo is matched
     */
    registerCombo(name, modifiers, key, output, callback) {
        const config = {
            modifiers,
            key,
            output,
            callback,
            description: `${modifiers.join('+')}+${key} → ${output}`
        };

        this.comboSequences.set(name, config);
        console.log(`🎹 InputHelper: Registered combo "${name}" - ${config.description}`);

        // Return deregister function
        return () => {
            this.comboSequences.delete(name);
        };
    }

    /**
     * Register common special character combos
     */
    registerCommonCombos() {
        // Shift + Number combos
        const shiftNumberCombos = [
            { num: '1', output: '!' },
            { num: '2', output: '@' },
            { num: '3', output: '#' },
            { num: '4', output: '$' },
            { num: '5', output: '%' },
            { num: '6', output: '^' },
            { num: '7', output: '&' },
            { num: '8', output: '*' },
            { num: '9', output: '(' },
            { num: '0', output: ')' }
        ];

        shiftNumberCombos.forEach(combo => {
            this.registerCombo(
                `Shift+${combo.num}`,
                ['Shift'],
                combo.num,
                combo.output,
                (event) => console.log(`Typed: ${combo.output}`)
            );
        });

        // Other common combos
        const commonCombos = [
            { mods: ['Shift'], key: '`', output: '~', name: 'Tilde' },
            { mods: ['Shift'], key: '-', output: '_', name: 'Underscore' },
            { mods: ['Shift'], key: '=', output: '+', name: 'Plus' },
            { mods: ['Shift'], key: '[', output: '{', name: 'OpenBrace' },
            { mods: ['Shift'], key: ']', output: '}', name: 'CloseBrace' },
            { mods: ['Shift'], key: '\\', output: '|', name: 'Pipe' },
            { mods: ['Shift'], key: ';', output: ':', name: 'Colon' },
            { mods: ['Shift'], key: "'", output: '"', name: 'Quote' },
            { mods: ['Shift'], key: ',', output: '<', name: 'LessThan' },
            { mods: ['Shift'], key: '.', output: '>', name: 'GreaterThan' },
            { mods: ['Shift'], key: '/', output: '?', name: 'Question' }
        ];

        commonCombos.forEach(combo => {
            this.registerCombo(
                combo.name,
                combo.mods,
                combo.key,
                combo.output,
                (event) => console.log(`Typed: ${combo.output}`)
            );
        });
    }

    /**
     * Check registered sequences
     */
    checkSequences() {
        for (const [name, config] of this.sequences) {
            // Extract just the key names for sequence checking
            const keySequence = config.sequence.map(step =>
                typeof step === 'string' ? step : step.key
            );

            if (this.buffer.checkSequence(keySequence, config.timeWindow)) {
                // Get the actual events that matched
                const matchedEvents = this.getLastEvents(keySequence.length);

                // Call the callback
                config.callback({
                    name,
                    sequence: config.sequence,
                    matchedEvents,
                    timestamp: Date.now()
                });

                // Clear buffer if configured
                if (config.clearOnMatch) {
                    this.buffer.clear();
                }

                console.log(`🎹 Sequence matched: "${name}"`);
            }
        }
    }

    /**
     * Check for combo sequences (simultaneous key presses)
     */
    checkCombos() {
        const recentEvents = this.getLastEvents(10); // Check last 10 events

        // Find key down events that happened very close together
        const recentDowns = recentEvents.filter(e =>
            e.type === 'down' &&
            Date.now() - e.timestamp < 100 // Within 100ms
        );

        if (recentDowns.length >= 2) {
            for (const [name, combo] of this.comboSequences) {
                // Check if all required modifiers are pressed
                const hasAllModifiers = combo.modifiers.every(mod =>
                    recentDowns.some(e => e.key === mod) ||
                    this.currentModifiers.has(mod)
                );

                // Check if the main key is pressed
                const hasMainKey = recentDowns.some(e => e.key === combo.key);

                if (hasAllModifiers && hasMainKey) {
                    // Found a combo!
                    combo.callback({
                        name,
                        combo: combo.output,
                        modifiers: combo.modifiers,
                        key: combo.key,
                        timestamp: Date.now()
                    });

                    console.log(`🎹 Combo detected: ${name} (${combo.output})`);

                    // Clear these events from recent history to prevent retrigger
                    this.buffer.clearRecent(3);
                    break;
                }
            }
        }
    }

    /**
     * Get the last N events from buffer
     */
    getLastEvents(count) {
        // Assuming buffer stores events with most recent first
        return this.buffer.buffer.slice(0, count);
    }

    /**
     * Get all key names available in the system
     */
    getAllKeyNames() {
        const mappings = Input.getAllKeyMappings();
        return [
            ...mappings.letters,
            ...mappings.numbers,
            ...mappings.special,
            ...mappings.function,
            ...mappings.punctuation,
            ...mappings.additionalSpecial,
            ...mappings.rightModifiers,
            ...mappings.keypad,
            ...mappings.menu
        ];
    }

    /**
     * Check if a specific key is currently held down
     */
    isKeyHeld(key) {
        const recent = this.getLastEvents(5);
        const lastDown = recent.find(e => e.key === key && e.type === 'down');
        const lastUp = recent.find(e => e.key === key && e.type === 'up');

        // Key is held if:
        // 1. There's a recent down event
        // 2. No recent up event OR up event was before down event
        if (!lastDown) return false;
        if (!lastUp) return true;

        return lastDown.timestamp > lastUp.timestamp;
    }

    /**
     * Get currently held keys
     */
    getHeldKeys() {
        const allKeys = this.getAllKeyNames();
        return allKeys.filter(key => this.isKeyHeld(key));
    }

    /**
     * Get current modifier state
     */
    getModifierState() {
        return {
            shift: this.currentModifiers.has('Shift'),
            control: this.currentModifiers.has('Control'),
            alt: this.currentModifiers.has('Alt'),
            capsLock: this.capsLockActive,
            any: this.currentModifiers.size > 0
        };
    }

    /**
     * Register cheat code sequences
     */
    registerCheatCode(name, sequence, onActivate) {
        return this.registerSequence(
            `cheat_${name}`,
            sequence,
            (match) => {
                console.log(`🎮 Cheat activated: ${name}`);
                onActivate(match);
            },
            {
                timeWindow: 3000, // 3 seconds for cheat codes
                description: `Cheat code: ${name}`,
                clearOnMatch: true
            }
        );
    }

    /**
     * Register common cheat codes
     */
    registerCommonCheatCodes() {
        // Konami Code
        this.registerCheatCode('konami', [
            'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
            'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
            'B', 'A', 'Enter'
        ], () => {
            console.log('⬆️⬆️⬇️⬇️⬅️➡️⬅️➡️🅱️🅰️ - Konami Code Activated!');
        });

        // God mode
        this.registerCheatCode('godmode', ['G', 'O', 'D'], () => {
            console.log('👑 God Mode Activated!');
        });

        // Infinite ammo
        this.registerCheatCode('ammo', ['I', 'D', 'D', 'Q', 'D'], () => {
            console.log('🔫 Infinite Ammo!');
        });
    }

    /**
     * Create a typing buffer for text input
     */
    createTypingBuffer(options = {}) {
        const typingBuffer = {
            text: '',
            cursor: 0,
            maxLength: options.maxLength || 100,
            onTextChange: options.onTextChange || (() => { }),
            onEnter: options.onEnter || (() => { })
        };

        const shiftMap = {
            '1': '!',
            '2': '@',
            '3': '#',
            '4': '$',
            '5': '%',
            '6': '^',
            '7': '&',
            '8': '*',
            '9': '(',
            '0': ')',
            '`': '~',
            '-': '_',
            '=': '+',
            '[': '{',
            ']': '}',
            '\\': '|',
            ';': ':',
            "'": '"',
            ',': '<',
            '.': '>',
            '/': '?'
        };

        // Setup typing listeners
        const unsubscribers = [];

        // Letter, number, and punctuation keys
        const mappings = Input.getAllKeyMappings();
        const typeableKeys = [...mappings.letters, ...mappings.numbers, ...mappings.punctuation];
        typeableKeys.forEach(key => {
            const unsub = this.onSpecificKeyDown(key, (event) => {
                if (typingBuffer.text.length < typingBuffer.maxLength) {
                    const isShiftPressed = this.currentModifiers.has('Shift');
                    let char = key;

                    if (mappings.letters.includes(key)) {
                        // Handle letters with shift and caps lock (XOR behavior)
                        const shouldUpper = isShiftPressed !== this.capsLockActive;
                        char = shouldUpper ? key.toUpperCase() : key.toLowerCase();
                    } else if (isShiftPressed) {
                        // Handle shifted numbers and punctuation
                        char = shiftMap[key] || char;
                    }

                    typingBuffer.text = typingBuffer.text.slice(0, typingBuffer.cursor) + char + typingBuffer.text.slice(typingBuffer.cursor);
                    typingBuffer.cursor += 1;
                    typingBuffer.onTextChange(typingBuffer.text);
                }
            });
            unsubscribers.push(unsub);
        });

        // Space
        unsubscribers.push(this.onSpecificKeyDown('Space', () => {
            if (typingBuffer.text.length < typingBuffer.maxLength) {
                typingBuffer.text = typingBuffer.text.slice(0, typingBuffer.cursor) + ' ' + typingBuffer.text.slice(typingBuffer.cursor);
                typingBuffer.cursor += 1;
                typingBuffer.onTextChange(typingBuffer.text);
            }
        }));

        // Backspace
        unsubscribers.push(this.onSpecificKeyDown('Backspace', () => {
            if (typingBuffer.cursor > 0) {
                typingBuffer.text = typingBuffer.text.slice(0, typingBuffer.cursor - 1) + typingBuffer.text.slice(typingBuffer.cursor);
                typingBuffer.cursor -= 1;
                typingBuffer.onTextChange(typingBuffer.text);
            }
        }));

        // Enter
        unsubscribers.push(this.onSpecificKeyDown('Enter', () => {
            typingBuffer.onEnter(typingBuffer.text);
            typingBuffer.text = '';
            typingBuffer.cursor = 0;
            typingBuffer.onTextChange(typingBuffer.text);
        }));

        // Arrow keys for cursor navigation
        unsubscribers.push(this.onSpecificKeyDown('ArrowLeft', () => {
            typingBuffer.cursor = Math.max(0, typingBuffer.cursor - 1);
        }));

        unsubscribers.push(this.onSpecificKeyDown('ArrowRight', () => {
            typingBuffer.cursor = Math.min(typingBuffer.text.length, typingBuffer.cursor + 1);
        }));

        // Return buffer with cleanup
        return {
            buffer: typingBuffer,
            cleanup: () => unsubscribers.forEach(unsub => unsub())
        };
    }

    /**
     * Clean up all resources
     */
    cleanup() {
        this.stopRecording();
        this.sequences.clear();
        this.comboSequences.clear();
        this.globalKeyCallbacks.onKeyDown.clear();
        this.globalKeyCallbacks.onKeyUp.clear();
        this.currentModifiers.clear();
        this.buffer.clear();
        console.log('🎹 InputHelper: Cleaned up all resources');
    }

    /**
     * Get statistics about input usage
     */
    getStats() {
        const events = this.buffer.buffer;
        const keyCounts = {};
        const modifierUsage = {};

        events.forEach(event => {
            // Count key usage
            keyCounts[event.key] = (keyCounts[event.key] || 0) + 1;

            // Count modifier usage
            if (event.modifiers) {
                event.modifiers.forEach(mod => {
                    modifierUsage[mod] = (modifierUsage[mod] || 0) + 1;
                });
            }
        });

        // Find most used key
        let mostUsedKey = null;
        let maxCount = 0;
        for (const [key, count] of Object.entries(keyCounts)) {
            if (count > maxCount) {
                mostUsedKey = key;
                maxCount = count;
            }
        }

        return {
            totalEvents: events.length,
            mostUsedKey,
            mostUsedCount: maxCount,
            keyCounts,
            modifierUsage,
            sequencesRegistered: this.sequences.size,
            combosRegistered: this.comboSequences.size
        };
    }
}