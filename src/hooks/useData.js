import { useState, useEffect, useRef } from 'react'

const BASE = import.meta.env.VITE_N8N_BASE_URL || 'https://n8n.stationmind.cloud'

const DEFAULTS = {
  tonight: {
    title:   'Stated Communication',
    type:    'STATED',
    time:    '7:30 PM',
    dress:   'Business Attire',
    agenda:  ['Opening', 'Reading of Minutes', 'Correspondence', 'Bills', 'Closing'],
    notes:   '',
    weather: null,
  },
  attendees: [],
  events:    [],
  photos:    [],
  minutes: {
    meeting:   '',
    motions:   [],
    funds:     [],
    notes:     [],
    parsedAt:  null,
    postedBy:  null,
  },
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch {
    return null
  }
}

const DEFAULT_SLIDES = { home: true, events: true, photos: true, attendees: true, minutes: true }

export function useData() {
  const [tonight,    setTonight]   = useState(DEFAULTS.tonight)
  const [attendees,  setAttendees] = useState(DEFAULTS.attendees)
  const [events,     setEvents]    = useState(DEFAULTS.events)
  const [photos,     setPhotos]    = useState(DEFAULTS.photos)
  const [minutes,    setMinutes]   = useState(DEFAULTS.minutes)
  const [newCheckin, setNewCheckin] = useState(null)
  const [slideConfig, setSlideConfig] = useState(DEFAULT_SLIDES)

  const prevLenRef = useRef(0)

  // Tonight's event — 30s
  useEffect(() => {
    const poll = async () => {
      const data = await fetchJSON(`${BASE}/webhook/tyled/tonight`)
      if (data) setTonight(data)
    }
    poll()
    const id = setInterval(poll, 30_000)
    return () => clearInterval(id)
  }, [])

  // Attendees — 8s, also triggers welcome slide on new arrival
  useEffect(() => {
    const poll = async () => {
      const data = await fetchJSON(`${BASE}/webhook/tyled/attendees`)
      if (data && Array.isArray(data)) {
        if (data.length > prevLenRef.current) {
          setNewCheckin(data[data.length - 1])
        }
        prevLenRef.current = data.length
        setAttendees(data)
      }
    }
    poll()
    const id = setInterval(poll, 8_000)
    return () => clearInterval(id)
  }, [])

  // Upcoming events — 5 min
  useEffect(() => {
    const poll = async () => {
      const data = await fetchJSON(`${BASE}/webhook/tyled/events`)
      if (data && Array.isArray(data)) setEvents(data)
    }
    poll()
    const id = setInterval(poll, 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  // Facebook photos — 5 min
  useEffect(() => {
    const poll = async () => {
      const data = await fetchJSON(`${BASE}/webhook/tyled/photos`)
      if (data && Array.isArray(data)) setPhotos(data)
    }
    poll()
    const id = setInterval(poll, 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  // Meeting minutes — 60s
  useEffect(() => {
    const poll = async () => {
      const data = await fetchJSON(`${BASE}/webhook/tyled/minutes`)
      if (data) setMinutes(data)
    }
    poll()
    const id = setInterval(poll, 60_000)
    return () => clearInterval(id)
  }, [])

  // Slide config — 5 min (admin-controlled)
  useEffect(() => {
    const poll = async () => {
      const data = await fetchJSON(`${BASE}/webhook/tyled/config`)
      if (data?.slides) setSlideConfig(data.slides)
    }
    poll()
    const id = setInterval(poll, 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  return { tonight, attendees, events, photos, minutes, newCheckin, slideConfig }
}
