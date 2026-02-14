import React, { useState } from 'react';
import { Order } from '../types';
import { formatCurrency } from '../utils/currency';
import { useTheme } from '../context/ThemeContext';

interface ConflictResolutionProps {
  localOrder: Order;
  cloudOrder: Order;
  onResolve: (resolvedOrder: Order) => void;
  onCancel: () => void;
}

const ConflictResolution: React.FC<ConflictResolutionProps> = ({ 
  localOrder, 
  cloudOrder, 
  onResolve, 
  onCancel 
}) => {
  const { themeClasses } = useTheme();
  const [resolutionChoice, setResolutionChoice] = useState<'local' | 'cloud' | 'custom'>('local');
  const [customOrder, setCustomOrder] = useState<Order>({ ...localOrder });

  const handleFieldChange = (field: keyof Order, value: any) => {
    setCustomOrder(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResolve = () => {
    switch (resolutionChoice) {
      case 'local':
        onResolve(localOrder);
        break;
      case 'cloud':
        onResolve(cloudOrder);
        break;
      case 'custom':
        onResolve(customOrder);
        break;
      default:
        onResolve(localOrder);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Resolve Invoice Sync Conflict</h2>
          <p className="text-slate-600 text-sm mt-1">
            An invoice has been modified both locally and in Google Sheets. Please resolve the conflict.
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={`p-4 rounded-xl border-2 ${resolutionChoice === 'local' ? themeClasses.border.replace('200', '500') : 'border-slate-200'}`}>
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <input
                  type="radio"
                  checked={resolutionChoice === 'local'}
                  onChange={() => setResolutionChoice('local')}
                  className="w-4 h-4"
                />
                Local Version
              </h3>
              <div className="text-xs space-y-1">
                <p><span className="font-medium">Invoice #: </span>{localOrder.invoice_number}</p>
                <p><span className="font-medium">Date: </span>{localOrder.order_date}</p>
                <p><span className="font-medium">Total: </span>{formatCurrency(localOrder.net_total)}</p>
                <p><span className="font-medium">Approval: </span>{localOrder.approval_status || 'draft'}</p>
                <p><span className="font-medium">Sync: </span>{localOrder.sync_status}</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border-2 ${resolutionChoice === 'cloud' ? themeClasses.border.replace('200', '500') : 'border-slate-200'}`}>
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <input
                  type="radio"
                  checked={resolutionChoice === 'cloud'}
                  onChange={() => setResolutionChoice('cloud')}
                  className="w-4 h-4"
                />
                Cloud Version
              </h3>
              <div className="text-xs space-y-1">
                <p><span className="font-medium">Invoice #: </span>{cloudOrder.invoice_number}</p>
                <p><span className="font-medium">Date: </span>{cloudOrder.order_date}</p>
                <p><span className="font-medium">Total: </span>{formatCurrency(cloudOrder.net_total)}</p>
                <p><span className="font-medium">Approval: </span>{cloudOrder.approval_status || 'draft'}</p>
                <p><span className="font-medium">Sync: </span>{cloudOrder.sync_status}</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border-2 ${resolutionChoice === 'custom' ? themeClasses.border.replace('200', '500') : 'border-slate-200'}`}>
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <input
                  type="radio"
                  checked={resolutionChoice === 'custom'}
                  onChange={() => setResolutionChoice('custom')}
                  className="w-4 h-4"
                />
                Custom Merge
              </h3>
              <div className="text-xs space-y-1">
                <p><span className="font-medium">Invoice #: </span>
                  <input
                    type="text"
                    value={customOrder.invoice_number || ''}
                    onChange={(e) => handleFieldChange('invoice_number', e.target.value)}
                    className="w-full p-1 text-xs border border-slate-200 rounded mt-1"
                  />
                </p>
                <p><span className="font-medium">Approval Status: </span>
                  <select
                    value={customOrder.approval_status || 'draft'}
                    onChange={(e) => handleFieldChange('approval_status', e.target.value)}
                    className="w-full p-1 text-xs border border-slate-200 rounded mt-1"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="approved">Approved</option>
                  </select>
                </p>
                <p><span className="font-medium">Total: </span>{formatCurrency(customOrder.net_total)}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl mb-6">
            <h3 className="font-bold text-slate-800 mb-2">Comparison Details</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <h4 className="font-bold text-slate-700 border-b pb-1 mb-2">Local Values</h4>
                <p><span className="font-medium">Invoice #: </span>{localOrder.invoice_number}</p>
                <p><span className="font-medium">Date: </span>{localOrder.order_date}</p>
                <p><span className="font-medium">Total: </span>{formatCurrency(localOrder.net_total)}</p>
                <p><span className="font-medium">Approval: </span>{localOrder.approval_status || 'draft'}</p>
                <p><span className="font-medium">Status: </span>{localOrder.order_status}</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-700 border-b pb-1 mb-2">Cloud Values</h4>
                <p><span className="font-medium">Invoice #: </span>{cloudOrder.invoice_number}</p>
                <p><span className="font-medium">Date: </span>{cloudOrder.order_date}</p>
                <p><span className="font-medium">Total: </span>{formatCurrency(cloudOrder.net_total)}</p>
                <p><span className="font-medium">Approval: </span>{cloudOrder.approval_status || 'draft'}</p>
                <p><span className="font-medium">Status: </span>{cloudOrder.order_status}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            className={`px-6 py-2.5 text-white font-bold rounded-xl ${themeClasses.bg} hover:opacity-90 transition-opacity`}
          >
            Apply Selected Option
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolution;