import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Tarea {
  id: number;
  descripcion_tarea: string;
  estado: string;
  fecha_limite: string;
  proyecto_id: number;
}

export default function TaskInterface() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [descripcion_tarea, setDescripcionTarea] = useState("");
  const [estado, setEstado] = useState("Pendiente");
  const [fecha_limite, setFechaLimite] = useState("");
  const [proyecto_id, setProyectoId] = useState<number>(1);
  const [editando, setEditando] = useState<Tarea | null>(null);

  const API_URL = "http://localhost:8000/api/go/tareas";

  const fetchTareas = async () => {
    const res = await fetch(API_URL);
    const data = await res.json();
    setTareas(data);
  };

  useEffect(() => {
    fetchTareas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = { descripcion_tarea, estado, fecha_limite, proyecto_id };

    if (editando) {
      await fetch(`${API_URL}/${editando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setEditando(null);
    } else {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    setDescripcionTarea("");
    setFechaLimite("");
    fetchTareas();
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    fetchTareas();
  };

  const handleEdit = (tarea: Tarea) => {
    setEditando(tarea);
    setDescripcionTarea(tarea.descripcion_tarea);
    setEstado(tarea.estado);
    setFechaLimite(tarea.fecha_limite);
    setProyectoId(tarea.proyecto_id);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Gestión de Tareas</h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Descripción de la tarea"
          value={descripcion_tarea}
          onChange={(e) => setDescripcionTarea(e.target.value)}
          required
        />
        <Input
          type="date"
          value={fecha_limite}
          onChange={(e) => setFechaLimite(e.target.value)}
        />
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Pendiente">Pendiente</SelectItem>
            <SelectItem value="En Progreso">En Progreso</SelectItem>
            <SelectItem value="Completada">Completada</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="ID del proyecto"
          value={proyecto_id}
          onChange={(e) => setProyectoId(parseInt(e.target.value))}
        />

        <Button type="submit" className="w-full">
          {editando ? "Actualizar Tarea" : "Crear Tarea"}
        </Button>
      </form>

      <div className="grid md:grid-cols-2 gap-4">
        {tareas.map((t) => (
          <Card key={t.id} className="shadow-md">
            <CardContent className="p-4 space-y-2">
              <h2 className="font-semibold text-lg">{t.descripcion_tarea}</h2>
              <p className="text-sm text-gray-600">Estado: {t.estado}</p>
              <p className="text-xs text-gray-400">
                Fecha límite: {t.fecha_limite
                  ? new Date(t.fecha_limite).toLocaleDateString()
                  : "Sin definir"}
              </p>
              <p className="text-xs text-gray-500">Proyecto ID: {t.proyecto_id}</p>

              <div className="flex justify-between mt-3">
                <Button variant="secondary" onClick={() => handleEdit(t)}>
                  Editar
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(t.id)}>
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
