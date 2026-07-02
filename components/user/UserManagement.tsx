
import React, { useState } from 'react';
import { UserProfile, UserRole } from '../../types';
import { Plus, Mail, Shield, UserCheck, MoreVertical, Search, CheckCircle, Pencil, X, Trash2, BadgeCheck, Briefcase } from 'lucide-react';

import { useUserStore } from '../../src/stores/useUserStore';
import { useAuth } from '../../contexts/AuthContext';

export const UserManagement: React.FC = () => {
    const { users, roles, fetchUsers, fetchRoles, inviteUserWithPassword, updateUser, deleteUser, isLoading } = useUserStore();
    const { user, hasPermission } = useAuth();
    const canManage = hasPermission('manage_users');

    // Fetch on mount
    React.useEffect(() => {
        fetchUsers();
        fetchRoles(); // Ensure roles are loaded
    }, []);

    // Invite Modal State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', role: '', fullName: '', title: '', companyCode: '', specialties: [] as string[] });

    // Edit Modal State
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [newSpecialty, setNewSpecialty] = useState('');

    // --- ACTIONS ---

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManage) return;

        if (!newUser.role) {
            alert('Por favor, selecciona un rol para este usuario.');
            return;
        }

        if (newUser.email && newUser.fullName) {
            try {
                // DIAGNÓSTICO: Ver exactamente qué datos se envían
                console.log('=== INVITE USER DEBUG ===');
                console.log('Email:', newUser.email);
                console.log('Full Name:', newUser.fullName);
                console.log('Role ID:', newUser.role);
                console.log('Job Title (title):', newUser.title);
                console.log('Company Code:', newUser.companyCode);
                console.log('Tenant ID:', user?.tenant_id);
                console.log('Specialties:', newUser.specialties);

                const result = await inviteUserWithPassword(
                    newUser.email,
                    newUser.fullName,
                    newUser.role,
                    newUser.title,
                    newUser.companyCode,
                    user?.tenant_id,
                    newUser.specialties || []
                );

                console.log('=== INVITE RESULT ===', result);

                if (result && result.emailSent === false) {
                    alert(`⚠️ Usuario creado exitosamente, pero NO se pudo enviar el correo de bienvenida.\n\nMotivo: ${result.warning || 'Restricción de dominio de Resend.'}\n\nDile al usuario que su clave provisional es: CF-XXXXXX (visible en consola edge) o restablece su contraseña.`);
                } else {
                    alert(`✅ Invitación enviada existosamente a: ${newUser.email}`);
                }
                
                setShowInviteModal(false);
                setNewUser({ email: '', role: '', fullName: '', title: '', companyCode: '', specialties: [] });

                // Refrescamos lista
                await fetchUsers();
            } catch (error: any) {
                console.error("Error en handleInvite:", error);
                alert(`❌ Error al invitar usuario: ${error.message}`);
            }
        }
    };

    const handleUpdateUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser || !canManage) return;
        updateUser(editingUser);
        setEditingUser(null);
    };

    const addSpecialty = () => {
        if (editingUser && newSpecialty.trim()) {
            const currentSpecs = editingUser.specialties || [];
            if (!currentSpecs.includes(newSpecialty.trim())) {
                setEditingUser({
                    ...editingUser,
                    specialties: [...currentSpecs, newSpecialty.trim()]
                });
            }
            setNewSpecialty('');
        }
    };

    const removeSpecialty = (spec: string) => {
        if (editingUser) {
            setEditingUser({
                ...editingUser,
                specialties: (editingUser.specialties || []).filter(s => s !== spec)
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg text-white font-medium flex items-center gap-2">
                    <Shield size={18} className="text-industrial-accent" /> Directorio de Personal
                </h3>
                {canManage && (
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="bg-industrial-accent hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium shadow-lg flex items-center gap-2 transition-colors"
                    >
                        <Plus size={16} /> Invitar Usuario
                    </button>
                )}
            </div>

            {/* Users Table */}
            <div className="bg-industrial-800 rounded-lg border border-industrial-700 overflow-hidden shadow-lg">
                <table className="w-full text-left text-sm text-industrial-400">
                    <thead className="bg-industrial-900 text-xs uppercase font-bold text-industrial-500">
                        <tr>
                            <th className="px-6 py-4">Usuario</th>
                            <th className="px-6 py-4">Rol / Acceso</th>
                            <th className="px-6 py-4">Especialidades</th>
                            <th className="px-6 py-4">Estatus</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-industrial-700">
                        {users.map(user => (
                            <tr key={user.id} onClick={() => setEditingUser(user)} className="hover:bg-industrial-700/30 transition-colors group cursor-pointer">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-industrial-700 border border-industrial-600 flex items-center justify-center text-xs text-white font-bold shadow-sm">
                                            {(user.full_name || user.email || 'US').substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">{user.full_name}</p>
                                            <p className="text-xs text-industrial-500">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-white text-xs font-medium flex items-center gap-1">
                                            <Briefcase size={10} className="text-industrial-500" /> {user.job_title}
                                        </span>
                                        <span className={`text-[10px] uppercase font-bold mt-1 ${roles.find(r => r.id === user.role || r.name === user.role)?.name === 'Administrador' ? 'text-red-400' : 'text-blue-400'}`}>
                                            {roles.find(r => r.id === user.role || r.name === user.role)?.name || user.role}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {user.specialties?.slice(0, 2).map((spec, i) => (
                                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-industrial-900 border border-industrial-600 text-industrial-300">
                                                {spec}
                                            </span>
                                        ))}
                                        {(user.specialties?.length || 0) > 2 && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-industrial-900 border border-industrial-600 text-industrial-500">
                                                +{(user.specialties?.length || 0) - 2}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {user.status === 'ACTIVE' ? (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-emerald-900/30 text-emerald-400 border border-emerald-800">
                                            <CheckCircle size={10} /> Activo
                                        </span>
                                    ) : user.status === 'INVITED' ? (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-yellow-900/30 text-yellow-400 border border-yellow-800">
                                            <Mail size={10} /> Invitado
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-red-900/30 text-red-400 border border-red-800">
                                            <X size={10} /> Inactivo
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className={`flex items-center justify-end gap-2 transition-opacity ${canManage ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'}`}>
                                        {canManage && (
                                            <>
                                                <button
                                                    onClick={() => setEditingUser(user)}
                                                    className="p-1.5 text-industrial-400 hover:text-white hover:bg-industrial-600 rounded transition-colors"
                                                    title="Edit Profile"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if (confirm(`¿Eliminar al usuario ${user.full_name}?`)) {
                                                            deleteUser(user.id);
                                                        }
                                                    }}
                                                    className="p-1.5 text-industrial-400 hover:text-red-400 hover:bg-industrial-600 rounded transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && !isLoading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-industrial-500 italic">
                                    No hay usuarios registrados. Invita a alguien para comenzar.
                                </td>
                            </tr>
                        )}
                        {isLoading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-industrial-500 italic">
                                    Cargando usuarios...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* --- MODAL: INVITE USER --- */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-industrial-800 rounded-lg border border-industrial-600 shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-industrial-700 bg-industrial-900/50">
                            <h3 className="text-white font-bold">Invitar Nuevo Usuario</h3>
                        </div>
                        <form onSubmit={handleInvite} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-industrial-400 font-bold uppercase">Nombre Completo</label>
                                <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                    value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="e.g. Alice Smith" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-industrial-400 font-bold uppercase">Correo Electrónico</label>
                                <input required type="email" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                    value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="alice@company.com" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-industrial-400 font-bold uppercase">Posición / Cargo</label>
                                <input required type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                    value={newUser.title} onChange={e => setNewUser({ ...newUser, title: e.target.value })} placeholder="e.g. Mechanic L2" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-industrial-400 font-bold uppercase">Rol en Sistema</label>
                                <select className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                    value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                    <option value="">-- Seleccionar Rol --</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-industrial-400 font-bold uppercase">Código de Empresa</label>
                                <input type="text" className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                    value={newUser.companyCode} onChange={e => setNewUser({ ...newUser, companyCode: e.target.value })} placeholder="e.g. EMP-001" />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-industrial-700">
                                <button type="button" onClick={() => setShowInviteModal(false)} className="px-4 py-2 text-sm text-industrial-400 hover:text-white">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-industrial-accent hover:bg-blue-600 text-white rounded text-sm font-bold shadow-lg">Enviar Invitación</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL: CONFIGURE PROFILE (EDIT) --- */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-industrial-800 rounded-lg border border-industrial-600 shadow-2xl w-full max-w-lg overflow-hidden">

                        <div className="p-4 border-b border-industrial-700 bg-industrial-900/50 flex justify-between items-center">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Pencil size={16} className="text-industrial-accent" /> Configurar Perfil del Usuario
                            </h3>
                            <button onClick={() => setEditingUser(null)} className="text-industrial-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="p-6 space-y-5">

                            {/* Avatar & Basic Info Header */}
                            <div className="flex items-center gap-4 pb-4 border-b border-industrial-700">
                                <div className="w-16 h-16 rounded-full bg-industrial-700 border-2 border-industrial-600 flex items-center justify-center text-2xl font-bold text-white">
                                    {(editingUser.full_name || editingUser.email || 'US').substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-industrial-500 font-bold uppercase">Nombre Completo</label>
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-b border-industrial-600 text-white font-bold text-lg focus:border-industrial-accent outline-none"
                                        value={editingUser.full_name}
                                        onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                    />
                                    <p className="text-xs text-industrial-400 mt-1">{editingUser.email}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-industrial-400 font-bold uppercase">Posición</label>
                                    <input
                                        type="text"
                                        className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                        value={editingUser.job_title}
                                        onChange={e => setEditingUser({ ...editingUser, job_title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-industrial-400 font-bold uppercase">Rol</label>
                                    <select
                                        className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                        value={editingUser.role || ''}
                                        onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                                    >
                                        <option value="">-- Sin Rol Asignado --</option>
                                        {roles.map(role => (
                                            <option key={role.id} value={role.id}>{role.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-xs text-industrial-400 font-bold uppercase">Código de Empresa</label>
                                    <input
                                        type="text"
                                        className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-industrial-accent outline-none"
                                        value={editingUser.company_code || ''}
                                        onChange={e => setEditingUser({ ...editingUser, company_code: e.target.value })}
                                        placeholder="Código de Empresa"
                                    />
                                </div>
                            </div>

                            {/* Specialties Tag Manager */}
                            <div className="space-y-2">
                                <label className="text-xs text-industrial-400 font-bold uppercase flex items-center gap-2">
                                    <BadgeCheck size={12} className="text-industrial-accent" /> Certificaciones y Especialidades
                                </label>
                                <div className="bg-industrial-900 border border-industrial-600 rounded p-3">
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {(editingUser.specialties || []).map((spec, i) => (
                                            <span key={i} className="px-2 py-1 rounded bg-industrial-800 border border-industrial-600 text-industrial-300 text-xs flex items-center gap-1 group">
                                                {spec}
                                                <button
                                                    type="button"
                                                    onClick={() => removeSpecialty(spec)}
                                                    className="hover:text-red-400"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </span>
                                        ))}
                                        {(!editingUser.specialties || editingUser.specialties.length === 0) && (
                                            <span className="text-xs text-industrial-600 italic">No asignadas.</span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 bg-industrial-800 border-b border-industrial-600 text-xs text-white p-1 focus:border-industrial-accent outline-none"
                                            placeholder="Agregar habilidades y experiencias..."
                                            value={newSpecialty}
                                            onChange={e => setNewSpecialty(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                                        />
                                        <button
                                            type="button"
                                            onClick={addSpecialty}
                                            className="text-xs bg-industrial-700 hover:bg-industrial-600 text-white px-2 rounded"
                                        >
                                            Agregar
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-industrial-700">
                                <label className="text-xs text-industrial-400 font-bold uppercase block">Estatus de Cuenta</label>
                                <div className="flex items-center justify-between bg-industrial-900/50 p-3 rounded border border-industrial-700">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-industrial-500">Estatus actual:</span>
                                        {editingUser.status === 'ACTIVE' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-emerald-900/30 text-emerald-400 border border-emerald-800">
                                                <CheckCircle size={10} /> Activo
                                            </span>
                                        ) : editingUser.status === 'INVITED' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-yellow-900/30 text-yellow-400 border border-yellow-800">
                                                <Mail size={10} /> Invitado
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-red-900/30 text-red-400 border border-red-800">
                                                <X size={10} /> Inactivo
                                            </span>
                                        )}
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editingUser.status !== 'INACTIVE'}
                                            onChange={(e) => {
                                                const shouldBeActive = e.target.checked;
                                                setEditingUser({
                                                    ...editingUser,
                                                    status: shouldBeActive ? 'ACTIVE' : 'INACTIVE'
                                                });
                                            }}
                                            className="w-4 h-4 rounded text-industrial-accent bg-industrial-900 border-industrial-600 focus:ring-industrial-accent focus:ring-opacity-50"
                                        />
                                        <span className="text-xs text-white font-medium">Permitir Acceso (Activo)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-industrial-700">
                                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm text-industrial-400 hover:text-white">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-industrial-accent hover:bg-blue-600 text-white rounded text-sm font-bold shadow-lg">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};
