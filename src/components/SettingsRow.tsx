import type { ReactNode } from 'react'
import { IconChevronDown } from './icons'

export function SettingsRow({
  icon,
  title,
  detail,
  onClick,
  danger,
}: {
  icon: ReactNode
  title: string
  detail?: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button type="button" className={`settings-row${danger ? ' settings-row-danger' : ''}`} onClick={onClick}>
      <span className="settings-row-icon" aria-hidden="true">{icon}</span>
      <span className="settings-row-copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
      {!danger && <span className="settings-row-chevron" aria-hidden="true"><IconChevronDown size={16} /></span>}
    </button>
  )
}
