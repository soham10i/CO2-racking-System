import type { ReactNode } from 'react'
import { AppIcon, Card } from '../../components/ui'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex flex-col items-center gap-2">
          <AppIcon size={56} />
          <p className="text-2xl font-bold tracking-tight">CO2 Tracker</p>
        </div>
        <Card>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-4 space-y-4">{children}</div>
        </Card>
      </div>
    </main>
  )
}
