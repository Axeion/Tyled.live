const BASE        = import.meta.env.VITE_N8N_BASE_URL || 'https://n8n.stationmind.cloud'
const CHECKIN_URL = `${BASE}/webhook/tyled/checkin`
const MEMBERS_URL = `${BASE}/webhook/tyled/members`

// ── State ─────────────────────────────────────────────────────────────────────
let members      = []   // [{ name, role }] from lodge_members
let selectedName = ''
let isGuest      = false

// ── Elements ──────────────────────────────────────────────────────────────────
const nameInput    = document.getElementById('name-input')
const clearBtn     = document.getElementById('clear-btn')
const dropdown     = document.getElementById('dropdown')
const guestRow     = document.getElementById('guest-row')
const guestCheck   = document.getElementById('guest-check')
const guestCheckBox = document.getElementById('guest-check-box')
const btnCheckin   = document.getElementById('btn-checkin')
const errorBanner  = document.getElementById('error-banner')
const screenForm   = document.getElementById('screen-form')
const screenLoad   = document.getElementById('screen-loading')
const screenSuccess = document.getElementById('screen-success')
const successName  = document.getElementById('success-name')
const successRole  = document.getElementById('success-role')
const btnDone      = document.getElementById('btn-done')

// ── Load member list ──────────────────────────────────────────────────────────
async function loadMembers() {
  try {
    const res = await fetch(MEMBERS_URL)
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data)) members = data
  } catch {
    // endpoint not set up yet — input still works as free text
  }
}

// ── Dropdown ──────────────────────────────────────────────────────────────────
function renderDropdown(query) {
  const q = query.trim().toLowerCase()
  dropdown.innerHTML = ''

  if (!q) {
    dropdown.classList.remove('open')
    return
  }

  const matches = members.length
    ? members.filter(m => m.name.toLowerCase().includes(q))
    : []

  if (matches.length === 0 && members.length > 0) {
    dropdown.innerHTML = `<div class="dropdown-empty">No match — use free text or check "I'm a guest"</div>`
    dropdown.classList.add('open')
    return
  }

  if (matches.length === 0) {
    // No member list yet; don't show dropdown — free text mode
    dropdown.classList.remove('open')
    return
  }

  matches.slice(0, 8).forEach(m => {
    const item = document.createElement('div')
    item.className = 'dropdown-item'
    item.innerHTML = `
      <div class="item-avatar">${m.name[0].toUpperCase()}</div>
      <span>${m.name}</span>
      ${m.role ? `<span class="item-role">${m.role}</span>` : ''}
    `
    item.addEventListener('mousedown', e => {
      e.preventDefault()
      selectMember(m.name)
    })
    dropdown.appendChild(item)
  })

  dropdown.classList.add('open')
}

function selectMember(name) {
  nameInput.value  = name
  selectedName     = name
  dropdown.classList.remove('open')
  clearBtn.classList.add('visible')
  updateSubmitState()
}

function closeDropdown() {
  dropdown.classList.remove('open')
}

// ── Input events ──────────────────────────────────────────────────────────────
nameInput.addEventListener('input', () => {
  const val = nameInput.value
  selectedName = val.trim()
  clearBtn.classList.toggle('visible', val.length > 0)
  renderDropdown(val)
  updateSubmitState()
})

nameInput.addEventListener('blur', () => {
  // small delay so mousedown on dropdown item fires first
  setTimeout(closeDropdown, 150)
})

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDropdown()
  if (e.key === 'Enter') {
    closeDropdown()
    if (!btnCheckin.disabled) doCheckin()
  }
})

clearBtn.addEventListener('click', () => {
  nameInput.value = ''
  selectedName    = ''
  clearBtn.classList.remove('visible')
  closeDropdown()
  updateSubmitState()
  nameInput.focus()
})

// ── Guest toggle ──────────────────────────────────────────────────────────────
guestRow.addEventListener('click', () => {
  isGuest = !isGuest
  guestRow.classList.toggle('checked', isGuest)
  updateSubmitState()
})

// ── Submit state ──────────────────────────────────────────────────────────────
function updateSubmitState() {
  const hasName = selectedName.trim().length > 0
  btnCheckin.disabled = !hasName
  btnCheckin.textContent = isGuest
    ? `Check In as Guest`
    : `Check In`
}

// ── Check in ─────────────────────────────────────────────────────────────────
async function doCheckin() {
  const name = selectedName.trim()
  if (!name) return

  errorBanner.classList.remove('visible')
  showScreen('loading')

  try {
    const res = await fetch(CHECKIN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, isGuest }),
    })

    if (!res.ok) throw new Error(`Server returned ${res.status}`)
    const data = await res.json()

    successName.textContent = data.name || name
    const role = data.role && data.role !== 'Brother' ? data.role : ''
    successRole.textContent = role
    successRole.style.display = role ? 'block' : 'none'

    showScreen('success')
  } catch (err) {
    showScreen('form')
    errorBanner.textContent = 'Check-in failed — please try again or see the Secretary.'
    errorBanner.classList.add('visible')
  }
}

btnCheckin.addEventListener('click', doCheckin)

// ── Done button resets form ───────────────────────────────────────────────────
btnDone.addEventListener('click', () => {
  nameInput.value = ''
  selectedName    = ''
  isGuest         = false
  guestRow.classList.remove('checked')
  clearBtn.classList.remove('visible')
  errorBanner.classList.remove('visible')
  updateSubmitState()
  showScreen('form')
  nameInput.focus()
})

// ── Screen switcher ───────────────────────────────────────────────────────────
function showScreen(name) {
  screenForm.style.display    = name === 'form'    ? 'flex'   : 'none'
  screenLoad.style.display    = name === 'loading' ? 'flex'   : 'none'
  screenSuccess.style.display = name === 'success' ? 'flex'   : 'none'
}

// ── Boot ──────────────────────────────────────────────────────────────────────
loadMembers()
showScreen('form')
nameInput.focus()
