"use client";

import { useEffect, useRef, useState } from "react";
import { IconButton } from "./Iconbutton";
import { Circle, EraserIcon, MouseIcon, MousePointerIcon, Pencil, Pointer, RectangleHorizontal, TextCursor, Trash, ZoomIn, ZoomOut, ArrowRight, LineChart, PenLine, PenLineIcon, ChartLine, Minus, LetterText } from "lucide-react"; // Import new icons
import { Game } from "../draw/game";
import { SideBar, DrawingProperties } from "./Sidebar";

export type Tool = "circle" | "rect" | "pencil" | "zoomIn" | "zoomOut" | "select" | "eraser" | "arrow" | "text" | "line" ;

export default function MainCanvas({
  roomId,
  token,
  socket,
}: {
  roomId: string;
  token: string;
  socket: WebSocket;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game>();
  const [selectedTool, setSelectedTool] = useState<Tool>("select");
  const [drawingProperties, setDrawingProperties] = useState<DrawingProperties>({
    strokeColor: "#1a1c2c",
    strokeWidth: 2,
    fillColor: "transparent",
    opacity: 1
  });

  // Resize canvas properly to avoid zoom issue
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const g = new Game(canvas, roomId, token, socket);
      setGame(g);

      return () => {
        g.destroy();
      };
    }
  }, [canvasRef, roomId, token, socket]);

  useEffect(() => {
    if (game) {
      game.setTool(selectedTool);
    }
  }, [selectedTool, game]);


  useEffect(() => {
    if (game) {
      game.setDrawingProperties(drawingProperties);
    }
  }, [drawingProperties, game]);

  return (
    // Added 'relative' class here to position the parent div
    <div className="bg-white absolute">
      <canvas ref={canvasRef} />
      <TopBar
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        game={game}
      />
      <SideBar
        properties={drawingProperties}
        setProperties={setDrawingProperties}
        game={game}
      />
    </div>
  );
}

function TopBar({
  selectedTool,
  setSelectedTool,
  game
}: {
  selectedTool: Tool;
  setSelectedTool: (s: Tool) => void;
  game: Game | undefined;
}) {
  return (
    <div className="flex justify-center gap-2 fixed top-5 left-0 right-0 p-2">
      <div className="bg-neutral-800 flex justify-center gap-2 fixed top-5 p-1 rounded-md text-xs ">
        <IconButton
          activated={selectedTool === "select"}
          icon={<MousePointerIcon className="text-white" />}
          onClick={() => setSelectedTool("select")}
        />
        <IconButton
          activated={selectedTool === "pencil"}
          icon={<Pencil className="text-white text-2xl" />}
          onClick={() => setSelectedTool("pencil")}
        />
        <IconButton
          activated={selectedTool === "rect"}
          icon={<RectangleHorizontal className="text-white" />}
          onClick={() => setSelectedTool("rect")}
        />
        <IconButton
          activated={selectedTool === "circle"}
          icon={<Circle className="text-white" />}
          onClick={() => setSelectedTool("circle")}
        />
        <IconButton
          activated={selectedTool === "line"}
          icon={<Minus className="text-white" />} 
          onClick={() => setSelectedTool("line")}
        />
         <IconButton
          activated={selectedTool === "arrow"} 
          icon={<ArrowRight className="text-white" />} 
          onClick={() => setSelectedTool("arrow")}
        />
         <IconButton
          activated={selectedTool === "text"} 
          icon={<LetterText className="text-white" />} 
          onClick={() => setSelectedTool("text")}
        />
        <IconButton
          activated={selectedTool === "eraser"}
          icon={<EraserIcon className="text-white" />}
          onClick={() => setSelectedTool("eraser")}
        />
        <IconButton
          activated={false} 
          icon={<Trash className="text-white" />}
          onClick={() => game?.clearSlate()}
        />

      </div>
    </div>
  );
}
