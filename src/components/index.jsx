import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { COLORS, FONTS } from '../theme'

export function Card({ children, style, accent = false }) {
  return (
    <div style={{
      background: COLORS.surface,
      border:     `1px solid ${COLORS.border}`,
      borderRadius: 12,
      boxShadow:  `0 2px 12px ${COLORS.shadow}`,
      padding:    '16px 18px',
      borderTop:  accent ? `3px solid ${COLORS.gold}` : undefined,
      ...style,
    }}>
      {children}
    </div>
  )
}

export function Label({ children, color }) {
  return (
    <div style={{
      fontFamily:    FONTS.sans,
      fontSize:      10,
      fontWeight:    700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color:         color || COLORS.gold,
      marginBottom:  6,
    }}>
      {children}
    </div>
  )
}

export function Seal({ size = 40, color }) {
  const c = color || COLORS.navy
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Square — L-shaped, open right and top */}
      <path d="M18 72 L18 38 L52 38" stroke={c} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Left compass leg */}
      <path d="M50 12 L24 74" stroke={c} strokeWidth="6" strokeLinecap="round"/>
      {/* Right compass leg */}
      <path d="M50 12 L76 74" stroke={c} strokeWidth="6" strokeLinecap="round"/>
      {/* Compass arc joining the legs */}
      <path d="M28 64 Q50 84 72 64" stroke={c} strokeWidth="4" strokeLinecap="round" fill="none"/>
      {/* G */}
      <text x="50" y="58" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" fontWeight="bold" fill={c}>G</text>
    </svg>
  )
}

export function QRCode({ size = 120, url }) {
  return (
    <QRCodeSVG
      value={url || 'https://tyled.live'}
      size={size}
      bgColor="transparent"
      fgColor={COLORS.goldLt}
      level="M"
    />
  )
}

export function ProgressBar({ dur, animKey }) {
  return (
    <div style={{
      position:  'absolute',
      bottom:    0,
      left:      0,
      right:     0,
      height:    3,
      background: 'rgba(255,255,255,0.1)',
      overflow:  'hidden',
    }}>
      <div
        key={animKey}
        style={{
          height:     '100%',
          background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.goldLt})`,
          animation:  `tyled-progress ${dur}ms linear forwards`,
        }}
      />
      <style>{`
        @keyframes tyled-progress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  )
}
