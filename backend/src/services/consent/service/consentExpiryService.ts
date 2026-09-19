import Consent from '../../../shared/models/Consent.js';
import { auditService } from '../../audit/service/auditService.js';
import { createNotification } from '../../notification/service/notificationService.js';

const DEFAULT_CHECK_INTERVAL_MS = 60_000;

export class ConsentExpiryService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isExecuting = false;

  async expireOverdueConsents(referenceDate: Date = new Date()): Promise<number> {
    try {
      const overdueConsents = await Consent.find({ status: 'active', expiresAt: { $exists: true, $ne: null, $lte: referenceDate } });
      if (overdueConsents.length === 0) return 0;
      let count = 0;
      for (const consent of overdueConsents) {
        consent.status = 'expired'; await consent.save(); count += 1;
        await auditService.record({ actorId: null, action: 'CONSENT_EXPIRED', resource: 'consent', resourceId: consent._id.toString(), applicationId: consent.applicationId.toString(), consentId: consent._id.toString(), outcome: 'SUCCESS', metadata: { expiresAt: consent.expiresAt, expiredAt: new Date(), reason: 'automated_expiry_job' } });
        await createNotification({ userId: consent.citizenId.toString(), type: 'consent', title: 'Consent Expired', message: 'Consent for an application has expired.', applicationId: consent.applicationId.toString() });
      }
      return count;
    } catch (error: unknown) {
      console.error('Failed during consent expiration scan:', error instanceof Error ? error.message : 'Unknown error');
      return 0;
    }
  }

  startScheduler(customIntervalMs?: number): void {
    if (this.isRunning) return;
    const envInterval = Number(process.env.CONSENT_EXPIRY_CHECK_INTERVAL_MS);
    const interval = customIntervalMs && customIntervalMs > 0 ? customIntervalMs : !Number.isNaN(envInterval) && envInterval > 0 ? envInterval : DEFAULT_CHECK_INTERVAL_MS;
    this.isRunning = true;
    this.runJob();
    this.timer = setInterval(() => { this.runJob(); }, interval);
    if (this.timer.unref) this.timer.unref();
  }

  stopScheduler(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.isRunning = false; this.isExecuting = false;
  }

  isSchedulerRunning(): boolean { return this.isRunning; }

  private async runJob(): Promise<void> {
    if (this.isExecuting) return;
    this.isExecuting = true;
    try { await this.expireOverdueConsents(); }
    finally { this.isExecuting = false; }
  }
}

export const consentExpiryService = new ConsentExpiryService();
