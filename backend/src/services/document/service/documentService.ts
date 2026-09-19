import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class DocumentService {
  private localDocumentDirectory = path.resolve(process.cwd(), 'uploads/documents');

  private configureCloudinary(): void {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary is not configured');
    }
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
  }

  async uploadDocument(buffer: Buffer, applicationId: string, resourceType: 'image' | 'raw'): Promise<UploadApiResponse> {
    this.configureCloudinary();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: `SIH/applications/${applicationId}/documents`, resource_type: resourceType, use_filename: false, unique_filename: true, overwrite: false }, (error, result) => {
        if (error || !result) reject(error || new Error('Cloudinary upload failed'));
        else resolve(result);
      });
      stream.end(buffer);
    });
  }

  async deleteDocument(publicId: string, resourceType: 'image' | 'raw'): Promise<void> {
    this.configureCloudinary();
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
    if (result.result !== 'ok' && result.result !== 'not found') throw new Error('Cloudinary deletion failed');
  }

  async uploadLocalDocument(buffer: Buffer, applicationId: string, originalFileName: string, mimeType: string): Promise<{ publicId: string; secureUrl: string; format: string }> {
    await fs.mkdir(this.localDocumentDirectory, { recursive: true });
    const extension = path.extname(originalFileName).toLowerCase() || (mimeType === 'application/pdf' ? '.pdf' : '.bin');
    const fileName = `${applicationId}-${crypto.randomUUID()}${extension}`;
    const filePath = path.join(this.localDocumentDirectory, fileName);
    await fs.writeFile(filePath, buffer);
    return { publicId: `local/${fileName}`, secureUrl: `/api/uploads/documents/${fileName}`, format: extension.slice(1) || 'unknown' };
  }

  async deleteLocalDocument(publicId: string): Promise<void> {
    const fileName = path.basename(publicId);
    await fs.unlink(path.join(this.localDocumentDirectory, fileName));
  }
}
