import React, { createContext, useState, useContext, ReactNode } from 'react';

export type Language = 'en' | 'es';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

const translations: Translations = {
  en: {
    // Sidebar
    'app.subtitle': 'Maintenance Cloud',
    'sidebar.visualPlant': 'Visual Plant',
    'sidebar.maintenanceCanvas': 'Kanban Board',
    'sidebar.rmant02': 'Preventive (R-MANT-02)',
    'sidebar.rmant05': 'Corrective (R-MANT-05)',
    'sidebar.hours': 'Machine Usage Log',
    'sidebar.biAnalytics': 'BI & Analytics',
    'sidebar.calendar': 'Calendar',
    'sidebar.kardex': 'Kardex 4.0',
    'sidebar.masterData': 'Master Data Core',
    'sidebar.role': 'SysAdmin',
    'sidebar.plan': 'Business Plan',

    // Forms Common
    'form.save': 'Save Record',
    'form.cancel': 'Cancel',
    'form.machine': 'Machine / Equipment',
    'form.plate': 'License Plate / Tag',
    'form.date': 'Date',
    'form.priority': 'Priority',
    'form.description': 'Description',
    'form.assigned': 'Assigned Technician',

    // R-MANT-02 Image Specifics
    'mant02.formTitle': 'PREVENTIVE MAINTENANCE RECORD - R-MANT-02',
    'mant02.maintenanceType': 'Maintenance Type',
    'mant02.startDate': 'Start Date',
    'mant02.endDate': 'End Date',
    'mant02.machineHours': 'Machine Work Hours',
    'mant02.nextHours': 'Next Maintenance Hours',
    'mant02.electro': 'Electromechanicals',
    'mant02.executor': 'Executor',
    'mant02.supervisor': 'Supervisor',
    'mant02.startTime': 'Start Time',
    'mant02.endTime': 'End Time',
    'mant02.parts.code': 'Part Code',
    'mant02.parts.name': 'Spare Part',
    'mant02.parts.unit': 'UOM',
    'mant02.parts.qty': 'Qty',
    'mant02.parts.total': 'Total Maintenance Cost',
    'mant02.checklist.title': 'DELIVERY OF AREA OR EQUIPMENT WHERE WORK WAS PERFORMED',
    'mant02.checklist.subtitle': 'If compliant mark (YES), if not compliant mark (NO)',
    'mant02.check.1': 'Specific intervention point clean, free of contaminants (grease or other chemicals)',
    'mant02.check.2': 'Area or intervention point clean',
    'mant02.check.3': 'Machine guards and protections complete',
    'mant02.check.4': 'All tools and accessories used in intervention removed from area',
    'mant02.check.5': 'If greases or oils used, left in assigned place, containers capped',
    'mant02.check.6': 'Activate all safety protections',
    'mant02.exec.title': 'WORK EXECUTING PERSONNEL',
    'mant02.exec.name': 'Executor Name',
    'mant02.exec.lastname': 'Last Name',
    'mant02.exec.position': 'Executor Position',
    'mant02.image': 'Image',
    'mant02.file': 'Attached File',
    'mant02.obs': 'Observations',
    'mant02.assignedMech': 'Assigned Mechanic',
    'mant02.received': 'Received Conform',
    'mant02.sign': 'Signature',
    'mant02.clear': 'Clear',

    // R-MANT-02 Specific (Old keys kept for compatibility if needed)
    'mant02.interval': 'Intervention Interval',
    'mant02.hoursStart': 'Start Time',
    'mant02.hoursEnd': 'End Time',

    // R-MANT-05 Specific
    'mant05.dept': 'Department',
    'mant05.failType': 'Failure Type',
    'mant05.freq': 'Frequency',
    'mant05.cons': 'Consequence',
    'mant05.action': 'Action Taken',
    'mant05.checklist': 'Area Delivery Checklist',
    'mant05.check1': 'Clean Area',
    'mant05.check2': 'Guards & Safety',
    'mant05.check3': 'Tools Removed',
    'mant05.sign': 'Digital Signature',

    // Usage Log
    'hours.title': 'Machine Usage Registry',
    'hours.subtitle': 'Track usage to predict maintenance',
    'hours.log': 'Log Usage',
    'hours.current': 'Current Reading',
    'hours.last': 'Last Logged',

    // Maintenance List
    'mant.new': '+ New Record',
    'mant.col.id': 'Form ID',
    'mant.col.title': 'Description / Title',
    'mant.col.machine': 'Machine / Asset',
    'mant.col.date': 'Created Date',
    'mant.col.priority': 'Priority',
    'mant.col.status': 'Status',
    'mant.col.tech': 'Assigned To',

    // Inventory (Kardex)
    'inventory.title': 'Kardex 4.0',
    'inventory.subtitle': 'Real-time inventory & Safety Stock monitoring',
    'inventory.add': 'Add Part',
    'inventory.col.sku': 'SKU / Part Name',
    'inventory.col.status': 'Status',
    'inventory.col.stock': 'Stock Level',
    'inventory.col.reorder': 'Reorder Point',
    'inventory.col.cost': 'Unit Cost',
    'inventory.col.supplier': 'Supplier',
    'inventory.status.low': 'Restock Needed',
    'inventory.status.ok': 'OK',
    'inventory.modal.title': 'Add New Spare Part',
    'inventory.modal.name': 'Part Name',
    'inventory.modal.sku': 'SKU / Catalog ID',
    'inventory.modal.category': 'Category',
    'inventory.modal.stock': 'Initial Stock',
    'inventory.modal.reorder': 'Reorder Pt.',
    'inventory.modal.cost': 'Unit Cost ($)',
    'inventory.modal.supplier': 'Supplier Name',
    'inventory.modal.cancel': 'Cancel',
    'inventory.modal.confirm': 'Confirm & Add',

    // Kanban
    'kanban.mttr': 'MTTR (Mean Time To Repair)',
    'kanban.mtbf': 'MTBF (Mean Time Between Failures)',
    'kanban.active': 'Active Preventive',
    'kanban.col.backlog': 'Backlog / Requests',
    'kanban.col.progress': 'In Progress',
    'kanban.col.review': 'QA / Review',
    'kanban.col.done': 'Closed (R-INOC-07)',

    // Analytics
    'analytics.title': 'Business Intelligence (BI)',
    'analytics.availability': 'Equipment Availability Trend',
    'analytics.cost': 'Spare Parts Cost vs Budget',
    'analytics.faults': 'Criticality by Category',
    'analytics.spend': 'Actual Spend',
    'analytics.budget': 'Budget',
    'analytics.oee': 'Overall Plant Efficiency (OEE)',
    'analytics.incident': 'Days Without Incident',
    'analytics.pending': 'Pending R-MANT-05',
    'analytics.invHealth': 'Inventory Health',
    'analytics.completion': 'Completion',
    'analytics.optimal': 'Optimal',

    // Map
    'map.title': 'VISUAL PLANT MAP',
    'map.zone': 'Zone A - Production Line 1',
    'map.layers': 'Overlay Layers',
    'map.layer.operational': 'Operational',
    'map.layer.operational.desc': 'Real-time monitoring: Running, Idle, or Critical status.',
    'map.layer.maintenance': 'Maintenance',
    'map.layer.maintenance.desc': 'Highlights machines with overdue or upcoming scheduled service.',
    'map.layer.inventory': 'Kardex / Parts',
    'map.layer.inventory.desc': 'Risk map: Visualizes spare parts availability for each machine.',
    'map.layer.efficiency': 'OEE Heatmap',
    'map.layer.efficiency.desc': 'Productivity heatmap based on energy consumption and output.',

    // Configuration Module
    'config.title': 'Master Data Core',
    'config.subtitle': 'System Configuration & Resource Management',
    'config.export': 'Export Config',
    'config.save': 'Save Changes',
    'config.tab.assets': 'Asset Registry (Digital Twin)',
    'config.tab.workforce': 'Workforce (HR)',
    'config.tab.settings': 'Plant Settings',

    // Config - Assets
    'assets.title': 'Connected Machinery',
    'assets.provision': '+ Provision New Gateway',
    'assets.col.id': 'Asset ID',
    'assets.col.name': 'Machine Name',
    'assets.col.type': 'Type',
    'assets.col.protocol': 'Protocol',
    'assets.col.schedule': 'Maint. Schedule',
    'assets.col.actions': 'Actions',
    'assets.next': 'Next:',
    'assets.branch': 'Business Unit / Branch',
    'assets.category': 'Category',
    'assets.location': 'Location',
    'assets.alias': 'Equipment Alias',
    'assets.brand': 'Brand',
    'assets.model': 'Model',
    'assets.year': 'Year',
    'assets.capacity': 'Capacity',
    'assets.current': 'In (A)',
    'assets.frequency': 'f (Hz)',
    'assets.voltage': 'V. 3PH (VAC)',
    'assets.power': 'P (kVA)',
    'assets.image': 'Equipment Image',
    'assets.docs': 'Documents',

    // Config - Workforce
    'workforce.title': 'Technicians & Operators',
    'workforce.add': '+ Add Personnel',
    'workforce.role': 'Role',
    'workforce.shift': 'Shift',
    'workforce.config': 'Config',
    'workforce.modal.title': 'Onboard New Personnel',
    'workforce.modal.name': 'Full Name',
    'workforce.modal.email': 'Correo Electrónico',
    'workforce.modal.role': 'Role / Specialty',
    'workforce.modal.shift': 'Assigned Shift',
    'workforce.modal.cancel': 'Cancel',
    'workforce.modal.confirm': 'Onboard Personnel',

    // Config - Settings
    'settings.metadata.title': 'Plant Metadata',
    'settings.plantName': 'Plant Name',
    'settings.costCenter': 'RNC (Tax ID)',
    'settings.timezone': 'Timezone',
    'settings.currency': 'Base Currency',
    'settings.compliance.title': 'Compliance & Thresholds',
    'settings.compliance.sig': 'Force Electronic Signature',
    'settings.compliance.sig.desc': 'Require technicians to re-authenticate when closing Critical tickets.',
    'settings.compliance.auto': 'Preventive Auto-Trigger',
    'settings.compliance.auto.desc': 'Automatically create Work Orders when IoT sensors detect >90% vibration threshold.',
  },
  es: {
    // Sidebar
    'app.subtitle': 'Nube de Mantenimiento',
    'sidebar.visualPlant': 'Planta Visual',
    'sidebar.maintenanceCanvas': 'Tablero Kanban',
    'sidebar.rmant02': 'Preventivo (R-MANT-02)',
    'sidebar.rmant05': 'Correctivo (R-MANT-05)',
    'sidebar.hours': 'Registro de Uso',
    'sidebar.biAnalytics': 'BI y Analítica',
    'sidebar.calendar': 'Calendario',
    'sidebar.kardex': 'Kardex 4.0',
    'sidebar.masterData': 'Configuración',
    'sidebar.role': 'AdminSis',
    'sidebar.plan': 'Plan Empresarial',

    // Forms Common
    'form.save': 'Guardar Registro',
    'form.cancel': 'Cancelar',
    'form.machine': 'Máquina / Equipo',
    'form.plate': 'Matrícula',
    'form.date': 'Fecha',
    'form.priority': 'Prioridad',
    'form.description': 'Descripción',
    'form.assigned': 'Técnico Asignado',

    // R-MANT-02 Image Specifics ES
    'mant02.formTitle': 'REGISTRO DE MANTENIMIENTO PREVENTIVO – R-MANT-02',
    'mant02.maintenanceType': 'Tipo de Mantenimiento',
    'mant02.startDate': 'Fecha Inicio',
    'mant02.endDate': 'Fecha Finalización',
    'mant02.machineHours': 'Horas de Trabajo Maq.',
    'mant02.nextHours': 'Horas Próximo Mantenimiento',
    'mant02.electro': 'Electromecánicos',
    'mant02.executor': 'Ejecutante',
    'mant02.supervisor': 'Supervisor',
    'mant02.startTime': 'Hora de Inicio',
    'mant02.endTime': 'Hora Finalización',
    'mant02.parts.code': 'Código de Repuesto',
    'mant02.parts.name': 'Repuesto',
    'mant02.parts.unit': 'Unidad de Medida Repuesto',
    'mant02.parts.qty': 'Cantidad',
    'mant02.parts.total': 'Costo total de mantenimiento',
    'mant02.checklist.title': 'ENTREGA DEL AREA O EQUIPO DONDE SE REALIZO EL TRABAJO',
    'mant02.checklist.subtitle': 'En caso de cumplir todo lo mencionado marcar (SI), si no cumple lo mencionado marcar (NO)',
    'mant02.check.1': 'Punto específico de intervención limpio, libre de contaminantes (grasas u otros químicos)',
    'mant02.check.2': 'Área o punto de intervención limpio',
    'mant02.check.3': 'Protecciones y guardas de las maquinas completas',
    'mant02.check.4': 'Se retiro del área todas las herramientas y accesorios que se utilizo en la intervención del equipo',
    'mant02.check.5': 'En caso de haber utilizado grasas o aceites dejar en el lugar asignado, tapados los envases',
    'mant02.check.6': 'Activar todas la protecciones de seguridad',
    'mant02.exec.title': 'PERSONAL EJECUTANTE DEL TRABAJO',
    'mant02.exec.name': 'Nombre Ejecutante',
    'mant02.exec.lastname': 'Apellido',
    'mant02.exec.position': 'Posición Ejecutante',
    'mant02.image': 'Imagen',
    'mant02.file': 'Archivo Adjunto',
    'mant02.obs': 'Observaciones',
    'mant02.assignedMech': 'Mecánico Asignado',
    'mant02.received': 'Recibido Conforme',
    'mant02.sign': 'Firma',
    'mant02.clear': '[Borrar]',

    // R-MANT-02 Specific
    'mant02.interval': 'Intervalo de Intervención',
    'mant02.hoursStart': 'Hora Inicio',
    'mant02.hoursEnd': 'Hora Fin',

    // R-MANT-05 Specific
    'mant05.dept': 'Departamento',
    'mant05.failType': 'Tipo de Avería',
    'mant05.freq': 'Frecuencia',
    'mant05.cons': 'Consecuencia',
    'mant05.action': 'Acción Tomada',
    'mant05.checklist': 'Entrega del Área (Checklist)',
    'mant05.check1': 'Área Limpia',
    'mant05.check2': 'Protecciones/Guardas',
    'mant05.check3': 'Herramientas Retiradas',
    'mant05.sign': 'Firma Digital',

    // Usage Log
    'hours.title': 'Registro de Uso del Equipo',
    'hours.subtitle': 'Control de uso para cálculo de mantenimiento',
    'hours.log': 'Registrar Uso',
    'hours.current': 'Lectura Actual',
    'hours.last': 'Último Registro',

    // Maintenance List
    'mant.new': '+ Nuevo Registro',
    'mant.col.id': 'ID Formulario',
    'mant.col.title': 'Descripción / Título',
    'mant.col.machine': 'Máquina / Activo',
    'mant.col.date': 'Fecha Creación',
    'mant.col.priority': 'Prioridad',
    'mant.col.status': 'Estado',
    'mant.col.tech': 'Asignado A',

    // Inventory (Kardex)
    'inventory.title': 'Kardex 4.0',
    'inventory.subtitle': 'Inventario en tiempo real y monitoreo de Stock de Seguridad',
    'inventory.add': 'Agregar Repuesto',
    'inventory.col.sku': 'SKU / Parte',
    'inventory.col.status': 'Estado',
    'inventory.col.stock': 'Nivel Stock',
    'inventory.col.reorder': 'Punto Reorden',
    'inventory.col.cost': 'Costo Unit.',
    'inventory.col.supplier': 'Proveedor',
    'inventory.status.low': 'Reabastecer',
    'inventory.status.ok': 'OK',
    'inventory.modal.title': 'Nueva Refacción',
    'inventory.modal.name': 'Nombre Parte',
    'inventory.modal.sku': 'SKU / ID Catálogo',
    'inventory.modal.category': 'Categoría',
    'inventory.modal.stock': 'Stock Inicial',
    'inventory.modal.reorder': 'Pto. Reorden',
    'inventory.modal.cost': 'Costo Unit. ($)',
    'inventory.modal.supplier': 'Nombre Proveedor',
    'inventory.modal.cancel': 'Cancelar',
    'inventory.modal.confirm': 'Confirmar y Agregar',

    // Kanban
    'kanban.mttr': 'MTTR (Tiempo Medio Reparación)',
    'kanban.mtbf': 'MTBF (Tiempo Medio Entre Fallas)',
    'kanban.active': 'Preventivos Activos',
    'kanban.col.backlog': 'Solicitados',
    'kanban.col.progress': 'En Ejecución',
    'kanban.col.review': 'Calidad / Supervisión',
    'kanban.col.done': 'Cerrados',

    // Analytics
    'analytics.title': 'Inteligencia de Negocios (BI)',
    'analytics.availability': 'Tendencia Disponibilidad Equipos',
    'analytics.cost': 'Costo Refacciones vs Presupuesto',
    'analytics.faults': 'Criticidad por Categoría',
    'analytics.spend': 'Gasto Real',
    'analytics.budget': 'Presupuesto',
    'analytics.oee': 'Eficiencia General Planta (OEE)',
    'analytics.incident': 'Días Sin Incidentes',
    'analytics.pending': 'Pendientes R-MANT-05',
    'analytics.invHealth': 'Salud Inventario',
    'analytics.completion': 'Completado',
    'analytics.optimal': 'Óptimo',

    // Map
    'map.title': 'MAPA VISUAL DE PLANTA',
    'map.zone': 'Zona A - Línea de Producción 1',
    'map.layers': 'Capas de Superposición',
    'map.layer.operational': 'Operativo',
    'map.layer.operational.desc': 'Monitoreo en tiempo real: Operando, Detenido o Crítico.',
    'map.layer.maintenance': 'Mantenimiento',
    'map.layer.maintenance.desc': 'Resalta equipos con servicios vencidos o programados próximamente.',
    'map.layer.inventory': 'Kardex / Partes',
    'map.layer.inventory.desc': 'Mapa de riesgo: Visualiza disponibilidad de refacciones por equipo.',
    'map.layer.efficiency': 'Mapa Calor OEE',
    'map.layer.efficiency.desc': 'Mapa de calor de productividad basado en consumo y salida.',

    // Configuration Module
    'config.title': 'Configuración',
    'config.subtitle': 'Configuración del Sistema y Gestión de Recursos',
    'config.export': 'Exportar Config',
    'config.save': 'Guardar Cambios',
    'config.tab.assets': 'Equipos (Registro de Activos)',
    'config.tab.workforce': 'Fuerza Laboral (RH)',
    'config.tab.settings': 'Datos Generales',
    'config.tab.roles': 'Roles y Permisos',
    'config.tab.zones': 'Zonas y Líneas',
    'config.tab.equipment': 'Equipos',
    'config.tab.inventory': 'Repuestos',

    // Config - Assets
    'assets.title': 'Equipos',
    'assets.provision': '+ Agregar Equipo IoT',
    'assets.col.id': 'ID Activo',
    'assets.col.name': 'Nombre Equipo',
    'assets.col.type': 'Tipo',
    'assets.col.protocol': 'Protocolo',
    'assets.col.schedule': 'Prog. Mantenimiento',
    'assets.col.actions': 'Acciones',
    'assets.next': 'Próx:',
    'assets.branch': 'Empresa - Sucursal',
    'assets.category': 'Categoría',
    'assets.location': 'Ubicación',
    'assets.alias': 'Alias del Equipo',
    'assets.brand': 'Marca',
    'assets.model': 'Modelo',
    'assets.year': 'Año de Fabricación',
    'assets.capacity': 'Capacidad',
    'assets.current': 'In (A)',
    'assets.frequency': 'f (hz)',
    'assets.voltage': 'V. 3PH (VAC)',
    'assets.power': 'P (KVA)',
    'assets.image': 'Imagen del Equipo',
    'assets.docs': 'Documentos',

    // Config - Workforce
    'workforce.title': 'Usuarios',
    'workforce.add': '+ Agregar Personal',
    'workforce.role': 'Rol',
    'workforce.shift': 'Turno',
    'workforce.config': 'Config',
    'workforce.modal.title': 'Vincular Nuevo Personal',
    'workforce.modal.name': 'Nombre Completo',
    'workforce.modal.email': 'Correo Electrónico',
    'workforce.modal.role': 'Rol / Especialidad',
    'workforce.modal.shift': 'Turno Asignado',
    'workforce.modal.cancel': 'Cancelar',
    'workforce.modal.confirm': 'Vincular Personal',

    // Config - Settings
    'settings.metadata.title': 'Metadatos de Planta',
    'settings.plantName': 'Nombre de Planta',
    'settings.costCenter': 'RNC (Registro Nacional de Contribuyentes)',
    'settings.timezone': 'Zona Horaria',
    'settings.currency': 'Moneda Base',
    'settings.compliance.title': 'Cumplimiento y Umbrales',
    'settings.compliance.sig': 'Forzar Firma Electrónica',
    'settings.compliance.sig.desc': 'Requerir re-autenticación al cerrar tickets Críticos.',
    'settings.compliance.auto': 'Disparo Automático Preventivo',
    'settings.compliance.auto.desc': 'Crear Órdenes automáticas cuando sensores IoT detecten >90% vibración.',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('es');

  React.useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};