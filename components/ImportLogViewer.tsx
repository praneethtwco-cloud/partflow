import React, { useState, useEffect } from 'react';
import { csvImportService } from '../services/csv-import-service';
import { importLogger, ImportLogEntry, ImportSummary } from '../services/import-logger';
import { importSyncReporter, ImportSyncReport } from '../services/import-sync-reporter';

interface ImportLogViewerProps {
  onClose?: () => void;
}

export const ImportLogViewer: React.FC<ImportLogViewerProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [syncReport, setSyncReport] = useState<ImportSyncReport | null>(null);
  const [activeTab, setActiveTab] = useState<'logs' | 'summary' | 'sync'>('summary');
  const [filterEntityType, setFilterEntityType] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');

  useEffect(() => {
    loadLogsAndSummary();
  }, []);

  const loadLogsAndSummary = () => {
    const currentLogs = importLogger.getRecentLogs(100);
    const currentSummary = importLogger.getSummary();
    const currentSyncReport = importSyncReporter.generateReport();
    
    setLogs(currentLogs);
    setSummary(currentSummary);
    setSyncReport(currentSyncReport);
  };

  const filteredLogs = logs.filter(log => {
    const entityTypeMatch = filterEntityType === 'all' || log.entityType === filterEntityType;
    const actionMatch = filterAction === 'all' || log.action === filterAction;
    return entityTypeMatch && actionMatch;
  });

  const entityTypeOptions = ['all', 'customers', 'items', 'orders', 'orderLines'];
  const actionOptions = ['all', 'create', 'update', 'import', 'error'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">CSV Import Logs</h2>
          <div className="flex space-x-2">
            <button
              onClick={loadLogsAndSummary}
              className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => importLogger.clearLogs()}
              className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-200 transition-colors"
            >
              Clear Logs
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        <div className="flex border-b">
          <button
            className={`flex-1 py-3 font-medium ${
              activeTab === 'summary'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('summary')}
          >
            Import Summary
          </button>
          <button
            className={`flex-1 py-3 font-medium ${
              activeTab === 'sync'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('sync')}
          >
            Sync Report
          </button>
          <button
            className={`flex-1 py-3 font-medium ${
              activeTab === 'logs'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('logs')}
          >
            Detailed Logs
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'summary' && summary && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-700">{summary.totalProcessed}</div>
                  <div className="text-sm text-indigo-600">Total Processed</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{summary.created}</div>
                  <div className="text-sm text-green-600">Created</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{summary.updated}</div>
                  <div className="text-sm text-blue-600">Updated</div>
                </div>
                <div className="bg-rose-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-rose-700">{summary.errors}</div>
                  <div className="text-sm text-rose-600">Errors</div>
                </div>
              </div>

              <div className="text-center">
                <div className="inline-block bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-3 rounded-full">
                  <span className="text-2xl font-bold">{summary.successRate}%</span>
                  <span className="ml-2">Success Rate</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-bold text-gray-700 mb-2">Customers</h3>
                  <div className="space-y-1 text-sm">
                    <div>Total: {summary.entities.customers.total}</div>
                    <div className="text-green-600">Created: {summary.entities.customers.created}</div>
                    <div className="text-blue-600">Updated: {summary.entities.customers.updated}</div>
                    <div className="text-rose-600">Errors: {summary.entities.customers.errors}</div>
                  </div>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-bold text-gray-700 mb-2">Items</h3>
                  <div className="space-y-1 text-sm">
                    <div>Total: {summary.entities.items.total}</div>
                    <div className="text-green-600">Created: {summary.entities.items.created}</div>
                    <div className="text-blue-600">Updated: {summary.entities.items.updated}</div>
                    <div className="text-rose-600">Errors: {summary.entities.items.errors}</div>
                  </div>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-bold text-gray-700 mb-2">Orders</h3>
                  <div className="space-y-1 text-sm">
                    <div>Total: {summary.entities.orders.total}</div>
                    <div className="text-green-600">Created: {summary.entities.orders.created}</div>
                    <div className="text-blue-600">Updated: {summary.entities.orders.updated}</div>
                    <div className="text-rose-600">Errors: {summary.entities.orders.errors}</div>
                  </div>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-bold text-gray-700 mb-2">Order Lines</h3>
                  <div className="space-y-1 text-sm">
                    <div>Total: {summary.entities.orderLines.total}</div>
                    <div className="text-green-600">Created: {summary.entities.orderLines.created}</div>
                    <div className="text-blue-600">Updated: {summary.entities.orderLines.updated}</div>
                    <div className="text-rose-600">Errors: {summary.entities.orderLines.errors}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sync' && syncReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-700">{syncReport.syncSummary.totalSyncOperations}</div>
                  <div className="text-sm text-indigo-600">Total Sync Operations</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{syncReport.syncSummary.successfulSyncs}</div>
                  <div className="text-sm text-green-600">Successful Syncs</div>
                </div>
                <div className="bg-rose-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-rose-700">{syncReport.syncSummary.failedSyncs}</div>
                  <div className="text-sm text-rose-600">Failed Syncs</div>
                </div>
              </div>

              <div className="text-center">
                <div className="inline-block bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-3 rounded-full">
                  <span className="text-2xl font-bold">{syncReport.overallStats.successPercentage}%</span>
                  <span className="ml-2">Overall Success Rate</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-bold text-gray-700 mb-2">Customers</h3>
                  <div className="space-y-1 text-sm">
                    <div>Total: {syncReport.syncSummary.entities.customers.total}</div>
                    <div className="text-green-600">Successful: {syncReport.syncSummary.entities.customers.successful}</div>
                    <div className="text-rose-600">Failed: {syncReport.syncSummary.entities.customers.failed}</div>
                  </div>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-bold text-gray-700 mb-2">Items</h3>
                  <div className="space-y-1 text-sm">
                    <div>Total: {syncReport.syncSummary.entities.items.total}</div>
                    <div className="text-green-600">Successful: {syncReport.syncSummary.entities.items.successful}</div>
                    <div className="text-rose-600">Failed: {syncReport.syncSummary.entities.items.failed}</div>
                  </div>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-bold text-gray-700 mb-2">Orders</h3>
                  <div className="space-y-1 text-sm">
                    <div>Total: {syncReport.syncSummary.entities.orders.total}</div>
                    <div className="text-green-600">Successful: {syncReport.syncSummary.entities.orders.successful}</div>
                    <div className="text-rose-600">Failed: {syncReport.syncSummary.entities.orders.failed}</div>
                  </div>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-bold text-gray-700 mb-2">All Entities</h3>
                  <div className="space-y-1 text-sm">
                    <div>Settings: {syncReport.syncSummary.entities.settings.total}</div>
                    <div>Users: {syncReport.syncSummary.entities.users.total}</div>
                    <div>Adjustments: {syncReport.syncSummary.entities.adjustments.total}</div>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-bold text-gray-700 mb-2">Recent Sync Activities</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {syncReport.recentSyncs.map((sync, index) => (
                    <div key={index} className={`p-2 rounded ${sync.success ? 'bg-green-50' : 'bg-rose-50'}`}>
                      <div className="flex justify-between">
                        <span className="font-medium">{sync.operation.toUpperCase()} {sync.entityType}</span>
                        <span className="text-sm text-gray-500">{new Date(sync.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-sm">
                        Count: {sync.count} | 
                        <span className={sync.success ? 'text-green-600' : 'text-rose-600'}>
                          {' '}{sync.success ? 'SUCCESS' : 'FAILED'}
                        </span>
                        {sync.details && <span className="text-xs block text-gray-500">Details: {sync.details}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <select
                  value={filterEntityType}
                  onChange={(e) => setFilterEntityType(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  {entityTypeOptions.map(option => (
                    <option key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
                
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  {actionOptions.map(option => (
                    <option key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLogs.map((log, index) => (
                      <tr key={index} className={log.success ? '' : 'bg-red-50'}>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                          {log.entityType}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 capitalize">
                          {log.action}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {log.entityId || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                          {log.entityName || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-md truncate">
                          {log.message}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            log.success 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {log.success ? 'Success' : 'Error'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};