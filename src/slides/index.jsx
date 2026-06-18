import React from 'react'
import { COLORS, FONTS } from '../theme'
import { Card, Label, Seal } from '../components'

// ── WelcomeSlide ──────────────────────────────────────────────────────────────
export function WelcomeSlide({ checkin }) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      height:         '100%',
      gap:            28,
      padding:        '40px 20px',
    }}>
      <style>{`
        @keyframes nameIn {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <Seal size={72} color={COLORS.gold} />
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily:    FONTS.sans,
          fontSize:      11,
          fontWeight:    700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color:         COLORS.sub,
          marginBottom:  12,
        }}>
          Welcome, Brother
        </div>
        <div style={{
          fontFamily: FONTS.serif,
          fontSize:   'clamp(36px, 8vw, 52px)',
          fontWeight: 700,
          color:      COLORS.navy,
          lineHeight: 1.1,
          animation:  'nameIn 0.6s ease forwards',
        }}>
          {checkin?.name || 'Brother'}
        </div>
        {checkin?.role && (
          <div style={{
            fontFamily: FONTS.sans,
            fontSize:   15,
            color:      COLORS.gold,
            marginTop:  10,
            fontWeight: 600,
          }}>
            {checkin.role}
          </div>
        )}
      </div>
      <div style={{ width: 48, height: 1, background: COLORS.goldLt }} />
      <div style={{ fontFamily: FONTS.serif, fontSize: 14, color: COLORS.sub }}>
        Mizpah Lodge No. 148
      </div>
    </div>
  )
}

// ── EventsSlide ───────────────────────────────────────────────────────────────
export function EventsSlide({ events }) {
  const upcoming = (events || []).slice(0, 6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{
        fontFamily: FONTS.serif,
        fontSize:   22,
        fontWeight: 700,
        color:      COLORS.navy,
        marginBottom: 4,
      }}>
        Upcoming Events
      </div>

      {upcoming.length === 0 ? (
        <Card>
          <div style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.sub, textAlign: 'center', padding: '12px 0' }}>
            No upcoming events scheduled.
          </div>
        </Card>
      ) : (
        upcoming.map((ev, i) => {
          const tc = COLORS.tagColors[ev.type] || COLORS.tagColors.STATED
          return (
            <div key={i} style={{
              background:   COLORS.surface,
              border:       `1px solid ${COLORS.border}`,
              borderLeft:   `4px solid ${tc.bg}`,
              borderRadius: '0 10px 10px 0',
              padding:      '11px 14px',
              display:      'flex',
              alignItems:   'center',
              gap:          12,
            }}>
              <div style={{ minWidth: 40, textAlign: 'center' }}>
                <div style={{ fontFamily: FONTS.serif, fontSize: 22, fontWeight: 700, color: COLORS.navy, lineHeight: 1 }}>
                  {ev.day}
                </div>
                <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {ev.month}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 600, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.title}
                </div>
                <div style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.sub, marginTop: 2 }}>
                  {ev.time}
                </div>
              </div>
              <span style={{
                fontFamily:    FONTS.sans,
                fontSize:      8,
                fontWeight:    700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background:    tc.bg,
                color:         tc.text,
                padding:       '2px 6px',
                borderRadius:  4,
                flexShrink:    0,
              }}>
                {ev.type}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}

// ── PhotosSlide ───────────────────────────────────────────────────────────────
export function PhotosSlide({ photos }) {
  const items = photos?.length ? photos.slice(0, 2) : [{}, {}]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ fontFamily: FONTS.serif, fontSize: 22, fontWeight: 700, color: COLORS.navy, marginBottom: 4 }}>
        From the Lodge
      </div>

      {items.map((photo, i) => (
        <Card key={i} style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
          {photo.imageUrl ? (
            <img
              src={photo.imageUrl}
              alt={photo.caption || 'Lodge photo'}
              style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{
              width:          '100%',
              height:         170,
              background:     COLORS.bg,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexDirection:  'column',
              gap:            8,
            }}>
              <Seal size={38} color={COLORS.muted} />
              <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted }}>
                Facebook not yet connected
              </div>
            </div>
          )}
          {(photo.caption || photo.date) && (
            <div style={{ padding: '10px 14px' }}>
              {photo.caption && (
                <div style={{
                  fontFamily:   FONTS.sans,
                  fontSize:     12,
                  color:        COLORS.text,
                  marginBottom: 4,
                  display:      '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow:     'hidden',
                }}>
                  {photo.caption}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {photo.date && (
                  <div style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.sub }}>{photo.date}</div>
                )}
                {photo.likes != null && (
                  <div style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.sub }}>♥ {photo.likes}</div>
                )}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

// ── AttendeesSlide ────────────────────────────────────────────────────────────
export function AttendeesSlide({ attendees }) {
  const list = attendees || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ fontFamily: FONTS.serif, fontSize: 22, fontWeight: 700, color: COLORS.navy, marginBottom: 4 }}>
        Tonight's Attendees
      </div>

      {list.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Seal size={34} color={COLORS.muted} />
            <div style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.sub, marginTop: 12 }}>
              No one checked in yet.
            </div>
            <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
              Scan the QR code below to check in.
            </div>
          </div>
        </Card>
      ) : (
        list.map((member, i) => (
          <div key={i} style={{
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            background:   COLORS.surface,
            border:       `1px solid ${COLORS.border}`,
            borderRadius: 10,
            padding:      '9px 14px',
          }}>
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.name}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width:          36,
                height:         36,
                borderRadius:   '50%',
                background:     COLORS.navy,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontFamily:     FONTS.sans,
                fontSize:       15,
                fontWeight:     700,
                color:          '#fff',
                flexShrink:     0,
              }}>
                {(member.name || 'B')[0].toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                {member.name}
              </div>
              {member.role && (
                <div style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.gold, marginTop: 1 }}>
                  {member.role}
                </div>
              )}
            </div>
            {member.checkedInAt && (
              <div style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.sub, flexShrink: 0 }}>
                {new Date(member.checkedInAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ── MinutesSlide ──────────────────────────────────────────────────────────────
export function MinutesSlide({ minutes }) {
  const hasData = minutes?.meeting

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: FONTS.serif, fontSize: 22, fontWeight: 700, color: COLORS.navy }}>
          Meeting Minutes
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <span style={{ fontFamily: FONTS.sans, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#5865F2', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>
            Discord
          </span>
          <span style={{ fontFamily: FONTS.sans, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: COLORS.navy, color: '#fff', padding: '2px 6px', borderRadius: 4 }}>
            AI Summary
          </span>
        </div>
      </div>

      {!hasData ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Seal size={34} color={COLORS.muted} />
            <div style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.sub, marginTop: 12 }}>
              No minutes yet.
            </div>
            <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
              Secretary: post a PDF in #lodge-minutes on Discord.
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ fontFamily: FONTS.serif, fontSize: 13, color: COLORS.gold, fontWeight: 600 }}>
            {minutes.meeting}
          </div>

          {minutes.motions?.length > 0 && (
            <Card>
              <Label>Motions Passed</Label>
              {minutes.motions.map((m, i) => (
                <div key={i} style={{ marginBottom: i < minutes.motions.length - 1 ? 8 : 0 }}>
                  <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.text }}>{m.text}</div>
                  <div style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.sub, marginTop: 1 }}>{m.result}</div>
                </div>
              ))}
            </Card>
          )}

          {minutes.funds?.length > 0 && (
            <Card>
              <Label>Financial Report</Label>
              {minutes.funds.map((f, i) => (
                <div key={i} style={{
                  display:       'flex',
                  justifyContent: 'space-between',
                  fontFamily:    FONTS.sans,
                  fontSize:      12,
                  color:         COLORS.text,
                  padding:       '3px 0',
                  borderBottom:  i < minutes.funds.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                }}>
                  <span>{f.label}</span>
                  <span style={{ fontWeight: 600, color: COLORS.navy }}>{f.amount}</span>
                </div>
              ))}
            </Card>
          )}

          {minutes.notes?.length > 0 && (
            <Card>
              <Label>Announcements</Label>
              {minutes.notes.map((n, i) => (
                <div key={i} style={{
                  fontFamily: FONTS.sans,
                  fontSize:   12,
                  color:      COLORS.text,
                  padding:    '2px 0',
                  display:    'flex',
                  gap:        8,
                }}>
                  <span style={{ color: COLORS.gold, flexShrink: 0 }}>▸</span>
                  {n}
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
