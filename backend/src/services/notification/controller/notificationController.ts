import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Notification from '../../../shared/models/Notification.js';

export class NotificationController {
  async list(req: Request, res: Response): Promise<void> {
    const notifications = await Notification.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({ userId: req.user!.id, read: false });
    res.json({ notifications, unreadCount });
  }

  async markAllRead(req: Request, res: Response): Promise<void> {
    await Notification.updateMany(
      { userId: req.user!.id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ message: 'Notifications marked as read' });
  }

  async markOneRead(req: Request<{ id: string }>, res: Response): Promise<void> {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ message: 'Invalid notification ID' });
      return;
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { $set: { read: true, readAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }
    res.json({ notification });
  }
}
