import React from 'react';

export const StatusBadge = ({ status }) => {
  const map = {
    pending: 'badge-pending',
    in_progress: 'badge-in_progress',
    passed: 'badge-passed',
    failed: 'badge-failed',
    blocked: 'badge-blocked',
  };
  return <span className={`badge ${map[status] || 'badge-pending'}`}>{status?.replace('_',' ')}</span>;
};

export const PriorityBadge = ({ priority }) => {
  const map = {
    low: 'badge-low',
    medium: 'badge-medium',
    high: 'badge-high',
    critical: 'badge-critical',
  };
  return <span className={`badge ${map[priority] || 'badge-medium'}`}>{priority}</span>;
};

export const ModuleBadge = ({ module }) => (
  <span className="badge bg-slate-100 text-slate-700">{module}</span>
);
