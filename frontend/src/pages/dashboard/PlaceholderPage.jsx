import React from 'react';
import { Construction } from 'lucide-react';

export function PlaceholderPage({ title, subtitle, milestone }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>

      <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-[0_4px_25px_rgba(0,0,0,0.05)] text-center">
        <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1e3a8a] mx-auto mb-3 shadow-sm">
          <Construction className="w-6 h-6" />
        </div>
        <h3 className="text-base font-light text-gray-800">{title} Module</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-3">
          This engine is scheduled for implementation in {milestone}.
        </p>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1e3a8a] border border-blue-200">
          Target: {milestone}
        </span>
      </div>
    </div>
  );
}
