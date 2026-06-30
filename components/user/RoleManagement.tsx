
import React, { useState } from 'react';
import { RoleDefinition, Permission } from '../../types';
import { Shield, Lock, CheckSquare, Square, Save, Plus, Trash2, ChevronDown, ChevronRight, Users, AlertCircle } from 'lucide-react';
import { useUserStore } from '../../src/stores/useUserStore';
import { useAuth } from '../../contexts/AuthContext';

// --- DEFINICIÓN DE PERMISOS DEL SISTEMA ---
const SYSTEM_PERMISSIONS: Permission[] = [
    // Operativos
    { id: 'view_dashboard', category: 'OPERATIONAL', label: 'Ver Planta Visual y Mapa', description: 'Ver información en la planta visual. No puede editar el diseño del mapa.' },
    { id: 'edit_dashboard_map', category: 'OPERATIONAL', label: 'Editar Planta Visual y Mapa', description: 'Editar información en la planta visual. Puede editar el diseño del mapa.' },
    { id: 'create_wo', category: 'OPERATIONAL', label: 'Crear Órdenes de Mantenimiento', description: 'Generar nuevos tickets R-MANT-02/05.' },
    { id: 'execute_wo', category: 'OPERATIONAL', label: 'Ejecutar Órdenes de Mantenimiento', description: 'Llenar checklists y consumir repuestos.' },
    { id: 'supervise_order', category: 'OPERATIONAL', label: 'Supervisar y Recibir Órdenes', description: 'Llenar checklists y recepción de una orden.' },
    { id: 'edit_wo', category: 'OPERATIONAL', label: 'Editar Órdenes de Mantenimiento', description: 'Editar información de la orden.' },
    { id: 'log_hours', category: 'OPERATIONAL', label: 'Registrar Uso del Equipo', description: 'Actualizar contadores de horas de máquinas.' },
    
    // Administrativos
    { id: 'manage_assets', category: 'ADMINISTRATIVE', label: 'Gestionar Activos', description: 'Agregar/Editar Equipos y Máquinas' },
    { id: 'manage_inventory', category: 'ADMINISTRATIVE', label: 'Gestionar Inventario', description: 'Agregar/Editar repuestos y stock.' },
    { id: 'view_part_requests', category: 'ADMINISTRATIVE', label: 'Ver Solicitudes de Repuestos', description: 'Visualizar listado y detalle de solicitudes de repuestos.' },
    { id: 'view_purchase_requests', category: 'ADMINISTRATIVE', label: 'Ver Solicitudes a Compras', description: 'Visualizar listado y detalle de solicitudes de compras.' },
    
    // Analíticas
    { id: 'view_kanban', category: 'FINANCIAL', label: 'Ver Tablero Kanban', description: 'Ver estado de tickets de mantenimiento.' },
    { id: 'edit_kanban', category: 'FINANCIAL', label: 'Editar Tablero Kanban', description: 'Permiso de Edición de la Tabla Kanban.' },
    { id: 'view_analytics', category: 'FINANCIAL', label: 'Ver Analíticas y BI', description: 'Acceso completo a dashboard de reportes.' },
    
    // Sistema
    { id: 'manage_users', category: 'SYSTEM', label: 'Gestionar Usuarios', description: 'Invitar usuarios y asignar roles.' },
    { id: 'manage_roles', category: 'SYSTEM', label: 'Gestionar Roles y Permisos', description: 'Configurar este módulo RBAC.' },
];

// Componente recursivo para mostrar árbol de roles
interface RoleTreeItemProps {
  role: RoleDefinition;
  selectedId: string | null;
  onSelect: (role: RoleDefinition) => void;
  onDelete: (roleId: string) => void;
  level: number;
}

const RoleTreeItem: React.FC<RoleTreeItemProps> = ({ role, selectedId, onSelect, onDelete, level }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = role.children && role.children.length > 0;
  const isSelected = selectedId === role.id;
  
  return (
    <div>
      <div 
        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
          isSelected 
            ? 'bg-industrial-700 border border-industrial-accent shadow-md' 
            : 'hover:bg-industrial-700/50 border border-transparent'
        }`}
        style={{ paddingLeft: `${level * 24 + 8}px` }}
        onClick={() => onSelect(role)}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setIsExpanded(!isExpanded); 
            }}
            className="text-industrial-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <div className="w-4" /> // Spacer para alineación
        )}
        
        {/* Role Name */}
        <span className={`flex-1 text-sm font-medium ${isSelected ? 'text-white' : 'text-industrial-300'}`}>
          {role.name}
        </span>
        
        {/* System Lock Icon */}
        {(role.isSystem || role.name.includes('Admin')) && <Lock size={12} className="text-industrial-500" />}
        
        {/* Users Count */}
        <span className="text-[10px] bg-industrial-900 text-industrial-400 px-1.5 py-0.5 rounded flex items-center gap-1">
          <Users size={10} /> {role.usersCount || 0}
        </span>
      </div>
      
      {/* Children (Recursive) */}
      {isExpanded && hasChildren && (
        <div>
          {role.children!.map(child => (
            <RoleTreeItem 
              key={child.id} 
              role={child} 
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const RoleManagement: React.FC = () => {
    const { roles, roleTree, fetchRoles, addRole, updateRole, deleteRole } = useUserStore();
    const { hasPermission } = useAuth();
    const canManage = hasPermission('manage_roles');
    const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    
    // Form state usado para crear/editar
    const [formData, setFormData] = useState<Partial<RoleDefinition>>({
        name: '',
        description: '',
        parentRoleId: null,
        isSystem: false,
        permissions: {}
    });

    // Cargar roles al montar
    React.useEffect(() => {
        fetchRoles();
    }, []);

    // Seleccionar primer rol al cargar
    React.useEffect(() => {
        if (roles.length > 0 && !selectedRole) {
            setSelectedRole(roles[0]);
            setFormData(roles[0]);
        }
    }, [roles]);

    const handleSelectRole = (role: RoleDefinition) => {
        setSelectedRole(role);
        setFormData(role);
        setIsEditing(false);
        setShowCreateModal(false);
    };

    const handleCreateRole = () => {
        if (!canManage) return;
        const newRoleData: Partial<RoleDefinition> = {
            name: 'Nuevo Rol',
            description: 'Descripción del rol...',
            parentRoleId: null,
            isSystem: false,
            permissions: {}
        };
        setFormData(newRoleData);
        setSelectedRole(null);
        setShowCreateModal(true);
        setIsEditing(true);
    };

    const handleSaveNewRole = async () => {
        try {
            await addRole(formData as Omit<RoleDefinition, 'id'>);
            setShowCreateModal(false);
            setIsEditing(false);
            // Refrescar para obtener el nuevo rol con ID
            await fetchRoles();
        } catch (error: any) {
            alert(`Error al crear rol: ${error.message}`);
        }
    };

    const togglePermission = (permId: string) => {
        if (!canManage) return;
        if (formData.name?.includes('Admin')) return;
        const currentPerms = formData.permissions as Record<string, boolean> || {};
        const newPerms = {
            ...currentPerms,
            [permId]: !currentPerms[permId]
        };
        setFormData({ ...formData, permissions: newPerms });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!canManage) return;
        if (!selectedRole) {
            // Modo creación
            await handleSaveNewRole();
            return;
        }
        
        try {
            await updateRole({ ...selectedRole, ...formData } as RoleDefinition);
            setSelectedRole({ ...selectedRole, ...formData } as RoleDefinition);
            setIsEditing(false);
        } catch (error: any) {
            alert(`Error al guardar: ${error.message}`);
        }
    };

    const handleDelete = async () => {
        if (!canManage || !selectedRole) return;
        
        const isProtected = selectedRole.isSystem || selectedRole.name.includes('Admin');
        
        if (isProtected) {
            alert("No se pueden eliminar roles del sistema o de administración.");
            return;
        }
        
        if (confirm(`¿Está seguro de eliminar el rol "${selectedRole.name}"?`)) {
            try {
                await deleteRole(selectedRole.id);
                setSelectedRole(null);
                setFormData({});
            } catch (error: any) {
                alert(`Error: ${error.message}`);
            }
        }
    };

    // Agrupar permisos por categoría
    const groupedPermissions = SYSTEM_PERMISSIONS.reduce((acc, perm) => {
        if (!acc[perm.category]) acc[perm.category] = [];
        acc[perm.category].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    // Obtener roles disponibles para "Reporta a" (excluyendo el actual y sus descendientes)
    const getAvailableParentRoles = (): RoleDefinition[] => {
        if (!selectedRole) return roles;
        
        // Función recursiva para obtener todos los descendientes
        const getDescendants = (roleId: string): string[] => {
            const descendants: string[] = [roleId];
            roles.forEach(r => {
                if (r.parentRoleId === roleId) {
                    descendants.push(...getDescendants(r.id));
                }
            });
            return descendants;
        };
        
        const excludedIds = getDescendants(selectedRole.id);
        return roles.filter(r => !excludedIds.includes(r.id));
    };

    const categoryLabels: Record<string, string> = {
        'OPERATIONAL': 'Acceso Operativo',
        'ADMINISTRATIVE': 'Acceso Administrativo',
        'FINANCIAL': 'Acceso Analíticas',
        'SYSTEM': 'Acceso al Sistema'
    };

    return (
        <div className="h-full flex gap-6">
            {/* Panel Izquierdo: Árbol de Roles */}
            <div className="w-1/3 bg-industrial-800 rounded-lg border border-industrial-700 flex flex-col">
                <div className="p-4 border-b border-industrial-700 flex justify-between items-center">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Shield size={18} className="text-industrial-accent"/> Roles del Sistema
                    </h3>
                    {canManage && (
                        <button 
                            onClick={handleCreateRole}
                            className="p-1.5 bg-industrial-700 hover:bg-industrial-600 rounded text-white transition-colors"
                            title="Crear Nuevo Rol"
                        >
                            <Plus size={16} />
                        </button>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                    {roleTree().map(role => (
                        <RoleTreeItem 
                            key={role.id}
                            role={role}
                            selectedId={selectedRole?.id || null}
                            onSelect={handleSelectRole}
                            onDelete={handleDelete}
                            level={0}
                        />
                    ))}
                    
                    {roles.length === 0 && (
                        <div className="text-center p-8 text-industrial-500 text-sm">
                            <Shield size={32} className="mx-auto mb-2 opacity-20" />
                            <p>No hay roles configurados</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Panel Derecho: Configuración del Rol */}
            <div className="flex-1 bg-industrial-800 rounded-lg border border-industrial-700 flex flex-col overflow-hidden">
                {(selectedRole || showCreateModal) ? (
                    <>
                        {/* Header */}
                        <div className="p-6 border-b border-industrial-700 bg-industrial-900/30">
                            <div className="space-y-4">
                                {/* Nombre */}
                                <div>
                                    <label className="block text-xs font-medium text-industrial-400 mb-1">Nombre del Rol</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-lg font-bold outline-none focus:border-industrial-accent transition-colors"
                                        placeholder="Ingrese un nombre para este rol"
                                        value={formData.name || ''}
                                        onChange={(e) => {
                                            setFormData({...formData, name: e.target.value});
                                            setIsEditing(true);
                                        }}
                                    />
                                </div>
                                
                                {/* Reporta a */}
                                <div>
                                    <label className="block text-xs font-medium text-industrial-400 mb-1">Reporta a</label>
                                    <select
                                        className="w-full bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-industrial-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={formData.parentRoleId || ''}
                                        onChange={(e) => {
                                            setFormData({...formData, parentRoleId: e.target.value || null});
                                            setIsEditing(true);
                                        }}
                                        disabled={formData.name?.includes('Admin')}
                                    >
                                        <option value="">-- Sin Jefe Directo (Rol Raíz) --</option>
                                        {getAvailableParentRoles().map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* Descripción */}
                                <div>
                                    <label className="block text-xs font-medium text-industrial-400 mb-1">Descripción</label>
                                    <textarea 
                                        className="w-full bg-industrial-900 border border-industrial-600 rounded px-3 py-2 text-white text-sm outline-none focus:border-industrial-accent transition-colors resize-none"
                                        placeholder="Ingrese una descripción para este rol"
                                        rows={2}
                                        value={formData.description || ''}
                                        onChange={(e) => {
                                            setFormData({...formData, description: e.target.value});
                                            setIsEditing(true);
                                        }}
                                    />
                                </div>
                                
                                {/* Botones de Acción */}
                                <div className="flex gap-2 pt-2">
                                    {isEditing && canManage && (
                                        <button 
                                            onClick={handleSave}
                                            className="px-4 py-2 bg-industrial-accent hover:bg-blue-600 text-white text-sm font-bold rounded shadow-lg flex items-center gap-2"
                                        >
                                            <Save size={14} /> Guardar Cambios
                                        </button>
                                    )}
                                    {selectedRole && canManage && !(selectedRole.isSystem || selectedRole.name.includes('Admin')) && (
                                        <button 
                                            onClick={handleDelete}
                                            className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 text-sm font-bold rounded flex items-center gap-2"
                                        >
                                            <Trash2 size={14} /> Eliminar Rol
                                        </button>
                                    )}
                                    {showCreateModal && (
                                        <button 
                                            onClick={() => {
                                                setShowCreateModal(false);
                                                setFormData({});
                                                setIsEditing(false);
                                            }}
                                            className="px-4 py-2 bg-industrial-700 hover:bg-industrial-600 text-white text-sm font-bold rounded"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Panel de Permisos */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Configuración de Permisos</h4>
                            
                            <div className="grid grid-cols-2 gap-x-8 gap-y-8">
                                {Object.entries(groupedPermissions).map(([category, perms]) => (
                                    <div key={category} className="bg-industrial-900/50 rounded-lg p-4 border border-industrial-700/50">
                                        <h5 className="text-xs font-bold text-industrial-400 uppercase mb-4 pb-2 border-b border-industrial-700">
                                            {categoryLabels[category] || category}
                                        </h5>
                                        <div className="space-y-3">
                                            {perms.map(perm => {
                                                const permsObj = formData.permissions as Record<string, boolean> || {};
                                                const isEnabled = permsObj[perm.id] || false;
                                                const isAdmin = formData.name?.includes('Admin');
                                                return (
                                                    <div 
                                                        key={perm.id} 
                                                        onClick={() => togglePermission(perm.id)}
                                                        className={`flex items-start gap-3 p-2 rounded ${isAdmin ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} transition-colors ${isEnabled ? 'bg-industrial-800' : (isAdmin ? '' : 'hover:bg-industrial-800/50')}`}
                                                    >
                                                        <div className={`mt-0.5 ${isEnabled ? 'text-emerald-500' : 'text-industrial-600'}`}>
                                                            {isEnabled ? <CheckSquare size={16} /> : <Square size={16} />}
                                                        </div>
                                                        <div>
                                                            <p className={`text-sm font-medium ${isEnabled ? 'text-white' : 'text-industrial-400'}`}>
                                                                {perm.label}
                                                            </p>
                                                            <p className="text-[10px] text-industrial-500 leading-tight mt-0.5">
                                                                {perm.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-industrial-500 gap-4">
                        <Shield size={64} className="opacity-20" />
                        <p className="text-lg">Seleccione un rol para configurar</p>
                        {canManage && (
                            <button 
                                onClick={handleCreateRole}
                                className="px-4 py-2 bg-industrial-accent hover:bg-blue-600 text-white text-sm font-bold rounded flex items-center gap-2"
                            >
                                <Plus size={16} /> Crear Nuevo Rol
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
