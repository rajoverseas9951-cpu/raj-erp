import type { ReactNode } from 'react';
import PolicyFundingPanel from '@/components/insurance/PolicyFundingPanel';

export default function InsuranceLayout({children,params}:{children:ReactNode;params:{vehicleId:string}}){
 return <>{children}<PolicyFundingPanel vehicleId={params.vehicleId}/></>;
}
