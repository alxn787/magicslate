// IconButton.tsx
import { ReactNode } from "react";

interface IconButtonProps {
  icon: ReactNode;
  onClick: () => void;
  activated: boolean;
  tooltip?: string;
}

export function IconButton({ icon, onClick, activated, tooltip }: IconButtonProps) {
  return (
    <div className="relative group">
      <button
        className={`p-2 rounded-md transition-colors ${
          activated ? "bg-blue-600" : "bg-neutral-900 hover:bg-neutral-700"
        }`}
        onClick={onClick}
      >
        {icon}
      </button>
      
      {tooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-neutral-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {tooltip}
        </div>
      )}
    </div>
  );
}