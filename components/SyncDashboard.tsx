import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { SyncStats } from '../types';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { Modal } from './ui/Modal';
import { ConflictResolver, ConflictItem } from './ui/ConflictResolver';
import { DatabaseClearButtons } from './DatabaseClearButtons';
import { CsvImportComponent } from './CsvImportComponent';
import { supabaseSyncService } from '../services/supabase-sync-service';
import { ImportLogViewer } from './ImportLogViewer';
import { diagnoseSyncIssues } from '../utils/sync-diagnostics';
import { supabaseService } from '../services/supabase';
import { downloadCsvWithHeaders, downloadZipWithFiles, downloadCsv } from '../utils/csv';
import { CSV_TEMPLATES } from '../utils/csv-templates';
import Papa from 'papaparse';

interface SyncDashboardProps {
    onSyncComplete: () => void;
}

export const SyncDashboard: React.FC<SyncDashboardProps> = ({ onSyncComplete }) => {
    const { themeClasses } = useTheme();
    const { showToast } = useToast();
    const [stats, setStats] = useState<SyncStats>({ pendingCustomers: 0, pendingItems: 0, pendingOrders: 0, pendingAdjustments: 0 });
    const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'checking'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [sheetId, setSheetId] = useState('supabase'); // Default to 'supabase' for Supabase sync
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [serviceEmail, setServiceEmail] = useState('');
    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, onConfirm: () => void} | null>(null);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

    // Conflict State
    const [showConflictResolver, setShowConflictResolver] = useState(false);
    const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
    const [cloudBuffer, setCloudBuffer] = useState<any>(null);
    const [showImportLogViewer, setShowImportLogViewer] = useState(false);

    // Auto-sync status
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
    const [lastAutoSync, setLastAutoSync] = useState<string | null>(null);

    // Cloud Backup state
    const [selectedExportType, setSelectedExportType] = useState<string>('customers');
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const stats = await db.getSyncStats();
            setStats(stats);
            const settings = db.getSettings();

            // Check if Supabase is configured (we can check for any relevant setting)
            // For now, we'll assume if we reach this point, Supabase is configured
            // since the migration should have been done

            // According to requirements: "The toggle should reset each time the sync page is accessed"
            // This means we should start with advanced options hidden by default
            // The setting in the Settings page determines whether the user has the option to show them
            // If the setting is false, advanced options are never shown
            // If the setting is true, the toggle is available but resets each visit
            const hasAdvancedOptionAccess = !!settings.show_advanced_sync_options;
            setShowAdvancedOptions(hasAdvancedOptionAccess && false); // Always start as false to reset each visit

            // For Supabase, we don't need a service email like Google Sheets
            // We can set a placeholder or remove this functionality
            setServiceEmail('Supabase Authentication');
        };
        loadData();
    }, []);

    // Auto-sync functionality when coming online
    useEffect(() => {
        const handleOnline = () => {
            if (autoSyncEnabled && !supabaseSyncService.isQueueEmpty()) {
                handleAutoSync();
            }
        };

        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, [autoSyncEnabled]);

    const handleAutoSync = async () => {
        if (!autoSyncEnabled || supabaseSyncService.isQueueEmpty()) {
            return;
        }

        setStatus('syncing');
        setLogs([]);
        addLog('Auto-sync triggered - processing queued operations...');

        try {
            const result = await supabaseSyncService.processQueuedOperations();
            
            if (result.success) {
                setStatus('success');
                setLastAutoSync(new Date().toISOString());
                showToast("Auto-sync completed successfully!", "success");
                setStats(await db.getSyncStats());
                onSyncComplete();
            } else {
                setStatus('error');
                addLog(`Auto-sync failed: ${result.message}`);
                showToast(`Auto-sync failed: ${result.message}`, "error");
            }
        } catch (e: any) {
            console.error(e);
            setStatus('error');
            addLog(`Auto-sync error: ${e.message}`);
            showToast(`Auto-sync failed: ${e.message}`, "error");
        }
    };

    const saveConfiguration = () => {
        // For Supabase, we don't need to save a sheet ID
        // Instead, we might need to handle Supabase authentication
        // For now, we'll just close the configuration modal
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

        if (mode === 'overwrite') {
             addLog('Starting FULL data upload (Overwrite mode)...');
             try {
                await db.performSync((msg) => addLog(msg), 'overwrite');
                setStatus('success');
                showToast("Sync completed successfully!", "success");
                setStats(await db.getSyncStats());
                onSyncComplete();
            } catch (e: any) {
                console.error(e);
                setStatus('error');
                addLog(`Error: ${e.message}`);
                showToast(`Sync failed: ${e.message}`, "error");
            }
            return;
        }

        // Smart Sync (Check conflicts first)
        addLog('Checking for conflicts...');
        setStatus('checking');

        try {
            const result = await db.checkForConflicts();

            if (result.hasConflicts) {
                addLog(`Found ${result.conflicts.length} conflicts.`);
                setConflicts(result.conflicts);
                setCloudBuffer(result.cloudData);
                setShowConflictResolver(true);
                setStatus('idle');
                return;
            }

            addLog('No conflicts found. Proceeding with sync...');
            await db.performSync((msg) => addLog(msg), 'upsert');

            setStatus('success');
            showToast("Sync completed successfully!", "success");
            setStats(await db.getSyncStats());
            onSyncComplete();
        } catch (e: any) {
            console.error(e);
            setStatus('error');
            addLog(`Error: ${e.message}`);
            showToast(`Sync failed: ${e.message}`, "error");
        }
    };

    const handleResolveConflicts = async (resolutions: { [id: string]: 'local' | 'cloud' }) => {
        setShowConflictResolver(false);
        setStatus('syncing');
        addLog('Resolving conflicts and finalizing sync...');

        try {
            await db.resolveConflictsAndSync(resolutions, cloudBuffer);
            setStatus('success');
            showToast("Sync completed successfully!", "success");
            setStats(await db.getSyncStats());
            onSyncComplete();
        } catch (e: any) {
            console.error(e);
            setStatus('error');
            addLog(`Resolution Error: ${e.message}`);
            showToast(`Resolution failed: ${e.message}`, "error");
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
            setStats(await db.getSyncStats());
            onSyncComplete();
        } catch (e: any) {
            setStatus('error');
            addLog(`Error: ${e.message}`);
            showToast(`Download failed: ${e.message}`, "error");
        }
    };

    const handleExportCloudData = async () => {
        setIsExporting(true);
        try {
            const cloudData = await supabaseService.fetchCloudData();
            const timestamp = new Date().toISOString().split('T')[0];
            
            let csvContent = '';
            let filename = '';
            
            switch (selectedExportType) {
                case 'customers':
                    csvContent = Papa.unparse(cloudData.customers);
                    filename = `customers_${timestamp}.csv`;
                    break;
                case 'items':
                    csvContent = Papa.unparse(cloudData.items);
                    filename = `items_${timestamp}.csv`;
                    break;
                case 'orders':
                    csvContent = Papa.unparse(cloudData.orders);
                    filename = `orders_${timestamp}.csv`;
                    break;
                case 'orderLines':
                    csvContent = Papa.unparse(cloudData.orderLines);
                    filename = `order_lines_${timestamp}.csv`;
                    break;
            }
            
            await downloadCsv(csvContent, filename);
            showToast(`${selectedExportType} exported successfully`, 'success');
        } catch (error) {
            showToast(`Export failed: ${(error as Error).message}`, 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportAllAsZip = async () => {
        setIsExporting(true);
        try {
            const cloudData = await supabaseService.fetchCloudData();
            const timestamp = new Date().toISOString().split('T')[0];
            
            const files = [
                {
                    name: `customers_${timestamp}.csv`,
                    content: Papa.unparse(cloudData.customers)
                },
                {
                    name: `items_${timestamp}.csv`,
                    content: Papa.unparse(cloudData.items)
                },
                {
                    name: `orders_${timestamp}.csv`,
                    content: Papa.unparse(cloudData.orders)
                },
                {
                    name: `order_lines_${timestamp}.csv`,
                    content: Papa.unparse(cloudData.orderLines)
                }
            ];
            
            await downloadZipWithFiles(files, `partflow_backup_${timestamp}.zip`);
            showToast('Full backup exported successfully', 'success');
        } catch (error) {
            showToast(`Export failed: ${(error as Error).message}`, 'error');
        } finally {
            setIsExporting(false);
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
                        {status === 'syncing' || status === 'checking' ? (
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
                         {status === 'syncing' ? 'Syncing...' : status === 'checking' ? 'Checking Conflicts...' : totalPending > 0 ? 'Changes Pending' : 'All Systems Synced'}
                      </h3>
                      {stats.last_sync && (
                          <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-widest">
                              Last Sync: {new Date(stats.last_sync).toLocaleString()}
                          </p>
                      )}
                      {lastAutoSync && (
                          <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-widest">
                              Last Auto-sync: {new Date(lastAutoSync).toLocaleString()}
                          </p>
                      )}
                      <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">

                        {status === 'syncing' || status === 'checking' ? 'Please wait while we exchange data with HQ.' : 'Push local orders to the cloud and pull latest inventory.'}
                     </p>

                      <div className="flex flex-col gap-3 max-w-sm mx-auto">
                        <button
                            onClick={() => handleSync('upsert')}
                            disabled={isConfiguring || status === 'syncing' || status === 'checking'}
                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 ${
                                status === 'syncing' || status === 'checking' ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                                `${themeClasses.bg} text-white ${themeClasses.bgHover} ${themeClasses.shadow}`
                            }`}
                        >
                            {status === 'syncing' ? 'Processing...' : status === 'checking' ? 'Checking...' : totalPending > 0 ? 'Sync & Push' : 'Incremental Sync'}
                        </button>

                        {/* Auto-sync toggle */}
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm text-slate-600">Auto-sync when online</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoSyncEnabled}
                                    onChange={() => setAutoSyncEnabled(!autoSyncEnabled)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 rounded"></div>
                            </label>
                        </div>

                        {/* Advanced Options Toggle Hint */}
                        {!showAdvancedOptions && !!db.getSettings().show_advanced_sync_options && (
                            <div className="text-center pt-2">
                                <button
                                    onClick={() => setShowAdvancedOptions(true)}
                                    className={`text-xs ${themeClasses.text} italic underline`}
                                >
                                    Show advanced sync options
                                </button>
                            </div>
                        )}

                        {/* Show message if user doesn't have access to advanced options */}
                        {!showAdvancedOptions && !db.getSettings().show_advanced_sync_options && (
                            <div className="text-center pt-2">
                                <span className={`text-xs ${themeClasses.text} italic`}>
                                    Advanced options available in Settings
                                </span>
                            </div>
                        )}

                        {/* Only show advanced options if user has access AND the toggle is on */}
                        {showAdvancedOptions && !!db.getSettings().show_advanced_sync_options && (
                          <>
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

                            {status !== 'syncing' && (
                                <button
                                   onClick={handleRefreshOnly}
                                   className={`mt-2 ${themeClasses.text} font-bold text-sm hover:underline flex items-center justify-center gap-1 mx-auto`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Download Latest Master Record (Pull)
                                </button>
                            )}

                            <button
                                onClick={() => setShowAdvancedOptions(false)}
                                className="w-full py-2 mt-2 border border-slate-200 text-slate-500 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all"
                            >
                                Hide Advanced Options
                            </button>
                          </>
                        )}
                      </div>
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

            {/* CSV Import Component */}
            <CsvImportComponent onImportComplete={async () => setStats(await db.getSyncStats())} />

            {/* Cloud Backup Download */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h3 className={`font-bold ${themeClasses.textDark} mb-3 flex items-center gap-2`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Cloud Backup
                </h3>
                
                <p className="text-xs text-slate-500 mb-4">
                    Export data from Supabase as CSV files. Requires internet connection.
                </p>

                <div className="space-y-3">
                    {/* Entity Type Selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Select Data Type</label>
                        <select
                            value={selectedExportType}
                            onChange={(e) => setSelectedExportType(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="customers">Customers</option>
                            <option value="items">Items</option>
                            <option value="orders">Orders</option>
                            <option value="orderLines">Order Lines</option>
                        </select>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleExportCloudData}
                            disabled={isExporting}
                            className={`flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors ${themeClasses.text} ${isExporting ? 'opacity-50' : ''}`}
                        >
                            {isExporting ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download Selected
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleExportAllAsZip}
                            disabled={isExporting}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${themeClasses.bg} ${themeClasses.bgHover} ${isExporting ? 'opacity-50' : ''}`}
                        >
                            {isExporting ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Creating ZIP...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    Download All (ZIP)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Import Log Viewer Button */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex justify-between items-center">
                    <h3 className={`font-bold ${themeClasses.textDark} mb-2 flex items-center gap-2`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Import Logs
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={async () => {
                                await diagnoseSyncIssues();
                                showToast("Sync diagnostics completed. Check console for details.", "info");
                            }}
                            className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200"
                        >
                            Diagnose
                        </button>
                        <button
                            onClick={() => setShowImportLogViewer(true)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${themeClasses.bg} text-white hover:${themeClasses.hover}`}
                        >
                            View Logs
                        </button>
                    </div>
                </div>
                <p className="text-xs text-slate-500">
                    Review detailed logs of all CSV import activities and sync results
                </p>
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
                            <span className="font-bold text-emerald-600">Supabase Connected:</span> <br/>
                            Your data is securely synced with Supabase cloud database. <br/>
                            <code className={`bg-slate-100 px-1 py-0.5 rounded ${themeClasses.text} select-all font-bold block mt-1`}>{serviceEmail}</code>
                        </p>
                        <div className="text-center">
                            <button onClick={saveConfiguration} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold">Close</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2 text-slate-500">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Supabase Sync Active</span>
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
                                        Check Supabase connection
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
                    message="This will overwrite the Supabase database with your current local data. This action cannot be undone."
                    type="danger"
                    confirmText="Overwrite"
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            {showConflictResolver && (
                <ConflictResolver
                    conflicts={conflicts}
                    onResolve={handleResolveConflicts}
                    onCancel={() => {
                        setShowConflictResolver(false);
                        setStatus('idle');
                        addLog('Sync cancelled by user.');
                    }}
                />
            )}

            {/* Database Clear Buttons */}
            <DatabaseClearButtons />

            {/* Import Log Viewer Modal */}
            {showImportLogViewer && (
                <ImportLogViewer onClose={() => setShowImportLogViewer(false)} />
            )}
        </div>
    );
};