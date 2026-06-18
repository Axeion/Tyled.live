import React from 'react'
import { COLORS, FONTS } from '../theme'
import { Card, Label } from '../components'

export default function HomeSlide({ tonight, attendees, events, clock }) {
  const { h, min, ampm, dateStr } = clock
  const typeColor = COLORS.tagColors[tonight?.type] || COLORS.tagColors.STATED
  const upNext    = events?.find(e => e.type !== 'DARK')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>

      {/* Clock hero */}
      <div style={{ textAlign: 'center', padding: '6px 0' }}>
        <div style={{
          fontFamily:    FONTS.sans,
          fontWeight:    800,
          fontSize:      'clamp(52px, 12vw, 76px)',
          color:         COLORS.navy,
          lineHeight:    1,
          letterSpacing: '-2px',
        }}>
          {h}:{min}
          <span style={{ fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 600, color: COLORS.sub, marginLeft: 8 }}>
            {ampm}
          </span>
        </div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 14, color: COLORS.gold, marginTop: 4 }}>
          {dateStr}
        </div>
        {tonight?.weather && (
          <div style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.sub, marginTop: 2 }}>
            {tonight.weather}
          </div>
        )}
      </div>

      {/* Tonight's event */}
      <Card accent>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Label>Tonight</Label>
          {tonight?.type && (
            <span style={{
              fontFamily:    FONTS.sans,
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background:    typeColor.bg,
              color:         typeColor.text,
              padding:       '3px 8px',
              borderRadius:  4,
            }}>
              {tonight.type}
            </span>
          )}
        </div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 20, fontWeight: 700, color: COLORS.navy, marginBottom: 3 }}>
          {tonight?.title || 'No event scheduled'}
        </div>
        {tonight?.time && (
          <div style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.sub, marginBottom: 4 }}>
            {tonight.time}
          </div>
        )}
        {tonight?.dress && (
          <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.gold, fontWeight: 600, marginBottom: 4 }}>
            {tonight.dress}
          </div>
        )}
        {tonight?.notes && (
          <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.sub, marginBottom: 6 }}>
            {tonight.notes}
          </div>
        )}
        {tonight?.agenda?.length > 0 && (
          <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 8, paddingTop: 8 }}>
            <Label>Order of Business</Label>
            {tonight.agenda.map((item, i) => (
              <div key={i} style={{
                fontFamily: FONTS.sans,
                fontSize:   12,
                color:      COLORS.text,
                padding:    '2px 0',
                display:    'flex',
                alignItems: 'center',
                gap:        8,
              }}>
                <span style={{ color: COLORS.gold, fontSize: 9 }}>▸</span>
                {item}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Brothers present */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Label>Brothers Present</Label>
            <div style={{
              fontFamily: FONTS.sans,
              fontSize:   38,
              fontWeight: 800,
              color:      COLORS.navy,
              lineHeight: 1,
            }}>
              {attendees?.length ?? 0}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted }}>
              Scan QR to check in
            </div>
          </div>
        </div>
      </Card>

      {/* Up next teaser */}
      {upNext && (
        <Card>
          <Label>Up Next</Label>
          <div style={{ fontFamily: FONTS.serif, fontSize: 16, color: COLORS.navy, fontWeight: 600 }}>
            {upNext.title}
          </div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.sub, marginTop: 2 }}>
            {upNext.date} · {upNext.time}
          </div>
        </Card>
      )}
    </div>
  )
}
