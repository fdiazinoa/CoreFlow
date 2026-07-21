
import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { WorkOrder, Machine, Technician, Priority, WorkOrderStatus, SparePart, WorkOrderStage, MaintenanceTask, UserRole } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { X, Calendar, User, FileText, CheckCircle, Clock, AlertCircle, Wrench, Package, ShieldCheck, FileKey, Info, ChevronRight, Lock, Save, PenTool, CheckSquare, Plus, Trash2, Camera, Upload, ImageIcon, Trash, FileIcon, UserCircle, Download, ArrowRight, PlayCircle, Settings, UploadCloud, Image, Paperclip, Loader2 } from 'lucide-react';
import { ProtocolViewer } from './ProtocolViewer';
import { useMasterStore } from '../src/stores/useMasterStore';
import { useUserStore } from '../src/stores/useUserStore';
import { useWorkOrderStore } from '../src/stores/useWorkOrderStore';
import { generateRMant02PDF, generateRMant05PDF } from '../src/utils/pdf/pdfGenerator';

// --- 1. CONFIGURATION & MASTER DATA ENGINE ---

// Hierarchy and Master Task database removed as fallback to ensure only configured data is used.

// Mock Spare Parts for Selection removed in favor of real `useMasterStore().spareParts`

// --- 2. ZOD VALIDATION SCHEMAS (State Guards) ---

// R-MANT-02 Stage 1
const SchemaStage1 = z.object({
   machineId: z.string().min(1, "Machine is required"),
   maintenanceType: z.string().min(1, "Type is required"),
   startDate: z.string().min(1, "Start date is required"),
   assignedMechanic: z.string().min(1, "Technician is required"),
   supervisor: z.string().min(1, "Supervisor is required"),
   interval: z.string().optional(),
   priority: z.nativeEnum(Priority)
});

// R-MANT-05 Stage 1
const SchemaStage1_RMANT05 = z.object({
   assignedTo: z.string().min(1, "required"),
   createdDate: z.string().min(1, "required"),
   branch: z.string().min(1, "required"),
   department: z.string().min(1, "required"),
   equipmentType: z.string().min(1, "required"),
   machineId: z.string().min(1, "required"),
   maintenanceType: z.string().min(1, "required"),
   condition: z.string().min(1, "required"),
   failureType: z.string().min(1, "required"),
   requestDescription: z.string().min(1, "required"),
   frequency: z.string().min(1, "required"),
   consequence: z.string().min(1, "required"),
   actionTaken: z.string().min(1, "required"),
});

const SchemaStage2 = z.object({
   startTime: z.string().min(1, "Start time is required"),
   endTime: z.string().min(1, "End time is required"),
   executors: z.array(z.object({
      name: z.string().min(1),
      position: z.string()
   })).min(1, "At least one technician is required"),
   tasks: z.array(z.object({
      completed: z.boolean().optional()
   })).optional()
});

interface MaintenanceFormProps {
   type: 'R-MANT-02' | 'R-MANT-05';
   machines: Machine[];
   technicians: Technician[];
   onSave: (order: WorkOrder) => Promise<void> | void;
   onSaveAndStay?: (order: WorkOrder) => Promise<WorkOrder | void> | void;
   onCancel: () => void;
   initialMachineId?: string;
   initialData?: Partial<WorkOrder>;
}

export const MaintenanceForm: React.FC<MaintenanceFormProps> = ({
   type,
   machines,
   technicians,
   onSave,
   onSaveAndStay,
   onCancel,
   initialMachineId,
   initialData
}) => {
   const { t } = useLanguage();
   const { user, hasRole, hasPermission } = useAuth(); // RBAC Context

   // -- STATE MANAGEMENT --
   const [formData, setFormData] = useState<Partial<WorkOrder>>({
      formType: type,
      status: WorkOrderStatus.BACKLOG,
      currentStage: WorkOrderStage.DRAFT,
      priority: Priority.MEDIUM,
      createdDate: new Date().toISOString(),
      startDate: new Date().toISOString().split('T')[0],
      maintenanceType: 'Preventive',
      checklist: { pointClean: null, areaClean: null, guardsComplete: null, toolsRemoved: null, greaseCleaned: null, safetyActivated: null },
      consumedParts: [],
      executors: [{ name: '', lastName: '', position: '' }],
      tasks: [],
      totalMaintenanceCost: 0,
      machineWorkHours: 0,
      nextMaintenanceHours: 0
   });

   const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
   const [machineSearchTerm, setMachineSearchTerm] = useState('');
   const [validationError, setValidationError] = useState<string | null>(null);
   const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
   const clearInvalidField = (field: string) => {
      setInvalidFields(prev => {
         if (!prev.has(field)) return prev;
         const next = new Set(prev);
         next.delete(field);
         return next;
      });
   };
   const [duration, setDuration] = useState<string>('0h 0m');
   const [editingSection, setEditingSection] = useState<number | null>(null);
   const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
   const [isSaving, setIsSaving] = useState(false);

   // Helper UI renderers - Defined early to avoid TDZ and usage in handlers
   const isSection1Editable = (formData.currentStage === WorkOrderStage.DRAFT && hasPermission('create_wo')) || (editingSection === 1 && hasPermission('edit_wo'));
   
   const isSection2Editable = ((formData.currentStage === WorkOrderStage.DRAFT || formData.currentStage === WorkOrderStage.EXECUTION || formData.currentStage === WorkOrderStage.REQUESTED) && hasPermission('execute_wo')) || (editingSection === 2 && hasPermission('edit_wo'));

   const isSection3Editable = (formData.currentStage === WorkOrderStage.HANDOVER && hasPermission('supervise_order')) || (editingSection === 3 && hasPermission('edit_wo'));


   // -- INITIALIZATION EFFECT --
   useEffect(() => {
      if (initialMachineId) {
         const machine = machines.find(m => m.id === initialMachineId);
         if (machine) {
            handleMachineChange(machine.id);
         }
      }
      if (initialData) {
         setFormData(prev => {
            const nextData = {
               ...prev,
               ...initialData,
               formType: type,
               // Initialize assignedTo for new records if not present
               assignedTo: initialData.assignedTo || prev.assignedTo || user?.id,
               startDate: (initialData.startDate || initialData.createdDate || prev.startDate || prev.createdDate || new Date().toISOString()).split('T')[0],
               machineWorkHours: initialData.machineWorkHours || prev.machineWorkHours || 0,
               nextMaintenanceHours: initialData.nextMaintenanceHours || prev.nextMaintenanceHours || 0
            };
            // Deep check to prevent infinite React render loops if initialData reference keeps changing from parent
            if (JSON.stringify(prev) === JSON.stringify(nextData)) {
               return prev;
            }
            return nextData;
         });

         // If it's a new form coming from Map but with machine ID, we might need logic.
         // But if it's an existing order (has ID), we just load it.
         const machineIdToUse = initialData.machineId || initialMachineId;

         if (machineIdToUse) {
            const machine = machines.find(m => m.id === machineIdToUse);
            setSelectedMachine(machine || null);
            if (machine) setMachineSearchTerm(`${machine.name} (Alias: ${machine.alias || 'N/A'})`);

            // If we have an interval but NO tasks (e.g. fresh from map), generate tasks.
            // If we are editing an existing record, tasks should already be in initialData.
            if (initialData.interval && (!initialData.tasks || initialData.tasks.length === 0)) {
               const machine = machines.find(m => m.id === machineIdToUse);
               if (machine) {
                  // Pass the machine ID to generate tasks from the store
                  const tasks = generateCumulativeTasks(machine.id, machine.type, initialData.interval);
                  setFormData(prev => ({ ...prev, tasks }));
               }
            }
         }
      }
   }, [initialMachineId, initialData]);

   // Access store
   const { maintenancePlans, categories, parts: spareParts } = useMasterStore();
   const { users, fetchUsers } = useUserStore();
   const { deleteOrder } = useWorkOrderStore();

   useEffect(() => {
      // Ensure users are loaded
      if (users.length === 0) fetchUsers();
   }, []);

   const handleDelete = async (e?: React.MouseEvent) => {
      if (e) {
         e.preventDefault();
         e.stopPropagation();
      }
      if (!formData.id) return;

      try {
         await deleteOrder(formData.id);
         onCancel(); // Navigate back
      } catch (error: any) {
         console.error('Error deleting order:', error);
         alert('Error al eliminar el registro: ' + (error.message || 'Error desconocido'));
      } finally {
         setShowDeleteConfirm(false);
      }
   };

   // -- LOGIC ENGINE: Cumulative Tasks --
   const generateCumulativeTasks = (machineId: string, machineType: string, selectedInterval: string): MaintenanceTask[] => {
      // 1. Try to find a specific plan for this machine directly from the machine object first, then the specific array.
      const targetMachine = machines.find(m => m.id === machineId);
      const specificPlan = targetMachine?.maintenancePlans?.[0] || maintenancePlans.find(p => p.machineId === machineId);

      if (specificPlan && specificPlan.intervals && specificPlan.intervals.length > 0) {
         // Dynamic Logic based on Maintenance Module
         let targetHours = 0;
         const cleanSelected = selectedInterval.toLowerCase().trim();

         const targetInterval = specificPlan.intervals.find(i =>
            i.label.toLowerCase().trim() === cleanSelected ||
            parseInt(i.label) === parseInt(selectedInterval)
         );

         if (targetInterval) {
            targetHours = targetInterval.hours;
         } else {
            // Fallback: extract numbers directly from selectedInterval string if label mismatch
            const match = selectedInterval.match(/(\d+)/);
            if (match) {
               targetHours = parseInt(match[1]);
            } else {
               targetHours = -1;
            }
         }

         // Filter intervals <= targetHours and Sort by hours ASC
         const relevantIntervals = specificPlan.intervals
            .filter(i => i.hours <= targetHours)
            .sort((a, b) => a.hours - b.hours);

         if (relevantIntervals.length > 0) {
            // Flatten tasks
            let cumulativeTasks: MaintenanceTask[] = [];

            relevantIntervals.forEach(interval => {
               const labeledTasks = interval.tasks.map(t => ({
                  ...t,
                  id: `t-${interval.id}-${t.id}-${Math.random().toString(36).substr(2, 5)}`, // Ensure unique ID
                  intervalOrigin: interval.label,
                  completed: false
               }));
               cumulativeTasks = [...cumulativeTasks, ...labeledTasks];
            });

            return cumulativeTasks;
         }
      }
      // Removed legacy hardcoded fallback. 
      // If no plan exists, we return empty to avoid "fictitious" tasks.
      return [];
   };

   const handleTaskToggle = (taskId: string, action: string) => {
      console.log('DEBUG: handleTaskToggle called', { taskId, action, isSection2Editable });
      // Only allow toggle if editable
      if (!isSection2Editable) {
         console.warn('DEBUG: Toggle blocked because isSection2Editable is false');
         return;
      }

      setFormData(prev => {
         const tasks = prev.tasks?.map(t => {
            if (t.id === taskId) {
               const newChecks = { ...(t.checks || {}), [action]: !t.checks?.[action] };

               // Check if all required actions are done
               const requiredActions = Object.keys(t.actionFlags).filter(k => t.actionFlags[k as keyof typeof t.actionFlags] === true);
               const isComplete = requiredActions.every(k => newChecks[k] === true);

               return { ...t, checks: newChecks, completed: isComplete };
            }
            return t;
         });
         return { ...prev, tasks };
      });
   };

   // -- LOGIC ENGINE: Time Calculation --
   useEffect(() => {
      if (formData.startTime && formData.endTime) {
         // Mock calculation for demo purposes since we are storing just Time Strings (HH:MM)
         // In prod, use full ISO strings.
         const startParts = formData.startTime.split(':');
         const endParts = formData.endTime.split(':');

         if (startParts.length === 2 && endParts.length === 2) {
            let startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            let endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

            if (endMin < startMin) endMin += 24 * 60; // Cross midnight

            const diff = endMin - startMin;
            const hours = Math.floor(diff / 60);
            const mins = diff % 60;
            setDuration(`${hours}h ${mins}m`);
         }
      }
   }, [formData.startTime, formData.endTime]);

   // -- HANDLERS --

   const handleMachineChange = (machineId: string) => {
      const machine = machines.find(m => m.id === machineId);
      setSelectedMachine(machine || null);
      setMachineSearchTerm(machine ? `${machine.name} (Alias: ${machine.alias || 'N/A'})` : '');
      // Don't overwrite ID if we are just changing machine on a draft, but typically we shouldn't change machine on existing order.
      setFormData(prev => ({
         ...prev,
         machineId: machineId,
         machinePlate: machine?.plate || '',
         machineWorkHours: machine?.runningHours || 0,
         // Reset next maint hours if machine changes, it will be recalculated on interval change
         nextMaintenanceHours: 0,
         interval: prev.interval || '',
         tasks: prev.tasks || []
      }));
   };

   const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const interval = e.target.value;
      if (!selectedMachine) return;

      const tasks = generateCumulativeTasks(selectedMachine.id, selectedMachine.type, interval);
      
      // Calculate Next Maintenance Hours
      const currentHours = formData.machineWorkHours || selectedMachine.runningHours || 0;
      const intervalMatch = interval.match(/(\d+)/);
      const intervalHours = intervalMatch ? parseInt(intervalMatch[0]) : 0;
      const nextMaintHours = currentHours + intervalHours;

      setFormData(prev => ({
         ...prev,
         interval: interval,
         tasks: tasks,
         nextMaintenanceHours: nextMaintHours
      }));
   };

   const handleInternalSave = async (order: WorkOrder, stay: boolean = false) => {
      setIsSaving(true);
      try {
         const orderToSave = {
            ...order,
            formType: type,
            type: order.type || (type === 'R-MANT-02' ? 'PREVENTIVE' : 'CORRECTIVE'),
            totalMaintenanceCost: order.consumedParts?.reduce((sum, p) => sum + (p.totalCost || 0), 0) || 0
         };
         if (!orderToSave.title || orderToSave.title.trim() === '') {
            const machine = machines.find(m => m.id === orderToSave.machineId);
            const machineName = machine ? (machine.alias || machine.name) : 'Unknown Machine';

            if (type === 'R-MANT-02') {
               orderToSave.title = `${t('mant02.formTitle')} - ${machineName} - ${orderToSave.interval || 'N/A'}`;
            } else {
               const desc = orderToSave.description || 'Reporte de Falla';
               orderToSave.title = `Correctivo - ${machineName} - ${desc.substring(0, 30)}`;
            }
         }
         if (stay && onSaveAndStay) {
            const savedOrder = await onSaveAndStay(orderToSave);
            if (savedOrder && savedOrder.id && savedOrder.id !== formData.id) {
               console.log("Synchronizing Local ID from DB:", savedOrder.id);
               setFormData(prev => ({
                  ...prev,
                  id: savedOrder.id,
                  displayId: savedOrder.displayId
               }));
            }
         } else {
            await onSave(orderToSave);
         }
      } catch (error) {
         console.error("Error saving work order:", error);
         alert(`❌ Error al guardar la orden de trabajo: ${error || 'Unknown Error'}`);
      } finally {
         setIsSaving(false);
      }
   };

   const saveProgress = () => {
      // Save without closing or changing stage
      const orderToSave = {
         ...formData,
         id: formData.id || `WO-${Date.now()}` // Generate ID if it's the first save
      } as WorkOrder;

      handleInternalSave(orderToSave, false); // False = Close (Navigate back)
   };

   // -- STATE MACHINE TRANSITIONS --

   const transitionToRequested = () => {
      // RBAC: Check permission
      if (!hasPermission('create_wo')) {
         setValidationError("Acceso denegado: No tiene permiso para crear órdenes de trabajo.");
         return;
      }

      // Validation
      const Schema = type === 'R-MANT-05' ? SchemaStage1_RMANT05 : SchemaStage1;
      const result = Schema.safeParse(formData);

      if (!result.success) {
         const errorResult = result as any;
         console.warn("DEBUG ZOD VALIDATION FAILED on Section 1:", errorResult.error.issues);
         setValidationError("Por favor complete todos los campos obligatorios de la Sección 1.");

         const fieldErrors = new Set<string>();
         errorResult.error.issues.forEach((issue: any) => {
            fieldErrors.add(issue.path[0] as string);
         });
         setInvalidFields(fieldErrors);
         return;
      }

      const updated = {
         ...formData,
         currentStage: WorkOrderStage.REQUESTED,
         status: WorkOrderStatus.BACKLOG
      };
      setFormData(updated);
      setValidationError(null);
      // Auto save on transition
      handleInternalSave({ ...updated, id: formData.id || `WO-${Date.now()}` } as WorkOrder, true);
   };

   const startExecution = () => {
      // RBAC: Check permission
      if (!hasPermission('execute_wo')) return;

      const now = new Date();
      const updated: Partial<WorkOrder> = {
         ...formData,
         currentStage: WorkOrderStage.EXECUTION,
         status: WorkOrderStatus.IN_PROGRESS,
         startTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      };

      // R-MANT-05: Auto-initialize Report Received Date if empty
      if (type === 'R-MANT-05' && !formData.requestReceivedDate) {
         updated.requestReceivedDate = now.toISOString();
      }

      setFormData(updated);
      handleInternalSave({ ...updated, id: formData.id || `WO-${now.getTime()}` } as WorkOrder, true);
   };

   const finishExecution = () => {
      // RBAC: Check permission
      if (!hasPermission('execute_wo')) return;

      // REMOVED: Mandatory Task Completion Check
      // Some tasks might not be completed/marked as per user request.

      const updated = {
         ...formData,
         currentStage: WorkOrderStage.HANDOVER,
         status: WorkOrderStatus.REVIEW,
         endTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      };
      setFormData(updated);
      setValidationError(null);
      handleInternalSave({ ...updated, id: formData.id || `WO-${Date.now()}` } as WorkOrder, true);
   };

   const closeWorkOrder = () => {
      // RBAC: Check permission
      if (!hasPermission('supervise_order')) {
         setValidationError("Acceso denegado: No tiene permiso para supervisar y cerrar órdenes.");
         return;
      }

      // --- MANDATORY VALIDATION (R-MANT-02 & R-MANT-05) ---
      const errors: string[] = [];
      const fields = new Set<string>();

      // 1. Checklist Validation
      const checklistKeys = ['pointClean', 'areaClean', 'guardsComplete', 'toolsRemoved', 'greaseCleaned', 'safetyActivated'];
      checklistKeys.forEach(key => {
         if (formData.checklist?.[key as keyof typeof formData.checklist] === null || formData.checklist?.[key as keyof typeof formData.checklist] === undefined) {
            fields.add(`checklist.${key}`);
         }
      });

      // 2. Acceptance Fields Validation
      if (!formData.supervisorId) {
         fields.add('supervisorId');
         errors.push("Debe seleccionar el supervisor que recibe.");
      }
      if (!formData.closingDate) {
         fields.add('closingDate');
         errors.push("Debe registrar la fecha y hora de recepción.");
      }
      if (!formData.signatureExecutor || formData.signatureExecutor === 'false') {
         fields.add('signatureExecutor');
         errors.push("Falta la firma del ejecutante.");
      }
      if (!formData.signatureSupervisor || formData.signatureSupervisor === 'false') {
         fields.add('signatureSupervisor');
         errors.push("Falta la firma del supervisor.");
      }

      if (fields.size > 0) {
         setInvalidFields(fields);
         setValidationError("Existen campos obligatorios pendientes en la sección de Supervisión.");
         
         // Scroll to first error? For now just show the banner.
         return;
      }

      const newOrder = {
         ...formData,
         id: formData.id || `WO-${Date.now()}`, // Preserve ID if exists
         status: WorkOrderStatus.DONE,
         currentStage: WorkOrderStage.CLOSED,
         completedDate: new Date().toISOString()
      } as WorkOrder;

      setValidationError(null);
      setInvalidFields(new Set());
      handleInternalSave(newOrder);
   };

   const signSupervisor = () => {
      if (!isSection3Editable) return;
      if (formData.signatureSupervisor && formData.signatureSupervisor !== 'false') return; // Already signed

      setFormData(prev => ({
         ...prev,
         signatureSupervisor: user?.full_name || user?.name || 'Admin User',
         signatureSupervisorDate: new Date().toISOString()
      }));
   };

   return (
      <div className="h-full bg-industrial-900 flex flex-col overflow-hidden animate-fadeIn">
         {/* Top Bar */}
         <div className="p-4 border-b border-industrial-800 bg-industrial-900 flex justify-between items-center shrink-0">
            <div>
               <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {type === 'R-MANT-02'
                     ? t('mant02.formTitle')
                     : 'SOLICITUD, ANÁLISIS Y EJECUCIÓN DE AVERÍAS DE MAQUINARIAS / EQUIPOS AUXILIARES E INFRAESTRUCTURA'}
                  <span className="text-sm font-mono text-industrial-500 ml-2">{formData.displayId ? `ID: ${formData.displayId}` : '(New)'}</span>
               </h2>
               {/* Status Pills */}
               <div className="flex gap-2 text-xs mt-1 items-center">
                  <div className={`px-2 py-0.5 rounded transition-colors font-bold ${formData.currentStage === WorkOrderStage.DRAFT || formData.currentStage === WorkOrderStage.REQUESTED ? 'bg-emerald-500 text-white' : 'bg-industrial-800 text-industrial-500'}`}>
                     1. Solicitud
                  </div>
                  <span className="text-industrial-600">→</span>
                  <div className={`px-2 py-0.5 rounded transition-colors font-bold ${formData.currentStage === WorkOrderStage.EXECUTION ? 'bg-pink-500 text-white' : 'bg-industrial-800 text-industrial-500'}`}>
                     2. Ejecución
                  </div>
                  <span className="text-industrial-600">→</span>
                  <div className={`px-2 py-0.5 rounded transition-colors font-bold ${formData.currentStage === WorkOrderStage.HANDOVER ? 'bg-emerald-500 text-white' : 'bg-industrial-800 text-industrial-500'}`}>
                     3. Supervisión
                  </div>
                  <span className="text-industrial-600">→</span>
                  <div className={`px-2 py-0.5 rounded transition-colors font-bold ${formData.currentStage === WorkOrderStage.CLOSED ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-industrial-800 text-industrial-500'}`}>
                     4. Cerrado
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-4">
               {formData.id && (formData.currentStage === WorkOrderStage.CLOSED || formData.currentStage === WorkOrderStage.HANDOVER) && (
                  <button
                     type="button"
                     onClick={() => {
                        if (type === 'R-MANT-02') generateRMant02PDF(formData, selectedMachine || undefined);
                        else generateRMant05PDF(formData, selectedMachine || undefined);
                     }}
                     className="bg-industrial-800 hover:bg-industrial-700 text-industrial-300 px-4 py-2 rounded flex items-center gap-2 border border-industrial-600 transition-colors text-sm font-bold"
                  >
                     <Download className="w-4 h-4" />
                     Descargar PDF
                  </button>
               )}
               {formData.id && hasPermission('edit_wo') && (
                  <button
                     type="button"
                     onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowDeleteConfirm(true);
                     }}
                     className="p-2 bg-red-900/20 hover:bg-red-900/40 text-red-500 rounded border border-red-500/30 transition-colors"
                     title="Eliminar Registro"
                  >
                     <Trash2 className="w-5 h-5" />
                  </button>
               )}
               <button onClick={onCancel} className="text-industrial-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
         </div>

         {/* Global Validation Error Banner */}
         {validationError && (
            <div className="bg-red-900/50 border-b border-red-500/50 p-2 flex items-center justify-center gap-2 text-red-200 text-sm animate-pulse">
               <AlertCircle size={16} /> {validationError}
            </div>
         )}

         <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-8">

               {/* =====================================================================================
              SECTION 1: REQUEST (GREEN)
              Context: Solicitante / Gerente fills this to create the request.
          ===================================================================================== */}
               <section className={`rounded-lg border-2 transition-all duration-300 ${isSection1Editable
                  ? 'bg-emerald-900/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'bg-industrial-900 border-industrial-700'
                  }`}>
                  <div className={`p-4 border-b flex justify-between items-center ${isSection1Editable ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-industrial-800 border-industrial-700'}`}>
                     <h3 className={`${isSection1Editable ? 'text-emerald-400' : 'text-industrial-400'} font-bold flex items-center gap-2`}>
                        {type === 'R-MANT-02' ? '1. Solicitud de Mantenimiento' : '1. Solicitud de Servicio / Avería'} {!isSection1Editable && <Lock size={14} />}
                     </h3>
                     {!isSection1Editable && (
                        <button 
                           onClick={() => hasPermission('edit_wo') && setEditingSection(1)} 
                           className={`px-4 py-2 rounded text-sm font-bold transition-colors border ${
                              hasPermission('edit_wo') 
                              ? 'bg-emerald-900/50 hover:bg-emerald-800 text-emerald-400 border-emerald-500/30' 
                              : 'bg-emerald-900/10 text-emerald-400/30 border-emerald-500/10 cursor-not-allowed opacity-50'
                           }`}
                        >
                           Editar
                        </button>
                     )}
                     {editingSection === 1 && (
                        <button 
                           disabled={isSaving}
                           onClick={() => { setEditingSection(null); handleInternalSave(formData, true); }} 
                           className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                           {isSaving && <Loader2 size={14} className="animate-spin" />}
                           {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                     )}
                  </div>

                  {type === 'R-MANT-05' ? (
                     /* --- R-MANT-05 FORM LAYOUT (Corrective) --- */
                     <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {/* 1. Order Number */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Número de Orden</label>
                              <input type="text" readOnly disabled className="w-full bg-industrial-900/50 border border-industrial-700 rounded p-2 text-industrial-300 text-sm font-mono"
                                 value={formData.displayId || 'RM05-XXXXX'} />
                           </div>

                           {/* 2. Requester (Current User or Selection if Admin) */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Nombre del Solicitante</label>
                              <select disabled={!isSection1Editable}
                                 className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('assignedTo') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                 value={formData.assignedTo || ''}
                                 onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}>
                                 <option value="">- Seleccionar -</option>
                                 {/* Only show users with appropriate role (Gerente or Supervisor de Mantenimiento) */}
                                 {users.filter(u => u.roleName === 'Gerente de Mantenimiento' || u.roleName === 'Supervisor de Mantenimiento').map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name}</option>
                                 ))}
                              </select>
                           </div>

                           {/* 3. Date & Time - Expanded */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Fecha y Hora Solicitud</label>
                              <div className="flex gap-2">
                                 <input
                                    type="date"
                                    disabled={!isSection1Editable}
                                    className={`flex-1 bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none [color-scheme:dark] ${invalidFields.has('createdDate') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                    value={formData.createdDate?.split('T')[0] || new Date().toISOString().split('T')[0]}
                                    onChange={(e) => setFormData({ ...formData, createdDate: `${e.target.value}T${new Date().toLocaleTimeString()}` })}
                                 />
                                 <input
                                    type="time"
                                    disabled
                                    className="w-32 bg-industrial-900/50 border border-industrial-700 rounded p-2 text-industrial-400 text-sm text-center [color-scheme:dark]"
                                    value={(() => {
                                       const d = formData.createdDate ? new Date(formData.createdDate) : new Date();
                                       return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                    })()}
                                 />
                              </div>
                           </div>

                           {/* 4. Location / Area */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Ubicación / Área</label>
                              <select disabled={!isSection1Editable}
                                 className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('branch') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                 value={formData.branch || ''}
                                 onChange={e => setFormData({ ...formData, branch: e.target.value })}>
                                 <option value="">- Seleccionar -</option>
                                 <option value="Ravi Caribe">Ravi Caribe</option>
                                 <option value="Labels Caribe">Labels Caribe</option>
                              </select>
                           </div>

                           {/* 5. Department */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Departamento</label>
                              <select disabled={!isSection1Editable}
                                 className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('department') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                 value={formData.department || ''}
                                 onChange={e => setFormData({ ...formData, department: e.target.value as any })}>
                                 <option value="">- Seleccionar -</option>
                                 <option value="Mantenimiento">Mantenimiento</option>
                                 <option value="Almacén">Almacén</option>
                                 <option value="Calidad">Calidad</option>
                                 <option value="Producción">Producción</option>
                                 <option value="Servicios Generales">Servicios Generales</option>
                                 <option value="Administración">Administración</option>
                              </select>
                           </div>

                           {/* 6. Equipment for Maintenance */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Equipo para Mantenimiento</label>
                              <select disabled={!isSection1Editable}
                                 className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('equipmentType') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                 value={formData.equipmentType || ''}
                                 onChange={e => setFormData({ ...formData, equipmentType: e.target.value as any })}>
                                 <option value="">- Seleccionar -</option>
                                 <option value="Mantenimiento Maquinaria">Mantenimiento Maquinaria</option>
                                 <option value="Mantenimiento Elemento Auxiliar">Mantenimiento Elemento Auxiliar</option>
                              </select>
                           </div>

                           {/* 7. Machine / Accessory */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Máquina / Accesorio</label>
                              <div className="relative">
                                 <input
                                    list="rmant05-machine-list"
                                    disabled={!isSection1Editable}
                                    className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('machineId') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                    placeholder="Buscar equipo por nombre, alias o placa..."
                                    value={machineSearchTerm}
                                    onChange={(e) => {
                                       const val = e.target.value;
                                       setMachineSearchTerm(val);
                                       if (val === '') {
                                          handleMachineChange('');
                                       } else {
                                          const match = machines.find(m => m.isActive && (`${m.name} (Alias: ${m.alias || 'N/A'})` === val || m.plate === val));
                                          if (match) handleMachineChange(match.id);
                                       }
                                    }}
                                 />
                                 <datalist id="rmant05-machine-list">
                                    {machines.filter(m => m.isActive).map(m => (
                                       <option key={m.id} value={`${m.name} (Alias: ${m.alias || 'N/A'})`}>
                                          Placa: {m.plate}
                                       </option>
                                    ))}
                                 </datalist>
                              </div>
                           </div>

                           {/* 8. Maintenance Type */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Tipo de Mantenimiento</label>
                              <select disabled={!isSection1Editable}
                                 className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('maintenanceType') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                 value={formData.maintenanceType || ''}
                                 onChange={e => setFormData({ ...formData, maintenanceType: e.target.value as any })}>
                                 <option value="">- Seleccionar -</option>
                                 <option value="Correctivo">Correctivo</option>
                                 <option value="Preventivo">Preventivo</option>
                                 <option value="Cambio de Formato">Cambio de Formato</option>
                                 <option value="Solicitud de Servicio">Solicitud de Servicio</option>
                              </select>
                           </div>

                           {/* 9. Condition */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Condición</label>
                              <select disabled={!isSection1Editable}
                                 className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('condition') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                 value={formData.condition || ''}
                                 onChange={e => setFormData({ ...formData, condition: e.target.value as any })}>
                                 <option value="">- Seleccionar -</option>
                                 <option value="Normal">Normal</option>
                                 <option value="Media">Media</option>
                                 <option value="Crítica">Crítica</option>
                              </select>
                           </div>

                           {/* 10. Failure Type */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Tipo de Avería</label>
                              <select disabled={!isSection1Editable}
                                 className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('failureType') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                 value={formData.failureType || ''}
                                 onChange={e => setFormData({ ...formData, failureType: e.target.value as any })}>
                                 <option value="">- Seleccionar -</option>
                                 <option value="Mecánica">Mecánica</option>
                                 <option value="Eléctrica">Eléctrica</option>
                                 <option value="Electrónica">Electrónica</option>
                                 <option value="Plomería">Plomería</option>
                              </select>
                           </div>
                        </div>

                        {/* NEW SECTION: Description & Analysis */}
                        <div className="border-t border-industrial-700 pt-6">
                           <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                              <span className="bg-industrial-700 text-xs px-2 py-0.5 rounded">Detalles</span>
                              Descripción de la Avería / Solicitud de Servicio
                           </h4>

                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Request Details */}
                              <div className="space-y-1 lg:col-span-2">
                                 <label className="text-xs text-industrial-400 font-bold">Detalles Solicitud - Avería</label>
                                 <textarea
                                    disabled={!isSection1Editable}
                                    className={`w-full bg-industrial-900 border rounded p-3 text-white text-sm focus:border-emerald-500 outline-none min-h-[100px] ${invalidFields.has('requestDescription') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                    placeholder="Describa detalladamente el problema o solicitud..."
                                    value={formData.requestDescription || ''}
                                    onChange={e => setFormData({ ...formData, requestDescription: e.target.value })}
                                 />
                              </div>

                              {/* Frequency */}
                              <div className="space-y-1">
                                 <label className="text-xs text-industrial-400 font-bold">Frecuencia</label>
                                 <select disabled={!isSection1Editable}
                                    className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('frequency') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                    value={formData.frequency || ''}
                                    onChange={e => setFormData({ ...formData, frequency: e.target.value as any })}>
                                    <option value="">- Seleccionar -</option>
                                    <option value="Primera vez">Primera vez</option>
                                    <option value="Ocasional">Ocasional</option>
                                    <option value="Frecuente">Frecuente</option>
                                    <option value="Muy frecuente">Muy frecuente</option>
                                 </select>
                              </div>

                              {/* Consequence */}
                              <div className="space-y-1">
                                 <label className="text-xs text-industrial-400 font-bold">Consecuencia</label>
                                 <select disabled={!isSection1Editable}
                                    className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('consequence') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                    value={formData.consequence || ''}
                                    onChange={e => setFormData({ ...formData, consequence: e.target.value as any })}>
                                    <option value="">- Seleccionar -</option>
                                    <option value="Ninguna">Ninguna</option>
                                    <option value="Bajo Rendimiento">Bajo Rendimiento</option>
                                    <option value="Parada">Parada</option>
                                 </select>
                              </div>

                              {/* Containment Action */}
                              <div className="space-y-1 lg:col-span-2">
                                 <label className="text-xs text-industrial-400 font-bold">Acción de contención tomada por el solicitante</label>
                                 <textarea
                                    disabled={!isSection1Editable}
                                    className={`w-full bg-industrial-900 border rounded p-3 text-white text-sm focus:border-emerald-500 outline-none min-h-[80px] ${invalidFields.has('actionTaken') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                    placeholder="¿Qué medidas se tomaron provisionalmente?"
                                    value={formData.actionTaken || ''}
                                    onChange={e => setFormData({ ...formData, actionTaken: e.target.value })}
                                 />
                              </div>
                           </div>
                        </div>
                     </div>
                  ) : (
                     /* --- R-MANT-02 FORM LAYOUT (Preventive / Existing) --- */
                     <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* 1. Order Number (Auto) */}
                        <div className="space-y-1">
                           <label className="text-xs text-industrial-400 font-bold">Número de Orden</label>
                           <input type="text" readOnly disabled className="w-full bg-industrial-900/50 border border-industrial-700 rounded p-2 text-industrial-300 text-sm font-mono"
                              value={formData.displayId || 'RM02-XXXXX'} />
                        </div>

                        {/* 2. Maintenance Type */}
                        <div className="space-y-1">
                           <label className="text-xs text-industrial-400 font-bold">Tipo de Mantenimiento</label>
                           <select disabled={!isSection1Editable}
                              className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('maintenanceType') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                              value={formData.maintenanceType || 'Preventive'}
                              onChange={e => {
                                 setFormData({ ...formData, maintenanceType: e.target.value as any });
                                 clearInvalidField('maintenanceType');
                              }}>
                              <option value="Preventive">Preventivo</option>
                              <option value="Programmed">Programado</option>
                           </select>
                        </div>

                        {/* 3. Machine Search (Alias) */}
                        <div className="space-y-1">
                           <label className="text-xs text-industrial-400 font-bold">{t('form.machine')} (Nombre o Alias)</label>
                           <div className="relative">
                              <input
                                 list="machine-list"
                                 disabled={!isSection1Editable}
                                 className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none placeholder-industrial-600 ${invalidFields.has('machineId') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                                 placeholder="Buscar equipo..."
                                 value={machineSearchTerm}
                                 onChange={(e) => {
                                    const val = e.target.value;
                                    setMachineSearchTerm(val);
                                    if (val === '') {
                                       handleMachineChange('');
                                    } else {
                                       const match = machines.find(m => m.isActive && (`${m.name} (Alias: ${m.alias || 'N/A'})` === val || m.plate === val));
                                       if (match) {
                                          handleMachineChange(match.id);
                                          clearInvalidField('machineId');
                                       }
                                    }
                                 }}
                              />
                              <datalist id="machine-list">
                                 {machines.filter(m => m.isActive).map(m => (
                                    <option key={m.id} value={`${m.name} (Alias: ${m.alias || 'N/A'})`}>
                                       Placa: {m.plate}
                                    </option>
                                 ))}
                              </datalist>
                           </div>
                        </div>

                        {/* 4. License Plate (Auto) */}
                        <div className="space-y-1">
                           <label className="text-xs text-industrial-400 font-bold">{t('form.plate')}</label>
                           <input type="text" readOnly className="w-full bg-industrial-900/50 border border-industrial-700 rounded p-2 text-industrial-300 text-sm" value={selectedMachine?.plate || ''} />
                        </div>

                        {/* 5. Start Date (Calendar) */}
                        <div className="space-y-1">
                           <label className="text-xs text-industrial-400 font-bold">Fecha de Inicio</label>
                           <input
                              type="date"
                              disabled={!isSection1Editable}
                              className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none [color-scheme:dark]"
                              value={formData.startDate || ''}
                              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                           />
                        </div>

                        <div className="space-y-1">
                           <label className="text-xs text-industrial-400 font-bold">{t('mant02.interval')}</label>
                           <select disabled={!isSection1Editable || !selectedMachine}
                              className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm disabled:opacity-50 ${!selectedMachine?.maintenancePlans?.[0] && maintenancePlans.find(p => p.machineId === selectedMachine?.id) === undefined ? 'border-amber-500/50 bg-amber-500/5' : 'border-industrial-600'}`}
                              value={formData.interval || ''} onChange={handleIntervalChange}>
                              <option value="">- Seleccionar Programa -</option>
                              {(() => {
                                 const plan = selectedMachine?.maintenancePlans?.[0] || maintenancePlans.find(p => p.machineId === selectedMachine?.id);
                                 const intervals = (plan?.intervals && plan.intervals.length > 0)
                                    ? plan.intervals.slice().sort((a, b) => a.hours - b.hours).map(i => i.label)
                                    : (selectedMachine?.intervals && selectedMachine.intervals.length > 0 ? selectedMachine.intervals : []);

                                 return intervals.map(int => <option key={int} value={int}>{int}</option>);
                              })()}
                           </select>
                           {selectedMachine && !selectedMachine.maintenancePlans?.[0] && !maintenancePlans.find(p => p.machineId === selectedMachine.id) && (
                              <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                                 <AlertCircle size={10} /> Este equipo no tiene intervalos de mantenimiento configurados.
                              </p>
                           )}
                        </div>

                        {/* 7. Current Hours (Formatted) */}
                        <div className="space-y-1">
                           <label className="text-xs text-industrial-400 font-bold">Horas de Trabajo Máquina</label>
                           <input
                              type="text"
                              readOnly
                              className="w-full bg-industrial-900/50 border border-industrial-700 rounded p-2 text-industrial-300 text-sm font-mono text-right"
                              value={(formData.machineWorkHours !== undefined && formData.machineWorkHours !== null)
                                 ? formData.machineWorkHours.toLocaleString('en-US') 
                                 : (selectedMachine?.runningHours?.toLocaleString('en-US') || '0')}
                           />
                        </div>

                        {/* 8. Next Maintenance Hours (Formatted) */}
                        <div className="space-y-1">
                           <label className="text-xs text-industrial-400 font-bold text-emerald-400">Horas Próximo Mantenimiento</label>
                           <input
                              type="text"
                              readOnly
                              className="w-full bg-industrial-900/50 border border-industrial-700 rounded p-2 text-emerald-400 font-bold text-sm font-mono text-right"
                              value={formData.nextMaintenanceHours ? formData.nextMaintenanceHours.toLocaleString('en-US') : '0'}
                           />
                        </div>

                        {/* 9. Executor (Filtered) */}
                        <div className="space-y-1">
                           <label className="text-xs text-industrial-400 font-bold">Ejecutante (Técnico)</label>
                           <select disabled={!isSection1Editable}
                              className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('assignedMechanic') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                              value={formData.assignedMechanic || ''}
                              onChange={e => {
                                 setFormData({ ...formData, assignedMechanic: e.target.value });
                                 clearInvalidField('assignedMechanic');
                              }}>
                              <option value="">- Seleccionar Técnico -</option>
                              {users.filter(u => u.roleName === 'Electromecánico Labels' || u.roleName === 'Electromecánico Ravi').map(u => (
                                 <option key={u.id} value={u.id}>{u.full_name}</option>
                              ))}
                           </select>
                        </div>

                        {/* 10. Supervisor (Filtered) */}
                        <div className="space-y-1">
                           <label className="text-xs text-industrial-400 font-bold">Supervisor</label>
                           <select disabled={!isSection1Editable}
                              className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('supervisor') ? 'border-red-500 bg-red-900/10' : 'border-industrial-600'}`}
                              value={formData.supervisor || ''}
                              onChange={e => {
                                 setFormData({ ...formData, supervisor: e.target.value });
                                 clearInvalidField('supervisor');
                              }}>
                              <option value="">- Seleccionar Supervisor -</option>
                              {users.filter(u => u.roleName === 'Supervisor de Mantenimiento').map(u => (
                                 <option key={u.id} value={u.id}>{u.full_name}</option>
                              ))}
                           </select>
                        </div>

                     </div>
                  )}

                  {isSection1Editable && (
                     <div className="p-4 border-t border-emerald-500/30 flex justify-end gap-3">
                        <button 
                           type="button" 
                           disabled={isSaving}
                           onClick={saveProgress} 
                           className="text-emerald-400 hover:text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           Guardar Borrador
                        </button>
                        <button 
                           type="button" 
                           disabled={isSaving}
                           onClick={transitionToRequested} 
                           className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded font-bold shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           {isSaving && <Loader2 size={16} className="animate-spin" />}
                           {isSaving ? 'Procesando...' : <>Solicitar Mantenimiento <ArrowRight size={16} /></>}
                        </button>
                     </div>
                  )}
               </section>


               {/* =====================================================================================
              SECTION 2: EXECUTION (PINK)
              Context: Maintenance Tech performs tasks, logs parts, and times.
          ===================================================================================== */}
               <section className={`rounded-lg border-2 transition-all duration-300 ${isSection2Editable
                  ? 'bg-pink-900/10 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.1)]'
                  : 'bg-industrial-900 border-industrial-700'
                  }`}>
                  <div className={`p-4 border-b flex justify-between items-center ${isSection2Editable ? 'bg-pink-900/20 border-pink-500/30' : 'bg-industrial-800 border-industrial-700'}`}>
                     <h3 className={`${isSection2Editable ? 'text-pink-400' : 'text-industrial-400'} font-bold flex items-center gap-2`}>
                        2. Intervenciones de Mantenimiento {!isSection2Editable && <Lock size={14} />}
                     </h3>
                     <div className="flex gap-2">
                         {formData.currentStage === WorkOrderStage.REQUESTED && hasPermission('execute_wo') && (
                            <button 
                               disabled={isSaving}
                               onClick={startExecution} 
                               className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-1 rounded text-sm font-bold flex items-center gap-1 animate-pulse disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                               {isSaving ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                               {isSaving ? 'Iniciando...' : 'Iniciar Trabajo'}
                            </button>
                         )}
                         {!isSection2Editable && (
                            <button 
                               onClick={() => hasPermission('edit_wo') && setEditingSection(2)} 
                               className={`px-4 py-2 rounded text-sm font-bold transition-colors border ${
                                  hasPermission('edit_wo') 
                                  ? 'bg-pink-900/50 hover:bg-pink-800 text-pink-400 border-pink-500/30' 
                                  : 'bg-pink-900/10 text-pink-400/30 border-pink-500/10 cursor-not-allowed opacity-50'
                               }`}
                            >
                               Editar
                            </button>
                         )}
                         {editingSection === 2 && (
                            <button 
                               disabled={isSaving}
                               onClick={() => { setEditingSection(null); handleInternalSave(formData, true); }} 
                               className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                               {isSaving && <Loader2 size={14} className="animate-spin" />}
                               {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                         )}
                      </div>
                  </div>

                  <div className={`p-6`}>
                     {/* Common: Time & Duration */}
                     <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-industrial-900 p-3 rounded border border-industrial-700">
                           <span className="text-xs text-industrial-500 block">Hora Inicio</span>
                           <span className="text-xl font-mono text-white">{formData.startTime || '--:--'}</span>
                        </div>
                        <div className="bg-industrial-900 p-3 rounded border border-industrial-700">
                           <span className="text-xs text-industrial-500 block">Hora Fin</span>
                           <span className="text-xl font-mono text-white">{formData.endTime || '--:--'}</span>
                        </div>
                        <div className="bg-industrial-900 p-3 rounded border border-industrial-700">
                           <span className="text-xs text-industrial-500 block flex items-center gap-1"><Clock size={10} /> Duración</span>
                           <span className="text-xl font-mono text-pink-400">{duration}</span>
                        </div>
                     </div>

                     {type === 'R-MANT-05' ? (
                        /* --- R-MANT-05 EXECUTION LAYOUT --- */
                        <div className="space-y-6">

                           {/* 1. Header Fields */}
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Report Received By */}
                              <div className="space-y-1">
                                 <label className="text-xs text-industrial-400 font-bold">Reporte Recibido Por</label>
                                 <select disabled={!isSection2Editable}
                                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-pink-500 outline-none"
                                    value={formData.requestReceivedBy || ''}
                                    onChange={e => setFormData({ ...formData, requestReceivedBy: e.target.value })}>
                                    <option value="">- Seleccionar -</option>
                                    {users.filter(u => 
                                       u.roleName === 'Supervisor de Mantenimiento' || 
                                       u.roleName === 'Gerente de Mantenimiento' || 
                                       u.roleName === 'Electromecánico Labels' || 
                                       u.roleName === 'Electromecánico Ravi'
                                    ).map(u => (
                                       <option key={u.id} value={u.id}>{u.full_name}</option>
                                    ))}
                                 </select>
                              </div>

                              {/* Date/Time Received */}
                              <div className="space-y-1">
                                 <label className="text-xs text-industrial-400 font-bold">Fecha y Hora de Reporte Recibido</label>
                                 <div className="flex gap-2">
                                    <input
                                       type="date"
                                       disabled={!isSection2Editable}
                                       className="flex-1 bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-pink-500 outline-none"
                                       value={formData.requestReceivedDate?.split('T')[0] || new Date().toISOString().split('T')[0]}
                                       onChange={(e) => setFormData({ ...formData, requestReceivedDate: `${e.target.value}T${new Date().toLocaleTimeString()}` })}
                                    />
                                    <input
                                       type="time"
                                       disabled
                                       className="w-32 bg-industrial-900/50 border border-industrial-700 rounded p-2 text-industrial-400 text-sm text-center"
                                       value={(() => {
                                          const d = formData.requestReceivedDate ? new Date(formData.requestReceivedDate) : new Date();
                                          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                       })()}
                                    />
                                 </div>
                              </div>

                              {/* Assigned Personnel */}
                              <div className="space-y-1">
                                 <label className="text-xs text-industrial-400 font-bold">Personal Asignado / Ejecutante</label>
                                 <select disabled={!isSection2Editable}
                                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white text-sm focus:border-pink-500 outline-none"
                                    value={formData.assignedMechanic || ''}
                                    onChange={e => setFormData({ ...formData, assignedMechanic: e.target.value })}>
                                    <option value="">- Seleccionar Técnico -</option>
                                    {users.filter(u => 
                                       u.roleName === 'Electromecánico Labels' || 
                                       u.roleName === 'Electromecánico Ravi'
                                    ).map(u => (
                                       <option key={u.id} value={u.id}>{u.full_name}</option>
                                    ))}
                                 </select>
                              </div>
                           </div>

                           {/* 2. Failures and Activities (Dynamic Table) */}
                           <div className="border-t border-industrial-700 pt-6">
                              <h4 className="text-sm font-bold text-white mb-4">Registro Averías y Actividades Realizadas</h4>
                              <div className="bg-industrial-900 rounded border border-industrial-700 overflow-hidden">
                                 <table className="w-full text-sm text-left text-industrial-300">
                                    <thead className="bg-industrial-800 text-industrial-400 font-bold">
                                       <tr>
                                          <th className="p-3 w-1/3">Causa de la Avería</th>
                                          <th className="p-3">Actividades Realizadas</th>
                                          {isSection2Editable && <th className="p-3 w-10"></th>}
                                       </tr>
                                    </thead>
                                    <tbody>
                                       {(formData.failuresAndActivities || [{ cause: '', activity: '' }]).map((item, idx) => (
                                          <tr key={idx} className="border-b border-industrial-800 last:border-0 hover:bg-industrial-800/30 transition-colors">
                                             <td className="p-2 align-top">
                                                <input
                                                   type="text"
                                                   disabled={!isSection2Editable}
                                                   className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white focus:border-pink-500 outline-none placeholder-industrial-600"
                                                   placeholder="Causa..."
                                                   value={item.cause}
                                                   onChange={(e) => {
                                                      const updated = [...(formData.failuresAndActivities || [{ cause: '', activity: '' }])];
                                                      updated[idx].cause = e.target.value;
                                                      setFormData({ ...formData, failuresAndActivities: updated });
                                                   }}
                                                />
                                             </td>
                                             <td className="p-2 align-top">
                                                <textarea
                                                   disabled={!isSection2Editable}
                                                   className="w-full bg-industrial-900 border border-industrial-600 rounded p-2 text-white focus:border-pink-500 outline-none placeholder-industrial-600 min-h-[60px]"
                                                   placeholder="Actividad..."
                                                   value={item.activity}
                                                   onChange={(e) => {
                                                      const updated = [...(formData.failuresAndActivities || [{ cause: '', activity: '' }])];
                                                      updated[idx].activity = e.target.value;
                                                      setFormData({ ...formData, failuresAndActivities: updated });
                                                   }}
                                                />
                                             </td>
                                             {isSection2Editable && (
                                                <td className="p-2 align-top text-center">
                                                   <button
                                                      onClick={() => {
                                                         const updated = [...(formData.failuresAndActivities || [])];
                                                         updated.splice(idx, 1);
                                                         setFormData({ ...formData, failuresAndActivities: updated });
                                                      }}
                                                      className="text-industrial-500 hover:text-red-400 p-1"
                                                   >
                                                      <Trash2 size={16} />
                                                   </button>
                                                </td>
                                             )}
                                          </tr>
                                       ))}
                                    </tbody>
                                 </table>
                                 {isSection2Editable && (
                                    <div className="p-2 border-t border-industrial-700 bg-industrial-800/50">
                                       <button
                                          onClick={() => setFormData(p => ({
                                             ...p,
                                             failuresAndActivities: [...(p.failuresAndActivities || []), { cause: '', activity: '' }]
                                          }))}
                                          className="text-pink-400 hover:text-pink-300 text-xs font-bold flex items-center gap-1"
                                       >
                                          <Plus size={14} /> Add New
                                       </button>
                                    </div>
                                 )}
                              </div>
                           </div>



                           {/* 3. Spare Parts (Dynamic Table) */}
                           <div className="border-t border-industrial-700 pt-6">
                              <h4 className="text-sm font-bold text-white mb-4">Repuestos Utilizados</h4>
                              <div className="bg-industrial-900 rounded border border-industrial-700 mb-2">
                                 <table className="w-full text-sm text-left text-industrial-300">
                                    <thead className="bg-industrial-800 text-industrial-400 font-bold">
                                       <tr>
                                          <th className="p-3">Código / Repuesto</th>
                                          <th className="p-3 w-32">Unidad</th>
                                          <th className="p-3 w-24">Cant.</th>
                                          <th className="p-3 w-32 text-right">Costo Unit.</th>
                                          <th className="p-3 w-32 text-right">Total</th>
                                          {isSection2Editable && <th className="p-3 w-10"></th>}
                                       </tr>
                                    </thead>
                                    <tbody>
                                       {(formData.consumedParts || []).map((part, idx) => (
                                          <tr key={idx} className="border-b border-industrial-800 last:border-0 hover:bg-industrial-800/30 transition-colors">
                                             <td className="p-2">
                                                <div className="relative group">
                                                   <input
                                                      type="text"
                                                      disabled={!isSection2Editable}
                                                      className={`w-full bg-industrial-900 border ${!part.partId && part.partName ? 'border-pink-500' : 'border-industrial-600'} rounded p-1 text-white text-xs focus:border-pink-500 outline-none placeholder-industrial-600`}
                                                      placeholder="Buscar repuesto..."
                                                      value={part.partName || ''}
                                                      onChange={(e) => {
                                                         const val = e.target.value;
                                                         const updated = [...(formData.consumedParts || [])];
                                                         // Updates name for search, clears ID to show it's not selected yet
                                                         updated[idx] = { ...updated[idx], partName: val, partId: '', unitCost: 0, totalCost: 0 };
                                                         setFormData({ ...formData, consumedParts: updated });
                                                      }}
                                                   />
                                                   {/* Custom Dropdown Results - connected to inventory */}
                                                   {!part.partId && part.partName && (
                                                      <div className="absolute left-0 top-full mt-1 w-[360px] z-50 bg-industrial-800 border border-industrial-600 rounded-md shadow-xl max-h-60 overflow-y-auto">
                                                         {(spareParts || []).filter(p =>
                                                            p.name.toLowerCase().includes(part.partName.toLowerCase()) ||
                                                            p.partNumber.toLowerCase().includes(part.partName.toLowerCase())
                                                         ).length > 0 ? (
                                                            (spareParts || []).filter(p =>
                                                               p.name.toLowerCase().includes(part.partName.toLowerCase()) ||
                                                               p.partNumber.toLowerCase().includes(part.partName.toLowerCase())
                                                            ).map(sp => (
                                                               <div
                                                                  key={sp.id}
                                                                  className="p-2.5 hover:bg-industrial-700 cursor-pointer border-b border-industrial-700/50 last:border-0 flex justify-between items-center gap-3"
                                                                  onClick={() => {
                                                                     const updated = [...(formData.consumedParts || [])];
                                                                     updated[idx] = {
                                                                        ...updated[idx],
                                                                        partId: sp.id,
                                                                        partName: `${sp.partNumber} - ${sp.name}`,
                                                                        sku: sp.partNumber,
                                                                        unitCost: Math.max(0, sp.cost || 0),
                                                                        totalCost: Math.max(0, (sp.cost || 0) * (updated[idx].quantity || 0)),
                                                                        unit: sp.unitOfMeasure || 'Unidad'
                                                                     };
                                                                     const totalCost = updated.reduce((sum, p) => sum + (p.totalCost || 0), 0);
                                                                     setFormData({ ...formData, consumedParts: updated, totalMaintenanceCost: totalCost });
                                                                  }}
                                                               >
                                                                  <div className="flex flex-col flex-1 min-w-0">
                                                                     <span className="text-white text-xs font-bold truncate">
                                                                        <span className="text-pink-400 mr-1">{sp.partNumber}</span>
                                                                        {sp.name}
                                                                     </span>
                                                                     <span className="text-industrial-400 text-[10px]">
                                                                        {sp.unitOfMeasure || 'Unidad'} &bull; RD${(sp.cost || 0).toFixed(2)}
                                                                     </span>
                                                                  </div>
                                                                  <div className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded font-bold ${sp.currentStock <= sp.minStock
                                                                     ? 'bg-red-900/50 text-red-400 border border-red-500/30'
                                                                     : 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30'
                                                                     }`}>
                                                                     Stock: {sp.currentStock}
                                                                  </div>
                                                               </div>
                                                            ))
                                                         ) : (
                                                            <div className="p-3 text-industrial-500 text-xs italic text-center">No se encontraron repuestos</div>
                                                         )}
                                                      </div>
                                                   )}
                                                </div>
                                             </td>
                                             <td className="p-2">
                                                <input type="text" readOnly className="w-full bg-industrial-900/50 border border-industrial-800 rounded p-1 text-xs text-industrial-400" value={part.unit || 'Unidad'} />
                                             </td>
                                             <td className="p-2">
                                                <input
                                                   type="number"
                                                   min="0"
                                                   disabled={!isSection2Editable}
                                                   className="w-full bg-industrial-900 border border-industrial-600 rounded p-1 text-white text-xs focus:border-pink-500 outline-none text-right"
                                                   value={part.quantity}
                                                   onChange={(e) => {
                                                      const qty = Math.max(0, parseFloat(e.target.value) || 0);
                                                      const updated = [...(formData.consumedParts || [])];
                                                      updated[idx] = {
                                                         ...updated[idx],
                                                         quantity: qty,
                                                         totalCost: qty * (updated[idx].unitCost || 0)
                                                      };
                                                      const totalCost = updated.reduce((sum, p) => sum + (p.totalCost || 0), 0);
                                                      setFormData({ ...formData, consumedParts: updated, totalMaintenanceCost: totalCost });
                                                   }}
                                                />
                                             </td>
                                             <td className="p-2 text-right font-mono text-xs">
                                                RD${part.unitCost.toFixed(2)}
                                             </td>
                                             <td className="p-2 text-right font-mono text-xs font-bold text-emerald-400">
                                                RD${part.totalCost.toFixed(2)}
                                             </td>
                                             {isSection2Editable && (
                                                <td className="p-2 text-center">
                                                   <button
                                                      onClick={() => {
                                                         const updated = [...(formData.consumedParts || [])];
                                                         updated.splice(idx, 1);
                                                         const totalCost = updated.reduce((sum, p) => sum + (p.totalCost || 0), 0);
                                                         setFormData({ ...formData, consumedParts: updated, totalMaintenanceCost: totalCost });
                                                      }}
                                                      className="text-industrial-500 hover:text-red-400 p-1"
                                                   >
                                                      <Trash2 size={14} />
                                                   </button>
                                                </td>
                                             )}
                                          </tr>
                                       ))}
                                    </tbody>
                                 </table>
                                 {isSection2Editable && (
                                    <div className="p-2 border-t border-industrial-700 bg-industrial-800/50">
                                       <button
                                          onClick={() => setFormData(p => {
                                             const updated = [...(p.consumedParts || []), { partId: '', partName: '', sku: '', quantity: 1, unit: 'Unidad', unitCost: 0, totalCost: 0 }];
                                             const totalCost = updated.reduce((sum, p) => sum + (p.totalCost || 0), 0);
                                             return { ...p, consumedParts: updated, totalMaintenanceCost: totalCost };
                                          })}
                                          className="text-pink-400 hover:text-pink-300 text-xs font-bold flex items-center gap-1"
                                       >
                                          <Plus size={14} /> Add Part
                                       </button>
                                    </div>
                                 )}
                              </div>

                              {/* Total Cost Summary */}
                              <div className="flex justify-end">
                                 <div className="bg-industrial-900 p-3 rounded border border-industrial-700 min-w-[200px]">
                                    <span className="text-xs text-industrial-500 block">Costo Total Repuestos</span>
                                    <span className="text-xl font-mono text-emerald-400 font-bold">
                                       RD${(formData.consumedParts?.reduce((sum, p) => sum + p.totalCost, 0) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                 </div>
                              </div>
                           </div>
                        </div>
                     ) : (
                        /* --- R-MANT-02 EXECUTION LAYOUT (Existing) --- */
                        <>
                           {/* Tasks List (Inherited) */}
                           <div className="mb-6">
                              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><CheckSquare size={14} className="text-pink-500" /> Tareas de Mantenimiento Acumuladas</h4>
                              <div className="bg-industrial-900 rounded border border-industrial-700 overflow-hidden">
                                 {/* New Protocol Viewer - Grouped by Interval Origin */}
                                 {formData.tasks && formData.tasks.length > 0 ? (
                                    Array.from(new Set(formData.tasks.map(t => t.intervalOrigin))).map(origin => (
                                       <div key={origin} className="mb-8 last:mb-0">
                                          <h5 className="text-industrial-300 font-bold mb-2 border-b border-industrial-700 pb-1 text-xs uppercase tracking-wider">
                                             {origin || 'Tareas Generales'}
                                          </h5>
                                          <ProtocolViewer
                                             tasks={formData.tasks?.filter(t => t.intervalOrigin === origin) || []}
                                             readOnly={!isSection2Editable}
                                             onToggle={handleTaskToggle}
                                          />
                                       </div>
                                    ))
                                 ) : (
                                    <div className="text-center p-4 text-industrial-500 italic">No tasks generated.</div>
                                 )}


                              </div>
                           </div>

                            {/* Repuestos Utilizados */}
                            <div className="mb-6 border-t border-industrial-700 pt-6">
                               <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Package size={14} className="text-pink-500" /> Repuestos Utilizados</h4>
                               <div className="bg-industrial-900 rounded border border-industrial-700 mb-2">
                                  <table className="w-full text-sm text-left text-industrial-300">
                                     <thead className="bg-industrial-800 text-industrial-400 font-bold">
                                        <tr>
                                           <th className="p-3">Código / Repuesto</th>
                                           <th className="p-3 w-32">Unidad</th>
                                           <th className="p-3 w-24">Cant.</th>
                                           <th className="p-3 w-32 text-right">Costo Unit.</th>
                                           <th className="p-3 w-32 text-right">Total</th>
                                           {isSection2Editable && <th className="p-3 w-10"></th>}
                                        </tr>
                                     </thead>
                                     <tbody>
                                        {(formData.consumedParts || []).map((part, idx) => (
                                           <tr key={idx} className="border-b border-industrial-800 last:border-0 hover:bg-industrial-800/30 transition-colors">
                                              <td className="p-2">
                                                 <div className="relative group">
                                                    <input
                                                       type="text"
                                                       disabled={!isSection2Editable}
                                                       className={`w-full bg-industrial-900 border ${!part.partId && part.partName ? 'border-pink-500' : 'border-industrial-600'} rounded p-1 text-white text-xs focus:border-pink-500 outline-none placeholder-industrial-600`}
                                                       placeholder="Buscar repuesto..."
                                                       value={part.partName || ''}
                                                       onChange={(e) => {
                                                          const val = e.target.value;
                                                          const updated = [...(formData.consumedParts || [])];
                                                          updated[idx] = { ...updated[idx], partName: val, partId: '', unitCost: 0, totalCost: 0 };
                                                          setFormData({ ...formData, consumedParts: updated });
                                                       }}
                                                    />
                                                    {!part.partId && part.partName && (
                                                       <div className="absolute left-0 top-full mt-1 w-[360px] z-50 bg-industrial-800 border border-industrial-600 rounded-md shadow-xl max-h-60 overflow-y-auto">
                                                          {(spareParts || []).filter(p =>
                                                             p.name.toLowerCase().includes(part.partName.toLowerCase()) ||
                                                             p.partNumber.toLowerCase().includes(part.partName.toLowerCase())
                                                          ).length > 0 ? (
                                                             (spareParts || []).filter(p =>
                                                                p.name.toLowerCase().includes(part.partName.toLowerCase()) ||
                                                                p.partNumber.toLowerCase().includes(part.partName.toLowerCase())
                                                             ).map(sp => (
                                                                <div
                                                                   key={sp.id}
                                                                   className="p-2.5 hover:bg-industrial-700 cursor-pointer border-b border-industrial-700/50 last:border-0 flex justify-between items-center gap-3"
                                                                   onClick={() => {
                                                                      const updated = [...(formData.consumedParts || [])];
                                                                      updated[idx] = {
                                                                         ...updated[idx],
                                                                         partId: sp.id,
                                                                         partName: `${sp.partNumber} - ${sp.name}`,
                                                                         sku: sp.partNumber,
                                                                         unitCost: Math.max(0, sp.cost || 0),
                                                                         totalCost: Math.max(0, (sp.cost || 0) * (updated[idx].quantity || 0)),
                                                                         unit: sp.unitOfMeasure || 'Unidad'
                                                                      };
                                                                      const totalCost = updated.reduce((sum, p) => sum + (p.totalCost || 0), 0);
                                                                      setFormData({ ...formData, consumedParts: updated, totalMaintenanceCost: totalCost });
                                                                   }}
                                                                >
                                                                   <div className="flex flex-col flex-1 min-w-0">
                                                                      <span className="text-white text-xs font-bold truncate">
                                                                         <span className="text-pink-400 mr-1">{sp.partNumber}</span>
                                                                         {sp.name}
                                                                      </span>
                                                                      <span className="text-industrial-400 text-[10px]">
                                                                         {sp.unitOfMeasure || 'Unidad'} &bull; RD${(sp.cost || 0).toFixed(2)}
                                                                      </span>
                                                                   </div>
                                                                   <div className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded font-bold ${sp.currentStock <= sp.minStock
                                                                      ? 'bg-red-900/50 text-red-400 border border-red-500/30'
                                                                      : 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30'
                                                                      }`}>
                                                                      Stock: {sp.currentStock}
                                                                   </div>
                                                                </div>
                                                             ))
                                                          ) : (
                                                             <div className="p-3 text-industrial-500 text-xs italic text-center">No se encontraron repuestos</div>
                                                          )}
                                                       </div>
                                                    )}
                                                 </div>
                                              </td>
                                              <td className="p-2">
                                                 <input type="text" readOnly className="w-full bg-industrial-900/50 border border-industrial-800 rounded p-1 text-xs text-industrial-400" value={part.unit || 'Unidad'} />
                                              </td>
                                              <td className="p-2">
                                                 <input
                                                    type="number"
                                                    min="0"
                                                    disabled={!isSection2Editable}
                                                    className="w-full bg-industrial-900 border border-industrial-600 rounded p-1 text-white text-xs focus:border-pink-500 outline-none text-right"
                                                    value={part.quantity}
                                                    onChange={(e) => {
                                                       const qty = Math.max(0, parseFloat(e.target.value) || 0);
                                                       const updated = [...(formData.consumedParts || [])];
                                                       updated[idx] = {
                                                          ...updated[idx],
                                                          quantity: qty,
                                                          totalCost: qty * (updated[idx].unitCost || 0)
                                                       };
                                                       const totalCost = updated.reduce((sum, p) => sum + (p.totalCost || 0), 0);
                                                       setFormData({ ...formData, consumedParts: updated, totalMaintenanceCost: totalCost });
                                                    }}
                                                 />
                                              </td>
                                              <td className="p-2 text-right font-mono text-xs">
                                                 RD${part.unitCost.toFixed(2)}
                                              </td>
                                              <td className="p-2 text-right font-mono text-xs font-bold text-emerald-400">
                                                 RD${part.totalCost.toFixed(2)}
                                              </td>
                                              {isSection2Editable && (
                                                 <td className="p-2 text-center">
                                                    <button
                                                       onClick={() => {
                                                          const updated = [...(formData.consumedParts || [])];
                                                          updated.splice(idx, 1);
                                                          const totalCost = updated.reduce((sum, p) => sum + (p.totalCost || 0), 0);
                                                          setFormData({ ...formData, consumedParts: updated, totalMaintenanceCost: totalCost });
                                                       }}
                                                       className="text-industrial-500 hover:text-red-400 p-1"
                                                    >
                                                       <Trash2 size={14} />
                                                    </button>
                                                 </td>
                                              )}
                                           </tr>
                                        ))}
                                     </tbody>
                                  </table>
                                  {isSection2Editable && (
                                     <div className="p-2 border-t border-industrial-700 bg-industrial-800/50">
                                        <button
                                           onClick={() => setFormData(p => {
                                              const updated = [...(p.consumedParts || []), { partId: '', partName: '', sku: '', quantity: 1, unit: 'Unidad', unitCost: 0, totalCost: 0 }];
                                              const totalCost = updated.reduce((sum, p) => sum + (p.totalCost || 0), 0);
                                              return { ...p, consumedParts: updated, totalMaintenanceCost: totalCost };
                                           })}
                                           className="text-pink-400 hover:text-pink-300 text-xs font-bold flex items-center gap-1"
                                        >
                                           <Plus size={14} /> Add Part
                                        </button>
                                     </div>
                                  )}
                               </div>

                               {/* Total Cost Summary */}
                               <div className="flex justify-end">
                                  <div className="bg-industrial-900 p-3 rounded border border-industrial-700 min-w-[200px]">
                                     <span className="text-xs text-industrial-500 block">Costo Total Repuestos</span>
                                     <span className="text-xl font-mono text-emerald-400 font-bold">
                                        RD${(formData.consumedParts?.reduce((sum, p) => sum + p.totalCost, 0) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                     </span>
                                  </div>
                               </div>
                            </div>

                           {/* Executors (Multiple) */}
                           <div className="mb-6">
                              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><User size={14} className="text-pink-500" /> Personal Ejecutante</h4>
                              {formData.executors?.map((exec, idx) => (
                                 <div key={idx} className="grid grid-cols-2 gap-2 mb-2 items-center">
                                    <select
                                       disabled={!isSection2Editable}
                                       className="bg-industrial-900 border border-industrial-700 rounded p-2 text-xs text-white focus:border-pink-500 outline-none"
                                       value={users.find(u => u.full_name === exec.name)?.id || ''}
                                       onChange={(e) => {
                                          const tech = users.find(u => u.id === e.target.value);
                                          if (tech) {
                                             const updated = [...(formData.executors || [])];
                                             updated[idx] = { name: tech.full_name, lastName: '', position: tech.roleName || tech.job_title };
                                             setFormData({ ...formData, executors: updated });
                                          }
                                       }}
                                    >
                                       <option value="">Seleccionar Técnico...</option>
                                       {users.filter(u => u.roleName === 'Electromecánico Labels' || u.roleName === 'Electromecánico Ravi').map(u => (
                                          <option key={u.id} value={u.id}>{u.full_name}</option>
                                       ))}
                                    </select>
                                    <input type="text" readOnly disabled className="bg-industrial-900/50 border border-industrial-700 rounded p-2 text-xs text-industrial-400 cursor-not-allowed" value={exec.position} />
                                 </div>
                              ))}
                              {isSection2Editable && (
                                 <button type="button" onClick={() => setFormData(p => ({ ...p, executors: [...(p.executors || []), { name: '', lastName: '', position: '' }] }))} className="text-xs text-pink-400 flex items-center gap-1"><Plus size={12} /> Add Tech</button>
                              )}
                           </div>
                        </>
                     )}
                  </div>

                  {isSection2Editable && (
                     <div className="p-4 border-t border-pink-500/30 flex justify-end gap-3">
                        <button 
                           type="button" 
                           disabled={isSaving}
                           onClick={saveProgress} 
                           className="text-pink-400 hover:text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           Guardar Progreso
                        </button>
                        <button 
                           type="button" 
                           disabled={isSaving}
                           onClick={finishExecution} 
                           className="bg-pink-600 hover:bg-pink-500 text-white px-6 py-2 rounded font-bold shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           {isSaving && <Loader2 size={16} className="animate-spin" />}
                           {isSaving ? 'Guardando...' : <>Finalizar Ejecución <CheckCircle size={16} /></>}
                        </button>
                     </div>
                  )}
               </section>

               {/* =====================================================================================
              SECTION 3: HANDOVER & CLOSE (GREEN)
              Context: Supervisor review, checklist, and signature.
          ===================================================================================== */}
               <section className={`rounded-lg border-2 transition-all duration-300 ${isSection3Editable
                  ? 'bg-emerald-900/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'bg-industrial-900 border-industrial-700'
                  }`}>
                  <div className={`p-4 border-b flex justify-between items-center ${isSection3Editable ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-industrial-800 border-industrial-700'}`}>
                     <h3 className={`${isSection3Editable ? 'text-emerald-400' : 'text-industrial-400'} font-bold flex items-center gap-2`}>
                        3. Cierre y Entrega {!isSection3Editable && <Lock size={14} />}
                     </h3>
                     {!isSection3Editable && formData.currentStage === WorkOrderStage.CLOSED && (
                        <button 
                           onClick={() => hasPermission('edit_wo') && setEditingSection(3)} 
                           className={`px-4 py-2 rounded text-sm font-bold transition-colors border ${
                              hasPermission('edit_wo') 
                              ? 'bg-emerald-900/50 hover:bg-emerald-800 text-emerald-400 border-emerald-500/30' 
                              : 'bg-emerald-900/10 text-emerald-400/30 border-emerald-500/10 cursor-not-allowed opacity-50'
                           }`}
                        >
                           Editar
                        </button>
                     )}
                     {editingSection === 3 && (
                        <button 
                           disabled={isSaving}
                           onClick={() => { setEditingSection(null); handleInternalSave(formData, true); }} 
                           className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                           {isSaving && <Loader2 size={14} className="animate-spin" />}
                           {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                     )}
                  </div>

                  <div className={`p-6 space-y-8`}>
                     {/* 1. Checklist - R-MANT-05 Specific Options */}
                     <div>
                        <h4 className="text-sm font-bold text-white mb-4 uppercase border-b border-industrial-700 pb-2">Entrega del área o equipo donde se realizó el trabajo correctivo</h4>
                        <div className="space-y-4">
                           {[
                              { key: 'pointClean', label: 'Punto específico de intervención limpio libre de contaminantes (grasas u otros químicos)' },
                              { key: 'areaClean', label: 'Área o punto de intervención limpio' },
                              { key: 'guardsComplete', label: 'Protecciones y guardas de máquinas completas' },
                              { key: 'toolsRemoved', label: 'Se retiró del área todas las herramientas y accesorios que se utilizó en la intervención del equipo.' },
                              { key: 'greaseCleaned', label: 'En caso de haber utilizado grasas o aceites dejar en lugar asignado.' },
                              { key: 'safetyActivated', label: 'Protecciones de seguridad activadas' }
                           ].map((item) => (
                              <div key={item.key} className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 py-2 border-b border-industrial-700/30">
                                 <span className="text-sm text-industrial-300 flex-1">{item.label}</span>
                                 <div className="flex gap-4 min-w-[120px]">
                                     <label className={`cursor-pointer flex items-center gap-2 px-3 py-1 rounded transition-colors ${formData.checklist?.[item.key as keyof typeof formData.checklist] === true ? 'bg-emerald-900/50 border border-emerald-500/50' : (invalidFields.has(`checklist.${item.key}`) ? 'bg-red-900/20 border border-red-500/50' : 'hover:bg-industrial-800')}`}>
                                       <input
                                          type="radio"
                                          disabled={!isSection3Editable}
                                          name={item.key}
                                          checked={formData.checklist?.[item.key as keyof typeof formData.checklist] === true}
                                           onChange={() => {
                                              setFormData(p => ({ ...p, checklist: { ...p.checklist, [item.key]: true } }));
                                              clearInvalidField(`checklist.${item.key}`);
                                           }}
                                          className={`w-4 h-4 ${!isSection3Editable ? 'accent-emerald-500' : 'cursor-pointer'}`}
                                       />
                                       <span className={`${formData.checklist?.[item.key as keyof typeof formData.checklist] === true ? 'text-emerald-400 font-bold' : 'text-industrial-400'}`}>Si</span>
                                    </label>
                                     <label className={`cursor-pointer flex items-center gap-2 px-3 py-1 rounded transition-colors ${formData.checklist?.[item.key as keyof typeof formData.checklist] === false ? 'bg-red-900/50 border border-red-500/50' : (invalidFields.has(`checklist.${item.key}`) ? 'bg-red-900/20 border border-red-500/50' : 'hover:bg-industrial-800')}`}>
                                       <input
                                          type="radio"
                                          disabled={!isSection3Editable}
                                          name={item.key}
                                          checked={formData.checklist?.[item.key as keyof typeof formData.checklist] === false}
                                           onChange={() => {
                                              setFormData(p => ({ ...p, checklist: { ...p.checklist, [item.key]: false } }));
                                              clearInvalidField(`checklist.${item.key}`);
                                           }}
                                          className={`w-4 h-4 ${!isSection3Editable ? 'accent-red-500' : 'cursor-pointer'}`}
                                       />
                                       <span className={`${formData.checklist?.[item.key as keyof typeof formData.checklist] === false ? 'text-red-400 font-bold' : 'text-industrial-400'}`}>No</span>
                                    </label>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* 2. Uploads (Image & File) */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Image Upload */}
                        <div className="space-y-2">
                           <label className="text-xs text-industrial-400 font-bold flex items-center gap-2"><Image size={14} /> Evidencia Fotográfica (Imagen)</label>
                           <div className={`relative overflow-hidden border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 ${isSection3Editable ? 'border-industrial-600 hover:border-emerald-500 cursor-pointer bg-industrial-900' : 'border-industrial-700 bg-industrial-900/50'}`}>
                              {formData.closingImage ? (
                                 <div className="relative w-full h-32 bg-black rounded overflow-hidden flex items-center justify-center group">
                                    <img src={formData.closingImage} alt="Evidence" className="h-full object-contain" />
                                    {isSection3Editable && (
                                       <button
                                          onClick={() => setFormData({ ...formData, closingImage: undefined })}
                                          className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                       >
                                          <X size={12} />
                                       </button>
                                    )}
                                 </div>
                              ) : (
                                 <>
                                    <UploadCloud size={24} className="text-industrial-500" />
                                    <span className="text-xs text-industrial-500 text-center">
                                       {isSection3Editable ? 'Click to upload or drag image' : 'No image attached'}
                                    </span>
                                    {isSection3Editable && (
                                       <input
                                          type="file"
                                          accept="image/*"
                                          className="absolute inset-0 opacity-0 cursor-pointer"
                                          onChange={(e) => {
                                             // Mock upload - in real app, upload to storage and get URL
                                             if (e.target.files?.[0]) {
                                                const url = URL.createObjectURL(e.target.files[0]);
                                                setFormData({ ...formData, closingImage: url });
                                             }
                                          }}
                                       />
                                    )}
                                 </>
                              )}
                           </div>
                        </div>

                        {/* File Upload */}
                        <div className="space-y-2">
                           <label className="text-xs text-industrial-400 font-bold flex items-center gap-2"><FileText size={14} /> Archivo Adjunto (PDF/Doc)</label>
                           <div className={`relative overflow-hidden border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 ${isSection3Editable ? 'border-industrial-600 hover:border-emerald-500 cursor-pointer bg-industrial-900' : 'border-industrial-700 bg-industrial-900/50'}`}>
                              {formData.closingFile ? (
                                 <div className="relative w-full flex items-center justify-between bg-industrial-800 p-2 rounded border border-industrial-700 z-10">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                       <FileText size={16} className="text-blue-400 flex-shrink-0" />
                                       <span className="text-xs text-industrial-300 truncate">Attached File</span>
                                    </div>
                                    {isSection3Editable ? (
                                       <button onClick={() => setFormData({ ...formData, closingFile: undefined })} className="text-industrial-500 hover:text-red-400">
                                          <X size={14} />
                                       </button>
                                    ) : (
                                       <a href={formData.closingFile} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">
                                          <Download size={14} />
                                       </a>
                                    )}
                                 </div>
                              ) : (
                                 <>
                                    <Paperclip size={24} className="text-industrial-500" />
                                    <span className="text-xs text-industrial-500 text-center">
                                       {isSection3Editable ? 'Click to attach file' : 'No file attached'}
                                    </span>
                                    {isSection3Editable && (
                                       <input
                                          type="file"
                                          className="absolute inset-0 opacity-0 cursor-pointer"
                                          onChange={(e) => {
                                             if (e.target.files?.[0]) {
                                                const url = URL.createObjectURL(e.target.files[0]);
                                                setFormData({ ...formData, closingFile: url });
                                             }
                                          }}
                                       />
                                    )}
                                 </>
                              )}
                           </div>
                        </div>
                      </div>
                      <div className="border-t border-industrial-700 pt-6">
                        <h4 className="text-sm font-bold text-white mb-4">Aceptación del Trabajo</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                           {/* Supervisor Selection */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Recibido Por (Supervisor)</label>
                              <select disabled={!isSection3Editable}
                                 className={`w-full bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('supervisorId') ? 'border-red-500 bg-red-900/10 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-industrial-600'}`}
                                 value={formData.supervisorId || ''}
                                 onChange={e => {
                                    setFormData({ ...formData, supervisorId: e.target.value });
                                    clearInvalidField('supervisorId');
                                 }}>
                                 <option value="">- Seleccionar Supervisor -</option>
                                 {users.filter(u => u.roleName === 'Supervisor de Mantenimiento').map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name}</option>
                                 ))}
                              </select>
                           </div>

                           {/* Date/Time Received */}
                           <div className="space-y-1">
                              <label className="text-xs text-industrial-400 font-bold">Fecha y Hora de Recepción</label>
                              <div className="flex gap-2 items-center">
                                 <input
                                    type="date"
                                    disabled={!isSection3Editable}
                                    className={`flex-1 bg-industrial-900 border rounded p-2 text-white text-sm focus:border-emerald-500 outline-none ${invalidFields.has('closingDate') ? 'border-red-500 bg-red-900/10 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-industrial-600'}`}
                                    value={formData.closingDate?.split('T')[0] || new Date().toISOString().split('T')[0]}
                                    onChange={(e) => {
                                       const originalTime = formData.closingDate?.split('T')[1] || new Date().toISOString().split('T')[1];
                                       setFormData({ ...formData, closingDate: `${e.target.value}T${originalTime}` });
                                       clearInvalidField('closingDate');
                                    }}
                                 />
                                 <input
                                    type="time"
                                    disabled
                                    readOnly
                                    className={`w-32 bg-industrial-900/50 border rounded p-2 text-industrial-400 text-sm text-center ${invalidFields.has('closingDate') ? 'border-red-500' : 'border-industrial-700'}`}
                                    value={formData.closingDate ? new Date(formData.closingDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                                 />
                                 {isSection3Editable && (
                                    <button
                                       onClick={() => {
                                          setFormData({ ...formData, closingDate: new Date().toISOString() });
                                          clearInvalidField('closingDate');
                                       }}
                                       className="bg-industrial-800 hover:bg-emerald-900/50 text-emerald-400 border border-industrial-600 hover:border-emerald-500/50 rounded px-3 py-2 text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap"
                                       title="Registrar Hora Actual"
                                    >
                                       <Clock size={14} /> Registrar Hora
                                    </button>
                                 )}
                              </div>
                           </div>
                        </div>

                        {/* Signatures Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                           {/* Executor Signature */}
                           <div>
                              <label className="text-xs text-industrial-400 font-bold mb-2 block">Firma Ejecutante</label>
                              <div
                                 onClick={() => {
                                    if (isSection3Editable && (!formData.signatureExecutor || formData.signatureExecutor === 'false')) {
                                       setFormData({
                                          ...formData,
                                          signatureExecutor: user?.full_name || user?.name || 'Executor Name',
                                          signatureExecutorDate: new Date().toISOString()
                                       });
                                       clearInvalidField('signatureExecutor');
                                    }
                                 }}
                                 className={`h-24 bg-white/5 rounded border-2 border-dashed ${isSection3Editable && (!formData.signatureExecutor || formData.signatureExecutor === 'false') ? (invalidFields.has('signatureExecutor') ? 'border-red-500 bg-red-900/10' : 'border-pink-500/50 cursor-pointer hover:bg-white/10') : 'border-industrial-600'} flex items-center justify-center flex-col gap-1 transition-colors`}
                              >
                                 {formData.signatureExecutor && formData.signatureExecutor !== 'false' ? (
                                    <>
                                       <span className="text-pink-400 font-script text-xl">{formData.signatureExecutor}</span>
                                       <span className="text-xs text-industrial-500">{formData.signatureExecutorDate ? new Date(formData.signatureExecutorDate).toLocaleDateString() : ''}</span>
                                    </>
                                 ) : (
                                    <span className={`text-xs ${invalidFields.has('signatureExecutor') ? 'text-red-400 font-bold' : 'text-industrial-500'}`}>
                                       {isSection3Editable ? 'Click to Sign (Executor)' : 'Pending Signature'}
                                    </span>
                                 )}
                              </div>
                           </div>

                           {/* Supervisor Signature */}
                           <div>
                              <label className="text-xs text-industrial-400 font-bold mb-2 block">Firma Supervisor (Conformidad)</label>
                              <div
                                 onClick={() => {
                                    signSupervisor();
                                    if (isSection3Editable) {
                                       clearInvalidField('signatureSupervisor');
                                    }
                                 }}
                                 className={`h-24 bg-white/5 rounded border-2 border-dashed ${isSection3Editable && (!formData.signatureSupervisor || formData.signatureSupervisor === 'false') ? (invalidFields.has('signatureSupervisor') ? 'border-red-500 bg-red-900/10' : 'border-emerald-500/50 cursor-pointer hover:bg-white/10') : 'border-industrial-600'} flex items-center justify-center flex-col gap-1 transition-colors`}
                              >
                                 {formData.signatureSupervisor && formData.signatureSupervisor !== 'false' ? (
                                    <>
                                       <span className="text-emerald-400 font-script text-xl">{formData.signatureSupervisor}</span>
                                       <span className="text-xs text-industrial-500">{formData.signatureSupervisorDate ? new Date(formData.signatureSupervisorDate).toLocaleDateString() : ''}</span>
                                    </>
                                 ) : (
                                    <span className={`text-xs ${invalidFields.has('signatureSupervisor') ? 'text-red-400 font-bold' : 'text-industrial-500'}`}>
                                       {isSection3Editable ? 'Click to Sign (Supervisor)' : 'Pending Signature'}
                                    </span>
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  {
                     isSection3Editable && (
                        <div className="p-4 border-t border-emerald-500/30 flex justify-end gap-4">
                           <button 
                              disabled={isSaving}
                              onClick={() => setFormData(p => ({ ...p, currentStage: WorkOrderStage.EXECUTION, status: WorkOrderStatus.IN_PROGRESS }))} 
                              className="text-industrial-400 hover:text-white text-sm underline disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                              Rechazar (Volver a Ejecución)
                           </button>
                           <button 
                              disabled={isSaving}
                              onClick={closeWorkOrder} 
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded font-bold shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                              {isSaving && <Loader2 size={16} className="animate-spin" />}
                              {isSaving ? 'Cerrando...' : <>Cerrar Mantenimiento <Save size={16} /></>}
                           </button>
                        </div>
                     )
                  }
               </section >

            </div >
         </div>

         {/* Custom Delete Confirmation Modal */}
         {showDeleteConfirm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
               <div className="bg-industrial-900 border border-red-500/50 rounded-xl p-6 max-w-md w-full shadow-2xl animate-scaleIn">
                  <div className="flex items-center gap-4 text-red-500 mb-4">
                     <div className="p-3 bg-red-500/10 rounded-full">
                        <AlertCircle size={32} />
                     </div>
                     <h3 className="text-xl font-bold text-white">¿Eliminar Registro?</h3>
                  </div>

                  <p className="text-industrial-300 mb-8">
                     Esta acción eliminará permanentemente este registro de mantenimiento de la base de datos. Esta operación no se puede deshacer.
                  </p>

                  <div className="flex gap-4">
                     <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-4 py-3 bg-industrial-800 hover:bg-industrial-700 text-industrial-300 rounded-lg font-bold transition-colors"
                     >
                        Cancelar
                     </button>
                     <button
                        onClick={() => handleDelete()}
                        className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg shadow-red-900/20 transition-colors flex items-center justify-center gap-2"
                     >
                        <Trash2 size={18} /> Confirmar
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
