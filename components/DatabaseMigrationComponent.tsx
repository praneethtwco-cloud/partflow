import React, { useState } from 'react';
import { dbMigration, MigrationProgress } from '../services/db-migration';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

export const DatabaseMigrationComponent: React.FC = () => {
  const { themeClasses } = useTheme();
  const { showToast } = useToast();
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    indexedDBCounts: { customers: number; items: number; orders: number };
    sqliteCounts: { customers: number; items: number; orders: number };
    mismatches: string[];
  } | null>(null);

  const handleMigrate = async () => {
    if (!window.confirm('This will migrate all data from IndexedDB to SQLite. Continue?')) {
      return;
    }

    setIsMigrating(true);
    setProgress(null);
    setVerificationResult(null);

    const success = await dbMigration.migrate((prog) => {
      setProgress(prog);
    });

    if (success) {
      showToast('Migration completed successfully!', 'success');
      
      // Auto-verify after migration
      const verify = await dbMigration.verifyMigration();
      setVerificationResult(verify);
      
      if (!verify.success) {
        showToast('Migration completed but verification found mismatches. Check details.', 'warning');
      }
    } else {
      showToast('Migration failed. Check console for details.', 'error');
    }

    setIsMigrating(false);
  };

  const handleVerify = async () => {
    setIsMigrating(true);
    const verify = await dbMigration.verifyMigration();
    setVerificationResult(verify);
    setIsMigrating(false);
    
    if (verify.success) {
      showToast('Verification passed! Data matches.', 'success');
    } else {
      showToast('Verification found mismatches. Check details.', 'warning');
    }
  };

  const getProgressColor = () => {
    if (progress?.phase === 'error') return 'bg-rose-500';
    if (progress?.phase === 'complete') return 'bg-emerald-500';
    return themeClasses.bg;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 ${themeClasses.bg} rounded-xl flex items-center justify-center text-white`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-slate-800">Database Migration</h3>
          <p className="text-xs text-slate-500">Migrate from IndexedDB to SQLite</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-amber-800">
              <p className="font-medium">Before migrating:</p>
              <ul className="list-disc list-inside mt-1 text-xs space-y-1">
                <li>Ensure you have a backup (Data Sync & Tools)</li>
                <li>Migration is one-way (IndexedDB → SQLite)</li>
                <li>After migration, switch db.ts to use sqliteDB</li>
                <li>This improves Android app performance</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleMigrate}
            disabled={isMigrating}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition-all ${
              isMigrating 
                ? 'bg-slate-400 cursor-not-allowed' 
                : `${themeClasses.bg} hover:opacity-90 active:scale-95`
            }`}
          >
            {isMigrating ? 'Migrating...' : 'Start Migration'}
          </button>
          
          <button
            onClick={handleVerify}
            disabled={isMigrating}
            className="py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
          >
            Verify
          </button>
        </div>

        {progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">{progress.message}</span>
              <span className="font-medium text-slate-800">{progress.progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${getProgressColor()}`}
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            {progress.error && (
              <p className="text-sm text-rose-600">{progress.error}</p>
            )}
          </div>
        )}

        {verificationResult && (
          <div className={`rounded-xl p-4 ${verificationResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
            <h4 className={`font-bold text-sm mb-3 ${verificationResult.success ? 'text-emerald-800' : 'text-amber-800'}`}>
              {verificationResult.success ? '✓ Verification Passed' : '⚠ Verification Issues Found'}
            </h4>
            
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">IndexedDB</p>
                <div className="space-y-1 text-sm">
                  <p>Customers: <span className="font-medium">{verificationResult.indexedDBCounts.customers}</span></p>
                  <p>Items: <span className="font-medium">{verificationResult.indexedDBCounts.items}</span></p>
                  <p>Orders: <span className="font-medium">{verificationResult.indexedDBCounts.orders}</span></p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">SQLite</p>
                <div className="space-y-1 text-sm">
                  <p>Customers: <span className="font-medium">{verificationResult.sqliteCounts.customers}</span></p>
                  <p>Items: <span className="font-medium">{verificationResult.sqliteCounts.items}</span></p>
                  <p>Orders: <span className="font-medium">{verificationResult.sqliteCounts.orders}</span></p>
                </div>
              </div>
            </div>

            {verificationResult.mismatches.length > 0 && (
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-2">Mismatches:</p>
                <ul className="text-xs space-y-1">
                  {verificationResult.mismatches.map((mismatch, idx) => (
                    <li key={idx} className="text-rose-600">• {mismatch}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
