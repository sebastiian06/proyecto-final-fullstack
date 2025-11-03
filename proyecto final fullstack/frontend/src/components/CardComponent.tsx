import React from 'react'

interface Props{
    id: number;
    name: string;
    email: string;
}

export const UserInterface = ({id, name, email}: Props) => {
  return (
    <div className='bg-white shadow-lg rounded-lg p-2 mb-2 hover:bg-gray-100'>
        <div className='text-sm text-gray-600'>Id: {id}</div> 
        <div className='text-lg text-gray-800 font-semibold'>Nombre: {name}</div>
        <div className='text-md text-gray-700'>Email: {email}</div>
    </div>
  )
}
