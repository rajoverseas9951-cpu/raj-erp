'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  setVehicleBrokerAgentDraft,
  setVehicleFinanceSettlementDraft,
  vehicleApi,
  type Vehicle,
} from '@/lib/vehicles';

type Settlement = 'main' | 'customer' | 'broker' | 'agent';
const MANUAL = '__manual__';

export default function VehicleBrokerAgentBridge({ vehicle }: { vehicle?: Partial<Vehicle> }) {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [enabled, setEnabled] = useState(Boolean(vehicle?.broker_agent_enabled));
  const [broker, setBroker] = useState(vehicle?.broker_name ?? '');
  const [agent, setAgent] = useState(vehicle?.agent_name ?? '');
  const [brokers, setBrokers] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [brokerManual, setBrokerManual] = useState(false);
  const [agentManual, setAgentManual] = useState(false);
  const [settlement, setSettlement] = useState<Settlement>('main');

  useEffect(() => {
    void vehicleApi.list('?per_page=500').then((result) => {
      const rows = result.data ?? [];
      const unique = (values: Array<string | undefined>) => Array.from(new Set(values.map(v => v?.trim()).filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b));
      setBrokers(unique(rows.map(v => v.broker_name)));
      setAgents(unique(rows.map(v => v.agent_name)));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const form = document.querySelector('.vehicle-onboarding form, form');
      if (!form || form.querySelector('[data-broker-agent-bridge]')) return;
      const node = document.createElement('div');
      node.dataset.brokerAgentBridge = 'true';
      const fixed = Array.from(form.children).find((child) => child.classList.contains('fixed'));
      if (fixed) form.insertBefore(node, fixed); else form.appendChild(node);
      setMount(node);
      window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setVehicleBrokerAgentDraft({
      broker_agent_enabled: enabled,
      broker_name: enabled ? broker.trim() : '',
      agent_name: enabled ? agent.trim() : '',
    });
    return () => setVehicleBrokerAgentDraft(null);
  }, [enabled, broker, agent]);

  useEffect(() => {
    if (!enabled || settlement === 'main') {
      setVehicleFinanceSettlementDraft(null);
      return;
    }
    if (settlement === 'customer') {
      setVehicleFinanceSettlementDraft({
        default_payment_party_type: 'customer',
        default_payment_party_name: '',
      });
    } else {
      const name = settlement === 'broker' ? broker.trim() : agent.trim();
      setVehicleFinanceSettlementDraft(name ? {
        default_payment_party_type: 'other',
        default_payment_party_name: name,
      } : null);
    }
    return () => setVehicleFinanceSettlementDraft(null);
  }, [enabled, settlement, broker, agent]);

  useEffect(() => {
    if (!enabled) setSettlement('main');
    if (settlement === 'broker' && !broker.trim()) setSettlement('main');
    if (settlement === 'agent' && !agent.trim()) setSettlement('main');
  }, [enabled, settlement, broker, agent]);

  const brokerSelectValue = useMemo(() => brokerManual || (broker && !brokers.includes(broker)) ? MANUAL : broker, [brokerManual, broker, brokers]);
  const agentSelectValue = useMemo(() => agentManual || (agent && !agents.includes(agent)) ? MANUAL : agent, [agentManual, agent, agents]);

  if (!mount) return null;

  return createPortal(
    <section className="mb-6 overflow-hidden rounded-[26px] border border-[#dbe6f3] bg-white shadow-[0_18px_48px_rgba(15,23,42,.055)]">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-[#fbfcff] to-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[9px] font-black uppercase tracking-[.2em] text-indigo-600">Finance / loan attribution</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-slate-500">Optional</span>
          </div>
          <h2 className="mt-1 text-xl font-black text-[#0a1d3e]">Was this vehicle work received through a finance channel?</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Select the Bank/NBFC/finance broker and the loan/referral agent. Their names stay attached to the vehicle for monthly statements.</p>
        </div>
        <button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled((value) => !value)} className={`flex h-11 min-w-[132px] items-center justify-between rounded-2xl px-3 text-xs font-black transition ${enabled ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
          <span>{enabled ? 'YES' : 'NO'}</span>
          <span className={`relative h-6 w-11 rounded-full ${enabled ? 'bg-white/25' : 'bg-slate-300'}`}><i className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${enabled ? 'left-6' : 'left-1'}`} /></span>
        </button>
      </div>

      {enabled && (
        <div className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-xs font-extrabold text-slate-600">Bank / NBFC / Finance Broker
              <select
                value={brokerSelectValue}
                onChange={(e) => {
                  if (e.target.value === MANUAL) { setBrokerManual(true); setBroker(''); }
                  else { setBrokerManual(false); setBroker(e.target.value); }
                }}
                required
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#f7faff] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              >
                <option value="">Select finance broker / Bank / NBFC</option>
                {brokers.map(name => <option key={name} value={name}>{name}</option>)}
                <option value={MANUAL}>＋ Add new broker / Bank / NBFC</option>
              </select>
              {brokerManual && <input autoFocus value={broker} onChange={e=>setBroker(e.target.value)} placeholder="Enter new broker / Bank / NBFC name" required className="min-h-12 w-full rounded-2xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" />}
              <span className="text-[10px] font-medium text-slate-400">Previous registered names appear automatically in this dropdown.</span>
            </label>

            <label className="grid gap-2 text-xs font-extrabold text-slate-600">Loan / Referral Agent
              <select
                value={agentSelectValue}
                onChange={(e) => {
                  if (e.target.value === MANUAL) { setAgentManual(true); setAgent(''); }
                  else { setAgentManual(false); setAgent(e.target.value); }
                }}
                required
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#f7faff] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              >
                <option value="">Select loan / referral agent</option>
                {agents.map(name => <option key={name} value={name}>{name}</option>)}
                <option value={MANUAL}>＋ Add new loan / referral agent</option>
              </select>
              {agentManual && <input autoFocus value={agent} onChange={e=>setAgent(e.target.value)} placeholder="Enter new loan / referral agent name" required className="min-h-12 w-full rounded-2xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" />}
              <span className="text-[10px] font-medium text-slate-400">Used to identify which agent sourced each case in broker statements.</span>
            </label>
          </div>

          <div className="rounded-[22px] border border-indigo-100 bg-gradient-to-r from-indigo-50/70 to-blue-50/50 p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-center">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.18em] text-indigo-600">Settlement responsibility</p>
                <h3 className="mt-1 text-sm font-black text-[#0a1d3e]">Who should this vehicle's future work normally be billed to?</h3>
                <p className="mt-1 text-[11px] font-medium leading-5 text-slate-500">Choose Broker only when the broker actually settles your account. Then future service transactions inherit that broker as the payment party and its receivable is grouped under that broker name.</p>
              </div>
              <select value={settlement} onChange={e=>setSettlement(e.target.value as Settlement)} className="min-h-12 w-full rounded-2xl border border-indigo-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                <option value="main">Use main Payment Party default</option>
                <option value="customer">Vehicle Customer / Owner</option>
                <option value="broker" disabled={!broker.trim()}>Finance Broker — {broker.trim() || 'select broker first'}</option>
                <option value="agent" disabled={!agent.trim()}>Loan / Referral Agent — {agent.trim() || 'select agent first'}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-3 text-[10px] font-semibold text-slate-500">
        Accounting rule: selecting a broker/agent only tags the case. A receivable is created only when actual Insurance/RTO/PUC/Fitness/Permit/Tax/other billable work is posted. If Broker is chosen as settlement party, that work inherits the broker as debtor/payment party.
      </div>
    </section>,
    mount,
  );
}
