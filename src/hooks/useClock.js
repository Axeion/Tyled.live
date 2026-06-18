import { useState, useEffect } from 'react'

export function useClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const h      = now.getHours() % 12 || 12
  const min    = String(now.getMinutes()).padStart(2, '0')
  const ampm   = now.getHours() < 12 ? 'AM' : 'PM'
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return { now, h, min, ampm, dateStr }
}
