import React, { useState } from "react";
import ProjectInterface from "./components/ProjectInterface";
import TaskInterface from "./components/TaskInterface";
import { Button } from "@/components/ui/button";

export default function App() {
  const [view, setView] = useState<"proyectos" | "tareas">("proyectos");

  return (
    <div className="p-6">
      <div className="flex gap-4 mb-6">
        <Button
          onClick={() => setView("proyectos")}
          variant={view === "proyectos" ? "default" : "outline"}
        >
          Proyectos
        </Button>
        <Button
          onClick={() => setView("tareas")}
          variant={view === "tareas" ? "default" : "outline"}
        >
          Tareas
        </Button>
      </div>

      {view === "proyectos" ? <ProjectInterface /> : <TaskInterface />}
    </div>
  );
}
