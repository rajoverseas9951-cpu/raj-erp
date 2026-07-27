export type CustomerStatus = 'active' | 'inactive' | 'blocked';
export type CustomerPriority = 'low' | 'normal' | 'high' | 'urgent';
export interface CustomerListItem { id: string; customerCode: string; fullName: string; mobile: string; city?: string; vehiclesCount: number; insurancePoliciesCount: number; rtoFilesCount: number; gstNumber?: string; status: CustomerStatus; }
export interface CustomerTimelineActivity { id: string; eventType: 'customer.created' | 'customer.edited' | 'document.uploaded' | 'policy.created' | 'rto_file.created' | 'receipt.generated'; title: string; description?: string; createdAt: string; metadata: Record<string, unknown>; }
