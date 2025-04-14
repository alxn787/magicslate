"use client";

import { useEffect, useRef, useState } from "react";
import { IconButton } from "./Iconbutton";
import { Circle, Pencil, RectangleHorizontal, ZoomIn, ZoomOut } from "lucide-react";
import { Game } from "../draw/game";

export type Tool = "circle" | "rect" | "pencil" | "zoomIn" | "zoomOut";

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
  const [selectedTool, setSelectedTool] = useState<Tool>("circle");

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
  }, [canvasRef]);

  useEffect(() => {
    if (game) {
      game.setTool(selectedTool);
    }
  }, [selectedTool, game]);

  return (
    <div className="bg-black">
      <canvas ref={canvasRef} />
      <TopBar selectedTool={selectedTool} setSelectedTool={setSelectedTool} />
    </div>
  );
}

function TopBar({
  selectedTool,
  setSelectedTool,
}: {
  selectedTool: Tool;
  setSelectedTool: (s: Tool) => void;
}) {
  return (
    <div className="flex justify-start gap-2 fixed top-10 left-10 z-10">
      <IconButton
        activated={selectedTool === "pencil"}
        icon={<Pencil className="text-white" />}
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
        activated={selectedTool === "zoomIn"}
        icon={<ZoomIn className="text-white" />}
        onClick={() => setSelectedTool("zoomIn")}
      />
      <IconButton
        activated={selectedTool === "zoomOut"}
        icon={<ZoomOut className="text-white" />}
        onClick={() => setSelectedTool("zoomOut")}
        />
    </div>
  );
}
