// SideBar.tsx
"use client";

import { useState } from "react";
import { 
  AlignJustify, 
  Circle, 
  PanelLeft, 
  Palette, 
  Square, 
  Type,
  ArrowUpDown
} from "lucide-react";
import { IconButton } from "./Iconbutton";

export interface DrawingProperties {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
}

interface SideBarProps {
  properties: DrawingProperties;
  setProperties: (props: DrawingProperties) => void;
  game?: any;
}

export function SideBar({ properties, setProperties, game }: SideBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>("stroke");

  const colors = [
    "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", 
    "#ffcd75", "#a7f070", "#38b764", "#257179", 
    "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", 
    "#f4f4f4", "#94b0c2", "#566c86", "#333c57"
  ];

  const strokeWidths = [1, 2, 4, 6, 8, 12];

  const handleColorSelect = (color: string) => {
    if (activePanel === "stroke") {
      setProperties({ ...properties, strokeColor: color });
    } else if (activePanel === "fill") {
      setProperties({ ...properties, fillColor: color });
    }
  };

  const handleStrokeWidthSelect = (width: number) => {
    setProperties({ ...properties, strokeWidth: width });
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProperties({ ...properties, opacity: parseFloat(e.target.value) });
  };
  function exportSvg(){
    console.log(game?.exportSelectedShapeAsSvg());
    alert(game?.exportSelectedShapeAsSvg());
  }

  return (
    <div 
      className={`fixed left-0 top-20 bottom-10 bg-neutral-800 text-white rounded-r-md flex flex-col transition-all duration-200 ${
        isCollapsed ? "w-12" : "w-64"
      }`}
    >
      {/* Collapse button */}
      <div className="flex justify-end p-2">
        <IconButton
          activated={false}
          icon={<PanelLeft className={`text-white transition-transform ${isCollapsed ? "rotate-180" : ""}`} />}
          onClick={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {!isCollapsed && (
        <div className="flex flex-col h-full p-2 gap-4">
          {/* Tool panels selector */}
          <div className="flex justify-around bg-neutral-900 rounded-md p-2">
            <IconButton
              activated={activePanel === "stroke"}
              icon={<Square className="text-white" size={18} />}
              onClick={() => setActivePanel("stroke")}
              tooltip="Stroke"
            />
            <IconButton
              activated={activePanel === "fill"}
              icon={<Square className="text-white" fill="white" size={18} />}
              onClick={() => setActivePanel("fill")}
              tooltip="Fill"
            />
            <IconButton
              activated={activePanel === "text"}
              icon={<Type className="text-white" size={18} />}
              onClick={() => setActivePanel("text")}
              tooltip="Text"
            />
            <IconButton
              activated={activePanel === "layer"}
              icon={<AlignJustify className="text-white" size={18} />}
              onClick={() => setActivePanel("layer")}
              tooltip="Layers"
            />
          </div>

          {/* Color selector */}
          {(activePanel === "stroke" || activePanel === "fill") && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                {activePanel === "stroke" ? "Stroke Color" : "Fill Color"}
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    className={`w-10 h-10 rounded-md border-2 ${
                      (activePanel === "stroke" && properties.strokeColor === color) || 
                      (activePanel === "fill" && properties.fillColor === color)
                        ? "border-white"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorSelect(color)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Stroke width selector */}
          {activePanel === "stroke" && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Stroke Width</h3>
              <div className="grid grid-cols-3 gap-2">
                {strokeWidths.map((width) => (
                  <button
                    key={width}
                    className={`flex items-center justify-center p-2 rounded-md ${
                      properties.strokeWidth === width
                        ? "bg-neutral-700"
                        : "bg-neutral-900"
                    }`}
                    onClick={() => handleStrokeWidthSelect(width)}
                  >
                    <div 
                      className="bg-white rounded-full" 
                      style={{ 
                        width: Math.min(width * 2, 24),
                        height: Math.min(width * 2, 24)
                      }} 
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opacity slider */}
             <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Opacity</h3>
                    <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={properties.opacity}
                        onChange={handleOpacityChange}
                        className="w-full"
                    />
                    <span className="text-sm">{Math.round(properties.opacity * 100)}%</span>
                </div>
            </div>
            <div>
                <button onClick={exportSvg} >Export SVG</button>
            </div>

          {/* Text options */}   
          {activePanel === "text" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Font Size</h3>
                <input
                  type="range"
                  min="10"
                  max="72"
                  value={properties.fontSize || 16}
                  onChange={e => setProperties({...properties, fontSize: parseInt(e.target.value)})}
                  className="w-full"
                />
                <span className="text-sm">{properties.fontSize || 16}px</span>
              </div>
              
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Font Family</h3>
                <select 
                  className="bg-neutral-900 p-2 rounded-md"
                  value={properties.fontFamily || "Arial"}
                  onChange={e => setProperties({...properties, fontFamily: e.target.value})}
                >
                  <option value="Arial">Arial</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Georgia">Georgia</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vertical icons when collapsed */}
      {isCollapsed && (
        <div className="flex flex-col items-center gap-4 mt-4">
          <IconButton
            activated={activePanel === "stroke"}
            icon={<Circle className="text-white" size={18} />}
            onClick={() => {
              setActivePanel("stroke");
              setIsCollapsed(false);
            }}
          />
          <IconButton
            activated={activePanel === "fill"}
            icon={<Square className="text-white" fill="white" size={18} />}
            onClick={() => {
              setActivePanel("fill");
              setIsCollapsed(false);
            }}
          />
          <IconButton
            activated={activePanel === "text"}
            icon={<Type className="text-white" size={18} />}
            onClick={() => {
              setActivePanel("text");
              setIsCollapsed(false);
            }}
          />
          <IconButton
            activated={activePanel === "layer"}
            icon={<AlignJustify className="text-white" size={18} />}
            onClick={() => {
              setActivePanel("layer");
              setIsCollapsed(false);
            }}
          />
        </div>
      )}
    </div>
  );
}