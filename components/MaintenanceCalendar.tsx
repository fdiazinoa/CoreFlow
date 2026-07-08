import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useWorkOrderStore } from '../src/stores/useWorkOrderStore';
import { useMasterStore } from '../src/stores/useMasterStore';
import { WorkOrder, Machine } from '../types';
import { Calendar, ChevronLeft, ChevronRight, Printer, Search, Plus, MoreHorizontal } from 'lucide-react';

export const MaintenanceCalendar: React.FC = () => {
  const { t, language } = useLanguage();
  const { hasPermission } = useAuth();
  const { calendarOrders, fetchCalendarOrders, loading } = useWorkOrderStore();
  const { machines, fetchMasterData, isInitialized: masterInitialized } = useMasterStore();
  const navigate = useNavigate();

  // Calendar States
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [activeView, setActiveView] = useState<'month' | 'week' | 'day'>('month');
  
  // Filter States: R-MANT-02 (Preventive), R-MANT-05 (Corrective), and Next Maintenances
  // Default to showing all, load from localStorage if available
  const [showMant02, setShowMant02] = useState<boolean>(() => {
    const saved = localStorage.getItem('calendar_show_mant02');
    return saved !== null ? saved === 'true' : true;
  });
  const [showMant05, setShowMant05] = useState<boolean>(() => {
    const saved = localStorage.getItem('calendar_show_mant05');
    return saved !== null ? saved === 'true' : true;
  });
  const [showNextMaint, setShowNextMaint] = useState<boolean>(() => {
    const saved = localStorage.getItem('calendar_show_next_maint');
    return saved !== null ? saved === 'true' : true;
  });

  // Toggle handlers ensuring at least one filter remains active
  const handleToggleMant02 = () => {
    if (showMant02 && !showMant05 && !showNextMaint) return;
    const newValue = !showMant02;
    setShowMant02(newValue);
    localStorage.setItem('calendar_show_mant02', String(newValue));
  };

  const handleToggleMant05 = () => {
    if (showMant05 && !showMant02 && !showNextMaint) return;
    const newValue = !showMant05;
    setShowMant05(newValue);
    localStorage.setItem('calendar_show_mant05', String(newValue));
  };

  const handleToggleNextMaint = () => {
    if (showNextMaint && !showMant02 && !showMant05) return;
    const newValue = !showNextMaint;
    setShowNextMaint(newValue);
    localStorage.setItem('calendar_show_next_maint', String(newValue));
  };

  // Calendar item interface to unify orders and next maintenance events
  interface CalendarItem {
    id: string;
    date: string;
    type: 'R-MANT-02' | 'R-MANT-05' | 'NEXT_MAINTENANCE';
    machineId: string;
    machine?: Machine;
    title: string;
    line: string;
    description?: string;
    order?: WorkOrder;
  }

  // Hover Popover State
  const [hoveredItem, setHoveredItem] = useState<CalendarItem | null>(null);
  const [hoveredMachine, setHoveredMachine] = useState<Machine | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load orders on mount
  useEffect(() => {
    fetchCalendarOrders();
  }, [fetchCalendarOrders]);

  // Navigate dates helper
  const handlePrev = () => {
    const nextDate = new Date(currentDate);
    if (activeView === 'month') {
      nextDate.setMonth(currentDate.getMonth() - 1);
    } else if (activeView === 'week') {
      nextDate.setDate(currentDate.getDate() - 7);
    } else {
      nextDate.setDate(currentDate.getDate() - 1);
    }
    setCurrentDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(currentDate);
    if (activeView === 'month') {
      nextDate.setMonth(currentDate.getMonth() + 1);
    } else if (activeView === 'week') {
      nextDate.setDate(currentDate.getDate() + 7);
    } else {
      nextDate.setDate(currentDate.getDate() + 1);
    }
    setCurrentDate(nextDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Date parsing / matching helpers (avoiding timezone offset issues)
  const isSameDay = (d1: Date, dateStr?: string) => {
    if (!dateStr) return false;
    const cleanDate = dateStr.split('T')[0]; // "YYYY-MM-DD"
    const y = d1.getFullYear();
    const m = String(d1.getMonth() + 1).padStart(2, '0');
    const d = String(d1.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}` === cleanDate;
  };

  // Selector to get unified items matching active filters
  const getFilteredItems = (): CalendarItem[] => {
    const items: CalendarItem[] = [];

    // Add work orders if active
    if (showMant02 || showMant05) {
      calendarOrders.forEach((order) => {
        if (order.formType === 'R-MANT-02' && !showMant02) return;
        if (order.formType === 'R-MANT-05' && !showMant05) return;
        if (order.formType !== 'R-MANT-02' && order.formType !== 'R-MANT-05') return;

        const machine = machines.find((m) => m.id === order.machineId);
        items.push({
          id: order.id,
          date: order.startDate || order.createdDate,
          type: order.formType,
          machineId: order.machineId,
          machine,
          title: machine?.alias || machine?.model || machine?.name || 'Eq',
          line: getMachineLine(machine?.zone),
          description: order.description,
          order,
        });
      });
    }

    // Add next maintenance events if active
    if (showNextMaint) {
      machines.forEach((machine) => {
        if (machine.nextMaintenance && machine.isActive !== false) {
          items.push({
            id: `maint-${machine.id}-${machine.nextMaintenance}`, // Ensure unique key across calendar
            date: machine.nextMaintenance,
            type: 'NEXT_MAINTENANCE',
            machineId: machine.id,
            machine,
            title: machine.alias || machine.model || machine.name || 'Eq',
            line: getMachineLine(machine.zone),
            description: language === 'es'
              ? 'Próximo mantenimiento estimado'
              : 'Estimated next maintenance',
          });
        }
      });
    }

    return items;
  };

  // Helper to extract machine line/zone
  const getMachineLine = (zoneStr?: string) => {
    if (!zoneStr) return 'L-N/A';
    if (zoneStr.includes(' - ')) {
      return zoneStr.split(' - ')[1]; // e.g. "L4" from "Zona A - L4"
    }
    return zoneStr;
  };

  // Handlers for Hover Popover
  const handleMouseEnter = (e: React.MouseEvent, item: CalendarItem) => {
    const machine = item.machine || machines.find((m) => m.id === item.machineId);
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Position fixed tooltip above the card, centered horizontally
    setHoveredItem(item);
    setHoveredMachine(machine || null);
    setTooltipPos({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY - 8,
    });
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    setHoveredMachine(null);
  };

  // Print/Export placeholder action
  const handlePrint = () => {
    window.print();
  };

  // Render view headers
  const getHeaderTitle = () => {
    const monthNamesEn = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthNamesEs = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const months = language === 'es' ? monthNamesEs : monthNamesEn;
    const monthName = months[currentDate.getMonth()];
    
    if (activeView === 'month') {
      return `${monthName}, ${currentDate.getFullYear()}`;
    } else if (activeView === 'week') {
      // Show range of the week
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      
      const startMonth = months[start.getMonth()].substring(0, 3);
      const endMonth = months[end.getMonth()].substring(0, 3);
      
      return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${currentDate.getFullYear()}`;
    } else {
      const weekdaysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weekdaysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const wDays = language === 'es' ? weekdaysEs : weekdaysEn;
      
      return `${wDays[currentDate.getDay()]}, ${monthName} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    }
  };

  // Get dynamic main title depending on filter
  const getDynamicTitle = () => {
    if (showMant02 && !showMant05 && !showNextMaint) {
      return language === 'es' ? 'Mantenimientos R-MANT-02' : 'R-MANT-02 Maintenance';
    } else if (!showMant02 && showMant05 && !showNextMaint) {
      return language === 'es' ? 'Mantenimientos R-MANT-05' : 'R-MANT-05 Maintenance';
    } else if (!showMant02 && !showMant05 && showNextMaint) {
      return language === 'es' ? 'Próximos Mantenimientos' : 'Upcoming Maintenance';
    } else {
      return language === 'es' ? 'Calendario de Mantenimiento' : 'Maintenance Calendar';
    }
  };

  // --- MONTH VIEW LOGIC ---
  const renderMonthView = () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const startDayOfWeek = startOfMonth.getDay(); // Sunday = 0
    const totalDays = endOfMonth.getDate();
    
    const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    const totalDaysPrev = prevMonthEnd.getDate();
    
    const days: { date: Date; isCurrentMonth: boolean; dayNumber: number }[] = [];
    
    // Previous Month Days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = totalDaysPrev - i;
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, dayNum);
      days.push({ date: d, isCurrentMonth: false, dayNumber: dayNum });
    }
    
    // Current Month Days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      days.push({ date: d, isCurrentMonth: true, dayNumber: i });
    }
    
    // Next Month Days (to make complete grid of 42 cells)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i);
      days.push({ date: d, isCurrentMonth: false, dayNumber: i });
    }
    
    const weekdaysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdaysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const weekdays = language === 'es' ? weekdaysEs : weekdaysEn;
    const filteredItems = getFilteredItems();

    return (
      <div className="flex-1 flex flex-col overflow-hidden min-h-[500px]">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-industrial-800 bg-industrial-900/50 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-industrial-500">
          {weekdays.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        
        {/* Month grid */}
        <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-[1px] bg-industrial-800/40 border border-industrial-800 rounded-b-lg overflow-hidden">
          {days.map((dayObj, index) => {
            const dayItems = filteredItems.filter((item) => isSameDay(dayObj.date, item.date));
            const isToday = isSameDay(new Date(), formatDateString(dayObj.date));
            
            return (
              <div
                key={index}
                className={`flex flex-col p-1.5 border border-industrial-800/30 overflow-hidden relative group/cell min-h-[90px] ${
                  dayObj.isCurrentMonth
                    ? 'bg-industrial-900/20 text-slate-100'
                    : 'bg-industrial-950/20 text-industrial-600 opacity-60'
                }`}
              >
                {/* Day number */}
                <div className="flex justify-between items-center mb-1">
                  {isToday ? (
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-blue-500/20">
                      {dayObj.dayNumber}
                    </span>
                  ) : (
                    <span className={`text-xs font-semibold ${dayObj.isCurrentMonth ? 'text-slate-400' : 'text-industrial-600'}`}>
                      {dayObj.dayNumber}
                    </span>
                  )}
                  {dayItems.length > 0 && (
                    <span className="text-[10px] bg-industrial-800 text-industrial-400 font-mono px-1.5 py-0.2 rounded">
                      {dayItems.length}
                    </span>
                  )}
                </div>
                
                {/* Items container */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                  {dayItems.map((item) => {
                    const isMant02 = item.type === 'R-MANT-02';
                    const isMant05 = item.type === 'R-MANT-05';
                    const isNextMaint = item.type === 'NEXT_MAINTENANCE';
                    
                    return (
                      <div
                        key={item.id}
                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => {
                          if (isNextMaint) {
                            navigate('/orders/new', { state: { machineId: item.machineId } });
                          } else {
                            navigate(`/orders/${item.id}`, { state: { type: item.type } });
                          }
                        }}
                        className={`cursor-pointer px-2 py-1 rounded text-[11px] font-medium transition-all duration-150 truncate block select-none border ${
                          isMant02
                            ? 'bg-emerald-600/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-600/20 hover:border-emerald-500/40'
                            : isMant05
                            ? 'bg-amber-600/10 text-amber-300 border-amber-500/20 hover:bg-amber-600/20 hover:border-amber-500/40'
                            : 'bg-blue-600/10 text-blue-300 border-blue-500/20 hover:bg-blue-600/20 hover:border-blue-500/40'
                        }`}
                      >
                        {isNextMaint ? '🔧 ' : ''}{item.title} - {item.line}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Helper date formatter
  const formatDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // --- WEEK VIEW LOGIC ---
  const renderWeekView = () => {
    // Start of current week (Sunday)
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push(d);
    }
    
    const weekdaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdaysEs = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const weekdays = language === 'es' ? weekdaysEs : weekdaysEn;
    const filteredItems = getFilteredItems();

    return (
      <div className="flex-1 grid grid-cols-7 gap-3 overflow-hidden min-h-[400px]">
        {weekDays.map((day, idx) => {
          const dayItems = filteredItems.filter((item) => isSameDay(day, item.date));
          const isToday = isSameDay(new Date(), formatDateString(day));
          
          return (
            <div
              key={idx}
              className={`flex flex-col bg-industrial-900/30 rounded-xl border p-3.5 overflow-hidden ${
                isToday ? 'border-blue-500/40 ring-1 ring-blue-500/20' : 'border-industrial-800'
              }`}
            >
              {/* Day header */}
              <div className="border-b border-industrial-800 pb-3 mb-3 text-center">
                <p className="text-xs font-bold text-industrial-500 uppercase tracking-wider">
                  {weekdays[idx]}
                </p>
                <p className={`text-xl font-bold mt-1 ${isToday ? 'text-blue-400' : 'text-white'}`}>
                  {day.getDate()}
                </p>
              </div>
              
              {/* Cards list */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 custom-scrollbar">
                {dayItems.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-2">
                    <p className="text-xs text-industrial-600 italic">No events</p>
                  </div>
                ) : (
                  dayItems.map((item) => {
                    const isMant02 = item.type === 'R-MANT-02';
                    const isMant05 = item.type === 'R-MANT-05';
                    const isNextMaint = item.type === 'NEXT_MAINTENANCE';
                    
                    return (
                      <div
                        key={item.id}
                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => {
                          if (isNextMaint) {
                            navigate('/orders/new', { state: { machineId: item.machineId } });
                          } else {
                            navigate(`/orders/${item.id}`, { state: { type: item.type } });
                          }
                        }}
                        className={`cursor-pointer p-2.5 rounded-lg border text-xs transition-all duration-200 shadow-md ${
                          isMant02
                            ? 'bg-emerald-600/10 text-emerald-200 border-emerald-500/30 hover:border-emerald-400/50 hover:bg-emerald-600/20'
                            : isMant05
                            ? 'bg-amber-600/10 text-amber-200 border-amber-500/30 hover:border-amber-400/50 hover:bg-amber-600/20'
                            : 'bg-blue-600/10 text-blue-200 border-blue-500/30 hover:border-blue-400/50 hover:bg-blue-600/20'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold uppercase tracking-wider text-[10px]">
                            {isNextMaint
                              ? (language === 'es' ? 'PRÓX. MANT.' : 'UPCOMING MANT.')
                              : item.type}
                          </span>
                          <span className="font-mono text-[10px] text-industrial-400">
                            {isNextMaint
                              ? (language === 'es' ? 'Programado' : 'Scheduled')
                              : (item.order?.displayId || `#${item.id.substring(0, 4)}`)}
                          </span>
                        </div>
                        <h5 className="font-bold text-white leading-snug truncate mt-1.5" title={item.machine?.name}>
                          {item.title}
                        </h5>
                        <p className="text-industrial-400 text-[11px] mt-1 flex justify-between items-center">
                          <span>{item.line}</span>
                          {isNextMaint ? (
                            <span className="italic text-blue-400 font-semibold">
                              {language === 'es' ? 'Estimado' : 'Est.'}
                            </span>
                          ) : (
                            item.order?.interval && <span className="italic">{item.order.interval}</span>
                          )}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- DAY VIEW LOGIC ---
  const renderDayView = () => {
    const dayItems = getFilteredItems().filter((item) => isSameDay(currentDate, item.date));
    
    return (
      <div className="flex-1 bg-industrial-900/30 rounded-xl border border-industrial-800 p-6 overflow-y-auto min-h-[350px]">
        <h4 className="text-xs font-bold text-industrial-400 uppercase tracking-widest border-b border-industrial-800 pb-3 mb-4 flex justify-between items-center">
          <span>{language === 'es' ? 'REGISTROS Y MANTENIMIENTOS' : 'LOGS & MAINTENANCE'}</span>
          <span className="bg-industrial-800 px-2 py-0.5 rounded text-industrial-300 font-mono">
            {dayItems.length}
          </span>
        </h4>
        
        {dayItems.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-industrial-500 italic">
              {language === 'es'
                ? 'No hay eventos programados para este día.'
                : 'No scheduled events for this day.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {dayItems.map((item) => {
              const isMant02 = item.type === 'R-MANT-02';
              const isMant05 = item.type === 'R-MANT-05';
              const isNextMaint = item.type === 'NEXT_MAINTENANCE';
              
              return (
                <div
                  key={item.id}
                  onMouseEnter={(e) => handleMouseEnter(e, item)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => {
                    if (isNextMaint) {
                      navigate('/orders/new', { state: { machineId: item.machineId } });
                    } else {
                      navigate(`/orders/${item.id}`, { state: { type: item.type } });
                    }
                  }}
                  className={`cursor-pointer p-4 rounded-xl border flex justify-between items-start gap-4 transition-all duration-200 hover:shadow-lg hover:border-industrial-500 ${
                    isMant02
                      ? 'bg-emerald-600/10 text-emerald-200 border-emerald-500/20'
                      : isMant05
                      ? 'bg-amber-600/10 text-amber-200 border-amber-500/20'
                      : 'bg-blue-600/10 text-blue-200 border-blue-500/20'
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        isMant02 ? 'bg-emerald-600 text-white border-emerald-400' :
                        isMant05 ? 'bg-amber-600 text-white border-amber-400' :
                        'bg-blue-600 text-white border-blue-400'
                      }`}>
                        {isNextMaint
                          ? (language === 'es' ? 'PRÓXIMO MANTENIMIENTO' : 'NEXT MAINTENANCE')
                          : item.type}
                      </span>
                      {!isNextMaint && (
                        <span className="text-xs text-white font-bold font-mono">
                          {item.order?.displayId || item.id}
                        </span>
                      )}
                    </div>
                    
                    <h5 className="text-base font-bold text-white mt-1">
                      {item.machine?.name || 'Eq'} - {item.machine?.model || 'N/A'}
                    </h5>
                    
                    <p className="text-sm text-industrial-300 leading-snug">
                      {isNextMaint
                        ? (language === 'es'
                            ? `Fecha programada de próximo mantenimiento registrado en Registro de Uso para el equipo ${item.machine?.name || ''}.`
                            : `Scheduled next maintenance date registered in Usage Log for equipment ${item.machine?.name || ''}.`)
                        : (item.order?.description || 'Sin descripción')}
                    </p>
                    
                    <div className="flex gap-4 text-xs text-industrial-400 mt-2 font-medium">
                      <span>Línea: <strong className="text-white">{item.line}</strong></span>
                      {isNextMaint ? (
                        <span>Lectura actual: <strong className="text-white">{(item.machine?.runningHours || 0).toLocaleString('en-US')} h</strong></span>
                      ) : (
                        item.order?.interval && (
                          <span>Intervalo: <strong className="text-white">{item.order.interval}</strong></span>
                        )
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right flex flex-col justify-between h-full min-h-[60px] text-xs">
                    <span className="bg-industrial-800 text-industrial-300 px-2 py-0.5 rounded border border-industrial-700 uppercase font-bold tracking-wide">
                      {isNextMaint
                        ? (language === 'es' ? 'PROGRAMADO' : 'SCHEDULED')
                        : (item.order?.currentStage === 'CLOSED' ? 'CERRADO' :
                           item.order?.currentStage === 'HANDOVER' ? 'SUPERVISIÓN' :
                           item.order?.currentStage === 'EXECUTION' ? 'EJECUCIÓN' : 'SOLICITUD')}
                    </span>
                    {!isNextMaint && (
                      <span className="text-industrial-500 font-mono mt-auto block">
                        {item.order?.startTime && item.order?.endTime ? `${item.order.startTime} - ${item.order.endTime}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-industrial-900 text-slate-100 p-6 overflow-hidden relative">
      {/* Top Header */}
      <div className="flex justify-between items-center pb-4 border-b border-industrial-800">
        <div>
          <h2 className="text-2xl font-bold text-white flex flex-wrap items-baseline gap-3">
            <Calendar className="text-blue-500 print-hide" />
            <span>{getDynamicTitle()}</span>
            <span className="hidden print:inline text-lg font-medium text-slate-600 ml-2">
              - {getHeaderTitle()}
            </span>
          </h2>
          <p className="text-xs text-industrial-500 mt-0.5 print-hide">
            {language === 'es'
              ? 'Calendario integrado de registros de mantenimiento preventivo y correctivo.'
              : 'Integrated calendar of preventive and corrective maintenance logs.'}
          </p>
        </div>
        
        {/* Action icons */}
        <div className="flex items-center gap-2 print-hide">
          <button className="p-2 bg-industrial-800 hover:bg-industrial-700 rounded text-slate-400 hover:text-white transition-colors" title="Search">
            <Search size={18} />
          </button>
          <button
            onClick={() => navigate('/orders/new')}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors shadow-lg shadow-blue-500/20"
            title="Add Order"
          >
            <Plus size={18} />
          </button>
          <button className="p-2 bg-industrial-800 hover:bg-industrial-700 rounded text-slate-400 hover:text-white transition-colors" title="Settings">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 py-4 z-10 print-hide">
        {/* View switcher & Filters */}
        <div className="flex flex-wrap items-center gap-3 print-hide">
          {/* Month / Week / Day toggle */}
          <div className="bg-industrial-850 p-0.5 rounded-lg flex border border-industrial-800">
            <button
              onClick={() => setActiveView('month')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                activeView === 'month'
                  ? 'bg-industrial-700 text-white shadow-md'
                  : 'text-industrial-400 hover:text-white'
              }`}
            >
              {language === 'es' ? 'Mes' : 'Month'}
            </button>
            <button
              onClick={() => setActiveView('week')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                activeView === 'week'
                  ? 'bg-industrial-700 text-white shadow-md'
                  : 'text-industrial-400 hover:text-white'
              }`}
            >
              {language === 'es' ? 'Semana' : 'Week'}
            </button>
            <button
              onClick={() => setActiveView('day')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                activeView === 'day'
                  ? 'bg-industrial-700 text-white shadow-md'
                  : 'text-industrial-400 hover:text-white'
              }`}
            >
              {language === 'es' ? 'Día' : 'Day'}
            </button>
          </div>

          <div className="w-[1px] h-6 bg-industrial-800 hidden md:block mx-1"></div>

          {/* Type Filters (R-MANT-02 / R-MANT-05 / NEXT_MAINTENANCE) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleMant02}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 flex items-center gap-2 ${
                showMant02
                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/25 shadow-lg'
                  : 'bg-industrial-950/20 text-industrial-500 border-industrial-800 hover:border-industrial-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showMant02 ? 'bg-emerald-400 animate-pulse' : 'bg-industrial-600'}`}></span>
              R-MANT-02
            </button>
            <button
              onClick={handleToggleMant05}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 flex items-center gap-2 ${
                showMant05
                  ? 'bg-amber-600/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/25 shadow-lg'
                  : 'bg-industrial-950/20 text-industrial-500 border-industrial-800 hover:border-industrial-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showMant05 ? 'bg-amber-400 animate-pulse' : 'bg-industrial-600'}`}></span>
              R-MANT-05
            </button>
            <button
              onClick={handleToggleNextMaint}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 flex items-center gap-2 ${
                showNextMaint
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 ring-1 ring-blue-500/25 shadow-lg'
                  : 'bg-industrial-950/20 text-industrial-500 border-industrial-800 hover:border-industrial-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showNextMaint ? 'bg-blue-400 animate-pulse' : 'bg-industrial-600'}`}></span>
              {language === 'es' ? 'Próximos Mantenimientos' : 'Upcoming Maintenance'}
            </button>
          </div>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between sm:justify-end gap-3.5">
          {/* Middle Indicator */}
          <h3 className="text-sm font-bold text-white font-sans order-2 sm:order-none px-2 text-center sm:text-left min-w-[120px]">
            {getHeaderTitle()}
          </h3>

          <div className="flex items-center gap-1.5 order-1 sm:order-none print-hide">
            <button
              onClick={handlePrev}
              className="p-1.5 bg-industrial-800 hover:bg-industrial-700 rounded-md border border-industrial-700 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 bg-industrial-800 hover:bg-industrial-700 rounded-md border border-industrial-700 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-3 py-1.5 bg-industrial-800 hover:bg-industrial-700 rounded-md border border-industrial-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors order-3 print-hide"
          >
            {language === 'es' ? 'Hoy' : 'Today'}
          </button>

          <button
            onClick={handlePrint}
            className="p-1.5 bg-industrial-800 hover:bg-industrial-700 rounded-md border border-industrial-700 text-slate-400 hover:text-white transition-colors hidden md:block print-hide"
            title="Print Calendar"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="text-xs text-industrial-500 animate-pulse">
              {language === 'es' ? 'Cargando registros...' : 'Loading events...'}
            </p>
          </div>
        ) : (
          <>
            {activeView === 'month' && renderMonthView()}
            {activeView === 'week' && renderWeekView()}
            {activeView === 'day' && renderDayView()}
          </>
        )}
      </div>

      {/* Floating Hover Popover Tooltip */}
      {hoveredItem && (
        <div
          className="fixed z-[9999] bg-white border border-slate-200 text-slate-800 rounded-xl p-4 shadow-2xl w-72 pointer-events-none transition-all duration-100 ease-out"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="space-y-3">
            {/* Title / Machine Name */}
            <div>
              <h4 className="text-base font-bold text-slate-900 leading-tight">
                {hoveredMachine?.name || 'Sin Nombre'}
              </h4>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                {hoveredItem.type === 'NEXT_MAINTENANCE'
                  ? (language === 'es' ? 'Próximo Mantenimiento' : 'Next Maintenance')
                  : (hoveredItem.order?.interval || 'Sin Intervalo')}
              </p>
            </div>

            {/* Grid for Bottom info */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              <div>
                <span className="block text-[10px] text-slate-400 font-normal normal-case">Línea</span>
                <span className="text-slate-800 truncate block" title={hoveredItem.line}>
                  {hoveredItem.line}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-normal normal-case">Modelo</span>
                <span className="text-slate-800 truncate block max-w-full" title={hoveredMachine?.model}>
                  {hoveredMachine?.model || 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-normal normal-case">
                  {hoveredItem.type === 'NEXT_MAINTENANCE' ? 'Fecha' : 'Orden'}
                </span>
                <span className="text-slate-800 truncate block font-mono" title={hoveredItem.type === 'NEXT_MAINTENANCE' ? hoveredItem.date : (hoveredItem.order?.displayId || hoveredItem.id)}>
                  {hoveredItem.type === 'NEXT_MAINTENANCE'
                    ? hoveredItem.date
                    : (hoveredItem.order?.displayId || hoveredItem.id.substring(0, 8))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
