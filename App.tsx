import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, Outlet, useParams } from 'react-router-dom';
import {
  Machine,
  WorkOrder,
  WorkOrderStatus,
  WorkOrderStage,
  Priority,
  SparePart,
  Technician,
  UserRole
} from './types';
import { Dashboard } from './components/Dashboard';
import { MaintenanceKanban } from './components/MaintenanceKanban';
import { MaintenanceList } from './components/MaintenanceList';
import { MaintenanceForm } from './components/MaintenanceForm';
import { MachineHoursLog } from './components/MachineHoursLog';
import { Inventory } from './components/Inventory';
import { Analytics } from './components/Analytics';
import { MaintenanceCalendar } from './components/MaintenanceCalendar';
import { Configuration } from './components/Configuration';
import { UserProfileView } from './components/user/UserProfile';
// Remove OnboardingWizard if not used or add route
import { useLanguage } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { ChangePasswordView } from './components/auth/ChangePasswordView';
import { Clock, LogOut, Shield, User, Hexagon, Server, HelpCircle, CheckCircle2 } from 'lucide-react';
import { MachinesList } from './components/MachinesList';
import { useWorkOrderStore } from './src/stores/useWorkOrderStore';
import { useMasterStore } from './src/stores/useMasterStore';
import { useUserStore } from './src/stores/useUserStore';
import { SERVICE_MODE, SERVICE_WARNINGS } from './src/services';

import { FloatingHelpDesk } from './src/components/HelpDesk/FloatingHelpDesk';


// --- SIDEBAR ITEM ---
const SidebarItem = ({ icon, label, active, onClick, disabled = false }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, disabled?: boolean }) => {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left ${
        disabled 
          ? 'opacity-40 cursor-not-allowed text-industrial-600'
          : active
            ? 'text-white bg-industrial-800 border-r-2 border-industrial-accent'
            : 'text-industrial-500 hover:text-industrial-300 hover:bg-industrial-800/50'
      }`}
    >
      <div className="shrink-0">{icon}</div>
      <span className="leading-tight">{label}</span>
    </button>
  );
};

// --- ERROR BOUNDARY ---
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
interface ErrorBoundaryProps {
  children?: React.ReactNode;
}
class ErrorBoundary extends React.Component<any, any> {
  props: any;
  state: any = { hasError: false, error: null };
  constructor(props: any) {
    super(props);
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-industrial-900 text-white p-8">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">System Error</h2>
            <pre className="bg-black/50 p-4 rounded text-xs font-mono text-red-200 overflow-auto max-h-64">{this.state.error?.toString()}</pre>
            <button onClick={() => window.location.reload()} className="mt-6 bg-industrial-700 px-4 py-2 rounded">Reload System</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- PAGE WRAPPERS ---
const InventoryPage = () => {
  const { parts, addPart } = useMasterStore();
  return <Inventory parts={parts} onAddPart={addPart} />;
};

const MachinesPage = () => {
  return <MachinesList />;
};

const MachineHoursPage = () => {
  const { machines } = useMasterStore();
  return <MachineHoursLog machines={machines} />;
};

const ConfigurationPage = () => {
  const { technicians, plantSettings, addTechnician, updateSettings, zones, addZone, updateZone, deleteZone } = useMasterStore();
  const { hasRole } = useAuth();

  if (!hasRole([UserRole.ADMIN_SOLICITANTE])) {
    return <div className="h-full flex items-center justify-center bg-industrial-900 text-industrial-500 flex-col gap-4"><Shield className="w-12 h-12 text-red-900" /><span>Access Restricted: Master Data requires Admin privileges.</span></div>;
  }
  return (
    <Configuration
      technicians={technicians}
      settings={plantSettings}
      onAddTechnician={addTechnician}
      onUpdateSettings={updateSettings}
      zoneStructures={zones} // Pass store 'zones' to prop 'zoneStructures'
      onAddZone={addZone}
      onUpdateZone={updateZone}
      onRemoveZone={deleteZone}
    />
  );
};

const AnalyticsPage = () => {
  const { hasPermission } = useAuth();
  if (!hasPermission('view_analytics')) {
    return <div className="h-full flex items-center justify-center bg-industrial-900 text-industrial-500 flex-col gap-4"><Shield className="w-12 h-12 text-red-900" /><span>Acceso Restringido: Se requiere el permiso de Analíticas.</span></div>;
  }
  return <Analytics />;
};

const MaintenanceFormPage = () => {
  const { machines, technicians } = useMasterStore();
  const { addOrder, updateOrder, getOrderById } = useWorkOrderStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Parse query/state
  const { id } = useParams<{ id: string }>(); // Assuming Route path="/orders/:id"
  const state = location.state as { machineId?: string; type?: string; orderId?: string } | null;

  // Determine Order ID from URL or State
  const orderId = id || state?.orderId;
  const existingOrder = orderId ? getOrderById(orderId) : undefined;

  // If we have an ID but no order in store (e.g. reload), we might need to fetch. 
  // However, useWorkOrderStore usually loads all. If empty, maybe trigger fetch?
  // For now, assuming store is populated or we are navigating from list.

  // Logic:
  // 1. If existingOrder found, use it as initialData.
  // 2. If no existingOrder but machineId in state, use it as initialMachineId.


  const handleSave = async (order: WorkOrder) => {
    try {
      // Check if exists
      const existing = getOrderById(order.id);
      if (existing) {
        await updateOrder(order.id, order);
      } else {
        await addOrder(order);
      }
      navigate(-1); // Go back only on success
    } catch (e: any) {
      console.error("Save failed:", e);
      alert(`Error saving Work Order: ${e.message || 'Unknown Error'}`);
    }
  };

  return (
    <MaintenanceForm
      type={existingOrder?.formType || (state?.type as any) || 'R-MANT-02'}
      machines={machines}
      technicians={technicians}
      onSave={(order) => handleSave(order)}
      onSaveAndStay={async (order) => {
        try {
          // Logic repeated from handleSave but without navigate
          const existing = getOrderById(order.id);
          if (existing) {
            await updateOrder(order.id, order);
            return existing;
          } else {
            const newOrder = await addOrder(order);
            return newOrder;
          }
          // Optional: Show success toast/alert?
          console.log("Auto-saved (Stay on page)");
        } catch (e: any) {
          console.error("Save failed:", e);
          alert(`Error saving: ${e.message}`);
        }
      }}
      onCancel={() => navigate(-1)}
      initialMachineId={state?.machineId}
      initialData={existingOrder} // Pass existing order if found being edited
    />
  );
};

// --- LAYOUT ---
const AppLayout = () => {
  const { user, logout, hasRole, hasPermission } = useAuth();
  const { plantSettings } = useMasterStore();
  const { roles } = useUserStore(); // Get roles for lookup
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  return (
    <div className="flex h-screen bg-industrial-900 text-slate-100 font-sans">
        {/* Sidebar */}
        <aside className="w-64 bg-industrial-900 border-r border-industrial-800 flex flex-col">
          <div className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-500/30 overflow-hidden">
                {plantSettings.logoUrl ? <img src={plantSettings.logoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" /> : <Hexagon size={24} className="text-white" strokeWidth={2.5} />}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight leading-none">CoreFlow 4.0</h1>
                <p className="text-[10px] text-blue-400 font-medium tracking-wider uppercase">Maintenance Cloud</p>
              </div>
            </div>
            <p className="text-xs text-industrial-500 mt-1">Secure Industrial Gateway</p>
            <div className="mt-3 flex flex-col gap-1">
              <div className="inline-flex items-center gap-2">
                <span className="text-[10px] font-semibold tracking-wider uppercase text-industrial-500">DB</span>
                <span
                  className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border ${
                    SERVICE_MODE === 'MOCK'
                      ? 'text-amber-200 border-amber-500/40 bg-amber-500/10'
                      : 'text-emerald-200 border-emerald-500/40 bg-emerald-500/10'
                  }`}
                >
                  {SERVICE_MODE}
                </span>
              </div>
              {SERVICE_WARNINGS.length > 0 && (
                <div className="text-[10px] text-amber-300/90 bg-amber-900/10 border border-amber-500/20 rounded p-2 leading-snug">
                  {SERVICE_WARNINGS[0]}
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 space-y-1 mt-4">
            <SidebarItem label={t('sidebar.visualPlant')} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
              active={path === '/'} onClick={() => navigate('/')} />
            <SidebarItem label={t('sidebar.maintenanceCanvas')} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
              active={path === '/kanban'} onClick={() => navigate('/kanban')} />

            <SidebarItem label={t('sidebar.biAnalytics')} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              active={path === '/stats'} onClick={() => navigate('/stats')} disabled={!hasPermission('view_analytics')} />
            <SidebarItem label={t('sidebar.calendar')} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              active={path === '/calendar'} onClick={() => navigate('/calendar')} />

            <div className="my-2 border-t border-industrial-800 mx-4"></div>

            <SidebarItem label={t('sidebar.rmant02')} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
              active={path === '/orders/preventive'} onClick={() => navigate('/orders/preventive')} />
            <SidebarItem label={t('sidebar.rmant05')} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              active={path === '/orders/corrective'} onClick={() => navigate('/orders/corrective')} />

            <SidebarItem label={t('sidebar.hours')} icon={<Clock className="w-5 h-5" />}
              active={path === '/logs'} onClick={() => navigate('/logs')} />

            <div className="my-2 border-t border-industrial-800 mx-4"></div>


            <SidebarItem label="Equipos" icon={<Server className="w-5 h-5" />}
              active={path === '/machines'} onClick={() => navigate('/machines')} />

            <SidebarItem label="Repuestos" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
              active={path === '/inventory'} onClick={() => navigate('/inventory')} />

            <div className="pt-4 mt-4 border-t border-industrial-800">
              <SidebarItem label={t('sidebar.masterData')} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>}
                active={path === '/settings'} onClick={() => navigate('/settings')} disabled={!hasRole([UserRole.ADMIN_SOLICITANTE])} />

            </div>
          </nav>

          <div className="p-4 border-t border-industrial-800 bg-industrial-900/50">
            <div className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-industrial-800 rounded p-1 transition-colors" onClick={() => navigate('/profile')}>
              <div className="w-8 h-8 rounded-full bg-industrial-700 flex items-center justify-center font-bold text-xs text-white border border-industrial-600">
                {(user?.full_name || user?.email || 'U').substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-white truncate w-32">{user?.full_name}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${user?.role === 'ADMIN_SOLICITANTE' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                  <p className="text-[10px] text-industrial-400 uppercase tracking-wider">
                    {roles.find(r => r.id === user?.role || r.name === user?.role)?.name || user?.role?.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <button onClick={logout} className="text-industrial-500 hover:text-red-400 flex items-center gap-1 text-xs"><LogOut size={12} /> Sign Out</button>
            </div>
            <div className="flex bg-industrial-800 rounded p-1 mt-3">
              <button onClick={() => setLanguage('es')} className={`flex-1 text-xs py-1 rounded transition-colors ${language === 'es' ? 'bg-industrial-600 text-white shadow' : 'text-industrial-500 hover:text-white'}`}>ES</button>
              <button onClick={() => setLanguage('en')} className={`flex-1 text-xs py-1 rounded transition-colors ${language === 'en' ? 'bg-industrial-600 text-white shadow' : 'text-industrial-500 hover:text-white'}`}>EN</button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden relative">
          <AppInitializer />
      <Outlet />
    </main>
    <FloatingHelpDesk />
  </div>
);
};

// --- AUTH GUARD ---
// --- AUTH GUARD ---
const RequireAuth = ({ children }: { children: React.ReactElement }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-industrial-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-industrial-400 text-sm animate-pulse">Initializing Secure Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

// --- INITIALIZER ---
const AppInitializer = () => {
  const { fetchOrders, isInitialized: ordersInitialized } = useWorkOrderStore();
  const { fetchMasterData, isInitialized: masterInitialized } = useMasterStore();
  const { fetchRoles, rolesInitialized } = useUserStore();

  React.useEffect(() => {
    // Only fetch if not initialized
    if (!ordersInitialized) {
      console.log('AppInitializer: Fetching Orders...');
      fetchOrders();
    }
  }, [fetchOrders, ordersInitialized]);

  React.useEffect(() => {
    // Prevent infinite loop: only fetch if not initialized
    if (!masterInitialized) {
      console.log('AppInitializer: Fetching Master Data...');
      fetchMasterData();
    }
  }, [fetchMasterData, masterInitialized]);

  React.useEffect(() => {
    // Load Roles for RBAC
    if (!rolesInitialized) {
      console.log('AppInitializer: Fetching Roles...');
      fetchRoles();
    }
  }, [fetchRoles, rolesInitialized]);

  return null;
}

const ProfilePage = () => {
  const { user } = useAuth();
  return user ? <UserProfileView user={user} /> : <div>Loading...</div>;
};

// --- MAIN COMPONENT ---
const AppRoutes = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-industrial-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-industrial-400 text-sm animate-pulse">Initializing Secure Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Prevent wiping the hash if Supabase is still processing a magic link or recovery link
    if (window.location.hash.includes('access_token')) {
      return (
        <div className="h-screen w-screen bg-industrial-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <p className="text-industrial-400 text-sm animate-pulse">Processing secure link...</p>
          </div>
        </div>
      );
    }
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" state={{ from: location }} replace />} />
      </Routes>
    );
  }

  // FORCE CHANGE PASSWORD REDIRECTION
  if (user?.requires_password_change && window.location.pathname !== '/change-password') {
    return (
      <Routes>
        <Route path="/change-password" element={<ChangePasswordView />} />
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/change-password" element={<ChangePasswordView />} />
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="kanban" element={<MaintenanceKanban />} />
        <Route path="orders/preventive" element={<MaintenanceList key="preventive" type="R-MANT-02" />} />
        <Route path="orders/corrective" element={<MaintenanceList key="corrective" type="R-MANT-05" />} />
        <Route path="orders/new" element={<MaintenanceFormPage />} />
        <Route path="orders/:id" element={<MaintenanceFormPage />} />

        <Route path="logs" element={<MachineHoursPage />} />
        <Route path="machines" element={<MachinesPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="stats" element={<AnalyticsPage />} />
        <Route path="calendar" element={<MaintenanceCalendar />} />
        <Route path="settings" element={<ConfigurationPage />} />


        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
