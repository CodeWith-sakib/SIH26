import { apiClient } from './client'; import { EmploymentApplication, EmploymentApplicationDetail, EmploymentFormData, EmploymentJob } from '../types/employment.types';
export const employmentApi = {
  async jobs(params?: Record<string,string>) { return (await apiClient.get<{jobs:EmploymentJob[]}>('/employment/jobs',{params})).data.jobs; },
  async job(jobId:string) { return (await apiClient.get<{job:EmploymentJob}>(`/employment/jobs/${jobId}`)).data.job; },
  async start(jobId:string) { return (await apiClient.post<{application:EmploymentApplication}>('/employment/applications',{jobId})).data.application; },
  async applications() { return (await apiClient.get<{applications:EmploymentApplication[]}>('/employment/applications')).data.applications; },
  async application(id:string) { return (await apiClient.get<EmploymentApplicationDetail>(`/employment/applications/${id}`)).data; },
  async save(id:string,formData:EmploymentFormData) { return (await apiClient.patch(`/employment/applications/${id}`,{formData})).data; },
  async fetchData(id:string) {
    const { data } = await apiClient.post<{data:Record<string,string>,fetchedFields:string[],sources:Record<string,string>,matchedDepartments?:Array<{department:string,confidence:number}>}>(`/employment/applications/${id}/fetch-data`);
    return { ...data, matchedDepartments: data.matchedDepartments || [] };
  },
  async submit(id:string,formData:EmploymentFormData) { return (await apiClient.post<{application:EmploymentApplication,trackingId:string}>(`/employment/applications/${id}/submit`,{formData})).data; }
};
