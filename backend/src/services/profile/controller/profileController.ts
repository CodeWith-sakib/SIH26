import { Request, Response } from 'express';
import User from '../../../shared/models/User.js';
import Application from '../../../shared/models/Application.js';
import UploadedDocument from '../../../shared/models/UploadedDocument.js';

export class ProfileController {
  async getProfile(req: Request, res: Response): Promise<void> {
    const user = await User.findById(req.user!.id)
      .select('name email phone dateOfBirth registrationNumber college gender address district state pincode education category role isVerified')
      .lean();

    if (!user) {
      res.status(404).json({ message: 'Profile not found' });
      return;
    }

    const applicationCount = await Application.countDocuments({
      citizenId: req.user!.id,
      applicationKind: 'employment',
    });

    res.json({ profile: user, applicationCount });
  }

  async getDocuments(req: Request, res: Response): Promise<void> {
    const documents = await UploadedDocument.find({ userId: req.user!.id })
      .select('-cloudinaryPublicId')
      .sort({ uploadedAt: -1 })
      .lean();

    res.json({ documents });
  }
}
