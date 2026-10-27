import React from 'react';
import { Construction } from 'lucide-react';

export function PlaceholderPage({ title, subtitle, milestone }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>

      <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-3">
          <Construction className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">{title} Module</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-3">
          This engine is scheduled for implementation in {milestone}.
        </p>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          Target: {milestone}
        </span>
      </div>
    </div>
  );
}
