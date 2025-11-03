'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

// --- Interfaces y Tipos ---

interface User {
  id: number;
  name: string;
  email: string;
}

type NewUserInput = Omit<User, 'id'>;

interface UserInterfaceProps {
  backendName: string;
}

// --- Componente de Tarjeta (Card) ---
const CardComponent = ({ user }: { user: User }) => (
  <div className="grow">
    <p className="text-sm text-gray-500">ID: {user.id}</p>
    <p className="text-lg font-semibold text-gray-800">{user.name}</p>
    <p className="text-md text-gray-600">{user.email}</p>
  </div>
);


// --- Componente Principal ---

const UserInterface: React.FC<UserInterfaceProps> = ({ backendName }) => {
  // --- Constantes y Estilos ---
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const colorThemes: { [key: string]: { bg: string; btn: string } } = {
    go: { bg: 'bg-cyan-50', btn: 'bg-cyan-700 hover:bg-cyan-600' },
    rust: { bg: 'bg-orange-50', btn: 'bg-orange-600 hover:bg-orange-500' },
    node: { bg: 'bg-green-50', btn: 'bg-green-600 hover:bg-green-500' },
  };

  const theme = colorThemes[backendName] || { bg: 'bg-gray-100', btn: 'bg-gray-500 hover:bg-gray-400' };

  // --- Estados del Componente ---
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState<NewUserInput>({ name: '', email: '' });
  const [userToUpdate, setUserToUpdate] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  
  // --- NUEVO: Estado para el error del formulario de edición ---
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // --- Efectos (Fetching de Datos) ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`${apiUrl}/api/${backendName}/users`);
        setUsers(response.data.reverse());
      } catch (error) {
        console.error('Error fetching data:', error);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [backendName, apiUrl]);

  // --- Funciones CRUD ---

  const createUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) {
      setFormError('Por favor, completa todos los campos.');
      return;
    }
    const emailExists = users.some(user => user.email.toLowerCase() === newUser.email.toLowerCase());
    if (emailExists) {
      setFormError('El correo electrónico ya está registrado.');
      return;
    }
    setFormError(null);
    try {
      const response = await axios.post(`${apiUrl}/api/${backendName}/users`, newUser);
      setUsers([response.data, ...users]);
      setNewUser({ name: '', email: '' });
    } catch (error) {
      console.error('Error creating user:', error);
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setFormError('Este correo ya ha sido registrado.');
      } else {
        setFormError('Ocurrió un error al crear el usuario.');
      }
    }
  };

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userToUpdate) return;

    // 1. Validación de correo duplicado (CLIENT-SIDE) para EDICIÓN
    // Comprueba si existe OTRO usuario (con diferente ID) que ya tenga ese email.
    const emailExists = users.some(
      (user) => user.email.toLowerCase() === userToUpdate.email.toLowerCase() && user.id !== userToUpdate.id
    );

    if (emailExists) {
      setEditFormError('El correo electrónico ya está en uso por otro usuario.');
      return;
    }

    setEditFormError(null); // Limpia errores si la validación pasa

    try {
      await axios.put(`${apiUrl}/api/${backendName}/users/${userToUpdate.id}`, {
        name: userToUpdate.name,
        email: userToUpdate.email,
      });
      setUsers(users.map(user => (user.id === userToUpdate.id ? userToUpdate : user)));
      setUserToUpdate(null);
    } catch (error) {
      console.error('Error updating user:', error);
      // 2. Manejo de error del servidor (por si acaso)
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setEditFormError('Este correo ya está en uso.');
      } else {
        setEditFormError('Ocurrió un error al actualizar el usuario.');
      }
    }
  };

  const deleteUser = async (userId: number) => {
    try {
      await axios.delete(`${apiUrl}/api/${backendName}/users/${userId}`);
      setUsers(users.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  // --- Manejadores de Cambios para Formularios ---

  const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
    if (formError) setFormError(null);
  };

  const handleUpdateUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (userToUpdate) {
      setUserToUpdate({ ...userToUpdate, [e.target.name]: e.target.value });
      // 3. Limpia el error del formulario de edición al escribir
      if (editFormError) setEditFormError(null);
    }
  };

  // --- Renderizado del Componente ---
  return (
    <div className={`w-full max-w-2xl p-6 my-4 rounded-lg shadow-lg ${theme.bg}`}>
      <div className="flex items-center gap-4 mb-6">
        <img src={`/${backendName}logo.svg`} alt={`${backendName} Logo`} className="w-16 h-16" />
        <h2 className="text-3xl font-bold text-gray-800">{`${backendName.charAt(0).toUpperCase() + backendName.slice(1)} Backend`}</h2>
      </div>

      {userToUpdate ? (
        <form onSubmit={handleUpdateUser} className="mb-6 p-4 bg-white rounded-lg shadow-md animate-fade-in">
          <h3 className="font-bold mb-2">Editando Usuario (ID: {userToUpdate.id})</h3>
          
          {/* --- NUEVO: Muestra el error del formulario de edición --- */}
          {editFormError && (
            <div className="mb-2 p-2 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
              {editFormError}
            </div>
          )}

          <input
            name="name"
            placeholder="New Name"
            value={userToUpdate.name}
            onChange={handleUpdateUserChange}
            className="mb-2 w-full p-2 border border-gray-300 rounded"
          />
          <input
            name="email"
            placeholder="New Email"
            type="email"
            value={userToUpdate.email}
            onChange={handleUpdateUserChange}
            className="mb-2 w-full p-2 border border-gray-300 rounded"
          />
          <div className="flex gap-2">
            <button type="submit" className="grow p-2 text-white bg-green-500 rounded hover:bg-green-600">Guardar Cambios</button>
            <button type="button" onClick={() => setUserToUpdate(null)} className="p-2 text-white bg-gray-400 rounded hover:bg-gray-500">Cancelar</button>
          </div>
        </form>
      ) : (
        <form onSubmit={createUser} className="mb-6 p-4 bg-white rounded-lg shadow-md">
          <h3 className="font-bold mb-2">Añadir Nuevo Usuario</h3>
          {formError && (
            <div className="mb-2 p-2 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
              {formError}
            </div>
          )}
          <input
            name="name"
            placeholder="Name"
            value={newUser.name}
            onChange={handleNewUserChange}
            className="mb-2 w-full p-2 border border-gray-300 rounded"
          />
          <input
            name="email"
            placeholder="Email"
            type="email"
            value={newUser.email}
            onChange={handleNewUserChange}
            className="mb-2 w-full p-2 border border-gray-300 rounded"
          />
          <button type="submit" className={`w-full p-2 text-white rounded transition-colors ${theme.btn}`}>Añadir Usuario</button>
        </form>
      )}

      {/* Lista de Usuarios */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-center text-gray-500">Cargando...</p>
        ) : users.length > 0 ? (
          users.map((user) => (
            <div key={user.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm animate-fade-in">
              <CardComponent user={user} />
              <div className="flex gap-2 ml-4">
                <button onClick={() => setUserToUpdate(user)} className="text-white py-1 px-3 rounded bg-yellow-500 hover:bg-yellow-600">Editar</button>
                <button onClick={() => deleteUser(user.id)} className="text-white py-1 px-3 rounded bg-red-500 hover:bg-red-600">Borrar</button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500">No se encontraron usuarios.</p>
        )}
      </div>
    </div>
  );
};

export default UserInterface;