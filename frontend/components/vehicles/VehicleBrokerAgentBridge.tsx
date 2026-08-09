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
    }, 80);
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
    <section className="mb-6 overflow-hidden rounded-[28px] border border-[#dbe6f3] bg-white shadow-[0_18px_48px_rgba(15,23,42,.065)]">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-[#f7faff] to-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-500">Optional routing</p>
          <h2 className="mt-1 text-xl font-black text-[#0a1d3e]">Broker / Agent Details</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Enable only when this vehicle is handled through a broker or agent.</p>
        </div>
        <button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled((value) => !value)} className={`flex h-11 min-w-[122px] items-center justify-between rounded-2xl px-3 text-xs font-black transition ${enabled ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
          <span>{enabled ? 'ON' : 'OFF'}</span>
          <span className={`relative h-6 w-11 rounded-full ${enabled ? 'bg-white/25' : 'bg-slate-300'}`}><i className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${enabled ? 'left-6' : 'left-1'}`} /></span>
        </button>
      </div>
      {enabled && (
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <label className="grid gap-2 text-xs font-extrabold text-slate-600">Broker
            <input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="Enter broker name" required className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#f7faff] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
          </label>
          <label className="grid gap-2 text-xs font-extrabold text-slate-600">Agent
            <input value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="Enter agent name" required className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#f7faff] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
          </label>
        </div>
      )}
    </section>,
    mount,
  );
}
