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
  
  // Filter States: R-MANT-02 (Preventive) and R-MANT-05 (Corrective)
  // Default to showing both
  const [showMant02, setShowMant02] = useState<boolean>(true);
  const [showMant05, setShowMant05] = useState<boolean>(true);

  // Hover Popover State
  const [hoveredOrder, setHoveredOrder] = useState<WorkOrder | null>(null);
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

  // Filters matching
  const getFilteredOrders = () => {
    return calendarOrders.filter((order) => {
      if (order.formType === 'R-MANT-02' && !showMant02) return false;
      if (order.formType === 'R-MANT-05' && !showMant05) return false;
      // Only show R-MANT-02 and R-MANT-05 as per requirements
      return order.formType === 'R-MANT-02' || order.formType === 'R-MANT-05';
    });
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
  const handleMouseEnter = (e: React.MouseEvent, order: WorkOrder) => {
    const machine = machines.find((m) => m.id === order.machineId);
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Position fixed tooltip above the card, centered horizontally
    setHoveredOrder(order);
    setHoveredMachine(machine || null);
    setTooltipPos({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY - 8,
    });
  };

  const handleMouseLeave = () => {
    setHoveredOrder(null);
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
    if (showMant02 && !showMant05) {
      return language === 'es' ? 'Mantenimientos R-MANT-02' : 'R-MANT-02 Maintenance';
    } else if (!showMant02 && showMant05) {
      return language === 'es' ? 'Mantenimientos R-MANT-05' : 'R-MANT-05 Maintenance';
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
    const filteredOrders = getFilteredOrders();

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
            const dayOrders = filteredOrders.filter((o) => isSameDay(dayObj.date, o.startDate || o.createdDate));
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
                  {dayOrders.length > 0 && (
                    <span className="text-[10px] bg-industrial-800 text-industrial-400 font-mono px-1.5 py-0.2 rounded">
                      {dayOrders.length}
                    </span>
                  )}
                </div>
                
                {/* Orders container */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                  {dayOrders.map((order) => {
                    const machine = machines.find((m) => m.id === order.machineId);
                    const isMant02 = order.formType === 'R-MANT-02';
                    const machineName = machine?.alias || machine?.model || machine?.name || 'Eq';
                    const machineLine = getMachineLine(machine?.zone);
                    
                    return (
                      <div
                        key={order.id}
                        onMouseEnter={(e) => handleMouseEnter(e, order)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => navigate(`/orders/${order.id}`, { state: { type: order.formType } })}
                        className={`cursor-pointer px-2 py-1 rounded text-[11px] font-medium transition-all duration-150 truncate block select-none border ${
                          isMant02
                            ? 'bg-blue-600/10 text-blue-300 border-blue-500/20 hover:bg-blue-600/20 hover:border-blue-500/40'
                            : 'bg-amber-600/10 text-amber-300 border-amber-500/20 hover:bg-amber-600/20 hover:border-amber-500/40'
                        }`}
                      >
                        {machineName} - {machineLine}
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
    const filteredOrders = getFilteredOrders();

    return (
      <div className="flex-1 grid grid-cols-7 gap-3 overflow-hidden min-h-[400px]">
        {weekDays.map((day, idx) => {
          const dayOrders = filteredOrders.filter((o) => isSameDay(day, o.startDate || o.createdDate));
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
              
              {/* Order Cards list */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 custom-scrollbar">
                {dayOrders.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-2">
                    <p className="text-xs text-industrial-600 italic">No events</p>
                  </div>
                ) : (
                  dayOrders.map((order) => {
                    const machine = machines.find((m) => m.id === order.machineId);
                    const isMant02 = order.formType === 'R-MANT-02';
                    const machineName = machine?.alias || machine?.model || machine?.name || 'Eq';
                    const machineLine = getMachineLine(machine?.zone);
                    
                    return (
                      <div
                        key={order.id}
                        onMouseEnter={(e) => handleMouseEnter(e, order)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => navigate(`/orders/${order.id}`, { state: { type: order.formType } })}
                        className={`cursor-pointer p-2.5 rounded-lg border text-xs transition-all duration-200 shadow-md ${
                          isMant02
                            ? 'bg-blue-600/10 text-blue-200 border-blue-500/30 hover:border-blue-400/50 hover:bg-blue-600/20'
                            : 'bg-amber-600/10 text-amber-200 border-amber-500/30 hover:border-amber-400/50 hover:bg-amber-600/20'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold uppercase tracking-wider text-[10px]">
                            {isMant02 ? 'R-MANT-02' : 'R-MANT-05'}
                          </span>
                          <span className="font-mono text-[10px] text-industrial-400">
                            {order.displayId || `#${order.id.substring(0, 4)}`}
                          </span>
                        </div>
                        <h5 className="font-bold text-white leading-snug truncate mt-1.5" title={machine?.name}>
                          {machineName}
                        </h5>
                        <p className="text-industrial-400 text-[11px] mt-1 flex justify-between items-center">
                          <span>{machineLine}</span>
                          {order.interval && <span className="italic">{order.interval}</span>}
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
    const dayOrders = getFilteredOrders().filter((o) => isSameDay(currentDate, o.startDate || o.createdDate));
    
    return (
      <div className="flex-1 bg-industrial-900/30 rounded-xl border border-industrial-800 p-6 overflow-y-auto min-h-[350px]">
        <h4 className="text-xs font-bold text-industrial-400 uppercase tracking-widest border-b border-industrial-800 pb-3 mb-4 flex justify-between items-center">
          <span>{language === 'es' ? 'ÓRDENES DE TRABAJO REGISTRADAS' : 'REGISTERED WORK ORDERS'}</span>
          <span className="bg-industrial-800 px-2 py-0.5 rounded text-industrial-300 font-mono">
            {dayOrders.length}
          </span>
        </h4>
        
        {dayOrders.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-industrial-500 italic">
              {language === 'es'
                ? 'No hay mantenimientos programados para este día.'
                : 'No maintenance scheduled for this day.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {dayOrders.map((order) => {
              const machine = machines.find((m) => m.id === order.machineId);
              const isMant02 = order.formType === 'R-MANT-02';
              
              return (
                <div
                  key={order.id}
                  onMouseEnter={(e) => handleMouseEnter(e, order)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => navigate(`/orders/${order.id}`, { state: { type: order.formType } })}
                  className={`cursor-pointer p-4 rounded-xl border flex justify-between items-start gap-4 transition-all duration-200 hover:shadow-lg hover:border-industrial-500 ${
                    isMant02
                      ? 'bg-blue-600/10 text-blue-200 border-blue-500/20'
                      : 'bg-amber-600/10 text-amber-200 border-amber-500/20'
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        isMant02 ? 'bg-blue-600 text-white border-blue-400' : 'bg-amber-600 text-white border-amber-400'
                      }`}>
                        {order.formType}
                      </span>
                      <span className="text-xs text-white font-bold font-mono">
                        {order.displayId || order.id}
                      </span>
                    </div>
                    
                    <h5 className="text-base font-bold text-white mt-1">
                      {machine?.name || 'Eq'} - {machine?.model || 'N/A'}
                    </h5>
                    
                    <p className="text-sm text-industrial-300 leading-snug">
                      {order.description || 'Sin descripción'}
                    </p>
                    
                    <div className="flex gap-4 text-xs text-industrial-400 mt-2 font-medium">
                      <span>Línea: <strong className="text-white">{getMachineLine(machine?.zone)}</strong></span>
                      {order.interval && (
                        <span>Intervalo: <strong className="text-white">{order.interval}</strong></span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right flex flex-col justify-between h-full min-h-[60px] text-xs">
                    <span className="bg-industrial-800 text-industrial-300 px-2 py-0.5 rounded border border-industrial-700 uppercase font-bold tracking-wide">
                      {order.currentStage === 'CLOSED' ? 'CERRADO' :
                       order.currentStage === 'HANDOVER' ? 'SUPERVISIÓN' :
                       order.currentStage === 'EXECUTION' ? 'EJECUCIÓN' : 'SOLICITUD'}
                    </span>
                    <span className="text-industrial-500 font-mono mt-auto block">
                      {order.startTime && order.endTime ? `${order.startTime} - ${order.endTime}` : ''}
                    </span>
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

          {/* Type Filters (R-MANT-02 / R-MANT-05) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Do not allow both filters to be false (at least one must be active)
                if (showMant02 && !showMant05) {
                  setShowMant05(true);
                  setShowMant02(false);
                } else {
                  setShowMant02(!showMant02);
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 flex items-center gap-2 ${
                showMant02
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 ring-1 ring-blue-500/25 shadow-lg'
                  : 'bg-industrial-950/20 text-industrial-500 border-industrial-800 hover:border-industrial-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showMant02 ? 'bg-blue-400 animate-pulse' : 'bg-industrial-600'}`}></span>
              R-MANT-02
            </button>
            <button
              onClick={() => {
                if (showMant05 && !showMant02) {
                  setShowMant02(true);
                  setShowMant05(false);
                } else {
                  setShowMant05(!showMant05);
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 flex items-center gap-2 ${
                showMant05
                  ? 'bg-amber-600/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/25 shadow-lg'
                  : 'bg-industrial-950/20 text-industrial-500 border-industrial-800 hover:border-industrial-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showMant05 ? 'bg-amber-400 animate-pulse' : 'bg-industrial-600'}`}></span>
              R-MANT-05
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
      {hoveredOrder && (
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
                {hoveredOrder.interval || 'Sin Intervalo'}
              </p>
            </div>

            {/* Grid for Bottom info */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              <div>
                <span className="block text-[10px] text-slate-400 font-normal normal-case">Línea</span>
                <span className="text-slate-800 truncate block" title={getMachineLine(hoveredMachine?.zone)}>
                  {getMachineLine(hoveredMachine?.zone)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-normal normal-case">Modelo</span>
                <span className="text-slate-800 truncate block max-w-full" title={hoveredMachine?.model}>
                  {hoveredMachine?.model || 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-normal normal-case">Orden</span>
                <span className="text-slate-800 truncate block font-mono" title={hoveredOrder.displayId || hoveredOrder.id}>
                  {hoveredOrder.displayId || hoveredOrder.id.substring(0, 8)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
