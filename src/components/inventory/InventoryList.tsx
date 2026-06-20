import React, { useState, useEffect } from 'react';
import { inventoryService } from '../../services';
import { SparePart } from '../../types/inventory';
import { Search, AlertCircle, FileDown } from 'lucide-react';
import { SparePartDetail } from './SparePartDetail';
import { useMasterStore } from '../../stores/useMasterStore';
import { TablePagination } from '../shared/TablePagination';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Service initialized in index.ts

export const InventoryList: React.FC = () => {
    const {
        parts,
        isLoading: loading,
        fetchInventoryData,
        partCategories: categories,
        partLocations: locations,
        partCompanies: companies,
        partSuppliers: suppliers,
        inventoryPagination: pagination,
        setInventoryPage: setPage,
        inventoryFilters,
        setInventoryFilters,
        plantSettings
    } = useMasterStore();
    const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);

    // Filters (Sync with store)
    const searchTerm = inventoryFilters.search || '';
    const supplierFilter = inventoryFilters.supplier || '';
    const categoryFilter = inventoryFilters.category || '';
    const companyFilter = inventoryFilters.company || '';
    const locationFilter = inventoryFilters.location || '';
    const statusFilter = inventoryFilters.status || 'all';

    useEffect(() => {
        fetchInventoryData();
    }, []);

    const generatePDF = () => {
        const doc = new jsPDF();

        // Logo & Header
        if (plantSettings.logoUrl) {
            try {
                const imgProps = doc.getImageProperties(plantSettings.logoUrl);
                const logoWidth = 30;
                const logoHeight = (imgProps.height * logoWidth) / imgProps.width;
                doc.addImage(plantSettings.logoUrl, 'PNG', 14, 10, logoWidth, logoHeight);
            } catch (e) {
                console.warn('Could not add logo to PDF', e);
            }
        } else {
            doc.setFontSize(14);
            doc.text(plantSettings.plantName || 'CoreFlow', 14, 20);
        }

        // Title
        doc.setFontSize(14);
        doc.text('Reporte de Inventario de Repuestos', 14, 35);

        // Date
        doc.setFontSize(10);
        const dateStr = new Date().toLocaleDateString();
        doc.text(`Fecha de Emisión: ${dateStr}`, 14, 42);

        // Filters Info
        let yPos = 52;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Filtros aplicados:', 14, yPos);
        doc.setFont('helvetica', 'normal');

        const filterTexts = [];
        if (searchTerm) filterTexts.push(`Búsqueda: ${searchTerm}`);
        if (supplierFilter) filterTexts.push(`Proveedor: ${supplierFilter}`);
        if (categoryFilter) filterTexts.push(`Categoría: ${categoryFilter}`);
        if (companyFilter) filterTexts.push(`Empresa: ${companyFilter}`);
        if (locationFilter) filterTexts.push(`Tramo: ${locationFilter}`);
        if (statusFilter !== 'all') {
            filterTexts.push(`Estado: ${statusFilter === 'low' ? 'Bajo Stock' : 'Normal'}`);
        }

        const filterStr = filterTexts.length > 0 ? filterTexts.join(' | ') : 'Ninguno';
        doc.text(filterStr, 42, yPos);
        yPos += 8;

        // Table
        const tableBody = parts.map(part => {
            const isLowStock = part.currentStock < part.minStock;
            return [
                part.partNumber,
                part.name,
                part.company || '-',
                part.location,
                part.subLocation || '-',
                `${part.currentStock} ${part.unitOfMeasure}`,
                part.minStock,
                isLowStock ? 'Bajo Stock' : 'Normal'
            ];
        });

        autoTable(doc, {
            startY: yPos,
            head: [['Código', 'Nombre', 'Empresa', 'Tramo', 'Ubicación', 'Stock', 'Mínimo', 'Estado']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8 },
            columnStyles: {
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'center' }
            }
        });

        doc.save(`Inventario_Repuestos_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const filteredParts = parts;

    return (
        <div className="bg-industrial-800 rounded-lg shadow-xl border border-industrial-700 p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="p-1.5 bg-industrial-900 rounded border border-industrial-600">
                        <Search className="w-4 h-4 text-industrial-accent" />
                    </span>
                    Inventario de Repuestos
                </h2>
                <button
                    onClick={generatePDF}
                    disabled={parts.length === 0}
                    className="px-4 py-2 bg-industrial-700 hover:bg-industrial-600 border border-industrial-600 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
                >
                    <FileDown className="w-4 h-4" />
                    Exportar PDF
                </button>
            </div>


            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-industrial-500 uppercase tracking-wider mb-2">Buscar</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-industrial-400 h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Buscar repuesto..."
                            className="w-full pl-10 pr-4 py-2 bg-industrial-900 border border-industrial-600 rounded-lg focus:ring-2 focus:ring-industrial-accent focus:border-transparent outline-none text-white placeholder-industrial-500"
                            value={searchTerm}
                            onChange={(e) => setInventoryFilters({ search: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-industrial-500 uppercase tracking-wider mb-2">Proveedor</label>
                    <select
                        className="w-full px-4 py-2 bg-industrial-900 border border-industrial-600 rounded-lg focus:ring-2 focus:ring-industrial-accent focus:border-transparent outline-none text-white appearance-none cursor-pointer"
                        value={supplierFilter}
                        onChange={(e) => setInventoryFilters({ supplier: e.target.value })}
                    >
                        <option value="">Todos</option>
                        {suppliers.map(sup => (
                            <option key={sup} value={sup}>{sup}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-industrial-500 uppercase tracking-wider mb-2">Categoría</label>
                    <select
                        className="w-full px-4 py-2 bg-industrial-900 border border-industrial-600 rounded-lg focus:ring-2 focus:ring-industrial-accent focus:border-transparent outline-none text-white appearance-none cursor-pointer"
                        value={categoryFilter}
                        onChange={(e) => setInventoryFilters({ category: e.target.value })}
                    >
                        <option value="">Todas</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-industrial-500 uppercase tracking-wider mb-2">Empresa</label>
                    <select
                        className="w-full px-4 py-2 bg-industrial-900 border border-industrial-600 rounded-lg focus:ring-2 focus:ring-industrial-accent focus:border-transparent outline-none text-white appearance-none cursor-pointer"
                        value={companyFilter}
                        onChange={(e) => setInventoryFilters({ company: e.target.value })}
                    >
                        <option value="">Todas</option>
                        {companies.map(comp => (
                            <option key={comp} value={comp}>{comp}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-industrial-500 uppercase tracking-wider mb-2">Tramo</label>
                    <select
                        className="w-full px-4 py-2 bg-industrial-900 border border-industrial-600 rounded-lg focus:ring-2 focus:ring-industrial-accent focus:border-transparent outline-none text-white appearance-none cursor-pointer"
                        value={locationFilter}
                        onChange={(e) => setInventoryFilters({ location: e.target.value })}
                    >
                        <option value="">Todas</option>
                        {locations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-industrial-500 uppercase tracking-wider mb-2">Estado</label>
                    <select
                        className="w-full px-4 py-2 bg-industrial-900 border border-industrial-600 rounded-lg focus:ring-2 focus:ring-industrial-accent focus:border-transparent outline-none text-white appearance-none cursor-pointer"
                        value={statusFilter}
                        onChange={(e) => setInventoryFilters({ status: e.target.value as any })}
                    >
                        <option value="all">Todos</option>
                        <option value="low">Bajo Stock</option>
                        <option value="normal">Normal</option>
                    </select>
                </div>
            </div>

            {
                loading ? (
                    <div className="text-center py-12 text-industrial-400">Cargando inventario...</div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-industrial-700">
                        <table className="min-w-full divide-y divide-industrial-700">
                            <thead className="bg-industrial-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-industrial-500 uppercase tracking-wider">Código</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-industrial-500 uppercase tracking-wider">Nombre</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-industrial-500 uppercase tracking-wider">Categoría</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-industrial-500 uppercase tracking-wider">Empresa</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-industrial-500 uppercase tracking-wider">Tramo</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-industrial-500 uppercase tracking-wider">Ubicación</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-industrial-500 uppercase tracking-wider">Stock</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-industrial-500 uppercase tracking-wider">Mínimo</th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-industrial-500 uppercase tracking-wider">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="bg-industrial-800 divide-y divide-industrial-700">
                                {filteredParts.map((part) => {
                                    const isLowStock = part.currentStock < part.minStock;
                                    return (
                                        <tr
                                            key={part.id}
                                            className={`hover:bg-industrial-700/50 transition-colors cursor-pointer ${isLowStock ? 'bg-red-900/10' : ''}`}
                                            onClick={() => setSelectedPart(part)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-industrial-300 font-medium">{part.partNumber}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">{part.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-industrial-400">{part.category}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-industrial-400">{part.company || '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-industrial-400">{part.location}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-industrial-400 italic">{part.subLocation || '-'}</td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${isLowStock ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {part.currentStock} {part.unitOfMeasure}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-industrial-500">{part.minStock}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {isLowStock ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-900/30 text-red-400 border border-red-800">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        Bajo Stock
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-900/30 text-emerald-400 border border-emerald-800">
                                                        Normal
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            }

            <div className="mt-6 flex justify-end">
                <TablePagination
                    totalItems={pagination.total}
                    currentPage={pagination.page}
                    itemsPerPage={pagination.limit}
                    onPageChange={setPage}
                    isLoading={loading}
                />
            </div>

            {
                selectedPart && (
                    <SparePartDetail
                        part={selectedPart}
                        onClose={() => setSelectedPart(null)}
                    />
                )
            }
        </div >
    );
};
