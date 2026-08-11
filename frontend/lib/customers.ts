import { apiUrl } from "@/lib/api-url";
import { authenticatedRequest } from "@/lib/api-client";
import { invalidateDashboard } from "@/lib/dashboard-refresh";
import { exportRowsToPdf } from "@/lib/export-utils";

export type Customer = {
  id: string;
  customer_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  mobile: string;
  alternate_mobile?: string;
  whatsapp?: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  aadhaar_number?: string;
  pan_number?: string;
  driving_licence_number?: string;
  passport_number?: string;
  voter_id?: string;
  current_address?: string;
  permanent_address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  occupation?: string;
  company_name?: string;
  gst_number?: string;
  remarks?: string;
  tags?: string[];
  priority: string;
  status: string;
  vehicles_count: number;
  insurance_policies_count: number;
  rto_files_count: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await authenticatedRequest<T>(path, init);
  if (init?.method && init.method !== "GET") invalidateDashboard();
  return result;
}

export type CustomerPagination = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number | null;
  to?: number | null;
};

export type CustomerPage = {
  data: Customer[];
  links?: unknown;
  meta?: CustomerPagination;
};

async function listCustomers(q = ""): Promise<CustomerPage> {
  const result = await request<unknown>(`/customers${q}`);
  if (Array.isArray(result)) return { data: result as Customer[] };
  if (result && typeof result === "object") {
    const first = result as Record<string, unknown>;
    if (Array.isArray(first.data)) {
      const pagination = ["current_page","last_page","per_page","total"].every((key) => typeof first[key] === "number");
      return { data:first.data as Customer[], links:first.links, meta:pagination ? (first as unknown as CustomerPagination) : (first.meta as CustomerPagination | undefined) };
    }
    if (first.data && typeof first.data === "object") {
      const nested = first.data as Record<string, unknown>;
      if (Array.isArray(nested.data)) return { data:nested.data as Customer[], links:nested.links, meta:nested.meta as CustomerPagination | undefined };
    }
  }
  return { data: [] };
}

function parseCsv(text:string):Record<string,string>[] {
  const rows:string[][]=[]; let row:string[]=[]; let cell=''; let quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){ if(quoted&&text[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; }
    else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  const headers=rows.shift()||[];
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])));
}

export const customerApi = {
  list: listCustomers,
  get: (id: string) => request<Customer>(`/customers/${id}`),
  timeline: (id: string) => request<{ data: TimelineEvent[] }>(`/customers/${id}/timeline`),
  create: (body: unknown) => request<Customer>("/customers", { method:"POST", body:JSON.stringify(body) }),
  update: (id: string, body: unknown) => request<Customer>(`/customers/${id}`, { method:"PUT", body:JSON.stringify(body) }),
  bulkDelete: (ids: string[]) => request("/customers/bulk-delete", { method:"POST", body:JSON.stringify({ ids }) }),
  bulkAssign: (ids: string[], assigned_to: string) => request("/customers/bulk-assign", { method:"POST", body:JSON.stringify({ ids, assigned_to }) }),
  export: async (format: "csv" | "pdf", query = "") => {
    const token = sessionStorage.getItem("raj_erp_token");
    if (!token) throw new Error("Unauthenticated.");
    const params = new URLSearchParams(query);
    const response = await fetch(apiUrl(`/customers/export?${params}`), { headers:{ Accept:"text/csv", Authorization:`Bearer ${token}` } });
    if (!response.ok) throw new Error(response.status === 401 ? "Unauthenticated." : `Export failed: ${response.status}`);
    const csv = await response.text();
    if(format==='pdf') { await exportRowsToPdf('Customer Report','customers',parseCsv(csv)); return; }
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); const anchor=document.createElement('a'); anchor.href=url; anchor.download='customers.csv'; anchor.click(); URL.revokeObjectURL(url);
  },
};

export type TimelineEvent = {
  id: string;
  event_type: string;
  title: string;
  description?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};
