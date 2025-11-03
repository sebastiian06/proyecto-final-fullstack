'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

// --- Interfaces y Tipos ---
interface Proyecto {
  id: number;
  nombre: string;
  descripcion: string;
  fecha_creacion: string;
}

interface Tarea {
  id: number;
  descripcion_tarea: string;
  estado: string;
  fecha_limite: string;
  proyecto_id: number;
  proyecto_nombre?: string;
}

type NewProyectoInput = Omit<Proyecto, 'id' | 'fecha_creacion'>;
type NewTareaInput = Omit<Tarea, 'id' | 'proyecto_nombre'>;

interface ProyectoInterfaceProps {
  backendName: string;
}

// --- Componente de Tarjeta para Proyecto ---
const ProyectoCard = ({ proyecto }: { proyecto: Proyecto }) => (
  <div className="grow">
    <p className="text-sm text-gray-500">ID: {proyecto.id}</p>
    <p className="text-lg font-semibold text-gray-800">{proyecto.nombre}</p>
    <p className="text-md text-gray-600">{proyecto.descripcion}</p>
    <p className="text-xs text-gray-400">
      Creado: {new Date(proyecto.fecha_creacion).toLocaleDateString()}
    </p>
  </div>
);

// --- Componente de Tarjeta para Tarea ---
const TareaCard = ({ tarea, proyectos }: { tarea: Tarea; proyectos: Proyecto[] }) => {
  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Completada': return 'bg-green-100 text-green-800';
      case 'En Progreso': return 'bg-yellow-100 text-yellow-800';
      case 'Pendiente': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProyectoNombre = (proyectoId: number) => {
    const proyecto = proyectos.find(p => p.id === proyectoId);
    return proyecto ? proyecto.nombre : 'Proyecto no encontrado';
  };

  return (
    <div className="grow">
      <p className="text-sm text-gray-500">ID: {tarea.id}</p>
      <p className="text-md font-medium text-gray-800">{tarea.descripcion_tarea}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-xs px-2 py-1 rounded-full ${getEstadoColor(tarea.estado)}`}>
          {tarea.estado}
        </span>
        <span className="text-xs text-gray-500">
          Vence: {new Date(tarea.fecha_limite).toLocaleDateString()}
        </span>
      </div>
      <p className="text-xs text-blue-600 mt-1">
        Proyecto: {getProyectoNombre(tarea.proyecto_id)}
      </p>
    </div>
  );
};

// --- Componente Principal ---
const ProyectoInterface: React.FC<ProyectoInterfaceProps> = ({ backendName }) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const colorThemes: { [key: string]: { bg: string; btn: string } } = {
    go: { bg: 'bg-cyan-50', btn: 'bg-cyan-700 hover:bg-cyan-600' },
    rust: { bg: 'bg-orange-50', btn: 'bg-orange-600 hover:bg-orange-500' },
    node: { bg: 'bg-green-50', btn: 'bg-green-600 hover:bg-green-500' },
  };

  const theme = colorThemes[backendName] || { bg: 'bg-gray-100', btn: 'bg-gray-500 hover:bg-gray-400' };

  // --- Estados del Componente ---
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [newProyecto, setNewProyecto] = useState<NewProyectoInput>({ nombre: '', descripcion: '' });
  const [newTarea, setNewTarea] = useState<NewTareaInput>({ 
    descripcion_tarea: '', 
    estado: 'Pendiente', 
    fecha_limite: '', 
    proyecto_id: 0 
  });
  const [proyectoToUpdate, setProyectoToUpdate] = useState<Proyecto | null>(null);
  const [tareaToUpdate, setTareaToUpdate] = useState<Tarea | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'proyectos' | 'tareas'>('proyectos');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Efectos (Fetching de Datos) ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [proyectosRes, tareasRes] = await Promise.all([
          axios.get(`${apiUrl}/api/${backendName}/proyectos`),
          axios.get(`${apiUrl}/api/${backendName}/tareas`)
        ]);
        setProyectos(proyectosRes.data);
        setTareas(tareasRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        setProyectos([]);
        setTareas([]);
        setFormError('Error al cargar los datos. Verifica que el backend esté funcionando.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [backendName, apiUrl]);

  // --- Funciones de Utilidad ---
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleApiError = (error: any, defaultMessage: string) => {
    console.error('API Error:', error);
    if (error.response?.data) {
      setFormError(error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      setFormError('No se puede conectar al servidor. Verifica que el backend esté ejecutándose.');
    } else {
      setFormError(defaultMessage);
    }
  };

  // --- Funciones CRUD para Proyectos ---
  const createProyecto = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newProyecto.nombre.trim()) {
      setFormError('El nombre del proyecto es obligatorio.');
      return;
    }
    
    setFormError(null);
    try {
      const response = await axios.post(`${apiUrl}/api/${backendName}/proyectos`, {
        nombre: newProyecto.nombre.trim(),
        descripcion: newProyecto.descripcion.trim()
      });
      setProyectos([response.data, ...proyectos]);
      setNewProyecto({ nombre: '', descripcion: '' });
      showSuccess('Proyecto creado exitosamente!');
    } catch (error: any) {
      handleApiError(error, 'Ocurrió un error al crear el proyecto.');
    }
  };

  const handleUpdateProyecto = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!proyectoToUpdate) return;

    try {
      const response = await axios.put(`${apiUrl}/api/${backendName}/proyectos/${proyectoToUpdate.id}`, {
        nombre: proyectoToUpdate.nombre,
        descripcion: proyectoToUpdate.descripcion,
      });
      setProyectos(proyectos.map(proj => 
        proj.id === proyectoToUpdate.id ? response.data : proj
      ));
      setProyectoToUpdate(null);
      showSuccess('Proyecto actualizado exitosamente!');
    } catch (error: any) {
      handleApiError(error, 'Ocurrió un error al actualizar el proyecto.');
    }
  };

  const deleteProyecto = async (proyectoId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este proyecto? También se eliminarán todas sus tareas.')) {
      return;
    }

    try {
      await axios.delete(`${apiUrl}/api/${backendName}/proyectos/${proyectoId}`);
      setProyectos(proyectos.filter(proj => proj.id !== proyectoId));
      setTareas(tareas.filter(tarea => tarea.proyecto_id !== proyectoId));
      showSuccess('Proyecto eliminado exitosamente!');
    } catch (error: any) {
      handleApiError(error, 'Ocurrió un error al eliminar el proyecto.');
    }
  };

  // --- Funciones CRUD para Tareas ---
  const createTarea = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validaciones mejoradas
    if (!newTarea.descripcion_tarea.trim()) {
      setFormError('La descripción de la tarea es obligatoria.');
      return;
    }
    
    if (!newTarea.proyecto_id) {
      setFormError('Debes seleccionar un proyecto.');
      return;
    }
    
    if (!newTarea.fecha_limite) {
      setFormError('La fecha límite es obligatoria.');
      return;
    }

    setFormError(null);
    
    try {
      // Asegurarnos de que proyecto_id es un número
      const tareaData = {
        descripcion_tarea: newTarea.descripcion_tarea.trim(),
        estado: newTarea.estado,
        fecha_limite: newTarea.fecha_limite,
        proyecto_id: Number(newTarea.proyecto_id) // Convertir explícitamente a número
      };

      console.log('Enviando datos de tarea:', tareaData); // Para debugging

      const response = await axios.post(`${apiUrl}/api/${backendName}/tareas`, tareaData);
      
      setTareas([response.data, ...tareas]);
      setNewTarea({ 
        descripcion_tarea: '', 
        estado: 'Pendiente', 
        fecha_limite: '', 
        proyecto_id: 0 
      });
      showSuccess('Tarea creada exitosamente!');
    } catch (error: any) {
      if (error.response?.status === 400) {
        setFormError(error.response.data || 'Error en los datos de la tarea.');
      } else {
        handleApiError(error, 'Ocurrió un error al crear la tarea.');
      }
    }
  };

  const handleUpdateTarea = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tareaToUpdate) return;

    try {
      // Asegurarnos de que proyecto_id es un número
      const tareaData = {
        descripcion_tarea: tareaToUpdate.descripcion_tarea,
        estado: tareaToUpdate.estado,
        fecha_limite: tareaToUpdate.fecha_limite,
        proyecto_id: Number(tareaToUpdate.proyecto_id) // Convertir explícitamente a número
      };

      const response = await axios.put(`${apiUrl}/api/${backendName}/tareas/${tareaToUpdate.id}`, tareaData);
      setTareas(tareas.map(tarea => 
        tarea.id === tareaToUpdate.id ? response.data : tarea
      ));
      setTareaToUpdate(null);
      showSuccess('Tarea actualizada exitosamente!');
    } catch (error: any) {
      handleApiError(error, 'Ocurrió un error al actualizar la tarea.');
    }
  };

  const deleteTarea = async (tareaId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      return;
    }

    try {
      await axios.delete(`${apiUrl}/api/${backendName}/tareas/${tareaId}`);
      setTareas(tareas.filter(tarea => tarea.id !== tareaId));
      showSuccess('Tarea eliminada exitosamente!');
    } catch (error: any) {
      handleApiError(error, 'Ocurrió un error al eliminar la tarea.');
    }
  };

  // --- Manejadores de Cambios CORREGIDOS ---
  const handleNewProyectoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewProyecto({ ...newProyecto, [e.target.name]: e.target.value });
    if (formError) setFormError(null);
  };

  const handleUpdateProyectoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (proyectoToUpdate) {
      setProyectoToUpdate({ ...proyectoToUpdate, [e.target.name]: e.target.value });
      if (formError) setFormError(null);
    }
  };

  const handleNewTareaChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'proyecto_id') {
      // Convertir explícitamente a número
      setNewTarea({ ...newTarea, [name]: parseInt(value) || 0 });
    } else {
      setNewTarea({ ...newTarea, [name]: value });
    }
    
    if (formError) setFormError(null);
  };

  const handleUpdateTareaChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (tareaToUpdate) {
      const { name, value } = e.target;
      
      if (name === 'proyecto_id') {
        // Convertir explícitamente a número
        setTareaToUpdate({ ...tareaToUpdate, [name]: parseInt(value) || 0 });
      } else {
        setTareaToUpdate({ ...tareaToUpdate, [name]: value });
      }
      
      if (formError) setFormError(null);
    }
  };

  // --- Renderizado del Componente ---
  return (
    <div className={`w-full max-w-4xl p-6 my-4 rounded-lg shadow-lg ${theme.bg}`}>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
          <span className="text-2xl font-bold text-gray-600">
            {backendName.charAt(0).toUpperCase()}
          </span>
        </div>
        <h2 className="text-3xl font-bold text-gray-800">
          {`${backendName.charAt(0).toUpperCase() + backendName.slice(1)} - Gestor de Proyectos`}
        </h2>
      </div>

      {/* Mensajes de éxito */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Navegación por Tabs */}
      <div className="flex mb-6 border-b">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'proyectos'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('proyectos')}
        >
          Proyectos ({proyectos.length})
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'tareas'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('tareas')}
        >
          Tareas ({tareas.length})
        </button>
      </div>

      {/* Formularios y Listas según Tab Activo */}
      {activeTab === 'proyectos' ? (
        <>
          {/* Formulario de Proyectos */}
          {proyectoToUpdate ? (
            <form onSubmit={handleUpdateProyecto} className="mb-6 p-4 bg-white rounded-lg shadow-md">
              <h3 className="font-bold mb-2">Editando Proyecto (ID: {proyectoToUpdate.id})</h3>
              {formError && (
                <div className="mb-2 p-2 text-sm text-red-700 bg-red-100 rounded-lg">
                  {formError}
                </div>
              )}
              <input
                name="nombre"
                placeholder="Nombre del Proyecto"
                value={proyectoToUpdate.nombre}
                onChange={handleUpdateProyectoChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
                required
              />
              <textarea
                name="descripcion"
                placeholder="Descripción"
                value={proyectoToUpdate.descripcion}
                onChange={handleUpdateProyectoChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
                rows={3}
              />
              <div className="flex gap-2">
                <button type="submit" className="grow p-2 text-white bg-green-500 rounded hover:bg-green-600">
                  Guardar Cambios
                </button>
                <button type="button" onClick={() => setProyectoToUpdate(null)} className="p-2 text-white bg-gray-400 rounded hover:bg-gray-500">
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={createProyecto} className="mb-6 p-4 bg-white rounded-lg shadow-md">
              <h3 className="font-bold mb-2">Crear Nuevo Proyecto</h3>
              {formError && (
                <div className="mb-2 p-2 text-sm text-red-700 bg-red-100 rounded-lg">
                  {formError}
                </div>
              )}
              <input
                name="nombre"
                placeholder="Nombre del Proyecto *"
                value={newProyecto.nombre}
                onChange={handleNewProyectoChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
                required
              />
              <textarea
                name="descripcion"
                placeholder="Descripción"
                value={newProyecto.descripcion}
                onChange={handleNewProyectoChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
                rows={3}
              />
              <button type="submit" className={`w-full p-2 text-white rounded transition-colors ${theme.btn}`}>
                Crear Proyecto
              </button>
            </form>
          )}

          {/* Lista de Proyectos */}
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center text-gray-500">Cargando proyectos...</p>
            ) : proyectos.length > 0 ? (
              proyectos.map((proyecto) => (
                <div key={proyecto.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                  <ProyectoCard proyecto={proyecto} />
                  <div className="flex gap-2 ml-4">
                    <button 
                      onClick={() => setProyectoToUpdate(proyecto)} 
                      className="text-white py-1 px-3 rounded bg-yellow-500 hover:bg-yellow-600"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => deleteProyecto(proyecto.id)} 
                      className="text-white py-1 px-3 rounded bg-red-500 hover:bg-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500">No se encontraron proyectos. Crea el primero!</p>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Formulario de Tareas */}
          {tareaToUpdate ? (
            <form onSubmit={handleUpdateTarea} className="mb-6 p-4 bg-white rounded-lg shadow-md">
              <h3 className="font-bold mb-2">Editando Tarea (ID: {tareaToUpdate.id})</h3>
              {formError && (
                <div className="mb-2 p-2 text-sm text-red-700 bg-red-100 rounded-lg">
                  {formError}
                </div>
              )}
              <textarea
                name="descripcion_tarea"
                placeholder="Descripción de la Tarea *"
                value={tareaToUpdate.descripcion_tarea}
                onChange={handleUpdateTareaChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
                rows={2}
                required
              />
              <select
                name="estado"
                value={tareaToUpdate.estado}
                onChange={handleUpdateTareaChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
              >
                <option value="Pendiente">Pendiente</option>
                <option value="En Progreso">En Progreso</option>
                <option value="Completada">Completada</option>
              </select>
              <input
                name="fecha_limite"
                type="date"
                value={tareaToUpdate.fecha_limite.split('T')[0]}
                onChange={handleUpdateTareaChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
                required
              />
              <select
                name="proyecto_id"
                value={tareaToUpdate.proyecto_id}
                onChange={handleUpdateTareaChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
                required
              >
                <option value={0}>Seleccionar Proyecto *</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.id} value={proyecto.id}>
                    {proyecto.nombre}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button type="submit" className="grow p-2 text-white bg-green-500 rounded hover:bg-green-600">
                  Guardar Cambios
                </button>
                <button type="button" onClick={() => setTareaToUpdate(null)} className="p-2 text-white bg-gray-400 rounded hover:bg-gray-500">
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={createTarea} className="mb-6 p-4 bg-white rounded-lg shadow-md">
              <h3 className="font-bold mb-2">Crear Nueva Tarea</h3>
              {formError && (
                <div className="mb-2 p-2 text-sm text-red-700 bg-red-100 rounded-lg">
                  {formError}
                </div>
              )}
              {proyectos.length === 0 && (
                <div className="mb-2 p-2 text-sm text-orange-700 bg-orange-100 rounded-lg">
                  Para crear una tarea, primero debes crear al menos un proyecto.
                </div>
              )}
              <textarea
                name="descripcion_tarea"
                placeholder="Descripción de la Tarea *"
                value={newTarea.descripcion_tarea}
                onChange={handleNewTareaChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
                rows={2}
                required
                disabled={proyectos.length === 0}
              />
              <select
                name="estado"
                value={newTarea.estado}
                onChange={handleNewTareaChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
                disabled={proyectos.length === 0}
              >
                <option value="Pendiente">Pendiente</option>
                <option value="En Progreso">En Progreso</option>
                <option value="Completada">Completada</option>
              </select>
              <input
                name="fecha_limite"
                type="date"
                value={newTarea.fecha_limite}
                onChange={handleNewTareaChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
                required
                disabled={proyectos.length === 0}
              />
              <select
                name="proyecto_id"
                value={newTarea.proyecto_id}
                onChange={handleNewTareaChange}
                className="mb-2 w-full p-2 border border-gray-300 rounded"
                required
                disabled={proyectos.length === 0}
              >
                <option value={0}>Seleccionar Proyecto *</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.id} value={proyecto.id}>
                    {proyecto.nombre}
                  </option>
                ))}
              </select>
              <button 
                type="submit" 
                className={`w-full p-2 text-white rounded transition-colors ${theme.btn} ${proyectos.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={proyectos.length === 0}
              >
                {proyectos.length === 0 ? 'Crea un proyecto primero' : 'Crear Tarea'}
              </button>
            </form>
          )}

          {/* Lista de Tareas */}
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center text-gray-500">Cargando tareas...</p>
            ) : tareas.length > 0 ? (
              tareas.map((tarea) => (
                <div key={tarea.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                  <TareaCard tarea={tarea} proyectos={proyectos} />
                  <div className="flex gap-2 ml-4">
                    <button 
                      onClick={() => setTareaToUpdate(tarea)} 
                      className="text-white py-1 px-3 rounded bg-yellow-500 hover:bg-yellow-600"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => deleteTarea(tarea.id)} 
                      className="text-white py-1 px-3 rounded bg-red-500 hover:bg-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500">
                {proyectos.length === 0 
                  ? 'Crea un proyecto primero para poder agregar tareas.' 
                  : 'No se encontraron tareas. Crea la primera!'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProyectoInterface;