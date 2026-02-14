import React, { useState, useEffect } from 'react';
import { importSyncReporter } from '../services/import-sync-reporter';

export const ImportSyncSummary: React.FC = () => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReport = () => {
      try {
        const generatedReport = importSyncReporter.generateReport();
        setReport(generatedReport);
      } catch (error) {
        console.error('Error loading import/sync report:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReport();

    // Refresh every 30 seconds
    const interval = setInterval(loadReport, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !report) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
          Import & Sync Summary
        </h3>
        <p className="text-slate-500 text-sm">Loading statistics...</p>
      </div>
    );
  }

  const { importSummary, syncSummary, overallStats } = report;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Import & Sync Summary
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center bg-indigo-50 rounded-lg p-3">
          <div className="text-lg font-bold text-indigo-700">{importSummary.totalProcessed}</div>
          <div className="text-xs text-indigo-600 uppercase tracking-wide">Records Imported</div>
        </div>
        <div className="text-center bg-emerald-50 rounded-lg p-3">
          <div className="text-lg font-bold text-emerald-700">{syncSummary.totalSyncOperations}</div>
          <div className="text-xs text-emerald-600 uppercase tracking-wide">Sync Operations</div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Success Rate:</span>
          <span className="font-medium">{overallStats.successPercentage}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Created:</span>
          <span className="font-medium text-green-600">{importSummary.created}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Updated:</span>
          <span className="font-medium text-blue-600">{importSummary.updated}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Errors:</span>
          <span className="font-medium text-rose-600">{importSummary.errors}</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-500">
          Last activity: {overallStats.lastActivity ? new Date(overallStats.lastActivity).toLocaleString() : 'Never'}
        </div>
      </div>
    </div>
  );
};