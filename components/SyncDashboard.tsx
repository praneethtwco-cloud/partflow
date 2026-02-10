import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { SyncStats } from '../types';
import { API_CONFIG } from '../config';
import { useToast } from '../context/ToastContext';
import { Modal } from './ui/Modal';

interface SyncDashboardProps {
    onSyncComplete: () => void;
}

export const SyncDashboard: React.FC<SyncDashboardProps> = ({ onSyncComplete }) => {
    const { themeClasses } = useTheme();
    const { showToast } = useToast();
    const [stats, setStats] = useState<SyncStats>(db.getSyncStats());
    const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [sheetId, setSheetId] = useState('');
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [serviceEmail, setServiceEmail] = useState('spareparts@clear-vision-476504-k2.iam.gserviceaccount.com');

    useEffect(() => {
        setStats(db.getSyncStats());
        const settings = db.getSettings();
        if (settings.google_sheet_id) {
            setSheetId(settings.google_sheet_id);
        } else {
            setIsConfiguring(true);
        }

        // Fetch real service account email from backend
        const checkBackend = async () => {
            try {
                const res = await fetch(`${API_CONFIG.BACKEND_URL}/health`);
                const data = await res.json();
                if (data.client_email) {
                    setServiceEmail(data.client_email);
                }
            } catch (e) {
                console.error("Could not fetch backend health", e);
            }
        };
        checkBackend();
    }, []);

    const saveConfiguration = () => {
        const settings = db.getSettings();
        settings.google_sheet_id = sheetId;
        db.saveSettings(settings);
        setIsConfiguring(false);
        addLog('Configuration saved.');
    };

    const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    const handleSync = async (mode: 'upsert' | 'overwrite' = 'upsert') => {
        if (!sheetId) {
            setIsConfiguring(true);
            return;
        }

        setStatus('syncing');
        setLogs([]);
        addLog(mode === 'overwrite' ? 'Starting FULL data upload (Overwrite mode)...' : 'Connecting to Google Cloud...');

        try {
            await db.performSync((msg) => addLog(msg), mode);
            
            setStatus('success');
            showToast("Sync completed successfully!", "success");
            setStats(db.getSyncStats());
            onSyncComplete();
        } catch (e: any) {
            console.error(e);
            setStatus('error');
            addLog(`Error: ${e.message}`);
            showToast(`Sync failed: ${e.message}`, "error");
        }
    };

    const handleRefreshOnly = async () => {
        if (!sheetId) return;
        setStatus('syncing');
        setLogs([]);
        addLog('Pulling latest inventory from server...');
        try {
            // Upsert mode but we are mainly interested in the pulledItems return
            await db.performSync((msg) => addLog(msg), 'upsert'); 
            setStatus('success');
            showToast("Master records downloaded", "success");
            setStats(db.getSyncStats());
            onSyncComplete();
        } catch (e: any) {
            setStatus('error');
            addLog(`Error: ${e.message}`);
            showToast(`Download failed: ${e.message}`, "error");
        }
    };

    const totalPending = stats.pendingCustomers + stats.pendingItems + stats.pendingOrders;

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20 md:pb-0">
            <h2 className="text-2xl font-bold text-slate-800 px-2">Data Sync & Tools</h2>
            
            {/* Status Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className={`p-6 md:p-8 text-center bg-gradient-to-b ${themeClasses.bgSoft} to-white`}>
                     <div className="mb-6">
                        {status === 'syncing' ? (
                            <div className={`w-20 h-20 border-4 border-slate-200 border-t-${themeClasses.bg.split('-')[1]}-600 rounded-full animate-spin mx-auto`}></div>
                        ) : status === 'success' ? (
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                        ) : (
                            <div className={`w-20 h-20 ${themeClasses.bgSoft} rounded-full flex items-center justify-center mx-auto ${themeClasses.text}`}>
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            </div>
                        )}
                     </div>
                     
                      <h3 className="text-lg font-bold text-slate-900 mb-2">
                         {status === 'syncing' ? 'Syncing...' : totalPending > 0 ? 'Changes Pending' : 'All Systems Synced'}
                      </h3>
                      {stats.last_sync && (
                          <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-widest">
                              Last Sync: {new Date(stats.last_sync).toLocaleString()}
                          </p>
                      )}
                      <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">

                        {status === 'syncing' ? 'Please wait while we exchange data with HQ.' : 'Push local orders to the cloud and pull latest inventory.'}
                     </p>

                      <div className="flex flex-col gap-3 max-w-sm mx-auto">
                        <button 
                            onClick={() => handleSync('upsert')}
                            disabled={isConfiguring || status === 'syncing'}
                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 ${
                                status === 'syncing' ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                                `${themeClasses.bg} text-white ${themeClasses.bgHover} ${themeClasses.shadow}`
                            }`}
                        >
                            {status === 'syncing' ? 'Processing...' : totalPending > 0 ? 'Sync & Push' : 'Incremental Sync'}
                        </button>

                        <button 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    onConfirm: () => {
                                        handleSync('overwrite');
                                        setConfirmModal(null);
                                    }
                                });
                            }}
                            disabled={isConfiguring || status === 'syncing'}
                            className="w-full py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
                        >
                            Upload All to Cloud (Overwrite)
                        </button>
                      </div>

                      {status !== 'syncing' && (
                          <button 
                             onClick={handleRefreshOnly}
                             className={`mt-4 ${themeClasses.text} font-bold text-sm hover:underline flex items-center justify-center gap-1 mx-auto`}
                          >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              Download Latest Master Record (Pull)
                          </button>
                      )}
                </div>


                {/* Stats Grid */}
                <div className="grid grid-cols-3 border-t border-slate-100 divide-x divide-slate-100 bg-slate-50">
                    <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-slate-800">{stats.pendingCustomers}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">New Customers</div>
                    </div>
                    <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-slate-800">{stats.pendingOrders}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Orders</div>
                    </div>
                    <div className="p-4 text-center">
                        <div className="text-2xl font-bold text-slate-800">{stats.pendingItems}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Stock Adj.</div>
                    </div>
                </div>
            </div>

            {/* Config Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                 {isConfiguring ? (
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <h3 className={`font-bold ${themeClasses.textDark} mb-2 flex items-center gap-2`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Connection Setup
                        </h3>
                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                            <span className="font-bold text-rose-600">Action Required:</span> <br/>
                            Share your Google Sheet with this email as an <strong>Editor</strong>: <br/>
                            <code className={`bg-slate-100 px-1 py-0.5 rounded ${themeClasses.text} select-all font-bold block mt-1`}>{serviceEmail}</code>
                        </p>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Paste Google Sheet ID here" 
                                className={`flex-1 border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 ${themeClasses.ring} outline-none`}
                                value={sheetId}
                                onChange={(e) => setSheetId(e.target.value)}
                            />
                            <button onClick={saveConfiguration} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold">Save</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2 text-slate-500">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Connected to: <span className="font-mono text-slate-700">{sheetId.substring(0, 6)}...</span></span>
                        </div>
                        <button onClick={() => setIsConfiguring(true)} className={`${themeClasses.text} font-bold text-xs hover:underline`}>Configure</button>
                    </div>
                )}
            </div>

            {/* Logs */}
            {logs.length > 0 && (
                <div className="bg-slate-900 rounded-xl p-4 shadow-inner">
                    <h4 className="text-slate-400 text-xs font-bold uppercase mb-2">Activity Log</h4>
                    <div className="h-32 overflow-y-auto font-mono text-xs space-y-1">
                        {logs.map((log, i) => (
                            <div key={i} className={log.includes('Error') ? 'text-rose-400' : log.includes('Success') ? 'text-emerald-400' : 'text-slate-300'}>
                                {log}
                                {log.includes('Error') && (
                                    <div className={`mt-1 text-[10px] ${themeClasses.text}`}>
                                        Check diagnostics: <a href={`${API_CONFIG.BACKEND_URL}/health`} target="_blank" className="underline">Backend Health</a>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {confirmModal && (
                <Modal
                    isOpen={confirmModal.isOpen}
                    title="Overwrite Cloud Data?"
                    message="This will overwrite the Google Sheet with your current local data. This action cannot be undone."
                    type="danger"
                    confirmText="Overwrite"
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}
        </div>
    );
};