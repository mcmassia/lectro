"use client";

import { useEffect, useState } from 'react';
import { User, getUsers, createUser, updateUser, getUser } from '@/lib/db';
import { useAppStore } from '@/stores/appStore';
import { hashPassword } from '@/lib/auth';
import { X, UserPlus, Save, AlertCircle } from 'lucide-react';

interface UserManagementModalProps {
    onClose: () => void;
}

export function UserManagementModal({ onClose }: UserManagementModalProps) {
    const { currentUser } = useAppStore();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');

    // Form state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setIsLoading(true);
        const all = await getUsers();
        setUsers(all);
        setIsLoading(false);
    };

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setIsAdmin(false);
        setError('');
        setMessage('');
        setEditingUserId(null);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 4) {
            setError('La contraseña debe tener al menos 4 caracteres');
            return;
        }

        try {
            const existing = await getUser(username);
            if (existing) {
                setError('El usuario ya existe');
                return;
            }

            const passwordHash = await hashPassword(password);

            await createUser({
                id: crypto.randomUUID(),
                username,
                passwordHash,
                createdAt: new Date(),
                isAdmin
            });

            await loadUsers();
            resetForm();
            setView('list');
        } catch (e) {
            console.error(e);
            setError('Error al crear usuario');
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 4) {
            setError('La contraseña debe tener al menos 4 caracteres');
            return;
        }

        try {
            // If editing other user (admin only) or self
            const targetId = editingUserId || currentUser?.id;
            if (!targetId) return;

            const passwordHash = await hashPassword(password);
            await updateUser(targetId, { passwordHash });

            setMessage('Contraseña actualizada');
            setPassword('');
            setConfirmPassword('');

            // If we were in edit mode for another user, go back to list
            if (editingUserId) {
                setTimeout(() => {
                    resetForm();
                    setView('list');
                }, 1000);
            }
        } catch (e) {
            setError('Error al actualizar');
        }
    };

    // Determine if current user can edit others
    const canManageUsers = currentUser?.isAdmin;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {view === 'list' && 'Gestión de Usuarios'}
                        {view === 'create' && 'Nuevo Usuario'}
                        {view === 'edit' && 'Cambiar Contraseña'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {view === 'list' && (
                        <div className="space-y-4">
                            {/* Actions */}
                            {canManageUsers && (
                                <button
                                    onClick={() => { resetForm(); setView('create'); }}
                                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                                >
                                    <UserPlus size={18} />
                                    <span>Crear Usuario</span>
                                </button>
                            )}

                            {/* Change My Password Button */}
                            <button
                                onClick={() => { resetForm(); setView('edit'); }}
                                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                            >
                                <span>Cambiar Mi Contraseña</span>
                            </button>

                            <h3 className="text-sm font-medium text-gray-500 mt-4 uppercase tracking-wider">Usuarios Existentes</h3>

                            <div className="space-y-2">
                                {users.map(user => (
                                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                                    {user.username}
                                                    {user.id === currentUser?.id && <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded">Tú</span>}
                                                </div>
                                                <div className="text-xs text-gray-500">{user.isAdmin ? 'Administrador' : 'Lector'}</div>
                                            </div>
                                        </div>

                                        {canManageUsers && user.id !== currentUser?.id && (
                                            <button
                                                onClick={() => { resetForm(); setEditingUserId(user.id); setView('edit'); }}
                                                className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                                            >
                                                Editar
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {view === 'create' && (
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuario</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isAdmin"
                                    checked={isAdmin}
                                    onChange={e => setIsAdmin(e.target.checked)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="isAdmin" className="text-sm text-gray-700 dark:text-gray-300">Es Administrador</label>
                            </div>

                            {error && <div className="text-red-500 text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}

                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setView('list')} className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Cancelar
                                </button>
                                <button type="submit" className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm">
                                    Crear
                                </button>
                            </div>
                        </form>
                    )}

                    {view === 'edit' && (
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-800 dark:text-blue-200 mb-4">
                                {editingUserId ? `Cambiando contraseña para usuario seleccionado` : `Cambiando tu contraseña`}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Nueva Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                            </div>

                            {error && <div className="text-red-500 text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
                            {message && <div className="text-green-500 text-sm flex items-center gap-2"><Save size={16} /> {message}</div>}

                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setView('list')} className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Cancelar
                                </button>
                                <button type="submit" className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm">
                                    Actualizar
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
