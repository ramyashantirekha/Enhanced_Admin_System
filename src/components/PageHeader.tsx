import type { ReactNode } from 'react'
import './PageHeader.css'

type PageHeaderProps = {
  breadcrumb: string
  title: string
  description?: string
  action?: ReactNode
}

export default function PageHeader({
  breadcrumb,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <>
      <div className="page-breadcrumb">{breadcrumb}</div>
      <div className="page-header-card">
        <div>
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        {action && <div className="page-header-action">{action}</div>}
      </div>
    </>
  )
}
