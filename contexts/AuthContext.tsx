import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, UserRole } from '../types';
import { supabase } from '../src/services/supabaseClient';
import { useUserStore } from '../src/stores/useUserStore';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (allowedRoles: UserRole[]) => boolean;
  hasPermission: (permissionId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialCheckComplete = useRef(false);

  // Helper: Map Supabase User to UserProfile (Fallback)
  const mapSupabaseUser = (sbUser: any): UserProfile => {
    const metadata = sbUser.user_metadata || {};
    return {
      id: sbUser.id,
      email: sbUser.email || '',
      full_name: metadata.full_name || 'Usuario',
      role: metadata.role_id || metadata.role || UserRole.ADMIN_SOLICITANTE,
      tenant_id: metadata.tenant_id || 'default-tenant',
      status: 'ACTIVE',
      job_title: metadata.job_title || 'N/A',
      // Preserve existing if possible, otherwise empty
      specialties: [],
      company_code: metadata.company_code
    };
  };

  // Fetch profile from DB to ensure fresh data (Role, Company Code)
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error("Error fetching profile:", error);
      return null;
    }

    let status = data.status;
    if (status === 'INVITED') {
      console.log(`User ${userId} logging in for the first time. Activating account...`);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ status: 'ACTIVE' })
        .eq('id', userId);

      if (updateError) {
        console.error("Error updating user status to ACTIVE:", updateError);
      } else {
        status = 'ACTIVE';
      }
    }

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: data.role_id || data.role, // Source of truth: role_id from new schema
      company_code: data.company_code,
      job_title: data.job_title,
      status: status,
      specialties: data.specialties || [],
      tenant_id: data.tenant_id,
      avatar_url: data.avatar_url,
      requires_password_change: data.requires_password_change
    };
  };

  useEffect(() => {
    let mounted = true;

    if (import.meta.env.VITE_USE_MOCK === 'true') {
      console.log("AuthContext: Mock mode active. Reading session from localStorage...");
      const checkMockSession = () => {
        const stored = localStorage.getItem('coreflow_mock_session');
        if (stored && mounted) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.status === 'INVITED') {
              parsed.status = 'ACTIVE';
              localStorage.setItem('coreflow_mock_session', JSON.stringify(parsed));
              
              // Also update in the mock users list
              const mockUsersRaw = localStorage.getItem('coreflow_mock_users');
              if (mockUsersRaw) {
                const mockUsers = JSON.parse(mockUsersRaw);
                const idx = mockUsers.findIndex((u: any) => u.id === parsed.id);
                if (idx !== -1) {
                  mockUsers[idx].status = 'ACTIVE';
                  localStorage.setItem('coreflow_mock_users', JSON.stringify(mockUsers));
                }
              }
            }
            setUser(parsed);
          } catch (e) {
            console.error("Failed to parse mock session", e);
          }
        }
        if (mounted) {
          setIsLoading(false);
        }
      };
      checkMockSession();
      return () => {
        mounted = false;
      };
    }

    // 1. Initial Session Check with Timeout Race
    const checkSession = async () => {
      console.log("AuthContext: Starting session check...");

      const sessionPromise = (async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();

          if (mounted) {
            if (error) {
              console.error("AuthContext: Session error:", error);
            }

            if (session?.user) {
              console.log("AuthContext: Session found for", session.user.email);
              try {
                const profile = await fetchProfile(session.user.id);
                if (mounted) {
                  if (profile) {
                    setUser(profile);
                  } else {
                    console.warn("AuthContext: Using metadata fallback.");
                    setUser(mapSupabaseUser(session.user));
                  }
                }
              } catch (err) {
                console.error("AuthContext: Profile fetch error:", err);
                if (mounted) setUser(mapSupabaseUser(session.user));
              }
            } else {
              console.log("AuthContext: No active session.");
            }
          }
        } catch (err) {
          console.error("AuthContext: Unexpected error:", err);
        }
      })();

      // Force timeout after 1.5 seconds to clear loading state
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1500));

      await Promise.race([sessionPromise, timeoutPromise]);

      if (mounted) {
        console.log("AuthContext: Session check complete (or timed out). Clearing loading state.");
        initialCheckComplete.current = true;
        setIsLoading(false);
      }
    };

    checkSession();

    // 2. Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AuthContext: Auth event:", event);

      // SILENT REFRESH: Do NOT set isLoading(true) for TOKEN_REFRESHED
      // Only set loading for SIGNED_IN if we don't already have a current session (initial login)
      // or for SIGNED_OUT to ensure a clean transition.
      if (event === 'PASSWORD_RECOVERY') {
        if (mounted && session?.user) {
          // Set fallback user immediately to avoid unauthenticated redirect
          setUser(mapSupabaseUser(session.user));
          setIsLoading(true);
        }
        navigate('/change-password');
      }

      if (event === 'SIGNED_IN' && !session?.user) {
        if (mounted) setIsLoading(true);
      } else if (event === 'SIGNED_OUT') {
        if (mounted) setIsLoading(true);
      }

      try {
        if (session?.user) {
          // Profile Fetch with Timeout
          const fetchPromise = (async () => {
            try {
              const profile = await fetchProfile(session.user.id);
              if (mounted) {
                if (profile) setUser(profile);
                else setUser(mapSupabaseUser(session.user));
              }
            } catch (err) {
              console.error("AuthContext: Profile fetch error in listener:", err);
              if (mounted) setUser(mapSupabaseUser(session.user));
            }
          })();

          // Reduce timeout for background updates
          const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1000));

          await Promise.race([fetchPromise, timeoutPromise]);

        } else {
          if (mounted) setUser(null);
        }
      } catch (err) {
        console.error("Auth state change error:", err);
      } finally {
        if (mounted && initialCheckComplete.current) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 3. Subscribe to roles for reactivity in hasRole/hasPermission
  const roles = useUserStore(state => state.roles);

  const login = async (email: string, password: string) => {
    // Do not set global loading here. Let the UI handle its own loading state.
    // setIsLoading(true); 
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const mockUsersRaw = localStorage.getItem('coreflow_mock_users');
      let status = 'ACTIVE';
      let fullName = email.split('@')[0].toUpperCase();
      let role = UserRole.ADMIN_SOLICITANTE;
      let companyCode = 'COMP-1';
      let jobTitle = 'Administrator';
      let specialties: string[] = [];
      let id = 'mock-user-id-' + email.replace(/[^a-zA-Z0-9]/g, '');

      if (mockUsersRaw) {
        const mockUsers = JSON.parse(mockUsersRaw);
        const existingMockUser = mockUsers.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
        if (existingMockUser) {
          id = existingMockUser.id;
          fullName = existingMockUser.full_name;
          role = existingMockUser.role;
          companyCode = existingMockUser.company_code || 'COMP-1';
          jobTitle = existingMockUser.job_title || 'Technician';
          specialties = existingMockUser.specialties || [];
          if (existingMockUser.status === 'INVITED') {
            status = 'ACTIVE';
            existingMockUser.status = 'ACTIVE';
            localStorage.setItem('coreflow_mock_users', JSON.stringify(mockUsers));
          } else {
            status = existingMockUser.status;
          }
        }
      }

      const mockUser: UserProfile = {
        id,
        email,
        full_name: fullName,
        role,
        tenant_id: 'default-tenant',
        status: status as any,
        job_title: jobTitle,
        specialties,
        company_code: companyCode
      };
      localStorage.setItem('coreflow_mock_session', JSON.stringify(mockUser));
      setUser(mockUser);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      // setIsLoading(false);
      throw error;
    }
    // onAuthStateChange will handle setting user and eventually loading state if needed
  };

  const logout = async () => {
    // setIsLoading(true);
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      localStorage.removeItem('coreflow_mock_session');
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    // setIsLoading(false);
  };

  const hasRole = (allowedRoles: UserRole[]) => {
    if (!user) return false;

    // Si el rol sigue siendo el string hardcodeado, usa la lógica vieja
    if (allowedRoles.includes(user.role as UserRole)) return true;

    // Si el rol es un UUID, buscar en los roles dinámicos
    const userRoleDef = roles.find(r => r.id === user.role);

    if (userRoleDef) {
      // Si el rol de DB dice "Admin", "Manager" o "Supervisor" o es de sistema
      // consideramos que es un "ADMIN_SOLICITANTE" lógico para mantener compatibilidad
      if (allowedRoles.includes(UserRole.ADMIN_SOLICITANTE)) {
        if (userRoleDef.name?.toLowerCase().includes('admin') ||
          userRoleDef.name?.toLowerCase().includes('manager') ||
          userRoleDef.isSystem) {
          return true;
        }
      }

      // Si se requiere tecnico
      if (allowedRoles.includes(UserRole.TECNICO_MANT)) {
        if (userRoleDef.name?.toLowerCase().includes('tecnico') ||
          userRoleDef.name?.toLowerCase().includes('mecanico')) {
          return true;
        }
      }
    }

    return false;
  };

  const hasPermission = (permissionId: string) => {
    if (!user) return false;

    // 1. Super Admin Bypass (optional, but good for dev)
    if (user.role === UserRole.ADMIN_SOLICITANTE) return true;

    // 2. Check Dynamic Roles
    const userRoleDef = roles.find(r => r.id === user.role);

    if (!userRoleDef) return false;

    // 2.5 New System Admin Bypass
    if (userRoleDef.isSystem ||
      userRoleDef.name?.toLowerCase().includes('admin') ||
      userRoleDef.name?.toLowerCase().includes('manager')) {
      return true;
    }

    // 3. Check specific permission
    if (!userRoleDef.permissions) return false;

    if (Array.isArray(userRoleDef.permissions)) {
      return userRoleDef.permissions.includes(permissionId);
    } else {
      // Object format { [id]: boolean }
      return !!(userRoleDef.permissions as Record<string, boolean>)[permissionId];
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, hasRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};