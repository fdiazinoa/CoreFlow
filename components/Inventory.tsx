import React, { useState, useEffect } from 'react';
import { InventoryList } from '../src/components/inventory/InventoryList';
import { PartRequestForm } from '../src/components/inventory/PartRequestForm';
import { ReceptionForm } from '../src/components/inventory/ReceptionForm';
import { PartCreationForm } from '../src/components/inventory/PartCreationForm';
import { RequestList } from '../src/components/inventory/RequestList';
import { PurchaseRequestList } from '../src/components/inventory/PurchaseRequestList';
import { RequestDetail } from '../src/components/inventory/RequestDetail';
import { inventoryService } from '../src/services';
import { PartsRequest, SparePart } from '../src/types/inventory';
import { useAuth } from '../contexts/AuthContext';
import { Layers, FileText, ArrowDownCircle, PlusCircle, List } from 'lucide-react';

export const Inventory: React.FC<any> = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_inventory');
  const [activeTab, setActiveTab] = useState<'list' | 'request' | 'requests_list' | 'receive' | 'create' | 'purchase_requests'>('list');
  const [selectedRequest, setSelectedRequest] = useState<PartsRequest | null>(null);
  const [parts, setParts] = useState<SparePart[]>([]);

  // Fetch parts when showing details, as we need them for names
  useEffect(() => {
    if (activeTab === 'requests_list' && selectedRequest) {
      inventoryService.getAllParts().then(res => setParts(res.data));
    }
  }, [activeTab, selectedRequest]);

  const handleSelectRequest = async (request: PartsRequest) => {
    try {
      const fullRequest = await inventoryService.getRequestById(request.id);
      setSelectedRequest(fullRequest);
    } catch (error) {
      console.error('Error fetching request details:', error);
      setSelectedRequest(request);
    }
  };

  const handleBackToRequestList = () => {
    setSelectedRequest(null);
  };

  return (
    <div className="h-full bg-industrial-900 p-6 overflow-auto">

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Repuestos</h1>
          <p className="text-industrial-500 text-sm">Gestiona el inventario, solicitudes y recepciones.</p>
        </div>
      </div>

      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => { setActiveTab('list'); setSelectedRequest(null); }}
          className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${activeTab === 'list'
            ? 'bg-industrial-800 text-white border-industrial-600 shadow-md'
            : 'bg-transparent text-industrial-500 border-transparent hover:text-industrial-300 hover:bg-industrial-800/50'
            }`}
        >
          <Layers className="w-4 h-4 mr-2" />
          Stock Actual
        </button>
        {(canManage || hasPermission('view_part_requests')) && (
          <button
            onClick={() => { setActiveTab('requests_list'); setSelectedRequest(null); }}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${activeTab === 'requests_list'
              ? 'bg-industrial-800 text-white border-industrial-600 shadow-md'
              : 'bg-transparent text-industrial-500 border-transparent hover:text-industrial-300 hover:bg-industrial-800/50'
              }`}
          >
            <List className="w-4 h-4 mr-2" />
            Lista Solicitudes
          </button>
        )}
        {canManage && (
          <>
            <button
              onClick={() => setActiveTab('request')}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${activeTab === 'request'
                ? 'bg-industrial-800 text-white border-industrial-600 shadow-md'
                : 'bg-transparent text-industrial-500 border-transparent hover:text-industrial-300 hover:bg-industrial-800/50'
                }`}
            >
              <FileText className="w-4 h-4 mr-2" />
              Nueva Solicitud
            </button>
            <button
              onClick={() => setActiveTab('receive')}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${activeTab === 'receive'
                ? 'bg-industrial-800 text-white border-industrial-600 shadow-md'
                : 'bg-transparent text-industrial-500 border-transparent hover:text-industrial-300 hover:bg-industrial-800/50'
                }`}
            >
              <ArrowDownCircle className="w-4 h-4 mr-2" />
              Recepción
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${activeTab === 'create'
                ? 'bg-industrial-800 text-white border-industrial-600 shadow-md'
                : 'bg-transparent text-industrial-500 border-transparent hover:text-industrial-300 hover:bg-industrial-800/50'
                }`}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Nuevo Repuesto
            </button>
          </>
        )}
        {(canManage || hasPermission('view_purchase_requests')) && (
          <button
            onClick={() => { setActiveTab('purchase_requests'); setSelectedRequest(null); }}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${activeTab === 'purchase_requests'
              ? 'bg-industrial-800 text-white border-industrial-600 shadow-md'
              : 'bg-transparent text-industrial-500 border-transparent hover:text-industrial-300 hover:bg-industrial-800/50'
              }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            Solicitudes Compras
          </button>
        )}
      </div>

      <div className="bg-industrial-900 rounded-xl min-h-[500px]">
        {activeTab === 'list' && <InventoryList />}
        {activeTab === 'request' && <PartRequestForm />}
        {activeTab === 'receive' && <ReceptionForm />}
        {activeTab === 'create' && <PartCreationForm />}
        {activeTab === 'purchase_requests' && <PurchaseRequestList />}
        {activeTab === 'requests_list' && (
          selectedRequest ? (
            <RequestDetail request={selectedRequest} parts={parts} onBack={handleBackToRequestList} />
          ) : (
            <RequestList onSelectRequest={handleSelectRequest} />
          )
        )}
      </div>

    </div>
  );
};