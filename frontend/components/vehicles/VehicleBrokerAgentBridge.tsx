'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { setVehicleBrokerAgentDraft, type Vehicle } from '@/lib/vehicles';

export default function VehicleBrokerAgentBridge({ vehicle }: { vehicle?: Partial<Vehicle> }) {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [enabled, setEnabled] = useState(Boolean(vehicle?.broker_agent_enabled));
  const [broker, setBroker] = useState(vehicle?.broker_name ?? '');
  const [agent, setAgent] = useState(vehicle?.agent_name ?? '');

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
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Use this only for Bank / NBFC / finance-broker work. It is kept separately for monthly channel and loan-agent statements and does <b>not</b> decide who owes us money.</p>
        </div>
        <button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled((value) => !value)} className={`flex h-11 min-w-[132px] items-center justify-between rounded-2xl px-3 text-xs font-black transition ${enabled ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
          <span>{enabled ? 'YES' : 'NO'}</span>
          <span className={`relative h-6 w-11 rounded-full ${enabled ? 'bg-white/25' : 'bg-slate-300'}`}><i className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${enabled ? 'left-6' : 'left-1'}`} /></span>
        </button>
      </div>
      {enabled && (
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <label className="grid gap-2 text-xs font-extrabold text-slate-600">Bank / NBFC / Finance Broker
            <input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="e.g. HDFC Bank / Bajaj Finance / channel broker" required className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#f7faff] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" />
            <span className="text-[10px] font-medium text-slate-400">Monthly statement / settlement grouping.</span>
          </label>
          <label className="grid gap-2 text-xs font-extrabold text-slate-600">Loan / Referral Agent
            <input value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="Agent who gave this file / vehicle work" required className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#f7faff] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" />
            <span className="text-[10px] font-medium text-slate-400">Lets the broker statement show which loan agent sourced each case.</span>
          </label>
        </div>
      )}
      <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-3 text-[10px] font-semibold text-slate-500">
        Accounting separation: Finance channel = reporting dimension. Payment Party = debtor/receivable responsibility. Agent commission/payable remains a separate account item.
      </div>
    </section>,
    mount,
  );
}
