import { Tool } from "../components/MainCanvas";
import { DrawingProperties } from "../components/Sidebar";
import { getExistingShapes } from "./http";

type BaseShapeStyle = {
    strokeColor: string;
    strokeWidth: number;
    fillColor: string; // Still relevant for text background or future filled shapes
    opacity: number;
    id: string;
}


type Shape = ({
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
    cornerRadius: number;
} & BaseShapeStyle) | ({
    type: "circle";
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
} & BaseShapeStyle) | ({
    type: "pencil";
    points: { x: number, y: number }[];
} & BaseShapeStyle) | ({ 
    type: "line";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
} & BaseShapeStyle) | ({ 
    type: "arrow";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    arrowheadSize: number; // Size of the arrowhead
} & BaseShapeStyle) | ({ // Added Text Shape Type
    type: "text";
    x: number;
    y: number;
    text: string;
    fontSize: number;
    fontFamily: string;
    color: string; // Text color
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
} & BaseShapeStyle);


type ResizeHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | null;

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
    private selectedTool: Tool = 'select';
    private currentPoints: { x: number, y: number }[] = [];
    private scale = 1;

    private selectedShape: Shape | null = null;
    private isMoving: boolean = false;
    private moveOffsetX: number = 0;
    private moveOffsetY: number = 0;

    private isResizing: boolean = false;
    private resizeHandle: ResizeHandle = null;
    private initialShapeState: Shape | null = null;

    private drawingProperties: DrawingProperties = {
        strokeColor: "#1a1c2c",
        strokeWidth: 2,
        fillColor: "transparent",
        opacity: 1
    };

    private defaultCornerRadius: number = 10;
    private defaultArrowheadSize: number = 15; // Default size for arrowheads
    private defaultFontSize: number = 16; // Default font size for text
    private defaultFontFamily: string = "sans-serif"; // Default font family for text
    private defaultTextColor: string = "#1a1c2c"; // Default text color

    private drawingShapeId: string | null = null;

    // State for text editing
    private isEditingText: boolean = false;
    private textInput: HTMLInputElement | null = null;
    private editingTextShape: (Extract<Shape, { type: 'text' }> & { index: number }) | null = null;


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
         // Add resize listener to update text input position on canvas resize/zoom
        window.addEventListener("resize", this.handleCanvasResize);
    }

    destroy() {
        this.canvas.removeEventListener('mousedown', this.MouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.MouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.MouseMoveHandler);
        this.canvas.removeEventListener("mouseout", this.MouseOutHandler);
        window.removeEventListener("resize", this.handleCanvasResize); // Remove resize listener
        // Clean up text input if it exists
        if (this.textInput && this.textInput.parentElement) {
            this.textInput.parentElement.removeChild(this.textInput);
        }
    }

    setTool(tool: Tool) {
        this.selectedTool = tool;
        this.selectedShape = null;
        this.isMoving = false;
        this.isResizing = false;
        this.resizeHandle = null;
        this.initialShapeState = null;
        this.currentPoints = [];
        this.drawingShapeId = null;
        this.canvas.style.cursor = 'default';
        this.ClearCanvas();
        this.disableTextEditing(); // Disable text editing when tool changes
    }

    setDrawingProperties(props: DrawingProperties): void {
        this.drawingProperties = props;
         // If a text shape is selected, update its properties
        if (this.selectedShape && this.selectedShape.type === 'text') {
             const textShape = this.selectedShape as Extract<Shape, { type: 'text' }>;
             textShape.color = props.strokeColor; // Assuming strokeColor controls text color
             textShape.opacity = props.opacity;
             // Font size and family might be separate properties or derived from strokeWidth
             // Use a reasonable scaling factor or a dedicated font size property in DrawingProperties
             textShape.fontSize = props.strokeWidth * 2 > 8 ? props.strokeWidth * 2 : 8; // Example: scale font size with stroke width, minimum 8px
             // textShape.fontFamily = ... // If you add font family to DrawingProperties

             // Send update over socket
             this.socket.send(JSON.stringify({ type: "updateShape", roomId: this.roomId, shape: JSON.stringify(textShape) }));
             this.ClearCanvas(); // Redraw with updated text properties
             this.updateTextInputPosition(textShape); // Update input position and size
        } else {
            this.ClearCanvas();
        }
    }

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
        ctx.globalAlpha = shape.opacity;
    }

     private applyDrawingStylesForTemporaryDrawing(useFill = false) {
        this.ctx.strokeStyle = this.drawingProperties.strokeColor;
        this.ctx.lineWidth = this.drawingProperties.strokeWidth;
        this.ctx.globalAlpha = this.drawingProperties.opacity;

        if (useFill && this.drawingProperties.fillColor !== "transparent") {
            const { fillColor } = this.drawingProperties;
            const r = parseInt(fillColor.slice(1, 3), 16);
            const g = parseInt(fillColor.slice(3, 5), 16);
            const b = parseInt(fillColor.slice(5, 7), 16);
            this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        } else {
            this.ctx.fillStyle = "transparent";
        }
    }



    clearSlate() {
        this.socket.send(JSON.stringify({ type: "clearslate", roomId: this.roomId }));
        this.existingShapes = [];
        this.selectedShape = null;
        this.currentPoints = [];
        this.drawingShapeId = null;
        this.disableTextEditing(); // Disable text editing on clear
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
                const existingIndex = this.existingShapes.findIndex(s => s.id === parsedShape.id);
                if (existingIndex !== -1) {
                    this.existingShapes[existingIndex] = parsedShape;
                } else {
                    this.existingShapes.push(parsedShape);
                }
                this.ClearCanvas();
            } else if (message.type === "streamingShape") {
                 const parsedShape = JSON.parse(message.shape);
                 const existingIndex = this.existingShapes.findIndex(s => s.id === parsedShape.id);
                 if (existingIndex !== -1) {
                     this.existingShapes[existingIndex] = parsedShape;
                 } else {
                     this.existingShapes.push(parsedShape);
                 }
                 this.ClearCanvas();
            }
            else if (message.type === "clearslate") {
                this.existingShapes = [];
                this.selectedShape = null;
                 this.currentPoints = [];
                 this.drawingShapeId = null;
                 this.disableTextEditing();
                this.ClearCanvas();
            } else if (message.type === "updateShape") {
                const updatedShape = JSON.parse(message.shape);
                const index = this.existingShapes.findIndex(s => s.id === updatedShape.id);
                if (index !== -1) {
                    this.existingShapes[index] = updatedShape;
                    if (this.selectedShape && this.selectedShape.id === updatedShape.id) {
                        this.selectedShape = updatedShape;
                         // If the updated shape is the one being edited, update the text input value and position
                         if (this.isEditingText && this.editingTextShape && this.editingTextShape.id === updatedShape.id && updatedShape.type === 'text') {
                            this.textInput!.value = updatedShape.text;
                            this.editingTextShape.text = updatedShape.text; // Also update the local editing shape object
                            this.updateTextInputPosition(updatedShape);
                         }
                    }
                    this.ClearCanvas();
                }
            } else if (message.type === "eraseShape") {
                 const shapeToErase: Shape = JSON.parse(message.shape);
                 if (shapeToErase) {
                     this.existingShapes = this.existingShapes.filter(shape => shape.id !== shapeToErase.id);
                      if (this.selectedShape && this.selectedShape.id === shapeToErase.id) {
                         this.selectedShape = null;
                         this.disableTextEditing(); // Disable text editing if the edited shape is erased
                     }
                     this.ClearCanvas();
                 }
            }
        };
    }

    ClearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();


        for (const shape of this.existingShapes) {
            const isSelected = this.selectedShape && shape.id === this.selectedShape.id;

            this.applyShapeStyles(this.ctx, shape);

            if (shape.type === "rect") {
                this.ctx.beginPath();
                this.ctx.roundRect(shape.x, shape.y, shape.width, shape.height, shape.cornerRadius);
                this.ctx.stroke();
                if (this.ctx.fillStyle !== 'transparent') {
                    this.ctx.fill();
                }
            } else if (shape.type === "circle") {
                this.ctx.beginPath();
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
            } else if (shape.type === "line") {
                this.ctx.beginPath();
                this.ctx.moveTo(shape.x1, shape.y1);
                this.ctx.lineTo(shape.x2, shape.y2);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (shape.type === "arrow") {
                this.ctx.beginPath();
                this.ctx.moveTo(shape.x1, shape.y1);
                this.ctx.lineTo(shape.x2, shape.y2);
                this.ctx.stroke();

                const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
                const arrowheadSize = shape.arrowheadSize;

                this.ctx.save();
                this.ctx.translate(shape.x2, shape.y2);
                this.ctx.rotate(angle);
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(-arrowheadSize, arrowheadSize / 2);
                this.ctx.lineTo(-arrowheadSize, -arrowheadSize / 2);
                this.ctx.closePath();
                this.ctx.fillStyle = shape.strokeColor;
                this.ctx.fill();
                this.ctx.restore();
            } else if (shape.type === "text") {
                 // Only draw text on canvas if not currently editing it
                 if (!(this.isEditingText && this.editingTextShape && this.editingTextShape.id === shape.id)) {
                     this.ctx.font = `${shape.fontSize}px ${shape.fontFamily}`;
                     this.ctx.fillStyle = shape.color;
                     this.ctx.globalAlpha = shape.opacity;
                     this.ctx.textAlign = shape.textAlign;
                     this.ctx.textBaseline = shape.textBaseline;
                     this.ctx.fillText(shape.text, shape.x, shape.y);
                 }
            }


            if (isSelected) {
                this.drawSelectionBox(shape);
            }
        }
        this.ctx.restore();

        this.applyDrawingStylesForTemporaryDrawing();
    }

    private getShapeBoundingBox(shape: Shape): { x: number, y: number, width: number, height: number } {
        if (shape.type === "rect") {
            const x = Math.min(shape.x, shape.x + shape.width);
            const y = Math.min(shape.y, shape.y + shape.height);
            const width = Math.abs(shape.width);
            const height = Math.abs(shape.height);
             return { x, y, width, height };
        } else if (shape.type === "circle") {
            return { x: shape.centerX - Math.abs(shape.radiusX), y: shape.centerY - Math.abs(shape.radiusY), width: Math.abs(shape.radiusX) * 2, height: Math.abs(shape.radiusY) * 2 };
        } else if (shape.type === "pencil") {
            const points = shape.points;
            if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
            const minX = Math.min(...points.map(p => p.x));
            const maxX = Math.max(...points.map(p => p.x));
            const minY = Math.min(...points.map(p => p.y));
            const maxY = Math.max(...points.map(p => p.y));
            const padding = 10;
             return { x: minX - padding, y: minY - padding, width: (maxX - minX) + 2 * padding, height: (maxY - minY) + 2 * padding };
        } else if (shape.type === "line" || shape.type === "arrow") {
             const x = Math.min(shape.x1, shape.x2);
             const y = Math.min(shape.y1, shape.y2);
             const width = Math.abs(shape.x2 - shape.x1);
             const height = Math.abs(shape.y2 - shape.y1);
             const padding = shape.strokeWidth + 5;
             return { x: x - padding, y: y - padding, width: width + 2 * padding, height: height + 2 * padding };
        } else if (shape.type === "text") {
             // Temporarily set font to get accurate metrics
             this.ctx.save();
             this.ctx.font = `${shape.fontSize}px ${shape.fontFamily}`;
             const metrics = this.ctx.measureText(shape.text);
             this.ctx.restore(); // Restore context

             const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
             let x = shape.x;
             let y = shape.y;
             let width = metrics.width;
             let height = actualHeight;

             if (shape.textAlign === 'center') {
                 x -= width / 2;
             } else if (shape.textAlign === 'right' || shape.textAlign === 'end') {
                 x -= width;
             }

             if (shape.textBaseline === 'middle') {
                 y -= actualHeight / 2;
             } else if (shape.textBaseline === 'bottom' || shape.textBaseline === 'alphabetic' || shape.textBaseline === 'ideographic') {
                 y -= actualHeight;
             }
             const padding = 5;
             return { x: x - padding, y: y - padding, width: width + 2 * padding, height: height + 2 * padding };
        }
        return { x: 0, y: 0, width: 0, height: 0 };
    }

    private getResizeHandleAt(x: number, y: number, shape: Shape): ResizeHandle {
        if (shape.type === 'pencil' || shape.type === 'text') return null;

        const boundingBox = this.getShapeBoundingBox(shape);
        const handleSize = 10;
        const halfHandleSize = handleSize / 2;

        const handles = {
            topLeft: { x: boundingBox.x, y: boundingBox.y },
            topRight: { x: boundingBox.x + boundingBox.width, y: boundingBox.y },
            bottomLeft: { x: boundingBox.x, y: boundingBox.y + boundingBox.height },
            bottomRight: { x: boundingBox.x + boundingBox.width, y: boundingBox.y + boundingBox.height },
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

        this.ctx.strokeRect(x - 5, y - 5, width + 10, height + 10);

        this.ctx.setLineDash([]);

        if (shape.type !== 'pencil' && shape.type !== 'text') {
            const handleSize = 8;
            const halfHandleSize = handleSize / 2;
            this.ctx.fillStyle = "rgba(0,255,255,1)";

            this.ctx.fillRect(x - 5 - halfHandleSize, y - 5 - halfHandleSize, handleSize, handleSize);
            this.ctx.fillRect(x + width + 5 - halfHandleSize, y - 5 - halfHandleSize, handleSize, handleSize);
            this.ctx.fillRect(x - 5 - halfHandleSize, y + height + 5 - halfHandleSize, handleSize, handleSize);
            this.ctx.fillRect(x + width + 5 - halfHandleSize, y + height + 5 - halfHandleSize, handleSize, handleSize);
        }
    }

    isPointInShape(x: number, y: number, shape: Shape): boolean {
        if (shape.type === "rect") {
            const rectX = Math.min(shape.x, shape.x + shape.width);
            const rectY = Math.min(shape.y, shape.y + shape.height);
            const rectWidth = Math.abs(shape.width);
            const rectHeight = Math.abs(shape.height);

            if (x >= rectX && x <= rectX + rectWidth && y >= rectY && y <= rectY + rectHeight) {
                 return true;
            }
            return false;
        } else if (shape.type === "circle") {
            const dx = x - shape.centerX;
            const dy = y - shape.centerY;
            const term1 = (shape.radiusX === 0) ? (dx === 0 ? 0 : Infinity) : (dx * dx) / (shape.radiusX * shape.radiusX);
            const term2 = (shape.radiusY === 0) ? (dy === 0 ? 0 : Infinity) : (dy * dy) / (shape.radiusY * shape.radiusY);

            return term1 + term2 <= 1;

        } else if (shape.type === "pencil") {
            const points = shape.points;
            if (points.length < 2) return false;

            const tolerance = this.drawingProperties.strokeWidth / 2 + 5;

            for (let i = 1; i < points.length; i++) {
                const p1 = points[i - 1];
                const p2 = points[i];
                 //@ts-ignore
                const d = this.pointToLineDistance(x, y, p1, p2);
                if (d <= tolerance) return true;
            }
            return false;
        } else if (shape.type === "line" || shape.type === "arrow") {
             const tolerance = shape.strokeWidth / 2 + 5;
             //@ts-ignore
             const d = this.pointToLineDistance(x, y, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 });
             const boundingBox = this.getShapeBoundingBox(shape);
              if (x >= boundingBox.x && x <= boundingBox.x + boundingBox.width && y >= boundingBox.y && y <= boundingBox.y + boundingBox.height) {
                 return d <= tolerance;
             }
             return false;
        } else if (shape.type === "text") {
             const boundingBox = this.getShapeBoundingBox(shape);
             return x >= boundingBox.x && x <= boundingBox.x + boundingBox.width && y >= boundingBox.y && y <= boundingBox.y + boundingBox.height;
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
        for (let i = this.existingShapes.length - 1; i >= 0; i--) {
            const shape = this.existingShapes[i];
            if (!shape) continue;

            if (this.selectedTool === 'select' && this.selectedShape && this.selectedShape.id === shape.id) {
                const handle = this.getResizeHandleAt(x, y, shape);
                if (handle) {
                    return shape;
                }
            }

            if (this.isPointInShape(x, y, shape)) {
                return shape;
            }
        }
        return null;
    }


    moveSelectedShape(dx: number, dy: number) {
        if (!this.selectedShape) return;

        const shapeToMove = this.existingShapes.find(s => s.id === this.selectedShape!.id);

        if (!shapeToMove) return;

        if (shapeToMove.type === "rect") {
            shapeToMove.x += dx;
            shapeToMove.y += dy;
        } else if (shapeToMove.type === "circle") {
            shapeToMove.centerX += dx;
            shapeToMove.centerY += dy;
        } else if (shapeToMove.type === "pencil") {
            shapeToMove.points = shapeToMove.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        } else if (shapeToMove.type === "line" || shapeToMove.type === "arrow") {
             shapeToMove.x1 += dx;
             shapeToMove.y1 += dy;
             shapeToMove.x2 += dx;
             shapeToMove.y2 += dy;
        } else if (shapeToMove.type === "text") {
             shapeToMove.x += dx;
             shapeToMove.y += dy;
             if (this.isEditingText && this.editingTextShape && this.editingTextShape.id === shapeToMove.id) {
                this.updateTextInputPosition(shapeToMove);
             }
        }

        this.selectedShape = shapeToMove;

        this.socket.send(JSON.stringify({ type: "updateShape", roomId: this.roomId, shape: JSON.stringify(this.selectedShape) }));
        this.ClearCanvas();
    }

    resizeSelectedShape(currentX: number, currentY: number) {
        if (!this.selectedShape || !this.initialShapeState || !this.resizeHandle) return;
        if (this.selectedShape.type === 'pencil' || this.selectedShape.type === 'text') return;


        const shapeToResize = this.existingShapes.find(s => s.id === this.selectedShape!.id);
         if (!shapeToResize) return;

        const dx = currentX - this.startX;
        const dy = currentY - this.startY;


        if (shapeToResize.type === "rect") {
             const initialRectState = this.initialShapeState as Extract<Shape, { type: 'rect' }>;

            const initialBoundingBox = this.getShapeBoundingBox(initialRectState);
            const { x: initialX, y: initialY, width: initialWidth, height: initialHeight } = initialBoundingBox;

            let newX = initialX;
            let newY = initialY;
            let newWidth = initialWidth;
            let newHeight = initialHeight;
            let newCornerRadius = initialRectState.cornerRadius;


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
            }

             const minSize = 5;
             if (Math.abs(newWidth) < minSize && newWidth !== 0) {
                 newWidth = newWidth < 0 ? (newWidth / Math.abs(newWidth)) * minSize : minSize;
             } else if (newWidth === 0) {
                 newWidth = minSize;
             }
             if (Math.abs(newHeight) < minSize && newHeight !== 0) {
                 newHeight = newHeight < 0 ? (newHeight / Math.abs(newHeight)) * minSize : minSize;
             } else if (newHeight === 0) {
                 newHeight = minSize;
             }

             const widthScale = initialWidth !== 0 ? Math.abs(newWidth) / Math.abs(initialWidth) : 1;
             const heightScale = initialHeight !== 0 ? Math.abs(newHeight) / Math.abs(initialHeight) : 1;
             const scale = Math.min(widthScale, heightScale);
             newCornerRadius = initialRectState.cornerRadius * scale;


            shapeToResize.x = newX;
            shapeToResize.y = newY;
            shapeToResize.width = newWidth;
            shapeToResize.height = newHeight;
            shapeToResize.cornerRadius = newCornerRadius;

        } else if (shapeToResize.type === "circle") {
             const initialCircleState = this.initialShapeState as Extract<Shape, { type: 'circle' }>;

            const initialBoundingBox = this.getShapeBoundingBox(initialCircleState);
            const { x: initialX, y: initialY, width: initialWidth, height: initialHeight } = initialBoundingBox;

            let anchorX = initialX;
            let anchorY = initialY;

            switch (this.resizeHandle) {
                 case 'topLeft':
                     anchorX = initialX + initialWidth;
                     anchorY = initialY + initialHeight;
                     break;
                 case 'topRight':
                     anchorX = initialX;
                     anchorY = initialY + initialHeight;
                     break;
                 case 'bottomLeft':
                     anchorX = initialX + initialWidth;
                     anchorY = initialY;
                     break;
                 case 'bottomRight':
                     anchorX = initialX;
                     anchorY = initialY;
                     break;
             }

             const finalX = anchorX;
             const finalY = anchorY;
             const currentDraggedX = this.startX + dx;
             const currentDraggedY = this.startY + dy;

             const newBoundingBoxX = Math.min(finalX, currentDraggedX);
             const newBoundingBoxY = Math.min(finalY, currentDraggedY);
             const newBoundingBoxWidth = Math.abs(finalX - currentDraggedX);
             const newBoundingBoxHeight = Math.abs(finalY - currentDraggedY);

             const minSize = 5;
             const finalWidth = Math.max(minSize, newBoundingBoxWidth);
             const finalHeight = Math.max(minSize, newBoundingBoxHeight);

            shapeToResize.centerX = newBoundingBoxX + finalWidth / 2;
            shapeToResize.centerY = newBoundingBoxY + finalHeight / 2;
            shapeToResize.radiusX = finalWidth / 2;
            shapeToResize.radiusY = finalHeight / 2;


        } else if (shapeToResize.type === "line" || shapeToResize.type === "arrow") {
             const initialLineArrowState = this.initialShapeState as Extract<Shape, { type: 'line' | 'arrow' }>;

             shapeToResize.x2 = initialLineArrowState.x2 + dx;
             shapeToResize.y2 = initialLineArrowState.y2 + dy;
        }

        this.selectedShape = shapeToResize;

        this.socket.send(JSON.stringify({ type: "updateShape", roomId: this.roomId, shape: JSON.stringify(this.selectedShape) }));
        this.ClearCanvas();
    }


    MouseDownHandler = (e: MouseEvent) => {
        this.clicked = true;
        this.startX = e.clientX;
        this.startY = e.clientY;

        if (this.selectedTool === "select") {
             // Disable text editing when clicking anywhere in select mode
             this.disableTextEditing();

            const shape = this.findShapeAt(e.clientX, e.clientY);

            if (this.isResizing) {
                 return;
            }

            if (shape) {
                 // If clicking on a text shape, enable text editing
                if (shape.type === 'text') {
                    this.enableTextEditing(shape, this.existingShapes.indexOf(shape));
                    this.selectedShape = shape;
                     this.ClearCanvas();
                    return;
                }

                const handle = this.getResizeHandleAt(e.clientX, e.clientY, shape);
                if (handle) {
                    this.selectedShape = shape;
                    this.isResizing = true;
                    this.resizeHandle = handle;
                    this.initialShapeState = JSON.parse(JSON.stringify(shape));
                } else {
                    this.selectedShape = shape;
                    this.isMoving = true;
                    if (shape.type === "rect") {
                        this.moveOffsetX = e.clientX - shape.x;
                        this.moveOffsetY = e.clientY - shape.y;
                    } else if (shape.type === "circle") {
                        this.moveOffsetX = e.clientX - shape.centerX;
                        this.moveOffsetY = e.clientY - shape.centerY;
                    } else if (shape.type === "pencil") {
                         const boundingBox = this.getShapeBoundingBox(shape);
                        this.moveOffsetX = e.clientX - boundingBox.x;
                        this.moveOffsetY = e.clientY - boundingBox.y;
                    } else if (shape.type === "line" || shape.type === "arrow") {
                         this.moveOffsetX = e.clientX - shape.x1;
                         this.moveOffsetY = e.clientY - shape.y1;
                    } 
                }
            } else {
                this.selectedShape = null;
                 this.canvas.style.cursor = 'default';
                 this.disableTextEditing();
            }
            this.ClearCanvas();
        } else if (this.selectedTool === "pencil" || this.selectedTool === "eraser") {
            this.currentPoints = [{ x: e.clientX, y: e.clientY }];
             if (this.selectedTool === "pencil") {
                 this.drawingShapeId = crypto.randomUUID();
             }
        } else if (this.selectedTool === "rect" || this.selectedTool === "circle" || this.selectedTool === "line" || this.selectedTool === "arrow") {
             this.ClearCanvas();
             this.applyDrawingStylesForTemporaryDrawing(true);
             this.drawingShapeId = crypto.randomUUID();
        } else if (this.selectedTool === "text") {
             this.disableTextEditing();
             const newTextShape: Extract<Shape, { type: 'text' }> = {
                type: 'text',
                x: e.clientX,
                y: e.clientY,
                text: '',
                fontSize: this.drawingProperties.strokeWidth * 2 > 8 ? this.drawingProperties.strokeWidth * 2 : 8,
                fontFamily: this.defaultFontFamily,
                color: this.drawingProperties.strokeColor || this.defaultTextColor,
                opacity: this.drawingProperties.opacity,
                textAlign: 'left',
                textBaseline: 'top',
                id: crypto.randomUUID(),
                strokeColor: this.drawingProperties.strokeColor,
                strokeWidth: this.drawingProperties.strokeWidth,
                fillColor: 'transparent',
             };
             this.existingShapes.push(newTextShape);
             this.selectedShape = newTextShape;
             this.ClearCanvas();
             this.enableTextEditing(newTextShape, this.existingShapes.length - 1);
        }
    }

    MouseUpHandler = (e: MouseEvent) => {
        this.clicked = false;

        if (this.selectedTool === "select") {
            if (this.isMoving) {
                this.isMoving = false;
                 if(this.selectedShape){
                     this.socket.send(JSON.stringify({ type: "updateShape", roomId: this.roomId, shape: JSON.stringify(this.selectedShape) }));
                 }
            } else if (this.isResizing) {
                this.isResizing = false;
                this.resizeHandle = null;
                this.initialShapeState = null;
                 if(this.selectedShape){
                    this.socket.send(JSON.stringify({ type: "updateShape", roomId: this.roomId, shape: JSON.stringify(this.selectedShape) }));
                 }
            }
             this.canvas.style.cursor = 'default';
            return;
        }

        if (this.selectedTool === "eraser") {
             this.currentPoints = [];
            this.ClearCanvas();
            return;
        }

        if ((this.selectedTool === "rect" || this.selectedTool === "circle" || this.selectedTool === "pencil" || this.selectedTool === "line" || this.selectedTool === "arrow") && this.drawingShapeId) {
            const width = e.clientX - this.startX;
            const height = e.clientY - this.startY;

            let shape: Shape | null = null;
            const newShapeStyle: BaseShapeStyle = {
                strokeColor: this.drawingProperties.strokeColor,
                strokeWidth: this.drawingProperties.strokeWidth,
                fillColor: this.drawingProperties.fillColor,
                opacity: this.drawingProperties.opacity,
                id: this.drawingShapeId || crypto.randomUUID()
            };


            if (this.selectedTool === "pencil") {
                if (this.currentPoints.length < 2) {
                    this.currentPoints = [];
                    this.ClearCanvas();
                    this.drawingShapeId = null;
                    return;
                }
                shape = {
                    type: "pencil",
                    points: [...this.currentPoints],
                    ...newShapeStyle
                };
                this.currentPoints = [];
            } else if (this.selectedTool === "rect") {
                 const x = width > 0 ? this.startX : e.clientX;
                 const y = height > 0 ? this.startY : e.clientY;
                 const w = Math.abs(width);
                 const h = Math.abs(height);

                 if (w > 0 && h > 0) {
                    shape = {
                        type: "rect",
                        x: x,
                        y: y,
                        width: w,
                        height: h,
                         cornerRadius: this.defaultCornerRadius,
                        ...newShapeStyle
                    };
                 }
            } else if (this.selectedTool === "circle") {
                const centerX = this.startX + width / 2;
                const centerY = this.startY + height / 2;
                const radiusX = Math.abs(width) / 2;
                const radiusY = Math.abs(height) / 2;


                if (radiusX > 0 || radiusY > 0) {
                    shape = {
                        type: "circle",
                        centerX,
                        centerY,
                        radiusX,
                        radiusY,
                        ...newShapeStyle
                    };
                }
            } else if (this.selectedTool === "line") {
                 if (Math.abs(width) > 5 || Math.abs(height) > 5) {
                     shape = {
                         type: "line",
                         x1: this.startX,
                         y1: this.startY,
                         x2: e.clientX,
                         y2: e.clientY,
                         ...newShapeStyle
                     };
                 }
            } else if (this.selectedTool === "arrow") {
                 if (Math.abs(width) > 5 || Math.abs(height) > 5) {
                     shape = {
                         type: "arrow",
                         x1: this.startX,
                         y1: this.startY,
                         x2: e.clientX,
                         y2: e.clientY,
                         arrowheadSize: this.defaultArrowheadSize,
                         ...newShapeStyle
                     };
                 }
            }


            if (shape) {
                 const existingIndex = this.existingShapes.findIndex(s => s.id === shape!.id);
                 if (existingIndex !== -1) {
                     this.existingShapes[existingIndex] = shape;
                 } else {
                     this.existingShapes.push(shape);
                 }

                this.socket.send(JSON.stringify({ type: "chat", message: JSON.stringify(shape), roomId: this.roomId }));
                this.ClearCanvas();
            } else {
                this.ClearCanvas();
            }
             this.drawingShapeId = null;
        }
    }

    MouseMoveHandler = (e: MouseEvent) => {
        if (!this.clicked) {
            if (this.selectedTool === 'select') {
                const shapeAtMouse = this.findShapeAt(e.clientX, e.clientY);
                if (this.selectedShape && this.selectedShape.id === shapeAtMouse?.id) {
                    const handle = this.getResizeHandleAt(e.clientX, e.clientY, this.selectedShape);
                    if (handle) {
                        this.setCursorStyle(handle);
                    } else if (this.isPointInShape(e.clientX, e.clientY, this.selectedShape)) {
                         this.canvas.style.cursor = 'move';
                    } else {
                        this.canvas.style.cursor = 'default';
                    }
                } else if (shapeAtMouse && this.selectedTool === 'select') {
                    this.canvas.style.cursor = 'pointer';
                }
                else {
                     this.canvas.style.cursor = 'default';
                }
            } else if (this.selectedTool === 'eraser' || this.selectedTool === 'pencil' || this.selectedTool === 'line' || this.selectedTool === 'arrow') {
                 this.canvas.style.cursor = 'crosshair';
            } else if (this.selectedTool === 'text') {
                 this.canvas.style.cursor = 'text';
            }
            else {
                 this.canvas.style.cursor = 'default';
            }
            return;
        }

        if (this.selectedTool === "select") {
            if (this.isMoving && this.selectedShape) {
                const dx = e.clientX - this.startX;
                const dy = e.clientY - this.startY;
                this.moveSelectedShape(dx, dy);
                this.startX = e.clientX;
                this.startY = e.clientY;
                return;
            } else if (this.isResizing && this.selectedShape && this.initialShapeState && this.resizeHandle) {
                 this.resizeSelectedShape(e.clientX, e.clientY);
                return;
            }
        } else if (this.selectedTool === "eraser") {
             this.currentPoints.push({ x: e.clientX, y: e.clientY });

             const shapeToErase = this.findShapeAt(e.clientX, e.clientY);

             if (shapeToErase) {
                 this.existingShapes = this.existingShapes.filter(shape => shape.id !== shapeToErase.id);
                 if (this.selectedShape && this.selectedShape.id === shapeToErase.id) {
                      this.selectedShape = null;
                      this.disableTextEditing();
                 }
                 this.ClearCanvas();

                 this.socket.send(JSON.stringify({ type: "eraseShape", roomId: this.roomId, shape: JSON.stringify(shapeToErase) }));
             }


             this.ctx.save();
             this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
             this.ctx.lineWidth = this.drawingProperties.strokeWidth + 5;
             this.ctx.lineJoin = "round";
             this.ctx.lineCap = "round";
             this.ctx.beginPath();
             if (this.currentPoints.length > 1) {
                //@ts-ignore
                 this.ctx.moveTo(this.currentPoints[this.currentPoints.length - 2].x, this.currentPoints[this.currentPoints.length - 2].y);
                 //@ts-ignore
                 this.ctx.lineTo(this.currentPoints[this.currentPoints.length - 1].x, this.currentPoints[this.currentPoints.length - 1].y);
             } else if (this.currentPoints.length === 1) {
                  //@ts-ignore
                  this.ctx.arc(this.currentPoints[0].x, this.currentPoints[0].y, this.ctx.lineWidth / 2, 0, 2 * Math.PI);
             }
             this.ctx.stroke();
             this.ctx.restore();
             return;
        }


        if ((this.selectedTool === "rect" || this.selectedTool === "circle" || this.selectedTool === "pencil" || this.selectedTool === "line" || this.selectedTool === "arrow") && this.drawingShapeId) {
             this.ClearCanvas();

            const width = e.clientX - this.startX;
            const height = e.clientY - this.startY;

            this.applyDrawingStylesForTemporaryDrawing(true);

            let currentShape: Shape | null = null;

            if (this.selectedTool === "rect") {
                 const cornerRadius = this.defaultCornerRadius;
                 this.ctx.beginPath();
                this.ctx.roundRect(this.startX, this.startY, width, height, cornerRadius);
                this.ctx.stroke();
                 if (this.ctx.fillStyle !== 'transparent') {
                    this.ctx.fill();
                }
                 currentShape = {
                    type: "rect",
                    x: this.startX,
                    y: this.startY,
                    width: width,
                    height: height,
                    cornerRadius: cornerRadius,
                    strokeColor: this.drawingProperties.strokeColor,
                    strokeWidth: this.drawingProperties.strokeWidth,
                    fillColor: this.drawingProperties.fillColor,
                    opacity: this.drawingProperties.opacity,
                    id: this.drawingShapeId
                 };
            } else if (this.selectedTool === "circle") {
                const centerX = this.startX + width / 2;
                const centerY = this.startY + height / 2;
                const radiusX = Math.abs(width) / 2;
                const radiusY = Math.abs(height) / 2;
                this.ctx.beginPath();
                this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                this.ctx.stroke();
                 if (this.ctx.fillStyle !== 'transparent') {
                    this.ctx.fill();
                }
                this.ctx.closePath();
                 currentShape = {
                    type: "circle",
                    centerX: centerX,
                    centerY: centerY,
                    radiusX: radiusX,
                    radiusY: radiusY,
                    strokeColor: this.drawingProperties.strokeColor,
                    strokeWidth: this.drawingProperties.strokeWidth,
                    fillColor: this.drawingProperties.fillColor,
                    opacity: this.drawingProperties.opacity,
                    id: this.drawingShapeId
                 };
            } else if (this.selectedTool === "pencil") {
                this.currentPoints.push({ x: e.clientX, y: e.clientY });
                this.ctx.strokeStyle = this.drawingProperties.strokeColor;
                this.ctx.lineWidth = this.drawingProperties.strokeWidth;
                this.ctx.lineJoin = "round";
                this.ctx.lineCap = "round";

                this.ctx.beginPath();
                 if (this.currentPoints.length > 1) {
                    //@ts-ignore
                    this.ctx.moveTo(this.currentPoints[this.currentPoints.length - 2].x, this.currentPoints[this.currentPoints.length - 2].y);
                    //@ts-ignore
                    this.ctx.lineTo(this.currentPoints[this.currentPoints.length - 1].x, this.currentPoints[this.currentPoints.length - 1].y);
                 } else if (this.currentPoints.length === 1) {
                    //@ts-ignore
                      this.ctx.arc(this.currentPoints[0].x, this.currentPoints[0].y, this.ctx.lineWidth / 2, 0, 2 * Math.PI);
                 }
                this.ctx.stroke();
                this.ctx.closePath();
                 currentShape = {
                    type: "pencil",
                    points: [...this.currentPoints],
                    strokeColor: this.drawingProperties.strokeColor,
                    strokeWidth: this.drawingProperties.strokeWidth,
                    fillColor: this.drawingProperties.fillColor,
                    opacity: this.drawingProperties.opacity,
                    id: this.drawingShapeId
                 };
            } else if (this.selectedTool === "line") {
                 currentShape = {
                     type: "line",
                     x1: this.startX,
                     y1: this.startY,
                     x2: e.clientX,
                     y2: e.clientY,
                     strokeColor: this.drawingProperties.strokeColor,
                     strokeWidth: this.drawingProperties.strokeWidth,
                     fillColor: this.drawingProperties.fillColor,
                     opacity: this.drawingProperties.opacity,
                     id: this.drawingShapeId
                 };
            } else if (this.selectedTool === "arrow") {
                 currentShape = {
                     type: "arrow",
                     x1: this.startX,
                     y1: this.startY,
                     x2: e.clientX,
                     y2: e.clientY,
                     arrowheadSize: this.defaultArrowheadSize,
                     strokeColor: this.drawingProperties.strokeColor,
                     strokeWidth: this.drawingProperties.strokeWidth,
                     fillColor: this.drawingProperties.fillColor,
                     opacity: this.drawingProperties.opacity,
                     id: this.drawingShapeId
                 };
            }


            if (currentShape) {
                 this.socket.send(JSON.stringify({ type: "streamingShape", roomId: this.roomId, shape: JSON.stringify(currentShape) }));

                 const existingIndex = this.existingShapes.findIndex(s => s.id === currentShape!.id);
                 if (existingIndex !== -1) {
                     this.existingShapes[existingIndex] = currentShape;
                 } else {
                     this.existingShapes.push(currentShape);
                 }
            }
        }
    }

    // --- Text Editing Methods ---
    private enableTextEditing(shape: Extract<Shape, { type: 'text' }>, index: number) {
        if (this.isEditingText) {
            this.disableTextEditing();
        }

        this.isEditingText = true;
        this.editingTextShape = { ...shape, index };

        this.textInput = document.createElement('input');
        this.textInput.type = 'text';
        this.textInput.value = shape.text;
        this.textInput.style.position = 'absolute';
        this.textInput.style.fontSize = `${shape.fontSize}px`;
        this.textInput.style.fontFamily = shape.fontFamily;
        this.textInput.style.color = shape.color;
        this.textInput.style.opacity = shape.opacity.toString();
        this.textInput.style.background = 'transparent';
        this.textInput.style.border = '1px dashed rgba(0, 255, 255, 0.5)';
        this.textInput.style.outline = 'none';
        this.textInput.style.padding = '0';
        this.textInput.style.margin = '0';
        this.textInput.style.lineHeight = 'normal'; // Prevent extra spacing
        this.textInput.style.boxSizing = 'content-box'; // Ensure padding doesn't affect size
        this.textInput.style.zIndex = '100'; // Ensure the input is on top
        this.textInput.style.whiteSpace = 'pre'; // Preserve whitespace for accurate measurement

        // Set initial position and size based on text metrics and scale
        // Append before positioning to ensure offsetWidth/Height are available if needed (though using measureText)
        this.canvas.parentElement?.appendChild(this.textInput);
        this.updateTextInputPosition(shape);


        this.textInput.addEventListener('input', this.handleTextInput);
        this.textInput.addEventListener('blur', this.handleTextBlur);
        this.textInput.addEventListener('keydown', this.handleTextKeydown);


        this.textInput.focus();
    }

    private disableTextEditing() {
        if (this.isEditingText && this.textInput) {
            this.textInput.removeEventListener('input', this.handleTextInput);
            this.textInput.removeEventListener('blur', this.handleTextBlur);
            this.textInput.removeEventListener('keydown', this.handleTextKeydown);

            if (this.textInput.parentElement) {
                this.textInput.parentElement.removeChild(this.textInput);
            }

            this.isEditingText = false;
            this.editingTextShape = null;
            this.textInput = null;
            this.ClearCanvas();
        }
    }

    private handleTextInput = () => {
        if (this.isEditingText && this.editingTextShape && this.textInput) {
            const updatedText = this.textInput.value;
            this.editingTextShape.text = updatedText;

            this.existingShapes[this.editingTextShape.index] = this.editingTextShape;

            this.socket.send(JSON.stringify({ type: "streamingShape", roomId: this.roomId, shape: JSON.stringify(this.editingTextShape) }));

            this.ClearCanvas();
             this.updateTextInputPosition(this.editingTextShape);
        }
    }

    private handleTextBlur = () => {
        if (this.isEditingText && this.editingTextShape) {
             // If the text is empty, remove the shape
             if (this.editingTextShape.text.trim() === '') {
                 this.existingShapes.splice(this.editingTextShape.index, 1);
                 this.socket.send(JSON.stringify({ type: "eraseShape", roomId: this.roomId, shape: JSON.stringify(this.editingTextShape) }));
             } else {
                 // Send the final shape data if text is not empty
                 this.socket.send(JSON.stringify({ type: "chat", message: JSON.stringify(this.editingTextShape), roomId: this.roomId }));
             }
        }
        this.disableTextEditing();
    }

     private handleTextKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.handleTextBlur();
        }
     }

    private handleCanvasResize = () => {
         if (this.isEditingText && this.editingTextShape) {
             const dpr = window.devicePixelRatio || 1;
             const width = window.innerWidth;
             const height = window.innerHeight;
             const canvasWidth = this.canvas.width / dpr;
             const canvasHeight = this.canvas.height / dpr;
             this.updateTextInputPosition(this.editingTextShape);
         }
    }


    private updateTextInputPosition(shape: Extract<Shape, { type: 'text' }>) {
        if (this.textInput) {
             this.ctx.save(); 
             this.ctx.font = `${shape.fontSize}px ${shape.fontFamily}`;
             const metrics = this.ctx.measureText(shape.text);
             this.ctx.restore(); 

             const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

            let offsetX = 0;
            let offsetY = 0;
            if (shape.textAlign === 'center') {
                offsetX = metrics.width / 2;
            } else if (shape.textAlign === 'right' || shape.textAlign === 'end') {
                offsetX = metrics.width;
            }

            if (shape.textBaseline === 'middle') {
                offsetY = actualHeight / 2;
            } else if (shape.textBaseline === 'bottom' || shape.textBaseline === 'alphabetic' || shape.textBaseline === 'ideographic') {
                offsetY = actualHeight;
            }

             // Apply canvas offset and scale to the input position
             const canvasRect = this.canvas.getBoundingClientRect();
             this.textInput.style.left = `${canvasRect.left + (shape.x - offsetX) * this.scale}px`;
             this.textInput.style.top = `${canvasRect.top + (shape.y - offsetY) * this.scale}px`;

             // Apply scale to the input element's size
             // Set input width to match the measured text width
             this.textInput.style.width = `${metrics.width * this.scale}px`;
             // Set input height to match the measured text height
             this.textInput.style.height = `${actualHeight * this.scale}px`;

             // Ensure the input element's transform scale matches the canvas scale
             this.textInput.style.transform = `scale(${this.scale})`;
             this.textInput.style.transformOrigin = 'top left'; // Ensure consistent scaling origin

             const inputPadding = 2;
             this.textInput.style.padding = `${inputPadding}px`;
             this.textInput.style.width = `${(metrics.width + 2 * inputPadding) * this.scale}px`;
             this.textInput.style.height = `${(actualHeight + 2 * inputPadding) * this.scale}px`;
             this.textInput.style.left = `${canvasRect.left + (shape.x - offsetX) * this.scale - inputPadding * this.scale}px`;
             this.textInput.style.top = `${canvasRect.top + (shape.y - offsetY) * this.scale - inputPadding * this.scale}px`;
        }
    }


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
            default:
                this.canvas.style.cursor = 'default';
        }
    }

    private MouseOutHandler = () => {
        if (this.clicked) {
            const mouseUpEvent = new MouseEvent('mouseup', {
                clientX: this.startX,
                clientY: this.startY,
                button: 0,
            });
            this.MouseUpHandler(mouseUpEvent);
        }
         this.canvas.style.cursor = 'default';
    }


    exportSelectedShapeAsSvg(): string | null {
        if (!this.selectedShape) {
            return null;
        }

        const shape = this.selectedShape;
        let svgElement = '';

        const stroke = `stroke="${shape.strokeColor}"`;
        const strokeWidth = `stroke-width="${shape.strokeWidth}"`;
        const fill = shape.fillColor !== 'transparent' ? `fill="${shape.fillColor}"` : 'fill="none"';
        const strokeOpacity = `stroke-opacity="${shape.opacity}"`;
        const fillOpacity = shape.fillColor !== 'transparent' ? `fill-opacity="${shape.opacity}"` : '';


        if (shape.type === "rect") {
            const rx = shape.cornerRadius;
            const ry = shape.cornerRadius;
            svgElement = `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${rx}" ry="${ry}" ${stroke} ${strokeWidth} ${fill} ${strokeOpacity} ${fillOpacity}/>`;
        } else if (shape.type === "circle") {
            svgElement = `<ellipse cx="${shape.centerX}" cy="${shape.centerY}" rx="${Math.abs(shape.radiusX)}" ry="${Math.abs(shape.radiusY)}" ${stroke} ${strokeWidth} ${fill} ${strokeOpacity} ${fillOpacity}/>`;
        } else if (shape.type === "pencil") {
            if (shape.points.length < 1) {
                return null;
            }
            const pathData = shape.points.map((p, index) => {
                if (index === 0) {
                    return `M ${p.x} ${p.y}`;
                } else {
                    return `L ${p.x} ${p.y}`;
                }
            }).join(' ');
            const pencilFill = 'fill="none"';

            svgElement = `<path d="${pathData}" ${stroke} ${strokeWidth} ${pencilFill} ${strokeOpacity}/>`;
        } else if (shape.type === "line") {
             svgElement = `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" ${stroke} ${strokeWidth} ${strokeOpacity}/>`;
        } else if (shape.type === "arrow") {
             const lineSvg = `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" ${stroke} ${strokeWidth} ${strokeOpacity}/>`;

             const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
             const arrowheadSize = shape.arrowheadSize;

             const p1x = shape.x2 + arrowheadSize * Math.cos(angle - Math.PI / 6);
             const p1y = shape.y2 + arrowheadSize * Math.sin(angle - Math.PI / 6);
             const p2x = shape.x2;
             const p2y = shape.y2;
             const p3x = shape.x2 + arrowheadSize * Math.cos(angle + Math.PI / 6);
             const p3y = shape.y2 + arrowheadSize * Math.sin(angle + Math.PI / 6);

             const arrowheadSvg = `<polygon points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}" fill="${shape.strokeColor}" stroke="${shape.strokeColor}" ${strokeOpacity}/>`;

             svgElement = lineSvg + arrowheadSvg;
        } else if (shape.type === "text") {
             let x = shape.x;
             let y = shape.y;
             let textAnchor = 'start';

             if (shape.textAlign === 'center') {
                 textAnchor = 'middle';
             } else if (shape.textAlign === 'right' || shape.textAlign === 'end') {
                 textAnchor = 'end';
             }

             let dominantBaseline = 'text-before-edge';

             if (shape.textBaseline === 'middle') {
                 dominantBaseline = 'middle';
             } else if (shape.textBaseline === 'bottom' || shape.textBaseline === 'alphabetic' || shape.textBaseline === 'ideographic') {
                 dominantBaseline = 'alphabetic';
             }


             svgElement = `<text x="${x}" y="${y}" font-family="${shape.fontFamily}" font-size="${shape.fontSize}" fill="${shape.color}" fill-opacity="${shape.opacity}" text-anchor="${textAnchor}" dominant-baseline="${dominantBaseline}">${shape.text}</text>`;
        }


        return svgElement;
    }


    initMouseHandler() {
        this.canvas.addEventListener('mousedown', this.MouseDownHandler);
        this.canvas.addEventListener("mouseup", this.MouseUpHandler);
        this.canvas.addEventListener("mousemove", this.MouseMoveHandler);
        this.canvas.addEventListener("mouseout", this.MouseOutHandler);
    }
}