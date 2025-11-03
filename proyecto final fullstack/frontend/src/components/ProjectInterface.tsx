import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Proyecto {
  id: number;
  nombre: string;
  descripcion: string;
  fecha_creacion: string;
}

export default function ProjectInterface() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [editando, setEditando] = useState<Proyecto | null>(null);

  const API_URL = "http://localhost:8000/api/go/proyectos";

  // Cargar proyectos
  const fetchProyectos = async () => {
    const res = await fetch(API_URL);
    const data = await res.json();
    setProyectos(data);
  };

  useEffect(() => {
    fetchProyectos();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = { nombre, descripcion };

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

    setNombre("");
    setDescripcion("");
    fetchProyectos();
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    fetchProyectos();
  };

  const handleEdit = (proyecto: Proyecto) => {
    setEditando(proyecto);
    setNombre(proyecto.nombre);
    setDescripcion(proyecto.descripcion);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Gestión de Proyectos</h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Nombre del proyecto"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <Textarea
          placeholder="Descripción del proyecto"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
        <Button type="submit" className="w-full">
          {editando ? "Actualizar Proyecto" : "Crear Proyecto"}
        </Button>
      </form>

      <div className="grid md:grid-cols-2 gap-4">
        {proyectos.map((p) => (
          <Card key={p.id} className="shadow-md">
            <CardContent className="p-4 space-y-2">
              <h2 className="font-semibold text-lg">{p.nombre}</h2>
              <p className="text-sm text-gray-600">{p.descripcion}</p>
              <p className="text-xs text-gray-400">
                Creado el {new Date(p.fecha_creacion).toLocaleDateString()}
              </p>

              <div className="flex justify-between mt-3">
                <Button variant="secondary" onClick={() => handleEdit(p)}>
                  Editar
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(p.id)}>
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
