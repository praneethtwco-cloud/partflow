import React, { useState } from 'react';
import { Modal } from './Modal';
import { Customer, Item, Order } from '../../types';
import { cleanText } from '../../utils/cleanText';
import { useTheme } from '../../context/ThemeContext';

export type ConflictItem = {
    type: 'customer' | 'item' | 'order';
    id: string;
    local: any;
    cloud: any;
};

interface ConflictResolverProps {
    conflicts: ConflictItem[];
    onResolve: (resolutions: { [id: string]: 'local' | 'cloud' }) => void;
    onCancel: () => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({ conflicts, onResolve, onCancel }) => {
    const { themeClasses } = useTheme();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [resolutions, setResolutions] = useState<{ [id: string]: 'local' | 'cloud' }>({});

    const currentConflict = conflicts[currentIndex];
    const isLast = currentIndex === conflicts.length - 1;

    const handleChoice = (choice: 'local' | 'cloud') => {
        const newResolutions = { ...resolutions, [currentConflict.id]: choice };
        setResolutions(newResolutions);
        
        if (isLast) {
            onResolve(newResolutions);
        } else {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const renderDiff = (local: any, cloud: any) => {
        // Simple JSON diff for now, can be enhanced to show specific field diffs
        const keys = Array.from(new Set([...Object.keys(local), ...Object.keys(cloud)]));
        const diffs = keys.filter(k => 
            k !== 'updated_at' && 
            k !== 'sync_status' && 
            JSON.stringify(local[k]) !== JSON.stringify(cloud[k])
        );

        return (
            <div className="text-xs space-y-2 mt-4 max-h-60 overflow-y-auto custom-scrollbar">
                {diffs.map(key => (
                    <div key={key} className="grid grid-cols-2 gap-2 border-b border-slate-100 pb-2">
                        <div>
                            <span className="font-bold text-slate-500 block uppercase text-[10px]">{key}</span>
                            <span className="text-slate-800 break-all">{JSON.stringify(local[key])}</span>
                        </div>
                        <div>
                            <span className="font-bold text-slate-500 block uppercase text-[10px]">{key} (Cloud)</span>
                            <span className="text-slate-800 break-all">{JSON.stringify(cloud[key])}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const getTitle = (item: ConflictItem) => {
        if (item.type === 'customer') return `Shop Conflict: ${cleanText(item.local.shop_name)}`;
        if (item.type === 'item') return `Item Conflict: ${cleanText(item.local.item_display_name)}`;
        if (item.type === 'order') return `Order Conflict: #${item.local.order_id}`;
        return 'Data Conflict';
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-lg font-black text-slate-800">Resolve Conflicts</h3>
                        <p className="text-sm text-slate-500">Conflict {currentIndex + 1} of {conflicts.length}</p>
                    </div>
                    <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">Cancel Sync</button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    <h4 className="font-bold text-lg mb-2">{getTitle(currentConflict)}</h4>
                    <p className="text-sm text-slate-500 mb-6">This record has been modified in both locations. Choose which version to keep.</p>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Local Version */}
                        <div className="border-2 border-indigo-100 rounded-xl p-4 bg-indigo-50/30">
                            <div className="flex justify-between items-center mb-4">
                                <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold uppercase">Local Version</span>
                                <span className="text-[10px] text-slate-400">{new Date(currentConflict.local.updated_at).toLocaleString()}</span>
                            </div>
                            <div className="text-sm">
                                {renderDiff(currentConflict.local, currentConflict.cloud)}
                            </div>
                            <button 
                                onClick={() => handleChoice('local')}
                                className={`w-full mt-4 py-3 rounded-lg font-bold shadow-sm transition-all active:scale-95 ${themeClasses.bg} text-white hover:opacity-90`}
                            >
                                Keep Local
                            </button>
                        </div>

                        {/* Cloud Version */}
                        <div className="border-2 border-slate-100 rounded-xl p-4 bg-slate-50">
                            <div className="flex justify-between items-center mb-4">
                                <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs font-bold uppercase">Cloud Version</span>
                                <span className="text-[10px] text-slate-400">{new Date(currentConflict.cloud.updated_at).toLocaleString()}</span>
                            </div>
                            <div className="text-sm opacity-60">
                                {renderDiff(currentConflict.cloud, currentConflict.local)} 
                            </div>
                            <button 
                                onClick={() => handleChoice('cloud')}
                                className="w-full mt-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                            >
                                Overwrite with Cloud
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
