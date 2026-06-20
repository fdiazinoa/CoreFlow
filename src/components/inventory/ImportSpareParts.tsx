import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { SparePart } from '../../types/inventory';
import { inventoryService } from '../../services';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';

const parseExcelRow = (rawRow: any): Omit<SparePart, 'id'> | null => {
    // Normalizamos las llaves de la fila (minúsculas, sin acentos, sin símbolos)
    const normalizedRow: Record<string, any> = {};
    for (const key in rawRow) {
        if (Object.prototype.hasOwnProperty.call(rawRow, key)) {
            const cleanKey = key
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Quita acentos
                .replace(/[^a-z0-9]/g, ""); // Quita espacios, °, º, /, $, etc.

            normalizedRow[cleanKey] = rawRow[key];
        }
    }

    // Extraer usando las llaves limpias
    const partNumber = String(normalizedRow['codigonparte'] || normalizedRow['codigo'] || normalizedRow['sku'] || '').trim();
    const name = String(normalizedRow['nombrerepuesto'] || normalizedRow['nombre'] || '').trim();

    // Si no tiene los campos clave, ignoramos esta fila
    if (!partNumber || !name) return null;

    // Retornar el objeto SparePart mapeado corrigiendo el cruce de columnas
    // Tramo (Excel) -> location (Modelo) -> Tramo (UI)
    // Ubicación (Excel) -> subLocation (Modelo) -> Ubicación (UI)
    return {
        partNumber,
        name,
        category: normalizedRow['categoria'] || 'General',
        location: String(normalizedRow['tramo'] || '').trim(),    // Mapeo correcto: Tramo -> location
        subLocation: String(normalizedRow['ubicacion'] || '').trim(), // Mapeo correcto: Ubicación -> subLocation
        minStock: Number(normalizedRow['stockminimo']) || 0,
        maxStock: Number(normalizedRow['stockmaximo']) || 0,
        currentStock: Number(normalizedRow['stockinicial']) || 0, // Stock Inicial va a currentStock
        unitOfMeasure: normalizedRow['unidaddemedida'] || 'PCS',
        cost: parseFloat(normalizedRow['costounitariord'] || normalizedRow['costo'] || '0') || 0,
        description: normalizedRow['descripcion'] || '',
        supplier: normalizedRow['proveedor'] || normalizedRow['supplier'] || ''
    } as Omit<SparePart, 'id'>;
};

interface ImportSparePartsProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const ImportSpareParts: React.FC<ImportSparePartsProps> = ({ onClose, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<Omit<SparePart, 'id'>[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setError(null);
        parseFile(selectedFile);
    };

    const parseFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                // Usamos type: 'array' para mejor detección de delimitadores en CSV (;)
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

                if (jsonData.length > 0) {
                    console.log("1. Fila Cruda de Excel/CSV:", jsonData[0]);
                }

                const mappedData = jsonData
                    .map(parseExcelRow)
                    .filter((row): row is Omit<SparePart, 'id'> => row !== null);

                if (mappedData.length > 0) {
                    console.log("2. Fila Mapeada para BD:", mappedData[0]);
                }

                if (mappedData.length === 0) {
                    setError("Error: No se encontraron datos válidos. Asegúrese de incluir 'Código / Nº Parte' y 'Nombre Repuesto'.");
                }

                setPreviewData(mappedData);
            } catch (err) {
                console.error("Error al parsear archivo:", err);
                setError('Error al procesar el archivo. Por favor, verifique el formato.');
            }
        };
        // Leer como ArrayBuffer para soporte multi-delimitador robusto
        reader.readAsArrayBuffer(file);
    };

    const handleImport = async () => {
        if (previewData.length === 0) return;

        setLoading(true);
        try {
            await inventoryService.bulkCreate(previewData);
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError('Error al importar los datos. Por favor, intente de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FileSpreadsheet className="w-6 h-6 text-green-600" />
                        Importar Repuestos
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">

                    {!file ? (
                        <div
                            className="border-2 border-dashed border-gray-300 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="w-12 h-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-700 mb-2">Click to Upload Excel or CSV</h3>
                            <p className="text-sm text-gray-500 mb-6">Supported formats: .xlsx, .csv</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".xlsx,.csv"
                                onChange={handleFileUpload}
                            />
                            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                Select File
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <FileSpreadsheet className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{file.name}</p>
                                        <p className="text-sm text-gray-500">{previewData.length} items found</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setFile(null); setPreviewData([]); setError(null); }}
                                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                                >
                                    Cambiar Archivo
                                </button>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    {error}
                                </div>
                            )}

                            {previewData.length > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                                            <tr>
                                                <th className="px-4 py-3">SKU / Code</th>
                                                <th className="px-4 py-3">Name</th>
                                                <th className="px-4 py-3">Category</th>
                                                <th className="px-4 py-3 text-right">Stock</th>
                                                <th className="px-4 py-3 text-right">Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {previewData.slice(0, 5).map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-medium text-gray-900">{item.partNumber}</td>
                                                    <td className="px-4 py-3">{item.name}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                                                            {item.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">{item.currentStock}</td>
                                                    <td className="px-4 py-3 text-right">${item.cost?.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {previewData.length > 5 && (
                                        <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 border-t">
                                            Y {previewData.length - 5} elementos más...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={loading || previewData.length === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? 'Importando...' : 'Importar Datos'}
                        {!loading && <CheckCircle className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
};
