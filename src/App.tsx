import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { TrainingProgram } from './types'

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']

function LoginGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session) return <>{children}</>

  async function magicLogin(e: React.FormEvent) {
    e.preventDefault()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    alert('Check je e-mail voor de login-link.')
  }

  return (
    <div style={{ maxWidth: 420, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h2>Inloggen</h2>
      <form onSubmit={magicLogin}>
        <input
          type="email"
          placeholder="jij@voorbeeld.nl"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{ width:'100%', padding:8, marginBottom:8 }}
        />
        <button type="submit">Stuur magic link</button>
      </form>
    </div>
  )
}

export default function App() {
  return (
    <LoginGate>
      <Trainer />
    </LoginGate>
  )
}

function Trainer() {
  const [program, setProgram] = useState<TrainingProgram | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [calories, setCalories] = useState<number | ''>('')

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const { data: state } = await supabase
        .from('user_program_state')
        .select('program_id, current_step_idx')
        .eq('user_id', user.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let programId = state?.program_id

      if (!programId) {
        const { data: first } = await supabase.from('programs').select('id').limit(1).maybeSingle()
        programId = first?.id ?? null
      }

      if (programId) {
        const { data: p } = await supabase
          .from('programs')
          .select('data')
          .eq('id', programId)
          .maybeSingle()
        if (p?.data) {
          setProgram(p.data as TrainingProgram)
          setCurrentIdx(state?.current_step_idx ?? 0)
        }
      }
    })()
  }, [])

  async function saveProgress(nextIdx: number) {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user || !program) return
    await supabase.from('user_program_state').upsert({
      user_id: user.user.id,
      program_id: program.id,
      current_step_idx: nextIdx
    })
  }

  async function finishTraining() {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user || !program) return
    const duration_sec = 0 // TODO: vervang met echte timer
    await supabase.from('sessions').insert({
      user_id: user.user.id,
      program_id: program.id,
      calories: calories === '' ? null : Number(calories),
      duration_sec
    })
    alert('Training opgeslagen!')
  }

  if (!program) return <p style={{ padding: 24 }}>Programma laden…</p>

  const stepsExpanded = expandRepeats(program.steps)
  const current = stepsExpanded[currentIdx]

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h2>{program.title}</h2>
      <p>Stap {currentIdx + 1} / {stepsExpanded.length}</p>

      <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 16 }}>
        <div><strong>{current.label}</strong></div>
        {'speed' in current && current.speed !== undefined && (
          <div>Snelheid: {current.speed} km/u</div>
        )}
        <div>Duur: {current.duration_sec} sec</div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={async () => {
            const next = Math.max(0, currentIdx - 1)
            setCurrentIdx(next)
            await saveProgress(next)
          }}
        >← Vorige</button>

        <button
          onClick={async () => {
            const next = Math.min(stepsExpanded.length - 1, currentIdx + 1)
            setCurrentIdx(next)
            await saveProgress(next)
          }}
        >Volgende →</button>
      </div>

      <hr style={{ margin: '24px 0' }} />

      <label>
        Calorieën (einde training):
        <input
          type="number"
          value={calories}
          onChange={e => setCalories(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ marginLeft: 8, width: 140 }}
        />
      </label>
      <button style={{ marginLeft: 12 }} onClick={finishTraining}>Opslaan</button>
    </div>
  )
}

function expandRepeats(steps: TrainingProgram['steps']) {
  const out: { label: string; duration_sec: number; speed?: number }[] = []
  for (const s of steps) {
    const times = Math.max(1, s.repeat ?? 1)
    for (let i = 0; i < times; i++) out.push({ label: s.label, duration_sec: s.duration_sec, speed: s.speed })
  }
  return out
}
