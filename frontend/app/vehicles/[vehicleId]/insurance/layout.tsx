import type { ReactNode } from 'react';
import PolicyFundingPanel from '@/components/insurance/PolicyFundingPanel';

export default function InsuranceLayout({children}:{children:ReactNode}){
 return <>{children}<PolicyFundingPanel/></>;
}
