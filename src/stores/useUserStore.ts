
import { create } from 'zustand';
import { UserProfile, RoleDefinition, UserRole } from '../../types';
import { UserSupabaseService } from '../services/UserSupabaseService';
import { RoleSupabaseService } from '../services/RoleSupabaseService';

interface UserState {
  users: UserProfile[];
  roles: RoleDefinition[];
  isLoading: boolean;
  error: string | null;
  rolesInitialized: boolean;

  // Actions
  fetchUsers: () => Promise<void>;
  addUser: (email: string, fullName: string, role: string, jobTitle: string, companyCode?: string, tenantId?: string) => Promise<void>;
  inviteUserWithPassword: (email: string, fullName: string, role: string, jobTitle?: string, companyCode?: string, tenantId?: string, specialties?: string[]) => Promise<any>;
  updateUser: (user: UserProfile) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  fetchRoles: () => Promise<void>;
  addRole: (role: Omit<RoleDefinition, 'id'>) => Promise<void>;
  updateRole: (role: RoleDefinition) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;

  // Getters
  roleTree: () => RoleDefinition[]; // Retorna estructura de árbol
}

// Helper function para construir árbol desde lista plana
function buildRoleTree(roles: RoleDefinition[]): RoleDefinition[] {
  const roleMap = new Map<string, RoleDefinition>();
  const rootRoles: RoleDefinition[] = [];

  // Primera pasada: crear mapa y agregar campo children
  roles.forEach(role => {
    roleMap.set(role.id, { ...role, children: [], level: 0 });
  });

  // Segunda pasada: construir jerarquía
  roles.forEach(role => {
    const node = roleMap.get(role.id)!;

    if (role.parentRoleId) {
      const parent = roleMap.get(role.parentRoleId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
        node.level = (parent.level || 0) + 1;
      } else {
        // Si el parent no existe, tratar como raíz
        rootRoles.push(node);
      }
    } else {
      // Sin parent = rol raíz
      rootRoles.push(node);
    }
  });

  return rootRoles;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  roles: [],
  isLoading: false,
  error: null,
  rolesInitialized: false,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const users = await UserSupabaseService.getUsers();
      set({ users, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  addUser: async (email, fullName, role, jobTitle, companyCode, tenantId) => {
    set({ isLoading: true, error: null });
    try {
      const newUser = await UserSupabaseService.inviteUser(email, fullName, role, jobTitle, companyCode, tenantId);
      set((state) => ({
        users: [...state.users, newUser],
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error; // RE-THROW so the UI knows it failed!
    }
  },
  
  inviteUserWithPassword: async (email, fullName, role, jobTitle, companyCode, tenantId, specialties) => {
    set({ isLoading: true, error: null });
    try {
      const data = await UserSupabaseService.inviteUserWithPassword(email, fullName, role, jobTitle, companyCode, tenantId, specialties);
      set({ isLoading: false });
      return data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateUser: async (user) => {
    try {
      await UserSupabaseService.updateUser(user);
      set((state) => ({
        users: state.users.map(u => u.id === user.id ? user : u)
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteUser: async (id) => {
    try {
      await UserSupabaseService.deleteUser(id);
      set((state) => ({
        users: state.users.filter(u => u.id !== id)
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  fetchRoles: async () => {
    try {
      const roles = await RoleSupabaseService.getRoles();
      // If DB is empty, maybe init with default? For now just set.
      set({ roles, rolesInitialized: true });
    } catch (error: any) {
      console.error("Error fetching roles", error);
      set({ error: error.message, rolesInitialized: true });
    }
  },

  addRole: async (role) => {
    try {
      const newRole = await RoleSupabaseService.createRole(role);
      set(state => ({ roles: [...state.roles, newRole] }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  updateRole: async (role) => {
    try {
      await RoleSupabaseService.updateRole(role);
      set(state => ({ roles: state.roles.map(r => r.id === role.id ? role : r) }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteRole: async (id) => {
    try {
      await RoleSupabaseService.deleteRole(id);
      set(state => ({ roles: state.roles.filter(r => r.id !== id) }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // Getter: Retorna estructura de árbol
  roleTree: () => {
    return buildRoleTree(get().roles);
  }

}));
