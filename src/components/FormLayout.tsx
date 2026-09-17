import type { ReactNode } from 'react'

type BrandHeaderProps = {
  title: string
  subtitle: string
  logoSrc?: string
  logoAlt?: string
}

export function BrandHeader({
  title,
  subtitle,
  logoSrc = '/branding/sig-logo-black.png',
  logoAlt = 'Logo SIG',
}: BrandHeaderProps) {
  return (
    <header className='brand-header'>
      <div className='brand-header-inner'>
        <div className='brand-logo-frame'>
          <img className='brand-logo-image' src={logoSrc} alt={logoAlt} />
        </div>
        <div className='brand-title-block'>
          <p className='brand-eyebrow'>PILOK · Form Operasional</p>
          <h1>{title}</h1>
          <p className='brand-subtitle'>{subtitle}</p>
        </div>
      </div>
    </header>
  )
}

type FormShellProps = BrandHeaderProps & {
  children: ReactNode
}

export function FormShell({
  title,
  subtitle,
  logoSrc,
  logoAlt,
  children,
}: FormShellProps) {
  return (
    <div className='form-shell'>
      <BrandHeader
        title={title}
        subtitle={subtitle}
        logoSrc={logoSrc}
        logoAlt={logoAlt}
      />
      <main className='form-container'>{children}</main>
    </div>
  )
}

type SectionCardProps = {
  children: ReactNode
  className?: string
}

export function SectionCard({ children, className = '' }: SectionCardProps) {
  return <section className={`form-section ${className}`}>{children}</section>
}

type SectionHeaderProps = {
  title: string
  description?: string
  step?: number
}

export function SectionHeader({
  title,
  description,
  step,
}: SectionHeaderProps) {
  return (
    <div className='section-heading'>
      {step !== undefined && <span className='step-badge'>{step}</span>}
      <div className='min-w-0'>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  )
}

type StatusVariant = 'info' | 'success' | 'warning' | 'error'

type StatusBannerProps = {
  children: ReactNode
  variant?: StatusVariant
  title?: string
  action?: ReactNode
  compact?: boolean
}

export function StatusBanner({
  children,
  variant = 'info',
  title,
  action,
  compact = false,
}: StatusBannerProps) {
  return (
    <div
      className={`status-banner status-banner-${variant} ${compact ? 'status-banner-compact' : ''}`}
      data-variant={variant}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <span className='status-indicator' aria-hidden='true' />
      <div className='min-w-0 flex-1'>
        {title && <p className='status-title'>{title}</p>}
        <div className='status-content'>{children}</div>
      </div>
      {action && <div className='status-action'>{action}</div>}
    </div>
  )
}

type ActionBarProps = {
  children: ReactNode
  feedback?: ReactNode
}

export function ActionBar({ children, feedback }: ActionBarProps) {
  return (
    <section className='action-bar'>
      {feedback && <div className='min-w-0 flex-1'>{feedback}</div>}
      <div className='action-bar-buttons'>{children}</div>
    </section>
  )
}
