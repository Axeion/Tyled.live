import React, { useState, useEffect, useRef, useCallback } from 'react'
import { COLORS, FONTS } from './theme'
import { Seal, QRCode, ProgressBar } from './components'
import { useClock } from './hooks/useClock'
import { useData } from './hooks/useData'
import HomeSlide from './slides/HomeSlide'
import { WelcomeSlide, EventsSlide, PhotosSlide, AttendeesSlide, MinutesSlide } from './slides/index'

const SLIDE_DURATION   = Number(import.meta.env.VITE_SLIDE_DURATION_MS)   || 9_000
const WELCOME_DURATION = Number(import.meta.env.VITE_WELCOME_DURATION_MS) || 7_000
const CHECKIN_URL      = import.meta.env.VITE_CHECKIN_URL || 'https://mizpah.tyled.live/checkin'

const SLIDES = ['home', 'events', 'photos', 'attendees', 'minutes']

export default function App() {
  const clock = useClock()
  const { tonight, attendees, events, photos, minutes, newCheckin } = useData()

  const [slideIdx,       setSlideIdx]       = useState(0)
  const [animKey,        setAnimKey]        = useState(0)
  const [welcomeActive,  setWelcomeActive]  = useState(false)
  const [currentCheckin, setCurrentCheckin] = useState(null)

  const intervalRef = useRef(null)

  const startRotation = useCallback((startIdx = 0) => {
    clearInterval(intervalRef.current)
    setSlideIdx(startIdx)
    setAnimKey(k => k + 1)
    intervalRef.current = setInterval(() => {
      setSlideIdx(i => (i + 1) % SLIDES.length)
      setAnimKey(k => k + 1)
    }, SLIDE_DURATION)
  }, [])

  useEffect(() => {
    startRotation(0)
    return () => clearInterval(intervalRef.current)
  }, [startRotation])

  // Fire welcome slide on new check-in
  useEffect(() => {
    if (!newCheckin) return
    clearInterval(intervalRef.current)
    setCurrentCheckin(newCheckin)
    setWelcomeActive(true)
    setAnimKey(k => k + 1)
    const t = setTimeout(() => {
      setWelcomeActive(false)
      startRotation(0)
    }, WELCOME_DURATION)
    return () => clearTimeout(t)
  }, [newCheckin, startRotation])

  const currentSlide = SLIDES[slideIdx]

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      width:          '100vw',
      height:         '100vh',
      background:     '#0a0a0a',
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Portrait 9:16 shell */}
      <div style={{
        aspectRatio: '9 / 16',
        height:      'min(100vh, calc(100vw * 16 / 9))',
        background:  COLORS.bg,
        display:     'flex',
        flexDirection: 'column',
        overflow:    'hidden',
        position:    'relative',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: COLORS.navy,
          padding:    '12px 20px',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          position:   'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Seal size={30} color={COLORS.goldLt} />
            <div>
              <div style={{ fontFamily: FONTS.serif, fontSize: 14, fontWeight: 700, color: '#fff' }}>
                Mizpah Lodge No. 148
              </div>
              <div style={{ fontFamily: FONTS.sans, fontSize: 9, color: COLORS.goldLt, letterSpacing: '0.08em' }}>
                F&amp;AM · Omaha, Nebraska
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily:    FONTS.sans,
              fontWeight:    800,
              fontSize:      22,
              color:         '#fff',
              lineHeight:    1,
              letterSpacing: '-0.5px',
            }}>
              {clock.h}:{clock.min}
            </div>
            <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.goldLt }}>
              {clock.ampm}
            </div>
          </div>
          <ProgressBar
            dur={welcomeActive ? WELCOME_DURATION : SLIDE_DURATION}
            animKey={animKey}
          />
        </div>

        {/* ── Slide area ── */}
        <div
          key={animKey}
          style={{
            flex:      1,
            overflow:  'hidden',
            padding:   '16px 18px',
            animation: 'fadeUp 0.35s ease forwards',
          }}
        >
          {welcomeActive ? (
            <WelcomeSlide checkin={currentCheckin} />
          ) : currentSlide === 'home' ? (
            <HomeSlide tonight={tonight} attendees={attendees} events={events} clock={clock} />
          ) : currentSlide === 'events' ? (
            <EventsSlide events={events} />
          ) : currentSlide === 'photos' ? (
            <PhotosSlide photos={photos} />
          ) : currentSlide === 'attendees' ? (
            <AttendeesSlide attendees={attendees} />
          ) : (
            <MinutesSlide minutes={minutes} />
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          background: COLORS.navy,
          padding:    '8px 20px',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ textAlign: 'center' }}>
            <QRCode size={58} url={CHECKIN_URL} />
            <div style={{ fontFamily: FONTS.sans, fontSize: 8, color: COLORS.goldLt, marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Check In
            </div>
          </div>

          {/* Slide dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {SLIDES.map((_, i) => (
              <div key={i} style={{
                width:      6,
                height:     6,
                borderRadius: '50%',
                background: (!welcomeActive && i === slideIdx) ? COLORS.goldLt : 'rgba(255,255,255,0.22)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: FONTS.sans, fontSize: 8, color: COLORS.goldLt, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Powered by
            </div>
            <div style={{ fontFamily: FONTS.serif, fontSize: 13, color: '#fff', fontWeight: 700 }}>
              Tyled
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
