import React from 'react';
import { Inbox } from 'lucide-react';
import { cx } from '../../lib/cx';

export default function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center px-6 py-14', className)}>
      <div className="mb-3 rounded-full bg-surface-3 p-3 text-fg-subtle">
        <Icon size={24} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
