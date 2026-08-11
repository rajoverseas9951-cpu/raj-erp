"use client";
import { authenticatedRequest } from "@/lib/api-client";

export type InsuranceLine = "non_motor"|"health"|"life";
export type OtherInsuranceRow = {
 id:string; insurance_line:InsuranceLine; product_type?:string|null; customer_id?:string|null; customer_name:string; mobile?:string|null;
 company_name?:string|null; policy_number?:string|null; proposal_number?:string|null; issue_date?:string|null; expiry_date?:string|null;
 sum_insured:number; gross_premium:number; commission_amount:number; agent_commission:number; net_commission:number; received_amount:number; due_amount:number; status:string; notes?:string|null;
};
export type OtherInsurancePayload={rows:OtherInsuranceRow[];summary:{policy_count:number;premium:number;received:number;due:number;gross_commission:number;agent_commission:number;net_commission:number}};
export type OtherInsuranceInput={customer_id?:string|null;product_type?:string;customer_name?:string;mobile?:string;company_name?:string;policy_number?:string;proposal_number?:string;issue_date?:string;expiry_date?:string;sum_insured?:number;gross_premium:number;commission_amount?:number;agent_commission?:number;received_amount?:number;status?:string;notes?:string};

export const otherInsuranceApi={
 list:(line:InsuranceLine,query="")=>authenticatedRequest<OtherInsurancePayload>(`/other-insurance/${line}${query?`?${query}`:""}`),
 create:(line:InsuranceLine,input:OtherInsuranceInput)=>authenticatedRequest<{id:string}>(`/other-insurance/${line}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}),
 update:(line:InsuranceLine,id:string,input:Partial<OtherInsuranceInput>)=>authenticatedRequest<null>(`/other-insurance/${line}/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}),
 remove:(line:InsuranceLine,id:string)=>authenticatedRequest<null>(`/other-insurance/${line}/${id}`,{method:"DELETE"}),
};
