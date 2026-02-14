// Connection service to handle online/offline status detection
class ConnectionService {
  private isOnline: boolean = navigator.onLine;
  private listeners: Array<(isOnline: boolean) => void> = [];

  constructor() {
    // Listen to online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.notifyListeners(true);
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.notifyListeners(false);
  };

  public subscribe(listener: (isOnline: boolean) => void) {
    this.listeners.push(listener);
    // Immediately notify the new subscriber of current status
    listener(this.isOnline);
  }

  public unsubscribe(listener: (isOnline: boolean) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach(listener => listener(isOnline));
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Cleanup event listeners when no longer needed
  public destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.listeners = [];
  }
}

export const connectionService = new ConnectionService();