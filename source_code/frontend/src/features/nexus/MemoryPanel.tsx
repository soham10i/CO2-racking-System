import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card } from '../../components/ui'
import { useT } from '../../lib/i18n'
import { forgetMemory, getMemory, saveMemory } from './api'

/** The user sees, edits or erases exactly what Nexus keeps about them. */
export function MemoryPanel() {
  const { t } = useT()
  const client = useQueryClient()
  const memory = useQuery({ queryKey: ['nexus', 'memory'], queryFn: getMemory })
  const [notes, setNotes] = useState('')
  const [auto, setAuto] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (memory.data) {
      setNotes(memory.data.notes)
      setAuto(memory.data.autoUpdate)
    }
  }, [memory.data])

  const save = useMutation({
    mutationFn: () => saveMemory(notes, auto),
    onSuccess: (m) => {
      client.setQueryData(['nexus', 'memory'], m)
      setSaved(true)
    },
  })
  const forget = useMutation({
    mutationFn: forgetMemory,
    onSuccess: () => client.invalidateQueries({ queryKey: ['nexus', 'memory'] }),
  })
  const dirty = memory.data && (notes !== memory.data.notes || auto !== memory.data.autoUpdate)

  return (
    <Card className="space-y-3 !p-4 md:!p-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{t('nexus.memory.title')}</h2>
        <p className="text-xs text-muted">{t('nexus.memory.hint')}</p>
      </div>
      <label htmlFor="nexus-memory" className="sr-only">{t('nexus.memory.title')}</label>
      <textarea
        id="nexus-memory"
        rows={5}
        maxLength={1500}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value)
          setSaved(false)
        }}
        placeholder={t('nexus.memory.empty')}
        className="block w-full resize-y rounded-xl border border-field/60 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
      />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked)
            setSaved(false)
          }}
          className="h-4 w-4 accent-[var(--brand)]"
        />
        {t('nexus.memory.auto')}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {t('nexus.memory.save')}
        </Button>
        <Button variant="ghost" disabled={!memory.data?.notes || forget.isPending} onClick={() => forget.mutate()}>
          {t('nexus.memory.forget')}
        </Button>
        {saved && <span className="text-xs text-muted">{t('nexus.memory.saved')}</span>}
      </div>
    </Card>
  )
}
