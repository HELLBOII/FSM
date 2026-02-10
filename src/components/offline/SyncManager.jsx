import { serviceRequestService, workReportService, storageService } from '@/services';
import { offlineStorage } from './OfflineStorage';
import { toast } from 'sonner';

class SyncManager {
  constructor() {
    this.syncing = false;
    this.syncListeners = [];
  }

  onSyncStatusChange(callback) {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
    };
  }

  notifySyncListeners(status) {
    this.syncListeners.forEach(cb => cb(status));
  }

  async syncPendingChanges() {
    if (this.syncing) return;
    if (!navigator.onLine) return;

    this.syncing = true;
    this.notifySyncListeners({ syncing: true, progress: 0 });

    try {
      const queue = await offlineStorage.getSyncQueue();
      if (queue.length === 0) {
        this.syncing = false;
        return;
      }

      let completed = 0;
      const total = queue.length;

      for (const item of queue) {
        try {
          await this.processSyncItem(item);
          await offlineStorage.removeSyncItem(item.id);
          completed++;
          this.notifySyncListeners({ 
            syncing: true, 
            progress: Math.round((completed / total) * 100) 
          });
        } catch (error) {
          console.error('Failed to sync item:', item, error);
        }
      }

      toast.success(`Synced ${completed} pending changes`);
      this.notifySyncListeners({ syncing: false, progress: 100 });
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Sync failed. Will retry later.');
      this.notifySyncListeners({ syncing: false, error });
    } finally {
      this.syncing = false;
    }
  }

  async processSyncItem(item) {
    switch (item.type) {
      case 'UPDATE_JOB_STATUS':
        return await serviceRequestService.update(item.jobId, {
          status: item.data.status
        });

      case 'ADD_NOTE':
        const job = await serviceRequestService.getById(item.jobId);
        const currentNotes = job.notes || '';
        return await serviceRequestService.update(item.jobId, {
          notes: currentNotes + '\n' + item.data.note
        });

      case 'CREATE_WORK_REPORT':
        return await workReportService.create(item.data);

      case 'UPDATE_WORK_REPORT':
        return await workReportService.update(item.reportId, item.data);

      case 'UPLOAD_PHOTO':
        // Upload photo from base64
        const blob = await this.base64ToBlob(item.data.photoData);
        return await storageService.uploadFile(blob);

      default:
        console.warn('Unknown sync item type:', item.type);
    }
  }

  async base64ToBlob(base64Data) {
    const response = await fetch(base64Data);
    return response.blob();
  }

  async downloadJobsForOffline(technicianId) {
    try {
      const jobs = await serviceRequestService.filter({
        assigned_technician_id: technicianId,
        status: ['scheduled', 'assigned', 'in_progress']
      });
      
      await offlineStorage.saveJobs(jobs);
      toast.success('Jobs downloaded for offline use');
    } catch (error) {
      console.error('Failed to download jobs:', error);
      toast.error('Failed to download jobs');
    }
  }
}

export const syncManager = new SyncManager();

// Auto-sync when coming online
window.addEventListener('online', () => {
  toast.success('Connection restored. Syncing...');
  syncManager.syncPendingChanges();
});

window.addEventListener('offline', () => {
  toast.info('You are offline. Changes will sync when connected.');
});