"use client";
import { useContext, useCallback } from "react";
import { ViewerContext } from "../features/vrmViewer/viewerContext";

export default function VrmViewer() {
  const { viewer } = useContext(ViewerContext);

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (canvas) {
        viewer.setup(canvas);
        // VRMファイルは後ほど追加予定
        // viewer.loadVrm("/your-character.vrm");

        // Drag & Drop でVRMを差し替え
        canvas.addEventListener("dragover", (event) => {
          event.preventDefault();
        });
        canvas.addEventListener("drop", (event) => {
          event.preventDefault();
          const files = event.dataTransfer?.files;
          if (!files) return;
          const file = files[0];
          if (!file) return;
          const ext = file.name.split(".").pop();
          if (ext === "vrm") {
            const blob = new Blob([file], { type: "application/octet-stream" });
            const url = window.URL.createObjectURL(blob);
            viewer.loadVrm(url);
          }
        });
      }
    },
    [viewer]
  );

  return (
    <div className="absolute top-0 left-0 w-full h-full -z-10">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
