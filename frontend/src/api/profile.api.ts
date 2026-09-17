import { apiClient } from './client'; import { UploadedDocument } from '../types/document.types';

export interface CitizenProfile {
  name: string; email: string; phone?: string; dateOfBirth?: string; registrationNumber?: string;
  college?: string; gender?: string; address?: string; district?: string; state?: string;
  pincode?: string; education?: string; category?: string; isVerified: boolean;
}

export const profileApi = {
  async get() {
    return (await apiClient.get('/profile')).data as { profile: CitizenProfile; applicationCount: number };
  },
  async documents() {
    return (await apiClient.get<{ documents: UploadedDocument[] }>('/profile/documents')).data.documents;
  }
};
