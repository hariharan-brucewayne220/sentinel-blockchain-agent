type Status = 'active' | 'paused' | 'blocked'

const STATUS_MAP: Record<Status, { label: string; cls: string; dotCls: string }> = {
  active:  { label: 'SENTINEL ACTIVE', cls: 'active',  dotCls: '' },
  paused:  { label: 'SENTINEL PAUSED', cls: 'paused',  dotCls: 'red' },
  blocked: { label: 'POLICY BLOCK',    cls: 'blocked', dotCls: 'red' },
}

export default function AgentStatusBadge({ status }: { status: Status }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.active
  return (
    <div className={`status-bar ${s.cls}`}>
      <span className={`pulse-dot ${s.dotCls}`} />
      <span className="status-label">{s.label}</span>
      <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
        · base-sepolia
      </span>
    </div>
  )
}
