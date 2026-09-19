import Notification, { NotificationType } from '../../../shared/models/Notification.js';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  applicationId?: string;
}

export class NotificationService {
  async create(input: CreateNotificationInput): Promise<void> {
    try {
      await Notification.create(input);
    } catch (error: unknown) {
      console.error(`Notification persistence failed: ${error instanceof Error ? error.name : 'UnknownError'}`);
    }
  }
}

// Singleton factory-function helper for inline callers
export const notificationService = new NotificationService();

/** Convenience shorthand, keeps existing code minimal */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  return notificationService.create(input);
}
