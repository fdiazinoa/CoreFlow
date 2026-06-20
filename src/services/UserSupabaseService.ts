
import { supabase } from './supabaseClient';
import { UserProfile, UserRole } from '../../types';

async function parseEdgeFunctionError(error: any): Promise<Error> {
  let message = error?.message || String(error);
  if (error && error.context && typeof error.context.text === 'function') {
    try {
      const text = await error.context.text();
      const parsed = JSON.parse(text);
      if (parsed && parsed.error) {
        message = parsed.error;
      }
    } catch (_) {
      // Ignore parsing errors
    }
  }
  return new Error(message);
}

export const UserSupabaseService = {
  // Get all users (profiles) with notification preferences
  async getUsersWithPreferences(): Promise<UserProfile[]> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      return this.getUsers();
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, job_title, role, tenant_id, status, notification_preferences')
      .order('full_name');

    if (error) throw error;

    return data.map((p: any) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name || '',
      role: p.role,
      job_title: p.job_title || '',
      tenant_id: p.tenant_id,
      status: p.status,
      notification_preferences: p.notification_preferences || {
        alerts_rmant05: false,
        low_stock: false,
        pending_approvals: false
      }
    }));
  },

  // Get all users (profiles)
  async getUsers(): Promise<UserProfile[]> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const stored = localStorage.getItem('coreflow_mock_users');
      if (stored) {
        return JSON.parse(stored);
      }
      const initialUsers: UserProfile[] = [
        {
          id: 'mock-user-admin',
          email: 'beracasa@gmail.com',
          full_name: 'BERACASA',
          role: 'ADMIN_SOLICITANTE',
          job_title: 'Plant Manager',
          tenant_id: 'default-tenant',
          status: 'ACTIVE',
          specialties: ['SACMI', 'Electrical'],
          company_code: 'COMP-1'
        },
        {
          id: 'mock-user-tech-1',
          email: 'juan@example.com',
          full_name: 'Juan Perez',
          role: 'TECNICO_MANT',
          job_title: 'Mechanic',
          tenant_id: 'default-tenant',
          status: 'ACTIVE',
          specialties: ['Hydraulics'],
          company_code: 'COMP-1'
        }
      ];
      localStorage.setItem('coreflow_mock_users', JSON.stringify(initialUsers));
      return initialUsers;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*, app_roles(name)')
      .order('full_name');

    if (error) throw error;

    // Map snake_case DB to camelCase UI if needed, or keep as is if types match
    return data.map((p: any) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name || '',
      role: p.role_id || p.role, // map role_id from DB to role in UI. Fallback to role if migration is partial.
      roleName: p.app_roles?.name,
      job_title: p.job_title || '',
      tenant_id: p.tenant_id,
      status: p.status,
      // Handle array or null
      specialties: p.specialties || [],
      avatar_url: p.avatar_url,
      company_code: p.company_code // New field
    }));
  },

  // Invite user (Mock implementation for now as Supabase Invite requires Admin API)
  // For now we just create a profile row if we want to "reserve" a spot, or we skipping auth
  // In a real app we'd call an Edge Function to supabase.auth.admin.inviteUserByEmail
  async inviteUser(email: string, fullName: string, role: string, jobTitle: string, companyCode?: string, tenantId?: string): Promise<UserProfile> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const users = await this.getUsers();
      const newUser: UserProfile = {
        id: 'mock-invited-' + Math.random().toString(36).substr(2, 9),
        email,
        full_name: fullName,
        role: role as UserRole,
        job_title: jobTitle,
        tenant_id: tenantId || 'default-tenant',
        status: 'INVITED',
        specialties: [],
        company_code: companyCode
      };
      users.push(newUser);
      localStorage.setItem('coreflow_mock_users', JSON.stringify(users));
      return newUser;
    }

    console.log(`[UserSupabaseService] Inviting user: ${email} with role: ${role}, tenant: ${tenantId}`);
    
    // Call the Edge Function to send the invitation
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, fullName, roleId: role, tenantId }
    });

    if (error) {
      console.error("[UserSupabaseService] Invitation error:", error);
      throw await parseEdgeFunctionError(error);
    }

    console.log("[UserSupabaseService] Invitation successful:", data);

    // Return the created user profile (from the function's response)
    const invitedUser = data.user;
    
    return {
      id: invitedUser.id,
      email: invitedUser.email,
      full_name: fullName,
      role: role as UserRole,
      job_title: jobTitle,
      tenant_id: 'primary',
      status: 'INVITED',
      specialties: [],
      company_code: companyCode
    };
  },

  async inviteUserWithPassword(email: string, fullName: string, roleId: string, jobTitle?: string, companyCode?: string, tenantId?: string, specialties?: string[]): Promise<any> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const users = await this.getUsers();
      const newUser: UserProfile = {
        id: 'mock-user-' + Math.random().toString(36).substr(2, 9),
        email,
        full_name: fullName,
        role: roleId,
        job_title: jobTitle || 'Technician',
        tenant_id: tenantId || 'default-tenant',
        status: 'ACTIVE',
        specialties: specialties || [],
        company_code: companyCode
      };
      users.push(newUser);
      localStorage.setItem('coreflow_mock_users', JSON.stringify(users));
      return { user: newUser };
    }

    console.log(`[UserSupabaseService] Inviting user with password: ${email}`);
    
    // Call the NEW Edge Function
    const { data, error } = await supabase.functions.invoke('create-user-admin', {
      body: { email, fullName, roleId, jobTitle, companyCode, tenantId, specialties }
    });

    if (error) {
      console.error("Error nativo de invoke:", error);
      throw await parseEdgeFunctionError(error);
    }

    if (data && data.error) {
      throw new Error(data.error);
    }

    return data;
  },
  // Update User Profile
  async updateUser(user: UserProfile): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const users = await this.getUsers();
      const index = users.findIndex(u => u.id === user.id);
      if (index !== -1) {
        users[index] = { ...users[index], ...user };
        localStorage.setItem('coreflow_mock_users', JSON.stringify(users));
      }
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: user.full_name,
        role_id: user.role, // Direct update to profiles using `role_id`
        job_title: user.job_title,
        status: user.status,
        specialties: user.specialties,
        company_code: user.company_code // Added company_code to update
      })
      .eq('id', user.id)
      .select();

    if (error) {
       console.error("Error updating profile:", error);
       throw error;
    }
  },
  // Delete User (Profile)
  async deleteUser(id: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const users = await this.getUsers();
      const filtered = users.filter(u => u.id !== id);
      localStorage.setItem('coreflow_mock_users', JSON.stringify(filtered));
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Request a new skill/certification
  async createSkillRequest(userId: string, skillName: string): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      console.log(`[Mock Mode] Created skill request for ${userId}: ${skillName}`);
      return;
    }

    console.log(`[UserSupabaseService] Creating skill request for user ${userId}: ${skillName}`);
    const { error } = await supabase
      .from('skill_requests')
      .insert({
        user_id: userId,
        skill_name: skillName,
        status: 'PENDING'
      });

    if (error) {
      console.error("[UserSupabaseService] Skill Request creation failed:", error);
      throw error;
    }
  },

  // Update a single user's notification preferences
  async updateUserNotificationPreferences(userId: string, preferences: any): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const users = await this.getUsers();
      const index = users.findIndex(u => u.id === userId);
      if (index !== -1) {
        users[index].notification_preferences = preferences;
        localStorage.setItem('coreflow_mock_users', JSON.stringify(users));
      }
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ notification_preferences: preferences })
      .eq('id', userId);

    if (error) throw error;
  },

  // Bulk update notification preferences
  async bulkUpdateNotificationPreferences(updates: { userId: string, preferences: any }[]): Promise<void> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const users = await this.getUsers();
      updates.forEach(update => {
        const index = users.findIndex(u => u.id === update.userId);
        if (index !== -1) {
          users[index].notification_preferences = update.preferences;
        }
      });
      localStorage.setItem('coreflow_mock_users', JSON.stringify(users));
      return;
    }

    const promises = updates.map(update => 
      this.updateUserNotificationPreferences(update.userId, update.preferences)
    );
    
    await Promise.all(promises);
  }
};
