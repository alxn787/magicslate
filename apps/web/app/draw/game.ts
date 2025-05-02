import { Tool } from "../components/MainCanvas";
import { DrawingProperties } from "../components/Sidebar";
import { getExistingShapes } from "./http";

type BaseShapeStyle = {
    strokeColor: string;
    strokeWidth: number;
    fillColor: string;
    opacity: number;
    id: string;
}


type Shape = ({
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
} & BaseShapeStyle) | ({
    type: "circle"; // Changed back to circle
    centerX: number;
    centerY: number;
    radiusX: number; // Kept radiusX
    radiusY: number; // Kept radiusY
} & BaseShapeStyle) | ({
    type: "pencil";
    points: { x: number, y: number }[];
} & BaseShapeStyle);

// Define the type for resize handles
type ResizeHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'top' | 'bottom' | 'left' | 'right' | null;

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private existingShapes: Shape[] = [];
    private roomId: string;
    private token: string;
    private socket: WebSocket;
    private clicked: boolean;
    private startX = 0;
    private startY = 0;
    private selectedTool: Tool = 'circle'; // Default tool can be circle
    private currentPoints: { x: number, y: number }[] = [];
    private scale = 1;

    private selectedShape: Shape | null = null;
    private isMoving: boolean = false;
    private moveOffsetX: number = 0;
    private moveOffsetY: number = 0;

    // New state for resizing
    private isResizing: boolean = false;
    private resizeHandle: ResizeHandle = null;
    private initialShapeState: Shape | null = null; // Store initial state for resizing calculations

    private drawingProperties: DrawingProperties = {
        strokeColor: "#1a1c2c",
        strokeWidth: 2,
        fillColor: "transparent",
        opacity: 1
    };

    constructor(canvas: HTMLCanvasElement, roomId: string, token: string, socket: WebSocket) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.roomId = roomId;
        this.token = token;
        this.socket = socket;
        this.clicked = false;
        this.init();
        this.initHandler();
        this.initMouseHandler();
    }

    destroy() {
        this.canvas.removeEventListener('mousedown', this.MouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.MouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.MouseMoveHandler);
         this.canvas.removeEventListener("mouseout", this.MouseOutHandler);
    }

    setTool(tool: Tool) {
        this.selectedTool = tool;
        if (tool !== 'select') {
            this.selectedShape = null;
            this.ClearCanvas(); // Clear selection box when tool changes
        }
    }

    setDrawingProperties(props: DrawingProperties): void {
        this.drawingProperties = props;
         // When drawing properties are updated, redraw to show potential changes on selected shape if applicable
        this.ClearCanvas();
    }

    // This method should apply styles based on the shape being drawn, not global properties
    private applyShapeStyles(ctx: CanvasRenderingContext2D, shape: Shape) {
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;

        if (shape.fillColor !== "transparent") {
            const { fillColor, opacity } = shape;
            const r = parseInt(fillColor.slice(1, 3), 16);
            const g = parseInt(fillColor.slice(3, 5), 16);
            const b = parseInt(fillColor.slice(5, 7), 16);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        } else {
            ctx.fillStyle = "transparent";
        }
    }


    zoomIn() {
        this.scale = Math.min(this.scale * 1.2, 10);
        this.ClearCanvas();
    }

    zoomOut() {
        this.scale = Math.max(this.scale / 1.2, 0.1);
        this.ClearCanvas();
    }

    resetZoom() {
        this.scale = 1;
        this.ClearCanvas();
    }

    clearSlate() {
        this.socket.send(JSON.stringify({ type: "clearslate", roomId: this.roomId }));
        this.existingShapes = [];
        this.selectedShape = null;
        this.ClearCanvas();
        this.selectedTool = "select";
    }

    async init() {
        this.existingShapes = await getExistingShapes(this.roomId, this.token);
        this.ClearCanvas();
    }

    initHandler() {
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === "chat") {
                const parsedShape = JSON.parse(message.message);
                this.existingShapes.push(parsedShape);
                this.ClearCanvas();
            } else if (message.type === "clearslate") {
                this.existingShapes = [];
                this.selectedShape = null;
                this.ClearCanvas();
            } else if (message.type === "updateShape") {
                const updatedShape = JSON.parse(message.shape);
                const index = this.existingShapes.findIndex(s => s.id === updatedShape.id);
                if (index !== -1) {
                    this.existingShapes[index] = updatedShape;
                    // If the updated shape is the currently selected one, update the reference
                    if (this.selectedShape && this.selectedShape.id === updatedShape.id) {
                        this.selectedShape = updatedShape;
                    }
                    this.ClearCanvas();
                }
            }
        };
    }

    ClearCanvas() {
        // Clear the entire canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Redraw the background (optional, based on desired behavior)
        this.ctx.fillStyle = "black"; // Or any desired background color
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);


        for (const shape of this.existingShapes) {
            const isSelected = this.selectedShape && shape.id === this.selectedShape.id;

            // Apply styles specific to this shape
            this.applyShapeStyles(this.ctx, shape);

            if (shape.type === "rect") {
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
                if (this.ctx.fillStyle !== 'transparent') {
                    this.ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
                }
            } else if (shape.type === "circle") { // Still type "circle"
                this.ctx.beginPath();
                // Draw an ellipse using radiusX and radiusY
                this.ctx.ellipse(shape.centerX, shape.centerY, Math.abs(shape.radiusX), Math.abs(shape.radiusY), 0, 0, 2 * Math.PI);
                this.ctx.stroke();
                if (this.ctx.fillStyle !== 'transparent') {
                    this.ctx.fill();
                }
                this.ctx.closePath();
            } else if (shape.type === "pencil") {
                this.ctx.lineJoin = "round";
                this.ctx.lineCap = "round";
                this.ctx.beginPath();
                //@ts-ignore
                this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
                for (let i = 1; i < shape.points.length; i++) {
                    //@ts-ignore
                    this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
                }
                this.ctx.stroke();
                this.ctx.closePath();
                // Restore default line width after drawing pencil line
                // this.ctx.lineWidth = this.drawingProperties.strokeWidth; // Redundant if applyShapeStyles is used
            }

            if (isSelected) {
                this.drawSelectionBox(shape);
            }
        }
         // Restore default drawing properties for potential temporary drawings in MouseMoveHandler
        this.applyDrawingStylesForTemporaryDrawing();
    }

    // Method to apply drawing properties for temporary shapes drawn during mouse move
     private applyDrawingStylesForTemporaryDrawing(useFill = false) {
        this.ctx.strokeStyle = this.drawingProperties.strokeColor;
        this.ctx.lineWidth = this.drawingProperties.strokeWidth;
        if (useFill && this.drawingProperties.fillColor !== "transparent") {
            const { fillColor, opacity } = this.drawingProperties;
            const r = parseInt(fillColor.slice(1, 3), 16);
            const g = parseInt(fillColor.slice(3, 5), 16);
            const b = parseInt(fillColor.slice(5, 7), 16);
            this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        } else {
            this.ctx.fillStyle = "transparent";
        }
    }

    // Calculate the bounding box of a shape
    private getShapeBoundingBox(shape: Shape): { x: number, y: number, width: number, height: number } {
        if (shape.type === "rect") {
            const x = Math.min(shape.x, shape.x + shape.width);
            const y = Math.min(shape.y, shape.y + shape.height);
            const width = Math.abs(shape.width);
            const height = Math.abs(shape.height);
             return { x, y, width, height };
        } else if (shape.type === "circle") { // Still type "circle" but using ellipse properties
            return { x: shape.centerX - Math.abs(shape.radiusX), y: shape.centerY - Math.abs(shape.radiusY), width: Math.abs(shape.radiusX) * 2, height: Math.abs(shape.radiusY) * 2 };
        } else if (shape.type === "pencil") {
            const points = shape.points;
            if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
            const minX = Math.min(...points.map(p => p.x));
            const maxX = Math.max(...points.map(p => p.x));
            const minY = Math.min(...points.map(p => p.y));
            const maxY = Math.max(...points.map(p => p.y));
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }
        return { x: 0, y: 0, width: 0, height: 0 }; // Should not reach here
    }

    // Check if a point is on a resize handle
    private getResizeHandleAt(x: number, y: number, shape: Shape): ResizeHandle {
        const boundingBox = this.getShapeBoundingBox(shape);
        const handleSize = 10; // Size of the interactive handle area
        const halfHandleSize = handleSize / 2;

        const handles = {
            topLeft: { x: boundingBox.x, y: boundingBox.y },
            topRight: { x: boundingBox.x + boundingBox.width, y: boundingBox.y },
            bottomLeft: { x: boundingBox.x, y: boundingBox.y + boundingBox.height },
            bottomRight: { x: boundingBox.x + boundingBox.width, y: boundingBox.y + boundingBox.height },
            top: { x: boundingBox.x + boundingBox.width / 2, y: boundingBox.y },
            bottom: { x: boundingBox.x + boundingBox.width / 2, y: boundingBox.y + boundingBox.height },
            left: { x: boundingBox.x, y: boundingBox.y + boundingBox.height / 2 },
            right: { x: boundingBox.x + boundingBox.width, y: boundingBox.y + boundingBox.height / 2 },
        };

        for (const handle in handles) {
            //@ts-ignore
            const handlePos = handles[handle];
            if (x >= handlePos.x - halfHandleSize && x <= handlePos.x + halfHandleSize &&
                y >= handlePos.y - halfHandleSize && y <= handlePos.y + halfHandleSize) {
                 //@ts-ignore
                return handle as ResizeHandle;
            }
        }

        return null;
    }


    drawSelectionBox(shape: Shape) {
        const boundingBox = this.getShapeBoundingBox(shape);
        const { x, y, width, height } = boundingBox;

        this.ctx.strokeStyle = "rgba(0,255,255,0.8)";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);

        // Draw the bounding box outline
        this.ctx.strokeRect(x - 5, y - 5, width + 10, height + 10);

        this.ctx.setLineDash([]);
        // Restore default line width after drawing selection box
        // this.ctx.lineWidth = this.drawingProperties.strokeWidth; // Redundant if applyShapeStyles is used

        // Draw resize handles (squares at corners and midpoints)
        const handleSize = 8;
        const halfHandleSize = handleSize / 2;
        this.ctx.fillStyle = "rgba(0,255,255,1)"; // Color of the handles

        // Corner handles
        this.ctx.fillRect(x - 5 - halfHandleSize, y - 5 - halfHandleSize, handleSize, handleSize); // Top-left
        this.ctx.fillRect(x + width + 5 - halfHandleSize, y - 5 - halfHandleSize, handleSize, handleSize); // Top-right
        this.ctx.fillRect(x - 5 - halfHandleSize, y + height + 5 - halfHandleSize, handleSize, handleSize); // Bottom-left
        this.ctx.fillRect(x + width + 5 - halfHandleSize, y + height + 5 - halfHandleSize, handleSize, handleSize); // Bottom-right

        // Mid-point handles
        this.ctx.fillRect(x + width / 2 - halfHandleSize, y - 5 - halfHandleSize, handleSize, handleSize); // Top
        this.ctx.fillRect(x + width / 2 - halfHandleSize, y + height + 5 - halfHandleSize, handleSize, handleSize); // Bottom
        this.ctx.fillRect(x - 5 - halfHandleSize, y + height / 2 - halfHandleSize, handleSize, handleSize); // Left
        this.ctx.fillRect(x + width + 5 - halfHandleSize, y + height / 2 - halfHandleSize, handleSize, handleSize); // Right
    }

    isPointInShape(x: number, y: number, shape: Shape): boolean {
        if (shape.type === "rect") {
             // Account for negative width/height
            const rectX = Math.min(shape.x, shape.x + shape.width);
            const rectY = Math.min(shape.y, shape.y + shape.height);
            const rectWidth = Math.abs(shape.width);
            const rectHeight = Math.abs(shape.height);
            return x >= rectX && x <= rectX + rectWidth && y >= rectY && y <= rectY + rectHeight;
        } else if (shape.type === "circle") { // Still type "circle" but using ellipse logic
            const dx = x - shape.centerX;
            const dy = y - shape.centerY;
            // Check if point is inside the ellipse using the ellipse equation
             // Avoid division by zero if radiusX or radiusY is 0
            const term1 = (shape.radiusX === 0) ? (dx === 0 ? 0 : Infinity) : (dx * dx) / (shape.radiusX * shape.radiusX);
            const term2 = (shape.radiusY === 0) ? (dy === 0 ? 0 : Infinity) : (dy * dy) / (shape.radiusY * shape.radiusY);

            return term1 + term2 <= 1;

        } else if (shape.type === "pencil") {
             // Increased padding for easier selection of pencil lines
            const padding = 10;
            const points = shape.points;
            if (points.length < 2) return false;

            const minX = Math.min(...points.map(p => p.x)) - padding;
            const maxX = Math.max(...points.map(p => p.x)) + padding;
            const minY = Math.min(...points.map(p => p.y)) - padding;
            const maxY = Math.max(...points.map(p => p.y)) + padding;

            // Quick check if point is within the bounding box of the pencil line
            if (x < minX || x > maxX || y < minY || y > maxY) return false;

             // Tolerance for how close the point needs to be to the line segment
            const tolerance = shape.strokeWidth / 2 + padding; // Tolerance based on stroke width and padding

            for (let i = 1; i < points.length; i++) {
                const p1 = points[i - 1];
                const p2 = points[i];
                 //@ts-ignore - points are guaranteed to have x and y
                const d = this.pointToLineDistance(x, y, p1, p2);
                if (d <= tolerance) return true;
            }
            return false;
        }
        return false;
    }

    pointToLineDistance(px: number, py: number, p1: { x: number, y: number }, p2: { x: number, y: number }): number {
        const A = px - p1.x;
        const B = py - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;

        if (len_sq !== 0) {
             param = dot / len_sq;
        }


        let xx, yy;

        if (param < 0) {
            xx = p1.x;
            yy = p1.y;
        } else if (param > 1) {
            xx = p2.x;
            yy = p2.y;
        } else {
            xx = p1.x + param * C;
            yy = p1.y + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }


    findShapeAt(x: number, y: number): Shape | null {
        // Iterate in reverse order to select the topmost shape
        for (let i = this.existingShapes.length - 1; i >= 0; i--) {
            const shape = this.existingShapes[i];
            if (!shape) return null; // Should not happen, but as a safeguard

            // Check if clicking on a resize handle first if a shape is already selected
            if (this.selectedTool === 'select' && this.selectedShape && this.selectedShape.id === shape.id) {
                const handle = this.getResizeHandleAt(x, y, shape);
                if (handle) {
                    this.isResizing = true;
                    this.resizeHandle = handle;
                    this.initialShapeState = JSON.parse(JSON.stringify(shape)); // Store initial state
                    this.startX = x; // Update startX/Y for resizing
                    this.startY = y;
                    return shape; // Return the selected shape to indicate interaction
                }
            }

            // If not clicking on a handle, check if clicking inside the shape
            if (this.isPointInShape(x, y, shape)) {
                 // If a shape is found, and it's not the selected shape, clear the current selection
                if (this.selectedShape && this.selectedShape.id !== shape.id) {
                    this.selectedShape = null;
                    this.ClearCanvas(); // Redraw to remove the old selection box
                }
                return shape;
            }
        }
        return null;
    }


    moveSelectedShape(dx: number, dy: number) {
        if (!this.selectedShape) return;

        // Create a mutable copy for updates
        const updated: Shape = JSON.parse(JSON.stringify(this.selectedShape));

        if (updated.type === "rect") {
            updated.x += dx;
            updated.y += dy;
        } else if (updated.type === "circle") { // Still type "circle"
            updated.centerX += dx;
            updated.centerY += dy;
        } else if (updated.type === "pencil") {
            updated.points = updated.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        }

        // Update the shape in the existingShapes array
        const index = this.existingShapes.findIndex(s => s.id === updated.id);
        if (index !== -1) {
             this.existingShapes[index] = updated;
        }

        // Update the selectedShape reference to the modified object
        this.selectedShape = updated;

        // Send update over socket during move for smoother experience
        this.socket.send(JSON.stringify({ type: "updateShape", roomId: this.roomId, shape: JSON.stringify(this.selectedShape) }));
        this.ClearCanvas();
    }

    resizeSelectedShape(currentX: number, currentY: number) {
        if (!this.selectedShape || !this.initialShapeState || !this.resizeHandle) return;

        // Create a mutable copy for updates
        const updated: Shape = JSON.parse(JSON.stringify(this.initialShapeState)); // Start from the initial state

        const dx = currentX - this.startX;
        const dy = currentY - this.startY;

        const initialBoundingBox = this.getShapeBoundingBox(this.initialShapeState);
        const { x: initialX, y: initialY, width: initialWidth, height: initialHeight } = initialBoundingBox;

        if (updated.type === "rect") {
            let newX = initialX;
            let newY = initialY;
            let newWidth = initialWidth;
            let newHeight = initialHeight;

            // Apply changes based on the dragged handle
            switch (this.resizeHandle) {
                case 'topLeft':
                    newX = initialX + dx;
                    newY = initialY + dy;
                    newWidth = initialWidth - dx;
                    newHeight = initialHeight - dy;
                    break;
                case 'topRight':
                    newY = initialY + dy;
                    newWidth = initialWidth + dx;
                    newHeight = initialHeight - dy;
                    break;
                case 'bottomLeft':
                    newX = initialX + dx;
                    newWidth = initialWidth - dx;
                    newHeight = initialHeight + dy;
                    break;
                case 'bottomRight':
                    newWidth = initialWidth + dx;
                    newHeight = initialHeight + dy;
                    break;
                case 'top':
                    newY = initialY + dy;
                    newHeight = initialHeight - dy;
                    break;
                case 'bottom':
                    newHeight = initialHeight + dy;
                    break;
                case 'left':
                    newX = initialX + dx;
                    newWidth = initialWidth - dx;
                    break;
                case 'right':
                    newWidth = initialWidth + dx;
                    break;
            }

             // Prevent very small width or height, maintain minimum size
             const minSize = 5;
             if (Math.abs(newWidth) < minSize && newWidth !== 0) {
                 newWidth = newWidth < 0 ? -minSize : minSize;
             } else if (newWidth === 0) {
                 newWidth = minSize; // Prevent division by zero in bounding box calculation
             }
             if (Math.abs(newHeight) < minSize && newHeight !== 0) {
                 newHeight = newHeight < 0 ? -minSize : minSize;
             } else if (newHeight === 0) {
                 newHeight = minSize; // Prevent division by zero
             }


            updated.x = newX;
            updated.y = newY;
            updated.width = newWidth;
            updated.height = newHeight;

        } else if (updated.type === "circle") { // Still type "circle" but using ellipse logic
             // Resizing an ellipse from a handle
            let newRadiusX = Math.abs(initialBoundingBox.width) / 2;
            let newRadiusY = Math.abs(initialBoundingBox.height) / 2;
            let newCenterX = initialBoundingBox.x + newRadiusX;
            let newCenterY = initialBoundingBox.y + newRadiusY;


            switch (this.resizeHandle) {
                 case 'topLeft':
                     newCenterX = initialBoundingBox.x + (initialBoundingBox.width - dx) / 2;
                     newCenterY = initialBoundingBox.y + (initialBoundingBox.height - dy) / 2;
                     newRadiusX = Math.abs(initialBoundingBox.width - dx) / 2;
                     newRadiusY = Math.abs(initialBoundingBox.height - dy) / 2;
                     break;
                 case 'topRight':
                     newCenterX = initialBoundingBox.x + (initialBoundingBox.width + dx) / 2;
                     newCenterY = initialBoundingBox.y + (initialBoundingBox.height - dy) / 2;
                     newRadiusX = Math.abs(initialBoundingBox.width + dx) / 2;
                     newRadiusY = Math.abs(initialBoundingBox.height - dy) / 2;
                     break;
                 case 'bottomLeft':
                     newCenterX = initialBoundingBox.x + (initialBoundingBox.width - dx) / 2;
                     newCenterY = initialBoundingBox.y + (initialBoundingBox.height + dy) / 2;
                     newRadiusX = Math.abs(initialBoundingBox.width - dx) / 2;
                     newRadiusY = Math.abs(initialBoundingBox.height + dy) / 2;
                     break;
                 case 'bottomRight':
                     newCenterX = initialBoundingBox.x + (initialBoundingBox.width + dx) / 2;
                     newCenterY = initialBoundingBox.y + (initialBoundingBox.height + dy) / 2;
                     newRadiusX = Math.abs(initialBoundingBox.width + dx) / 2;
                     newRadiusY = Math.abs(initialBoundingBox.height + dy) / 2;
                     break;
                 case 'top':
                     newCenterY = initialBoundingBox.y + (initialBoundingBox.height - dy) / 2;
                     newRadiusY = Math.abs(initialBoundingBox.height - dy) / 2;
                     break;
                 case 'bottom':
                     newCenterY = initialBoundingBox.y + (initialBoundingBox.height + dy) / 2;
                     newRadiusY = Math.abs(initialBoundingBox.height + dy) / 2;
                     break;
                 case 'left':
                     newCenterX = initialBoundingBox.x + (initialBoundingBox.width - dx) / 2;
                     newRadiusX = Math.abs(initialBoundingBox.width - dx) / 2;
                     break;
                 case 'right':
                     newCenterX = initialBoundingBox.x + (initialBoundingBox.width + dx) / 2;
                     newRadiusX = Math.abs(initialBoundingBox.width + dx) / 2;
                     break;
             }

             // Prevent very small radii, maintain minimum size
             const minRadius = 2.5;
             if (newRadiusX < minRadius) newRadiusX = minRadius;
             if (newRadiusY < minRadius) newRadiusY = minRadius;

            updated.centerX = newCenterX;
            updated.centerY = newCenterY;
            updated.radiusX = newRadiusX;
            updated.radiusY = newRadiusY;


        } else if (updated.type === "pencil") {
             // Resizing a pencil stroke is more complex. A simple approach is scaling all points.
            const initialBoundingBox = this.getShapeBoundingBox(this.initialShapeState);
            const { x: initialBx, y: initialBy, width: initialBw, height: initialBh } = initialBoundingBox;

            if (initialBw === 0 || initialBh === 0) return; // Prevent division by zero

             // Calculate scale factors based on change from initial click relative to bounding box
            const scaleX = 1 + (currentX - this.startX) / initialBw;
            const scaleY = 1 + (currentY - this.startY) / initialBh;

             // Apply uniform scale based on the handle
             let scale = 1;
            switch (this.resizeHandle) {
                case 'topLeft':
                case 'bottomRight':
                    scale = Math.min(scaleX, scaleY);
                    break;
                case 'topRight':
                case 'bottomLeft':
                     scale = Math.min(scaleX, scaleY); // Could be different logic for these corners
                    break;
                case 'top':
                case 'bottom':
                    scale = scaleY;
                    break;
                case 'left':
                case 'right':
                    scale = scaleX;
                    break;
            }

             // Ensure scale is not too small
             const minScale = 0.01; // Allow for very small scaling
             if(scale < minScale) scale = minScale;


            updated.points = updated.points.map(p => {
                 // Scale points relative to the top-left of the initial bounding box
                const relativeX = p.x - initialBx;
                const relativeY = p.y - initialBy;
                return {
                    x: initialBx + relativeX * scale,
                    y: initialBy + relativeY * scale
                };
            });
        }

        // Update the shape in the existingShapes array
        const index = this.existingShapes.findIndex(s => s.id === updated.id);
        if (index !== -1) {
             this.existingShapes[index] = updated;
        }

        // Update the selectedShape reference to the modified object
        this.selectedShape = updated;

        this.ClearCanvas(); // Redraw to show the resized shape
    }


    MouseDownHandler = (e: MouseEvent) => {
        this.clicked = true;
        this.startX = e.clientX;
        this.startY = e.clientY;

        if (this.selectedTool === "select") {
            const shape = this.findShapeAt(e.clientX, e.clientY);

            if (this.isResizing) {
                 // If we are already resizing, no need to re-calculate and return
                 return;
            }

            if (shape) {
                // If a shape is found, check if a resize handle was clicked
                const handle = this.getResizeHandleAt(e.clientX, e.clientY, shape);
                if (handle) {
                    this.selectedShape = shape;
                    this.isResizing = true;
                    this.resizeHandle = handle;
                    this.initialShapeState = JSON.parse(JSON.stringify(shape)); // Store initial state
                     // startX and startY are already set to the click position
                } else {
                    // If a shape is clicked but not on a handle, start moving
                    this.selectedShape = shape;
                    this.isMoving = true;
                     // Calculate offset based on the specific shape type
                    if (shape.type === "rect") {
                        this.moveOffsetX = e.clientX - shape.x;
                        this.moveOffsetY = e.clientY - shape.y;
                    } else if (shape.type === "circle") { // Still type "circle"
                        this.moveOffsetX = e.clientX - shape.centerX;
                        this.moveOffsetY = e.clientY - shape.centerY;
                    } else if (shape.type === "pencil") {
                         // For pencil, use the first point for offset calculation
                         //@ts-ignore
                        this.moveOffsetX = e.clientX - shape.points[0].x;
                         //@ts-ignore
                        this.moveOffsetY = e.clientY - shape.points[0].y;
                    }
                }
            } else {
                // If no shape is clicked, clear selection
                this.selectedShape = null;
            }
            this.ClearCanvas(); // Redraw to show selection box or remove it
        } else if (this.selectedTool === "pencil") {
            this.currentPoints = [{ x: e.clientX, y: e.clientY }];
        }
    }

    MouseUpHandler = (e: MouseEvent) => {
        this.clicked = false;

        if (this.selectedTool === "select") {
            if (this.isMoving) {
                this.isMoving = false;
                 // Send the final position after moving
                 if(this.selectedShape){
                     this.socket.send(JSON.stringify({ type: "updateShape", roomId: this.roomId, shape: JSON.stringify(this.selectedShape) }));
                 }
            } else if (this.isResizing) {
                this.isResizing = false;
                this.resizeHandle = null;
                this.initialShapeState = null;
                 // Send the final state after resizing (already sent on mousemove, but sending again ensures the very last position is captured)
                 if(this.selectedShape){
                    this.socket.send(JSON.stringify({ type: "updateShape", roomId: this.roomId, shape: JSON.stringify(this.selectedShape) }));
                 }
            }
            // No need to call ClearCanvas here, MouseMoveHandler for moving/resizing already clears and redraws
            // If no shape was moved or resized, and a shape was selected, the selection remains.
             // If no shape was selected, ClearCanvas was called in MouseDownHandler
            return;
        }

        const width = e.clientX - this.startX;
        const height = e.clientY - this.startY;

        let shape: Shape | null = null;

        // Use drawingProperties for the new shape being created
        const newShapeStyle: BaseShapeStyle = {
            strokeColor: this.drawingProperties.strokeColor,
            strokeWidth: this.drawingProperties.strokeWidth,
            fillColor: this.drawingProperties.fillColor,
            opacity: this.drawingProperties.opacity,
            id: crypto.randomUUID()
        };


        if (this.selectedTool === "pencil") {
            if (this.currentPoints.length < 2) {
                this.currentPoints = []; // Clear points if not enough to form a line
                this.ClearCanvas(); // Clear any temporary drawing
                return;
            }
            shape = {
                type: "pencil",
                points: [...this.currentPoints],
                ...newShapeStyle
            };
            this.currentPoints = [];
        } else if (this.selectedTool === "rect") {
             // Ensure positive width and height for rect creation
             const x = width > 0 ? this.startX : e.clientX;
             const y = height > 0 ? this.startY : e.clientY;
             const w = Math.abs(width);
             const h = Math.abs(height);

             // Only create shape if it has a size
             if (w > 0 && h > 0) {
                shape = {
                    type: "rect",
                    x: x,
                    y: y,
                    width: w,
                    height: h,
                    ...newShapeStyle
                };
             }
        } else if (this.selectedTool === "circle") { // Still type "circle"
             // Calculate center and radii for ellipse creation
            const centerX = this.startX + width / 2;
            const centerY = this.startY + height / 2;
            const radiusX = Math.abs(width) / 2; // Use half the width of the bounding box as radiusX
            const radiusY = Math.abs(height) / 2; // Use half the height of the bounding box as radiusY


             // Only create shape if it has a valid size (at least one radius > 0)
            if (radiusX > 0 || radiusY > 0) {
                shape = {
                    type: "circle", // Still type "circle"
                    centerX,
                    centerY,
                    radiusX, // Added radiusX
                    radiusY, // Added radiusY
                    ...newShapeStyle
                };
            }
        }

        if (shape) {
            this.existingShapes.push(shape);
            this.socket.send(JSON.stringify({ type: "chat", message: JSON.stringify(shape), roomId: this.roomId }));
            this.ClearCanvas(); // Redraw with the new shape added
        } else {
             // If no shape was created (e.g., a single click or zero-size shape), just redraw to clear temporary drawing
            this.ClearCanvas();
        }
    }

    MouseMoveHandler = (e: MouseEvent) => {
        if (!this.clicked) {
             // Update cursor style when hovering over a resize handle
            if (this.selectedTool === 'select' && this.selectedShape) {
                const handle = this.getResizeHandleAt(e.clientX, e.clientY, this.selectedShape);
                if (handle) {
                    this.setCursorStyle(handle);
                } else if (this.isPointInShape(e.clientX, e.clientY, this.selectedShape)) {
                    this.canvas.style.cursor = 'move'; // Cursor for moving
                } else {
                    this.canvas.style.cursor = 'default'; // Default cursor
                }
            } else {
                 this.canvas.style.cursor = 'default'; // Default cursor when no shape is selected or a drawing tool is active
            }
            return;
        }

        if (this.selectedTool === "select") {
            if (this.isMoving && this.selectedShape) {
                const dx = e.clientX - this.startX;
                const dy = e.clientY - this.startY;
                 // Move the shape visually immediately
                this.moveSelectedShape(dx, dy);
                this.startX = e.clientX;
                this.startY = e.clientY;
                // Send update over socket during move for smoother experience - Already done in moveSelectedShape
                return; // Exit to prevent drawing temporary shapes while moving
            } else if (this.isResizing && this.selectedShape && this.initialShapeState && this.resizeHandle) {
                 this.resizeSelectedShape(e.clientX, e.clientY);
                 // Send update over socket continuously during resizing
                 this.socket.send(JSON.stringify({ type: "updateShape", roomId: this.roomId, shape: JSON.stringify(this.selectedShape) }));
                return; // Exit to prevent drawing temporary shapes while resizing
            }
        }


         // Only draw temporary shape if a drawing tool is selected and not resizing or moving
        if (this.selectedTool === "rect" || this.selectedTool === "circle" || this.selectedTool === "pencil") { // Still checking for "circle" tool
            this.ClearCanvas(); // Clear previous temporary drawing and redraw existing shapes

            const width = e.clientX - this.startX;
            const height = e.clientY - this.startY;

             // Apply current drawing styles for the temporary shape
            this.applyDrawingStylesForTemporaryDrawing(true);


            if (this.selectedTool === "rect") {
                this.ctx.strokeRect(this.startX, this.startY, width, height);
                 if (this.ctx.fillStyle !== 'transparent') {
                    this.ctx.fillRect(this.startX, this.startY, width, height);
                }
            } else if (this.selectedTool === "circle") { // Drawing an ellipse when tool is "circle"
                const centerX = this.startX + width / 2;
                const centerY = this.startY + height / 2;
                const radiusX = Math.abs(width) / 2; // Use half the width of the bounding box as radiusX
                const radiusY = Math.abs(height) / 2; // Use half the height of the bounding box as radiusY
                this.ctx.beginPath();
                // Draw an ellipse
                this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                this.ctx.stroke();
                 if (this.ctx.fillStyle !== 'transparent') {
                    this.ctx.fill();
                }
                this.ctx.closePath();
            } else if (this.selectedTool === "pencil") {
                this.currentPoints.push({ x: e.clientX, y: e.clientY });
                 // Use drawingProperties for pencil tool during drawing
                this.ctx.strokeStyle = this.drawingProperties.strokeColor;
                this.ctx.lineWidth = this.drawingProperties.strokeWidth;
                this.ctx.lineJoin = "round";
                this.ctx.lineCap = "round";

                this.ctx.beginPath();
                 //@ts-ignore
                this.ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);
                for (let i = 1; i < this.currentPoints.length; i++) {
                     //@ts-ignore
                    this.ctx.lineTo(this.currentPoints[i].x, this.currentPoints[i].y);
                }
                this.ctx.stroke();
                this.ctx.closePath();
                 // Restore default line width after drawing temporary pencil line
                // this.ctx.lineWidth = this.drawingProperties.strokeWidth; // Redundant if applyDrawingStylesForTemporaryDrawing is used
            }
        }
    }

    // Set cursor style based on the resize handle
    private setCursorStyle(handle: ResizeHandle) {
        switch (handle) {
            case 'topLeft':
            case 'bottomRight':
                this.canvas.style.cursor = 'nwse-resize';
                break;
            case 'topRight':
            case 'bottomLeft':
                this.canvas.style.cursor = 'nesw-resize';
                break;
            case 'top':
            case 'bottom':
                this.canvas.style.cursor = 'ns-resize';
                break;
            case 'left':
            case 'right':
                this.canvas.style.cursor = 'ew-resize';
                break;
            default:
                this.canvas.style.cursor = 'default';
        }
    }

     // Handle mouse leaving the canvas
    private MouseOutHandler = () => {
        // If currently moving or resizing, treat mouseout as mouseup to finalize the operation
        if (this.clicked) {
            // Simulate mouseup event
            const mouseUpEvent = new MouseEvent('mouseup', {
                clientX: this.startX, // Use last known position
                clientY: this.startY,
                button: 0, // Assume left click
                 // Include other relevant properties if needed
            });
            this.MouseUpHandler(mouseUpEvent);
        }
        this.canvas.style.cursor = 'default';
    }


    initMouseHandler() {
        this.canvas.addEventListener('mousedown', this.MouseDownHandler);
        this.canvas.addEventListener("mouseup", this.MouseUpHandler);
        this.canvas.addEventListener("mousemove", this.MouseMoveHandler);
         // Add mouseout to reset cursor if needed when mouse leaves the canvas and finalize drawing/moving/resizing
        this.canvas.addEventListener("mouseout", this.MouseOutHandler);
    }
}