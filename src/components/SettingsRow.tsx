import type { ReactNode } from 'react'
import { IconChevronDown } from './icons'

export function SettingsRow({ icon, title, detail, onClick }: { icon: ReactNode; title: string; detail?: string; onClick: () => void }) {
  return (
    <button type="button" className="settings-row" onClick={onClick}>
      <span className="settings-row-icon" aria-hidden="true">{icon}</span>
      <span className="settings-row-copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
      <span className="settings-row-chevron" aria-hidden="true"><IconChevronDown size={16} /></span>
    </button>
  )
}
