import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { CustomerList } from './components/CustomerList';
import { InventoryList } from './components/InventoryList';
import { OrderBuilder } from './components/OrderBuilder';
import { SyncDashboard } from './components/SyncDashboard';
import InvoicePreview from './components/InvoicePreview';
import { OrderHistory } from './components/OrderHistory';
import { Settings } from './components/Settings';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Reports } from './components/Reports';
import { Customer, Order } from './types';
import { db } from './services/db';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { App as CapApp } from '@capacitor/app';
import { Modal } from './components/ui/Modal';
import { ShopProfile } from './components/ShopProfile';

function AppContent() {
  const { isAuthenticated, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [historyStack, setHistoryStack] = useState<string[]>(['home']); // Navigation Stack
  const [draftOrder, setDraftOrder] = useState<Partial<Order> | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null); 
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [dbInitialized, setDbInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  // Handle Tab Change with History
  const navigateTo = (tab: string) => {
      if (tab === activeTab) return;
      
      // If going to home, clear stack or push? 
      // Standard mobile pattern: Home is root.
      if (tab === 'home') {
          setHistoryStack(['home']);
      } else {
          setHistoryStack(prev => [...prev, tab]);
      }
      setActiveTab(tab);
  };

  const handleBack = () => {
      if (historyStack.length > 1) {
          const newStack = [...historyStack];
          newStack.pop(); // Remove current
          const previous = newStack[newStack.length - 1];
          setHistoryStack(newStack);
          setActiveTab(previous);
      } else {
          // At root, ask to exit
          setShowExitModal(true);
      }
  };

  React.useEffect(() => {
      // Hardware Back Button Listener
      const setupListener = async () => {
          CapApp.addListener('backButton', ({ canGoBack }) => {
              if (showExitModal) {
                  setShowExitModal(false); // Close modal if open
              } else {
                  handleBack();
              }
          });
      };
      setupListener();

      return () => {
          CapApp.removeAllListeners();
      };
  }, [historyStack, showExitModal]);

  React.useEffect(() => {
    // Initialize DB and Load Cache on Boot
    const startUp = async () => {
        try {
            await db.initialize();
            setDbInitialized(true);
        } catch (e: any) {
            console.error("Database Initialization Failed:", e);
            setInitError(e.message || "Unknown Database Error");
        }
    };
    startUp();
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    navigateTo('orders');
  };

  const handleOpenProfile = (customer: Customer) => {
      setProfileCustomer(customer);
      navigateTo('shop_profile');
  };

  const handleOrderCreated = (order: Order) => {
    setActiveOrder(order);
    setEditingOrder(null);
    setDraftOrder(null); // Clear draft after successful creation
  };

  const handleInvoiceClose = () => {
    setActiveOrder(null);
    setEditingOrder(null);
    setSelectedCustomer(null);
    navigateTo('history');
  };

  const handleViewInvoice = (order: Order) => {
      const customers = db.getCustomers();
      const customer = customers.find(c => c.customer_id === order.customer_id);
      if (customer) {
          setSelectedCustomer(customer);
          setActiveOrder(order);
          setEditingOrder(null);
      }
  };

  const handleEditOrder = (order: Order) => {
      const customer = db.getCustomers().find(c => c.customer_id === order.customer_id);
      if (customer) {
          setSelectedCustomer(customer);
          setEditingOrder(order);
          setDraftOrder(null);
          setActiveOrder(null);
          navigateTo('orders');
      }
  };

  const handleExitApp = () => {
      CapApp.exitApp();
  };

  if (!dbInitialized) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="text-center">
                  {initError ? (
                      <>
                        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">System Error</h2>
                        <p className="text-rose-500 text-sm max-w-xs mx-auto mb-4">{initError}</p>
                        <button onClick={() => window.location.reload()} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold">Retry</button>
                      </>
                  ) : (
                      <>
                        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <h2 className="text-lg font-bold text-slate-800">Starting Engine...</h2>
                        <p className="text-slate-500 text-sm">Loading database from local storage</p>
                      </>
                  )}
              </div>
          </div>
      );
  }

  if (!isAuthenticated) {
      return authView === 'login' 
        ? <Login onToggleRegister={() => setAuthView('register')} /> 
        : <Register onToggleLogin={() => setAuthView('login')} />;
  }

  const renderContent = () => {
    if (activeOrder && selectedCustomer) {
        return <InvoicePreview 
            order={activeOrder} 
            customer={selectedCustomer} 
            settings={db.getSettings()} 
            onClose={handleInvoiceClose} 
        />;
    }

    switch (activeTab) {
      case 'home':
        return <Dashboard onAction={(tab) => navigateTo(tab)} onViewOrder={handleViewInvoice} />;
      case 'customers':
        return <CustomerList onSelectCustomer={handleSelectCustomer} onOpenProfile={handleOpenProfile} />;
      case 'shop_profile':
        if (!profileCustomer) return <CustomerList onSelectCustomer={handleSelectCustomer} onOpenProfile={handleOpenProfile} />;
        return <ShopProfile 
            customer={profileCustomer} 
            onBack={() => navigateTo('customers')} 
            onViewInvoice={handleViewInvoice} 
        />;
      case 'inventory':
        return <InventoryList />;
      case 'orders':
        if (!selectedCustomer && !editingOrder) {
            return (
                <div className="space-y-4">
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-center">
                        <p className="text-indigo-700 font-bold">Select a shop to start a new order</p>
                    </div>
                    <CustomerList onSelectCustomer={handleSelectCustomer} onOpenProfile={handleOpenProfile} />
                </div>
            );
        }
        return <OrderBuilder 
            onCancel={() => {
                setConfirmConfig({
                    isOpen: true,
                    title: editingOrder ? "Discard Changes?" : "Abandon Order?",
                    message: "Are you sure? Any unsaved changes will be lost.",
                    onConfirm: () => {
                        setSelectedCustomer(null);
                        setEditingOrder(null);
                        setDraftOrder(null);
                        navigateTo(editingOrder ? 'history' : 'home');
                        setConfirmConfig(null);
                    }
                });
            }} 
            onOrderCreated={handleOrderCreated}
            existingCustomer={selectedCustomer || undefined} 
            editingOrder={editingOrder || undefined}
            draftState={draftOrder}
            onUpdateDraft={(draft) => setDraftOrder(draft)}
        />;
      case 'history':
        return <OrderHistory onViewInvoice={handleViewInvoice} onEditOrder={handleEditOrder} />;
      case 'reports':
        return <Reports onOpenProfile={handleOpenProfile} />;
      case 'sync':
        return <SyncDashboard onSyncComplete={() => setIsSyncing(!isSyncing)} />;
      case 'settings':
        return <Settings onLogout={logout} />;
      default:
        return <div className="text-center p-10">Select a tab</div>;
    }
  };

  return (
    <>
        <Layout 
            activeTab={activeTab} 
            onTabChange={(tab) => {
                // Removed the abandon logic to persist state
                navigateTo(tab);
            }}
            onSync={() => navigateTo('sync')}
            isSyncing={isSyncing}
            hasActiveDraft={!!(draftOrder?.lines?.length || editingOrder)}
        >
        {renderContent()}
        </Layout>

        <Modal 
            isOpen={showExitModal}
            title="Exit App?"
            message="Are you sure you want to close PartFlow Pro?"
            confirmText="Exit"
            type="danger"
            onConfirm={handleExitApp}
            onCancel={() => setShowExitModal(false)}
        />

        {confirmConfig && (
            <Modal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(null)}
                confirmText="Confirm"
                type="danger"
            />
        )}
    </>
  );
}

export default function App() {
    return (
        <AuthProvider>
            <ThemeProvider>
                <ToastProvider>
                    <AppContent />
                </ToastProvider>
            </ThemeProvider>
        </AuthProvider>
    );
}
