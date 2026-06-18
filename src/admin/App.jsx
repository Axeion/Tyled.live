import React, { useState, useEffect, useCallback } from 'react'
import { COLORS, FONTS } from '../theme'

const BASE       = import.meta.env.VITE_N8N_BASE_URL || 'https://n8n.stationmind.cloud'
const ADMIN_BASE = `${BASE}/webhook/tyled/admin`

// ── API ───────────────────────────────────────────────────────────────────────

async function post(path, body) {
  const res = await fetch(`${ADMIN_BASE}/${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{
      background:   COLORS.surface,
      border:       `1px solid ${COLORS.border}`,
      borderRadius: 14,
      padding:      '18px 20px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontFamily:   FONTS.serif,
      fontSize:     18,
      fontWeight:   700,
      color:        COLORS.navy,
      marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{
      fontFamily:    FONTS.sans,
      fontSize:      10,
      fontWeight:    700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color:         COLORS.gold,
      marginBottom:  5,
    }}>
      {children}
    </div>
  )
}

function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <Label>{label}</Label>}
      <input
        {...props}
        style={{
          width:        '100%',
          fontFamily:   FONTS.sans,
          fontSize:     14,
          color:        COLORS.text,
          background:   COLORS.bg,
          border:       `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding:      '10px 12px',
          outline:      'none',
          ...(props.style || {}),
        }}
      />
    </div>
  )
}

function Textarea({ label, ...props }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <Label>{label}</Label>}
      <textarea
        {...props}
        style={{
          width:        '100%',
          fontFamily:   FONTS.sans,
          fontSize:     14,
          color:        COLORS.text,
          background:   COLORS.bg,
          border:       `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding:      '10px 12px',
          outline:      'none',
          resize:       'vertical',
          minHeight:    80,
          ...(props.style || {}),
        }}
      />
    </div>
  )
}

function Select({ label, options, ...props }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <Label>{label}</Label>}
      <select
        {...props}
        style={{
          width:        '100%',
          fontFamily:   FONTS.sans,
          fontSize:     14,
          color:        COLORS.text,
          background:   COLORS.bg,
          border:       `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding:      '10px 12px',
          outline:      'none',
          appearance:   'none',
          ...(props.style || {}),
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function Btn({ children, onClick, disabled, loading, variant = 'primary', style }) {
  const styles = {
    primary: { background: COLORS.navy,   color: '#fff'         },
    danger:  { background: '#B91C1C',     color: '#fff'         },
    ghost:   { background: 'transparent', color: COLORS.sub, border: `1px solid ${COLORS.border}` },
    gold:    { background: COLORS.gold,   color: '#fff'         },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        fontFamily:    FONTS.sans,
        fontSize:      13,
        fontWeight:    600,
        borderRadius:  8,
        border:        'none',
        padding:       '10px 18px',
        cursor:        disabled || loading ? 'not-allowed' : 'pointer',
        opacity:       disabled || loading ? 0.55 : 1,
        transition:    'opacity 0.15s',
        whiteSpace:    'nowrap',
        ...styles[variant],
        ...style,
      }}
    >
      {loading ? '…' : children}
    </button>
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width:        40,
          height:       22,
          borderRadius: 11,
          background:   value ? COLORS.navy : COLORS.border,
          position:     'relative',
          transition:   'background 0.2s',
          flexShrink:   0,
        }}
      >
        <div style={{
          position:   'absolute',
          top:        3,
          left:       value ? 21 : 3,
          width:      16,
          height:     16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow:  '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      <span style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.text }}>{label}</span>
    </label>
  )
}

function StatusPill({ ok, text }) {
  return (
    <span style={{
      fontFamily:    FONTS.sans,
      fontSize:      11,
      fontWeight:    600,
      padding:       '3px 9px',
      borderRadius:  999,
      background:    ok ? '#D1FAE5' : '#FEE2E2',
      color:         ok ? '#065F46' : '#991B1B',
    }}>
      {text}
    </span>
  )
}

function Divider() {
  return <div style={{ height: 1, background: COLORS.border, margin: '16px 0' }} />
}

function SaveFeedback({ state }) {
  if (!state) return null
  const isErr = state.startsWith('Error')
  return (
    <div style={{
      fontFamily:  FONTS.sans,
      fontSize:    12,
      color:       isErr ? '#B91C1C' : '#065F46',
      marginTop:   8,
      textAlign:   'center',
    }}>
      {state}
    </div>
  )
}

// ── TV Section ────────────────────────────────────────────────────────────────

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function TVSection({ tvConfig, token }) {
  const [schedule, setSchedule] = useState({
    enabled: false,
    onTime:  '18:30',
    offTime: '22:30',
    days:    [1, 2, 3, 4, 5],
    ...tvConfig?.schedule,
  })
  const [cmdFb,  setCmdFb]  = useState(null)
  const [schFb,  setSchFb]  = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (tvConfig?.schedule) setSchedule({ enabled: false, onTime: '18:30', offTime: '22:30', days: [1,2,3,4,5], ...tvConfig.schedule })
  }, [tvConfig])

  async function sendCommand(action) {
    setCmdFb(null)
    try {
      await post('tv/command', { token, action })
      setCmdFb(`TV ${action} command queued — Pi will execute within 60 s`)
    } catch {
      setCmdFb('Error: command failed')
    }
  }

  async function saveSchedule() {
    setSaving(true); setSchFb(null)
    try {
      await post('tv/schedule', { token, schedule })
      setSchFb('Schedule saved')
    } catch {
      setSchFb('Error: save failed')
    } finally { setSaving(false) }
  }

  function toggleDay(d) {
    setSchedule(s => ({
      ...s,
      days: s.days.includes(d) ? s.days.filter(x => x !== d) : [...s.days, d].sort(),
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Manual control */}
      <Card>
        <SectionTitle>Manual Control</SectionTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn variant="gold"   onClick={() => sendCommand('on')}>Turn TV On</Btn>
          <Btn variant="ghost"  onClick={() => sendCommand('off')}>Turn TV Off</Btn>
        </div>
        {cmdFb && (
          <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.sub, marginTop: 10 }}>
            {cmdFb}
          </div>
        )}
        <div style={{ marginTop: 12, fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted }}>
          The Pi polls for commands every 60 seconds.
        </div>
      </Card>

      {/* Schedule */}
      <Card>
        <SectionTitle>Schedule</SectionTitle>
        <Toggle
          value={schedule.enabled}
          onChange={v => setSchedule(s => ({ ...s, enabled: v }))}
          label="Enable automatic schedule"
        />
        {schedule.enabled && (
          <>
            <Divider />
            <Label>Days</Label>
            <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  style={{
                    width:        36,
                    height:       36,
                    borderRadius: '50%',
                    border:       `2px solid ${schedule.days.includes(i) ? COLORS.navy : COLORS.border}`,
                    background:   schedule.days.includes(i) ? COLORS.navy : 'transparent',
                    color:        schedule.days.includes(i) ? '#fff' : COLORS.sub,
                    fontFamily:   FONTS.sans,
                    fontSize:     12,
                    fontWeight:   600,
                    cursor:       'pointer',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Turn On"
                  type="time"
                  value={schedule.onTime}
                  onChange={e => setSchedule(s => ({ ...s, onTime: e.target.value }))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  label="Turn Off"
                  type="time"
                  value={schedule.offTime}
                  onChange={e => setSchedule(s => ({ ...s, offTime: e.target.value }))}
                />
              </div>
            </div>
          </>
        )}
        <Btn onClick={saveSchedule} loading={saving} style={{ marginTop: 4 }}>
          Save Schedule
        </Btn>
        <SaveFeedback state={schFb} />
      </Card>
    </div>
  )
}

// ── Tonight Section ───────────────────────────────────────────────────────────

const EVENT_TYPES = ['STATED', 'DEGREE', 'INSTRUCTION', 'DARK', 'SPECIAL'].map(v => ({ value: v, label: v }))

function TonightSection({ tonightConfig, token }) {
  const [form, setForm] = useState({
    active: false,
    title:  '',
    type:   'STATED',
    time:   '7:30 PM',
    dress:  '',
    notes:  '',
    ...tonightConfig,
    agenda: Array.isArray(tonightConfig?.agenda) ? tonightConfig.agenda.join('\n') : (tonightConfig?.agenda || ''),
  })
  const [saving, setSaving] = useState(false)
  const [fb,     setFb]     = useState(null)

  useEffect(() => {
    if (tonightConfig) {
      setForm({
        active: false,
        title:  '',
        type:   'STATED',
        time:   '7:30 PM',
        dress:  '',
        notes:  '',
        ...tonightConfig,
        agenda: Array.isArray(tonightConfig.agenda)
          ? tonightConfig.agenda.join('\n')
          : (tonightConfig.agenda || ''),
      })
    }
  }, [tonightConfig])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    setSaving(true); setFb(null)
    try {
      const override = {
        ...form,
        agenda: form.agenda.split('\n').map(s => s.trim()).filter(Boolean),
      }
      await post('tonight', { token, override })
      setFb('Override saved')
    } catch {
      setFb('Error: save failed')
    } finally { setSaving(false) }
  }

  async function clear() {
    setSaving(true); setFb(null)
    try {
      await post('tonight', { token, override: { active: false } })
      setForm(f => ({ ...f, active: false }))
      setFb('Override cleared — display will use Google Calendar')
    } catch {
      setFb('Error: clear failed')
    } finally { setSaving(false) }
  }

  return (
    <Card>
      <SectionTitle>Tonight's Override</SectionTitle>
      <Toggle
        value={form.active}
        onChange={v => set('active', v)}
        label="Override Google Calendar for tonight"
      />
      {form.active && (
        <>
          <Divider />
          <Input  label="Event Title"  value={form.title}  onChange={e => set('title', e.target.value)}  placeholder="Stated Communication" />
          <Select label="Type"         value={form.type}   onChange={e => set('type', e.target.value)}   options={EVENT_TYPES} />
          <Input  label="Time"         value={form.time}   onChange={e => set('time', e.target.value)}   placeholder="7:30 PM" />
          <Input  label="Dress Code"   value={form.dress}  onChange={e => set('dress', e.target.value)}  placeholder="Business Attire" />
          <Textarea
            label="Agenda (one item per line)"
            value={form.agenda}
            onChange={e => set('agenda', e.target.value)}
            placeholder={'Opening\nReading of Minutes\nCorrespondence\nBills\nClosing'}
          />
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Any extra notes shown on the display"
            style={{ minHeight: 60 }}
          />
        </>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Btn onClick={save} loading={saving}>Save</Btn>
        {form.active && <Btn variant="ghost" onClick={clear} disabled={saving}>Clear Override</Btn>}
      </div>
      <SaveFeedback state={fb} />
    </Card>
  )
}

// ── Members Section ───────────────────────────────────────────────────────────

const ROLES = [
  'Worshipful Master', 'Senior Warden', 'Junior Warden', 'Treasurer',
  'Secretary', 'Senior Deacon', 'Junior Deacon', 'Senior Steward',
  'Junior Steward', 'Marshal', 'Chaplain', 'Tyler', 'Master Mason',
  'Fellow Craft', 'Entered Apprentice',
].map(r => ({ value: r, label: r }))

function MembersSection({ members, token, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ name: '', role: 'Master Mason', email: '' })
  const [saving,   setSaving]   = useState(false)
  const [fb,       setFb]       = useState(null)
  const [deleting, setDeleting] = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function addMember() {
    if (!form.name.trim()) return
    setSaving(true); setFb(null)
    try {
      await post('members/add', { token, ...form })
      setForm({ name: '', role: 'Master Mason', email: '' })
      setShowForm(false)
      onRefresh()
      setFb('Member added')
    } catch {
      setFb('Error: add failed')
    } finally { setSaving(false) }
  }

  async function deleteMember(id, name) {
    if (!confirm(`Remove ${name} from the member list?`)) return
    setDeleting(id)
    try {
      await post('members/delete', { token, id })
      onRefresh()
    } catch {
      setFb('Error: delete failed')
    } finally { setDeleting(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <SectionTitle style={{ marginBottom: 0 }}>Lodge Members</SectionTitle>
          <Btn onClick={() => setShowForm(s => !s)} variant={showForm ? 'ghost' : 'primary'}>
            {showForm ? 'Cancel' : '+ Add Member'}
          </Btn>
        </div>

        {showForm && (
          <>
            <div style={{
              background:   COLORS.bg,
              borderRadius: 10,
              padding:      '14px 16px',
              marginBottom: 14,
              border:       `1px solid ${COLORS.border}`,
            }}>
              <Input  label="Full Name"  value={form.name}  onChange={e => set('name', e.target.value)}  placeholder="John Doe" />
              <Select label="Role"       value={form.role}  onChange={e => set('role', e.target.value)}  options={ROLES} />
              <Input  label="Email (optional)" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
              <Btn onClick={addMember} loading={saving} disabled={!form.name.trim()}>Save Member</Btn>
            </div>
          </>
        )}

        {fb && <SaveFeedback state={fb} />}

        {members.length === 0 ? (
          <div style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.muted, textAlign: 'center', padding: '20px 0' }}>
            No members yet. Add members so check-in autocomplete works.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.map(m => (
              <div key={m.id} style={{
                display:      'flex',
                alignItems:   'center',
                gap:          10,
                padding:      '10px 12px',
                background:   COLORS.bg,
                borderRadius: 8,
                border:       `1px solid ${COLORS.border}`,
              }}>
                <div style={{
                  width:          32,
                  height:         32,
                  borderRadius:   '50%',
                  background:     COLORS.navy,
                  color:          '#fff',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontFamily:     FONTS.sans,
                  fontSize:       13,
                  fontWeight:     700,
                  flexShrink:     0,
                }}>
                  {(m.name || 'M')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                    {m.name}
                  </div>
                  {m.role && (
                    <div style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.gold }}>{m.role}</div>
                  )}
                </div>
                <button
                  onClick={() => deleteMember(m.id, m.name)}
                  disabled={deleting === m.id}
                  style={{
                    background:   'none',
                    border:       'none',
                    color:        COLORS.muted,
                    cursor:       'pointer',
                    fontSize:     16,
                    padding:      '4px 6px',
                    borderRadius: 6,
                    lineHeight:   1,
                  }}
                  title="Remove member"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Slides Section ────────────────────────────────────────────────────────────

const SLIDE_META = [
  { key: 'home',      label: 'Home',                 note: 'Clock, tonight\'s event, brothers present' },
  { key: 'events',    label: 'Upcoming Events',       note: 'Next 60 days from Google Calendar'        },
  { key: 'photos',    label: 'From the Lodge',        note: 'Last 2 Facebook posts with photos'        },
  { key: 'attendees', label: 'Tonight\'s Attendees',  note: 'Check-in list for tonight'                },
  { key: 'minutes',   label: 'Meeting Minutes',       note: 'AI-parsed minutes from Discord PDF'       },
]

function SlidesSection({ slidesConfig, token }) {
  const [slides, setSlides] = useState({ home: true, events: true, photos: true, attendees: true, minutes: true, ...slidesConfig })
  const [saving, setSaving] = useState(false)
  const [fb,     setFb]     = useState(null)

  useEffect(() => {
    if (slidesConfig) setSlides({ home: true, events: true, photos: true, attendees: true, minutes: true, ...slidesConfig })
  }, [slidesConfig])

  async function save() {
    setSaving(true); setFb(null)
    try {
      await post('slides', { token, slides })
      setFb('Slide config saved — display updates on next poll')
    } catch {
      setFb('Error: save failed')
    } finally { setSaving(false) }
  }

  return (
    <Card>
      <SectionTitle>Active Slides</SectionTitle>
      <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.sub, marginBottom: 14 }}>
        Home is always shown. Toggle others on/off.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {SLIDE_META.map(({ key, label, note }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ paddingTop: 1 }}>
              <Toggle
                value={key === 'home' ? true : slides[key]}
                onChange={key === 'home' ? undefined : v => setSlides(s => ({ ...s, [key]: v }))}
                label=""
              />
            </div>
            <div style={{ opacity: key === 'home' ? 0.5 : 1 }}>
              <div style={{ fontFamily: FONTS.sans, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{label}</div>
              <div style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.sub }}>{note}</div>
            </div>
          </div>
        ))}
      </div>
      <Btn onClick={save} loading={saving} style={{ marginTop: 18 }}>Save</Btn>
      <SaveFeedback state={fb} />
    </Card>
  )
}

// ── Login Screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [token,  setToken]  = useState('')
  const [error,  setError]  = useState('')
  const [loading, setLoading] = useState(false)

  async function attempt() {
    if (!token.trim()) return
    setLoading(true); setError('')
    try {
      const res = await post('auth', { token: token.trim() })
      if (res.ok) {
        sessionStorage.setItem('tyled_admin_token', token.trim())
        onLogin(token.trim())
      } else {
        setError('Incorrect password.')
      }
    } catch {
      setError('Could not reach n8n — check VITE_N8N_BASE_URL.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight:      '100dvh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        24,
      background:     COLORS.bg,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <svg width="48" height="48" viewBox="0 0 100 100" fill="none" style={{ marginBottom: 12 }}>
            <path d="M18 72 L18 38 L52 38" stroke={COLORS.navy} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M50 12 L24 74" stroke={COLORS.navy} strokeWidth="6" strokeLinecap="round"/>
            <path d="M50 12 L76 74" stroke={COLORS.navy} strokeWidth="6" strokeLinecap="round"/>
            <path d="M28 64 Q50 84 72 64" stroke={COLORS.navy} strokeWidth="4" strokeLinecap="round" fill="none"/>
            <text x="50" y="58" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" fontWeight="bold" fill={COLORS.navy}>G</text>
          </svg>
          <div style={{ fontFamily: FONTS.serif, fontSize: 24, fontWeight: 700, color: COLORS.navy }}>
            Tyled Admin
          </div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.sub, marginTop: 4 }}>
            Mizpah Lodge No. 148
          </div>
        </div>

        <Card>
          <Input
            label="Admin Password"
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && attempt()}
            placeholder="Enter password"
            autoFocus
          />
          {error && (
            <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: '#B91C1C', marginBottom: 10 }}>
              {error}
            </div>
          )}
          <Btn onClick={attempt} loading={loading} disabled={!token.trim()} style={{ width: '100%' }}>
            Sign In
          </Btn>
        </Card>

        <div style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, textAlign: 'center', marginTop: 16 }}>
          Set TYLED_ADMIN_PASSWORD in your n8n environment variables.
        </div>
      </div>
    </div>
  )
}

// ── Dashboard Shell ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'tv',      label: 'TV'      },
  { key: 'tonight', label: 'Tonight' },
  { key: 'members', label: 'Members' },
  { key: 'slides',  label: 'Slides'  },
]

function Dashboard({ token, onLogout }) {
  const [tab,      setTab]      = useState('tv')
  const [config,   setConfig]   = useState(null)
  const [members,  setMembers]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [cfg, mem] = await Promise.all([
        post('config',  { token }),
        post('members', { token }),
      ])
      setConfig(cfg)
      setMembers(Array.isArray(mem) ? mem : [])
    } catch {
      setError('Failed to load data — check n8n connection.')
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  return (
    <div style={{ background: COLORS.bg, minHeight: '100dvh' }}>
      {/* Header */}
      <div style={{
        background:  COLORS.navy,
        padding:     '14px 20px',
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: FONTS.serif, fontSize: 16, fontWeight: 700, color: '#fff' }}>
            Tyled Admin
          </div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.goldLt, marginTop: 1 }}>
            Mizpah Lodge No. 148
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            fontFamily:   FONTS.sans,
            fontSize:     12,
            color:        COLORS.goldLt,
            background:   'none',
            border:       `1px solid rgba(201,168,76,0.4)`,
            borderRadius: 6,
            padding:      '6px 12px',
            cursor:       'pointer',
          }}
        >
          Logout
        </button>
      </div>

      {/* Tab bar */}
      <div style={{
        background:   COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
        display:      'flex',
        overflowX:    'auto',
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex:        1,
              fontFamily:  FONTS.sans,
              fontSize:    13,
              fontWeight:  600,
              color:       tab === t.key ? COLORS.navy : COLORS.sub,
              background:  'none',
              border:      'none',
              borderBottom: tab === t.key ? `2px solid ${COLORS.navy}` : '2px solid transparent',
              padding:     '14px 8px',
              cursor:      'pointer',
              whiteSpace:  'nowrap',
              transition:  'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 16px', maxWidth: 560, margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: FONTS.sans, fontSize: 14, color: COLORS.sub }}>
            Loading…
          </div>
        )}
        {error && (
          <div style={{ fontFamily: FONTS.sans, fontSize: 13, color: '#B91C1C', textAlign: 'center', padding: '20px 0' }}>
            {error}
          </div>
        )}
        {!loading && !error && config && (
          <>
            {tab === 'tv'      && <TVSection      tvConfig={config.tv}           token={token} />}
            {tab === 'tonight' && <TonightSection  tonightConfig={config.tonight} token={token} />}
            {tab === 'members' && <MembersSection  members={members}              token={token} onRefresh={fetchAll} />}
            {tab === 'slides'  && <SlidesSection   slidesConfig={config.slides}   token={token} />}
          </>
        )}
      </div>
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem('tyled_admin_token') || ''
  )

  function logout() {
    sessionStorage.removeItem('tyled_admin_token')
    setToken('')
  }

  if (!token) return <LoginScreen onLogin={setToken} />
  return <Dashboard token={token} onLogout={logout} />
}
