import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import type { Me, Profile } from '../../api/types'
import { useAuth } from '../auth/AuthContext'
import { ProfileEditor } from './ProfileEditor'
import { BaselineForm, emptyAnswers } from '../planning/BaselineForm'
import { useSaveBaseline } from '../planning/hooks'
import { skipOnboarding } from '../planning/api'
import { AppIcon, Button, Card, ErrorBanner } from '../../components/ui'

export default function Onboarding() {
  const { state, setUser } = useAuth()
  const navigate = useNavigate()
  const saveBaseline = useSaveBaseline()
  const [step, setStep] = useState<'profile' | 'baseline'>('profile')
  const [skipError, setSkipError] = useState<string | null>(null)
  if (state.status !== 'authed') return null
  const initial: Profile = {
    ...state.user.profile,
    timezone: state.user.profile.timezone === 'UTC' ? Intl.DateTimeFormat().resolvedOptions().timeZone : state.user.profile.timezone,
  }

  // Saving or skipping the baseline marks onboarding complete on the server; reload the user to leave the wizard.
  async function finish() {
    setUser(await api<Me>('/me'))
    navigate('/', { replace: true })
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 md:py-14">
      <div className="flex items-center gap-3" aria-hidden>
        <AppIcon size={36} />
        <span className="font-display text-lg font-semibold tracking-tight">CO2 Tracker</span>
      </div>
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <p className="brand-chip">Step {step === 'profile' ? 1 : 2} of 2</p>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill-strong" aria-hidden>
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: step === 'profile' ? '50%' : '100%' }}
            />
          </div>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
          {step === 'profile' ? 'Let’s personalise your footprint' : 'Estimate a typical year'}
        </h1>
        <p className="max-w-xl text-base text-muted md:text-lg">
          {step === 'profile'
            ? 'A few details so the right factors are used. You can change everything later in Settings.'
            : 'Rough answers are fine — this takes about five minutes and gives you a starting point to track against.'}
        </p>
      </header>
      {step === 'profile' ? (
        <ProfileEditor
          wizard
          initial={initial}
          submitLabel="Next"
          onSubmit={async (profile) => {
            const me = await api<Me>('/me/profile', { method: 'PUT', body: { ...profile, onboardingCompleted: false } })
            setUser(me)
            setStep('baseline')
          }}
        />
      ) : (
        <Card className="space-y-5 p-6 md:p-8">
          <ErrorBanner message={skipError} />
          <BaselineForm
            initial={emptyAnswers(state.user.profile)}
            submitLabel="Finish"
            onSubmit={async (answers) => {
              await saveBaseline.mutateAsync(answers)
              await finish()
            }}
            secondary={
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSkipError(null)
                  skipOnboarding().then(finish, () => setSkipError('Could not skip. Check your connection and try again.'))
                }}
              >
                Skip for now
              </Button>
            }
          />
        </Card>
      )}
    </main>
  )
}
