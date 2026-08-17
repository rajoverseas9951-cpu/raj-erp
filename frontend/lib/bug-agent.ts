import { authenticatedRequest } from '@/lib/api-client';

export type BugSeverity = 'low'|'medium'|'high'|'critical'|'unknown';
export type BugReport = {
  id:string;
  source:'upload'|'scan';
  title:string;
  description?:string|null;
  page_url?:string|null;
  severity:BugSeverity;
  category?:string|null;
  status:string;
  confidence?:number|null;
  diagnosis?:string|null;
  root_cause?:string|null;
  suggested_fix?:string|null;
  auto_fix_eligible:boolean;
  auto_fix_action?:string|null;
  ai_model?:string|null;
  detected_at?:string|null;
  resolved_at?:string|null;
  created_at:string;
  has_screenshot:boolean;
};
export type BugAgentPayload={reports:BugReport[];stats:{total:number;open:number;critical:number;safe_fix:number}};

export const bugAgentApi={
  list:()=>authenticatedRequest<BugAgentPayload>('/bug-agent'),
  report:(form:FormData)=>authenticatedRequest<BugReport>('/bug-agent/reports',{method:'POST',body:form}),
  analyze:(id:string)=>authenticatedRequest<BugReport>(`/bug-agent/reports/${id}/analyze`,{method:'POST'}),
  resolve:(id:string)=>authenticatedRequest<BugReport>(`/bug-agent/reports/${id}/resolve`,{method:'POST'}),
  safeFix:(id:string)=>authenticatedRequest<{report:BugReport;result:{action:string;message:string}}>(`/bug-agent/reports/${id}/safe-fix`,{method:'POST'}),
  scanNow:()=>authenticatedRequest<{findings:BugReport[];healthy:boolean}>('/bug-agent/scan',{method:'POST'}),
};
