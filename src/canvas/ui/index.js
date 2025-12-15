import {PolygonDrawer} from "../polygon.js"
import {ShapeDrawer} from "../shapes.js"
/**
 * Base UI Element
 * DO not use will re-write buggy
 */
export class UIElement {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.visible = true;
        this.enabled = true;
    }
    
    contains(px, py) {
        return px >= this.x && px < this.x + this.width &&
               py >= this.y && py < this.y + this.height;
    }
    
    update(inputMap) {}
    draw(canvas, font) {}
}

/**
 * Button with rounded corners
 */
export class Button extends UIElement {
    constructor(x, y, width, height, text, onClick) {
        super(x, y, width, height);
        this.text = text;
        this.onClick = onClick;
        
        // State
        this.isHovered = false;
        this.isPressed = false;
        
        // Style
        this.normalColor = { r: 70, g: 80, b: 100 };
        this.hoverColor = { r: 90, g: 100, b: 120 };
        this.pressedColor = { r: 50, g: 60, b: 80 };
        this.textColor = { r: 255, g: 255, b: 255, a: 255 };
        this.borderRadius = 8;
    }
    
    update(inputMap) {
        if (!this.enabled) return;
        
        const mousePos = inputMap.mousePosition;
        const wasHovered = this.isHovered;
        this.isHovered = this.contains(mousePos.x, mousePos.y);
        
        // Mouse down
        if (this.isHovered && inputMap.isMousePressed('click')) {
            this.isPressed = true;
        }
        
        // Mouse up (click complete)
        if (this.isPressed && inputMap.IsMouseActionReleased('click')) {
            if (this.isHovered && this.onClick) {
                this.onClick();
            }
            this.isPressed = false;
        }
    }
    
    draw(canvas, font) {
        if (!this.visible) return;
        
        // Choose color based on state
        let color = this.normalColor;
        if (!this.enabled) {
            color = { r: 40, g: 45, b: 50 };
        } else if (this.isPressed) {
            color = this.pressedColor;
        } else if (this.isHovered) {
            color = this.hoverColor;
        }
        
        // Draw rounded rectangle
        const points = PolygonDrawer.createRoundedRect(
            this.x, this.y, 
            this.width, this.height, 
            this.borderRadius
        );
        
        PolygonDrawer.fillPolygon(
            canvas, points,
            color.r, color.g, color.b, 255
        );
        
        // Draw border
        PolygonDrawer.strokePolygon(
            canvas, points, 2,
            this.isHovered ? 120 : 80,
            this.isHovered ? 140 : 100,
            this.isHovered ? 160 : 120,
            255
        );
        
        // Draw text (centered)
        if (font && this.text) {
            const metrics = font.measureText(this.text);
            const textX = this.x + (this.width - metrics.width) / 2;
            const textY = this.y + (this.height - metrics.height) / 2;
            
            font.drawText(canvas, this.text, textX, textY, this.textColor);
        }
    }
}

/**
 * Text Input with blinking cursor
 */
export class TextInput extends UIElement {
    constructor(x, y, width, height, placeholder = "") {
        super(x, y, width, height);
        this.text = "";
        this.placeholder = placeholder;
        this.isFocused = false;
        this.cursorPosition = 0;
        this.cursorBlinkTime = 0;
        this.cursorVisible = true;
        
        // Style
        this.backgroundColor = { r: 40, g: 45, b: 55 };
        this.focusedBackgroundColor = { r: 50, g: 55, b: 65 };
        this.borderColor = { r: 80, g: 90, b: 110 };
        this.focusedBorderColor = { r: 100, g: 150, b: 200 };
        this.textColor = { r: 255, g: 255, b: 255, a: 255 };
        this.placeholderColor = { r: 120, g: 130, b: 140, a: 255 };
        this.cursorColor = { r: 255, g: 255, b: 255, a: 255 };
        this.padding = 8;
        this.borderRadius = 6;
        
        // Callbacks
        this.onTextChange = null;
        this.onSubmit = null;
    }
    
    update(inputMap, deltaTime = 16) {
        if (!this.enabled) return;
        
        const mousePos = inputMap.mousePosition;
        
        // Handle focus
        if (inputMap.isMousePressed('click')) {
            const wasClicked = this.contains(mousePos.x, mousePos.y);
            if (wasClicked && !this.isFocused) {
                this.focus();
            } else if (!wasClicked && this.isFocused) {
                this.blur();
            }
        }
        
        // Blink cursor
        if (this.isFocused) {
            this.cursorBlinkTime += deltaTime;
            if (this.cursorBlinkTime >= 530) { // Blink every 530ms
                this.cursorVisible = !this.cursorVisible;
                this.cursorBlinkTime = 0;
            }
        }
    }
    
    focus() {
        this.isFocused = true;
        this.cursorPosition = this.text.length;
        this.cursorVisible = true;
        this.cursorBlinkTime = 0;
    }
    
    blur() {
        this.isFocused = false;
        this.cursorVisible = false;
    }
    
    /**
     * Handle character input
     * Call this from your input system when keys are pressed
     */
    handleChar(char) {
        if (!this.isFocused) return;
        
        // Insert character at cursor position
        this.text = this.text.slice(0, this.cursorPosition) + 
                    char + 
                    this.text.slice(this.cursorPosition);
        this.cursorPosition++;
        
        // Reset cursor blink
        this.cursorVisible = true;
        this.cursorBlinkTime = 0;
        
        if (this.onTextChange) {
            this.onTextChange(this.text);
        }
    }
    
    /**
     * Handle backspace
     */
    handleBackspace() {
        if (!this.isFocused || this.cursorPosition === 0) return;
        
        this.text = this.text.slice(0, this.cursorPosition - 1) + 
                    this.text.slice(this.cursorPosition);
        this.cursorPosition--;
        
        // Reset cursor blink
        this.cursorVisible = true;
        this.cursorBlinkTime = 0;
        
        if (this.onTextChange) {
            this.onTextChange(this.text);
        }
    }
    
    /**
     * Handle delete
     */
    handleDelete() {
        if (!this.isFocused || this.cursorPosition >= this.text.length) return;
        
        this.text = this.text.slice(0, this.cursorPosition) + 
                    this.text.slice(this.cursorPosition + 1);
        
        // Reset cursor blink
        this.cursorVisible = true;
        this.cursorBlinkTime = 0;
        
        if (this.onTextChange) {
            this.onTextChange(this.text);
        }
    }
    
    /**
     * Handle enter/return
     */
    handleSubmit() {
        if (!this.isFocused) return;
        
        if (this.onSubmit) {
            this.onSubmit(this.text);
        }
    }
    
    /**
     * Move cursor left
     */
    moveCursorLeft() {
        if (!this.isFocused || this.cursorPosition === 0) return;
        
        this.cursorPosition--;
        this.cursorVisible = true;
        this.cursorBlinkTime = 0;
    }
    
    /**
     * Move cursor right
     */
    moveCursorRight() {
        if (!this.isFocused || this.cursorPosition >= this.text.length) return;
        
        this.cursorPosition++;
        this.cursorVisible = true;
        this.cursorBlinkTime = 0;
    }
    
    /**
     * Set text programmatically
     */
    setText(text) {
        this.text = text;
        this.cursorPosition = text.length;
        this.cursorVisible = true;
        this.cursorBlinkTime = 0;
    }
    
    /**
     * Get current text
     */
    getText() {
        return this.text;
    }
    
    /**
     * Clear text
     */
    clear() {
        this.text = "";
        this.cursorPosition = 0;
        this.cursorVisible = true;
        this.cursorBlinkTime = 0;
    }
    
    draw(canvas, font) {
        if (!this.visible) return;
        
        // Background
        const bgColor = this.isFocused ? this.focusedBackgroundColor : this.backgroundColor;
        const points = PolygonDrawer.createRoundedRect(
            this.x, this.y,
            this.width, this.height,
            this.borderRadius
        );
        
        PolygonDrawer.fillPolygon(
            canvas, points,
            bgColor.r, bgColor.g, bgColor.b, 255
        );
        
        // Border
        const borderColor = this.isFocused ? this.focusedBorderColor : this.borderColor;
        PolygonDrawer.strokePolygon(
            canvas, points,
            this.isFocused ? 2 : 1,
            borderColor.r, borderColor.g, borderColor.b, 255
        );
        
        if (!font) return;
        
        // Text or placeholder
        const displayText = this.text || this.placeholder;
        const textColor = this.text ? this.textColor : this.placeholderColor;
        
        if (displayText) {
            const textX = this.x + this.padding;
            const textY = this.y + (this.height - font.lineHeight) / 2;
            
            font.drawText(canvas, displayText, textX, textY, textColor);
        }
        
        // Cursor
        if (this.isFocused && this.cursorVisible) {
            // Calculate cursor X position
            const textBeforeCursor = this.text.slice(0, this.cursorPosition);
            const cursorOffset = font.measureText(textBeforeCursor).width;
            
            const cursorX = this.x + this.padding + cursorOffset;
            const cursorY1 = this.y + this.padding;
            const cursorY2 = this.y + this.height - this.padding;
            
            // Draw cursor line
            ShapeDrawer.fillRect(
                canvas,
                cursorX, cursorY1,
                2, cursorY2 - cursorY1,
                this.cursorColor.r, this.cursorColor.g, this.cursorColor.b, this.cursorColor.a
            );
        }
    }
}

/**
 * Label (static text)
 */
export class Label extends UIElement {
    constructor(x, y, text, color = { r: 255, g: 255, b: 255, a: 255 }) {
        super(x, y, 0, 0);
        this.text = text;
        this.color = color;
    }
    
    draw(canvas, font) {
        if (!this.visible || !font) return;
        
        font.drawText(canvas, this.text, this.x, this.y, this.color);
    }
}

/**
 * UI Manager
 */
export class UIManager {
    constructor(canvas, font, inputMap) {
        this.canvas = canvas;
        this.font = font;
        this.inputMap = inputMap;
        this.elements = [];
        this.focusedElement = null;
        
        // Track last frame time for delta
        this.lastFrameTime = performance.now();
    }
    
    add(element) {
        this.elements.push(element);
        return element;
    }
    
    remove(element) {
        const index = this.elements.indexOf(element);
        if (index > -1) {
            this.elements.splice(index, 1);
        }
    }
    
    clear() {
        this.elements = [];
        this.focusedElement = null;
    }
    
    update() {
        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;
        
        // Update all elements
        this.elements.forEach(element => {
            if (element.enabled) {
                element.update(this.inputMap, deltaTime);
            }
        });
    }
    
    draw() {
        // Draw all elements
        this.elements.forEach(element => {
            if (element.visible) {
                element.draw(this.canvas, this.font);
            }
        });
    }
}

