/* ══════════════════════════════════════════════════
   PREMIUM / LICENSE SYSTEM
   ══════════════════════════════════════════════════ */

// Add valid codes here. Codes are stored hashed so they aren't
// readable in plain text in localStorage.
const VALID_CODES = ['CORD-2024-PREM', 'KORD-ALPHA-001', 'IBA-UNLOCK-777']

function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0
  return h.toString(16)
}

function isPremium() {
  return localStorage.getItem('premium_unlocked') === '1'
}

function tryUnlock(code) {
  const trimmed = code.trim().toUpperCase()
  if (VALID_CODES.map(c => c.toUpperCase()).includes(trimmed)) {
    localStorage.setItem('premium_unlocked', '1')
    localStorage.setItem('premium_code_hash', hashCode(trimmed))
    return true
  }
  return false
}

function updatePremiumUI() {
  const unlocked = isPremium()
  // Premium page status banner
  document.getElementById('premiumStatus').classList.toggle('hidden', !unlocked)
  document.getElementById('redeemBox').classList.toggle('hidden', unlocked)
  document.getElementById('pricingCard').classList.toggle('unlocked', unlocked)
  // Nav badge
  document.querySelectorAll('.nav-link--premium').forEach(el => {
    el.classList.toggle('unlocked', unlocked)
    el.textContent = unlocked ? '✓ Premium' : '⭐ Premium'
  })
  // TTS buttons visibility
  document.querySelectorAll('.tts-btn').forEach(btn => {
    btn.classList.toggle('tts-locked', !unlocked)
  })
  // Saved/history buttons
  document.querySelectorAll('.btn-save').forEach(btn => {
    btn.classList.toggle('tts-locked', !unlocked)
  })
}

/* ── Premium Gate Modal ── */
function openPremiumModal(featureName) {
  document.getElementById('gateBody').textContent =
    `"${featureName}" is a premium feature. Unlock once for ₱99 to access all premium features.`
  document.getElementById('premiumModal').classList.add('open')
  document.body.style.overflow = 'hidden'
}
function closePremiumModal() {
  document.getElementById('premiumModal').classList.remove('open')
  document.body.style.overflow = ''
}
document.getElementById('premiumModalClose').addEventListener('click', closePremiumModal)
document.getElementById('premiumModal').addEventListener('click', e => {
  if (e.target === document.getElementById('premiumModal')) closePremiumModal()
})

/* ── Redeem code ── */
document.getElementById('redeemBtn').addEventListener('click', () => {
  const code = document.getElementById('redeemInput').value
  const err  = document.getElementById('redeemError')
  if (tryUnlock(code)) {
    err.classList.add('hidden')
    document.getElementById('redeemInput').value = ''
    updatePremiumUI()
  } else {
    err.classList.remove('hidden')
  }
})
document.getElementById('redeemInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('redeemBtn').click()
})


/* ══════════════════════════════════════════════════
   AUDIO ENGINE — Recorded m4a (primary) + TTS (fallback)
   ══════════════════════════════════════════════════ */
const tts = window.speechSynthesis
let ttsVoices = []
let ttsSpeakingBtn = null
let currentAudio = null   // active HTMLAudioElement, if any

function ttsLoadVoices() { ttsVoices = tts ? tts.getVoices() : [] }
if (tts) {
  ttsLoadVoices()
  if (tts.onvoiceschanged !== undefined) tts.onvoiceschanged = ttsLoadVoices
}

function ttsBestVoice() {
  return ttsVoices.find(v => v.lang === 'ms-MY')
      || ttsVoices.find(v => v.lang.startsWith('ms'))
      || ttsVoices.find(v => v.lang === 'id-ID')
      || ttsVoices.find(v => v.lang.startsWith('id'))
      || null
}

function ttsStopBtn() {
  if (ttsSpeakingBtn) { ttsSpeakingBtn.classList.remove('tts-speaking'); ttsSpeakingBtn = null }
}

/* Build the expected m4a path for a Kankanaey word.
   Filenames match the word exactly but lowercased, spaces URL-encoded.
   e.g. "Gawis AY agew" -> pronunciations/gawis%20ay%20agew.m4a */
function m4aPath(word) {
  const safeWord = word
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '_'); // replace invalid filename chars
  return `pronunciations/${safeWord}.m4a`;
}
/* Stop any currently playing audio (recorded or TTS) */
function stopAll() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  if (tts && tts.speaking) tts.cancel()
  ttsStopBtn()
}

/* Speak via Web Speech API (TTS fallback) */
function speakTTS(word, btn) {
  if (!tts) { ttsStopBtn(); return }
  const utt   = new SpeechSynthesisUtterance(word)
  const voice = ttsBestVoice()
  utt.lang    = voice ? voice.lang : 'ms-MY'
  if (voice) utt.voice = voice
  utt.rate  = 0.85
  utt.pitch = 1
  btn.classList.add('tts-speaking')
  ttsSpeakingBtn = btn
  utt.onend   = ttsStopBtn
  utt.onerror = ttsStopBtn
  tts.speak(utt)
}

function ttsSpeak(word, btn) {
  if (!isPremium()) { openPremiumModal('Audio Pronunciation'); return }

  // Toggle off if already playing this button
  if (ttsSpeakingBtn === btn) { stopAll(); return }
  stopAll()

  // Only attempt m4a for Kankanaey words (recorded files are Kankanaey)
  const isKankanaey = currentLang === 'kankanaey' ||
    (typeof wordsLang !== 'undefined' && wordsLang === 'kankanaey') ||
    kankanaeyData.some(d => d.word === word)

  if (isKankanaey) {
    const audio = new Audio(m4aPath(word))
    currentAudio = audio
    btn.classList.add('tts-speaking')
    ttsSpeakingBtn = btn

    audio.onended = () => {
      currentAudio = null
      ttsStopBtn()
    }
    audio.onerror = () => {
      // m4a not found or failed — fall back to TTS
      currentAudio = null
      ttsStopBtn()
      speakTTS(word, btn)
    }

    audio.play().catch(() => {
      // play() rejected (e.g. file missing) — fall back to TTS
      currentAudio = null
      ttsStopBtn()
      speakTTS(word, btn)
    })
  } else {
    // Ibaloi or unknown — use TTS directly
    speakTTS(word, btn)
  }
}

const TTS_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`
const LOCK_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`
const SAVE_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>`

function ttsButton(word, extraClass='') {
  const safe    = (word || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')
  const locked  = !isPremium()
  const lockCls = locked ? ' tts-locked' : ''
  const title   = locked ? 'Premium: Audio Pronunciation' : 'Hear pronunciation'
  return `<button class="tts-btn${extraClass ? ' '+extraClass : ''}${lockCls}" title="${title}" onclick="event.stopPropagation();ttsSpeak('${safe}',this)">${locked ? LOCK_ICON : TTS_ICON}</button>`
}

function saveButton(word, extraClass='') {
  const safe    = (word || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')
  const locked  = !isPremium()
  const saved   = isWordSaved(word)
  const lockCls = locked ? ' tts-locked' : ''
  const savCls  = saved  ? ' btn-save--saved' : ''
  const title   = locked ? 'Premium: Saved Words' : (saved ? 'Remove from saved' : 'Save word')
  return `<button class="btn-save${extraClass ? ' '+extraClass : ''}${lockCls}${savCls}" title="${title}" onclick="event.stopPropagation();toggleSaveWord('${safe}',this)">${SAVE_ICON}</button>`
}


/* ══════════════════════════════════════════════════
   WORD HISTORY (premium)
   ══════════════════════════════════════════════════ */
const HISTORY_KEY = 'word_history'
const SAVED_KEY   = 'saved_words'
const MAX_HISTORY = 30

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}
function addToHistory(item) {
  if (!isPremium()) return
  let hist = getHistory()
  hist = hist.filter(h => h.word !== item.word || h.lang !== item.lang)
  hist.unshift({ word: item.word, english: (item.english||'').trim(), lang: item.lang || '', ts: Date.now() })
  if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist))
}

function getSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') } catch { return [] }
}
function isWordSaved(word) {
  return getSaved().some(s => s.word === word)
}
function toggleSaveWord(word, btn) {
  if (!isPremium()) { openPremiumModal('Saved Words'); return }
  let saved = getSaved()
  if (isWordSaved(word)) {
    saved = saved.filter(s => s.word !== word)
    btn.classList.remove('btn-save--saved')
    btn.title = 'Save word'
    // Also update any other save buttons for this word on the page
    document.querySelectorAll('.btn-save').forEach(b => {
      if (b !== btn && b.title !== 'Premium: Saved Words') {
        b.classList.remove('btn-save--saved')
      }
    })
  } else {
    // Find english translation from either dictionary
    const dictItem = [...kankanaeyData, ...ibaloidata].find(d => d.word === word)
    const english  = dictItem ? getEnglish(dictItem) : ''
    saved.unshift({ word, english, ts: Date.now() })
    btn.classList.add('btn-save--saved')
    btn.title = 'Remove from saved'
  }
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved))
}


/* ══════════════════════════════════════════════════
   DICTIONARY DATA & CORE STATE
   ══════════════════════════════════════════════════ */
let kankanaeyData = []
let ibaloidata    = []
let currentLang   = 'kankanaey'
let currentMode   = 'native'
let wordsLang     = 'kankanaey'
let wordsFiltered = []
let wordsSort     = { col: 'word', dir: 'asc' }
let wordsPage     = 1
const PAGE_SIZE   = 50
let activeAlpha   = null
let sortListenersAttached = false

Promise.all([
  fetch('kankanaey_dictionary.json').then(r => r.json()).catch(() => []),
  fetch('ibaloi_dictionary.json').then(r => r.json()).catch(() => [])
]).then(([kan, iba]) => {
  kankanaeyData = kan
  ibaloidata    = iba
  renderWordsPage()
})

function getEnglish(item)     { return (item.english || '').trim() }
function activeDictionary()   { return currentLang === 'kankanaey' ? kankanaeyData : ibaloidata }
function wordsDict()          { return wordsLang   === 'kankanaey' ? kankanaeyData : ibaloidata }


/* ══════════════════════════════════════════════════
   PAGE SWITCHING
   ══════════════════════════════════════════════════ */
function showPage(pageId) {
  // Close Bootstrap navbar collapse on mobile
  const bsCollapse = document.getElementById('bsNavLinks')
  if (bsCollapse && bsCollapse.classList.contains('show')) {
    const bsInstance = bootstrap.Collapse.getInstance(bsCollapse)
    if (bsInstance) bsInstance.hide()
  }

  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === pageId)
  })
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active')
    p.style.opacity = ''
    p.style.transform = ''
    p.style.display = ''
  })

  document.getElementById('page-' + pageId).classList.add('active')

  if (pageId === 'words')   renderWordsPage()
  if (pageId === 'premium') updatePremiumUI()
  if (pageId === 'library') renderLibraryPage()
}


/* ══════════════════════════════════════════════════
   SEARCH
   ══════════════════════════════════════════════════ */
function search(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const dict = activeDictionary()
  if (currentMode === 'native') return dict.filter(item => (item.word||'').toLowerCase().includes(q))
  return dict.filter(item => getEnglish(item).toLowerCase().includes(q))
}

function highlight(text, query) {
  if (!text||!query) return text||''
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
}

function buildCrossRefs(english, isKan) {
  const otherData  = isKan ? ibaloidata : kankanaeyData
  const otherLabel = isKan ? 'Ibaloi' : 'Kankanaey'

  const STOP = new Set(['a','an','the','to','of','in','on','at','by','or','and','be','is','as'])
  const splitTerms = str => str.toLowerCase().split(/[;,]/).map(s => s.trim()).filter(Boolean)
  const sigWords   = term => term.split(/\s+/).filter(w => w.length > 2 && !STOP.has(w))
  const englishTerms = splitTerms(english)

  const seen = new Set()
  const matches = otherData.filter(other => {
    const otherTerms = splitTerms(getEnglish(other))
    const hasOverlap = englishTerms.some(term => {
      if (otherTerms.some(ot => ot === term)) return true
      const termWords = sigWords(term)
      if (!termWords.length) return false
      return otherTerms.some(ot => {
        const otWords = sigWords(ot)
        if (!otWords.length) return false
        const [shorter, longer] = termWords.length <= otWords.length
          ? [termWords, otWords] : [otWords, termWords]
        return shorter.every(w => longer.some(lw => lw === w))
      })
    })
    if (hasOverlap && !seen.has(other.word)) { seen.add(other.word); return true }
    return false
  })

  if (!matches.length) return ''
  const crossCards = matches.slice(0, 3).map(m => {
    const mWord = m.word || ''
    const mPos  = m.part_of_speech || ''
    const mTag  = m.tagalog || ''
    return `<div class="cross-card">
      <span class="cross-lang">${otherLabel}</span>
      <span class="cross-word">${mWord}</span>
      ${mPos ? `<span class="cross-detail">${mPos}</span>` : ''}
      ${mTag ? `<span class="cross-detail">• ${mTag} (Tagalog)</span>` : ''}
    </div>`
  }).join('')
  return `<div class="cross-refs"><div class="cross-refs-title">Also in ${otherLabel}</div>${crossCards}</div>`
}

function renderResults(results, query) {
  const div = document.getElementById('result')
  if (!results.length) {
    div.innerHTML = `<div class="no-result"><div class="nr-icon">📖</div><p>No results found for <strong>"${query}"</strong></p></div>`
    return
  }

  let html = `<div class="result-count"><span>${results.length}</span> result${results.length !== 1 ? 's' : ''} found</div>`

  results.forEach(item => {
    const word      = item.word || ''
    const english   = getEnglish(item)
    const tagalog   = item.tagalog || ''
    const pos       = item.part_of_speech || ''
    const isKan     = currentLang === 'kankanaey'
    const cardClass = isKan ? 'kankanaey-card' : 'ibaloi-card'
    const posClass  = isKan ? 'sage' : 'rust'
    const langLabel = isKan ? 'Kankanaey' : 'Ibaloi'
    const hlWord    = currentMode === 'native'  ? highlight(word, query)    : word
    const hlEnglish = currentMode === 'english' ? highlight(english, query) : english
    const crossHtml = buildCrossRefs(english, isKan)

    // Track history
    addToHistory({ word, english, lang: langLabel })

    html += `<div class="result-card ${cardClass}">
      <div class="card-word-row">
        <div class="card-word">${hlWord}</div>
        <div class="card-word-actions">
          ${ttsButton(word)}
          ${saveButton(word)}
        </div>
      </div>
      ${pos ? `<span class="card-pos ${posClass}">${pos}</span>` : ''}
      <div class="card-fields">
        <div class="card-field"><span class="field-label">English</span><span>${hlEnglish}</span></div>
        ${tagalog ? `<div class="card-field"><span class="field-label">Tagalog</span><span>${tagalog}</span></div>` : ''}
        <div class="card-field"><span class="field-label">Language</span><span>${langLabel}</span></div>
      </div>
      ${crossHtml}
    </div>`
  })

  div.innerHTML = html
}

function showSuggestions(query) {
  const sugDiv = document.getElementById('suggestions')
  if (!query) { sugDiv.classList.add('hidden'); return }
  const matches = search(query).slice(0, 6)
  if (!matches.length) { sugDiv.classList.add('hidden'); return }
  sugDiv.innerHTML = matches.map(item => {
    const word    = item.word || ''
    const english = getEnglish(item)
    const hlWord    = currentMode === 'native'  ? highlight(word, query)    : word
    const hlEnglish = currentMode === 'english' ? highlight(english, query) : english
    return `<div class="suggestion-item"
      data-word="${word.replace(/"/g,'&quot;')}"
      data-english="${english.replace(/"/g,'&quot;')}">
      <span class="sug-word">${currentMode === 'native' ? hlWord : hlEnglish}</span>
      <span class="sug-english">${currentMode === 'native' ? english : word}</span>
    </div>`
  }).join('')
  sugDiv.classList.remove('hidden')
  sugDiv.querySelectorAll('.suggestion-item').forEach(el => {
    el.addEventListener('click', () => {
      const val = currentMode === 'native' ? el.dataset.word : el.dataset.english
      document.getElementById('wordInput').value = val
      sugDiv.classList.add('hidden')
      doSearch(val)
    })
  })
}

function doSearch(queryOverride) {
  const query = (queryOverride !== undefined
    ? queryOverride
    : document.getElementById('wordInput').value
  ).trim()
  document.getElementById('suggestions').classList.add('hidden')
  if (!query) return
  renderResults(search(query), query)
}

document.getElementById('searchBtn').addEventListener('click', () => doSearch())
document.getElementById('wordInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch() })
document.getElementById('wordInput').addEventListener('input', e => showSuggestions(e.target.value))

document.querySelectorAll('.lang-tab[data-lang]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lang-tab[data-lang]').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    currentLang = tab.dataset.lang
    document.getElementById('result').innerHTML = ''
    document.getElementById('wordInput').value = ''
    document.getElementById('suggestions').classList.add('hidden')
  })
})

document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    currentMode = tab.dataset.mode
    document.getElementById('result').innerHTML = ''
    document.getElementById('wordInput').value = ''
    document.getElementById('suggestions').classList.add('hidden')
    document.getElementById('wordInput').placeholder = currentMode === 'native'
      ? 'Type a native word…' : 'Type an English word…'
  })
})


/* ══════════════════════════════════════════════════
   WORD LIST
   ══════════════════════════════════════════════════ */
function posClass(pos) {
  const p = (pos||'').toLowerCase()
  if (p.includes('noun'))      return 'pos-noun'
  if (p.includes('verb'))      return 'pos-verb'
  if (p.includes('adj'))       return 'pos-adjective'
  if (p.includes('adv'))       return 'pos-adverb'
  return 'pos-other'
}

function buildAlpha() {
  const dict    = wordsDict()
  const letters = [...new Set(dict.map(item => (item.word||'')[0]?.toUpperCase()).filter(Boolean))]
  const container = document.getElementById('alphaScroll')
  container.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l =>
    `<button class="alpha-btn ${letters.includes(l) ? '' : 'disabled'}" data-alpha="${l}">${l}</button>`
  ).join('')
  container.querySelectorAll('.alpha-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const letter = btn.dataset.alpha
      if (activeAlpha === letter) {
        activeAlpha = null; btn.classList.remove('active')
      } else {
        container.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active'); activeAlpha = letter
      }
      wordsPage = 1; applyWordsFilter()
    })
  })
}

function applyWordsFilter() {
  const query = (document.getElementById('wordsFilter').value || '').trim().toLowerCase()
  const dict  = wordsDict()
  wordsFiltered = dict.filter(item => {
    const word    = (item.word || '').toLowerCase()
    const english = getEnglish(item).toLowerCase()
    const tagalog = (item.tagalog || '').toLowerCase()
    const matchesText  = !query || word.includes(query) || english.includes(query) || tagalog.includes(query)
    const matchesAlpha = !activeAlpha || (item.word||'')[0].toUpperCase() === activeAlpha
    return matchesText && matchesAlpha
  })
  wordsFiltered.sort((a, b) => {
    let va, vb
    if (wordsSort.col === 'english')             { va = getEnglish(a);        vb = getEnglish(b) }
    else if (wordsSort.col === 'part_of_speech') { va = a.part_of_speech||''; vb = b.part_of_speech||'' }
    else                                         { va = a.word||'';           vb = b.word||'' }
    va = va.toLowerCase(); vb = vb.toLowerCase()
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return wordsSort.dir === 'asc' ? cmp : -cmp
  })
  renderWordsTable(); renderPagination(); updateStats()
}

function renderWordsTable() {
  const start = (wordsPage - 1) * PAGE_SIZE
  const slice = wordsFiltered.slice(start, start + PAGE_SIZE)
  const query = (document.getElementById('wordsFilter').value || '').trim()
  const tbody = document.getElementById('wordsBody')

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">No words found.</td></tr>`
    return
  }

  tbody.innerHTML = slice.map(item => {
    const word    = item.word || ''
    const english = getEnglish(item)
    const tagalog = item.tagalog || ''
    const pos     = item.part_of_speech || ''
    const hlWord    = query ? highlight(word, query)    : word
    const hlEnglish = query ? highlight(english, query) : english
    return `<tr>
      <td class="td-word"><div class="td-word-cell">${hlWord}${ttsButton(word)}</div></td>
      <td class="td-english">${hlEnglish}</td>
      <td class="td-tagalog">${tagalog}</td>
      <td><span class="td-pos ${posClass(pos)}">${pos || '—'}</span></td>
    </tr>`
  }).join('')

  tbody.querySelectorAll('tr').forEach((row, i) => {
    row.addEventListener('click', () => openWordModal(slice[i]))
  })
}

function renderPagination() {
  const total = Math.ceil(wordsFiltered.length / PAGE_SIZE)
  const pg    = document.getElementById('pagination')
  if (total <= 1) { pg.innerHTML = ''; return }
  let html = `<button class="pg-btn" onclick="goPage(${wordsPage-1})" ${wordsPage===1?'disabled':''}>‹</button>`
  const pages = []
  for (let i = 1; i <= total; i++) {
    if (i===1 || i===total || (i >= wordsPage-2 && i <= wordsPage+2)) pages.push(i)
    else if (pages[pages.length-1] !== '…') pages.push('…')
  }
  pages.forEach(p => {
    if (p === '…') html += `<span class="pg-ellipsis">…</span>`
    else html += `<button class="pg-btn ${p===wordsPage?'active':''}" onclick="goPage(${p})">${p}</button>`
  })
  html += `<button class="pg-btn" onclick="goPage(${wordsPage+1})" ${wordsPage===total?'disabled':''}>›</button>`
  html += `<span class="pg-info">Page ${wordsPage} of ${total}</span>`
  pg.innerHTML = html
}

function goPage(p) {
  const total = Math.ceil(wordsFiltered.length / PAGE_SIZE)
  if (p < 1 || p > total) return
  wordsPage = p
  renderWordsTable(); renderPagination()
  document.querySelector('.words-table-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function updateStats() {
  const total = wordsDict().length
  const shown = wordsFiltered.length
  document.getElementById('wordsStats').innerHTML =
    `Showing <strong>${shown.toLocaleString()}</strong> of <strong>${total.toLocaleString()}</strong> entries`
}

function renderWordsPage() {
  buildAlpha(); applyWordsFilter()
  if (!sortListenersAttached) {
    document.querySelectorAll('.words-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col
        if (wordsSort.col === col) wordsSort.dir = wordsSort.dir === 'asc' ? 'desc' : 'asc'
        else { wordsSort.col = col; wordsSort.dir = 'asc' }
        document.querySelectorAll('.words-table th.sortable').forEach(h => h.classList.remove('sort-asc','sort-desc'))
        th.classList.add(wordsSort.dir === 'asc' ? 'sort-asc' : 'sort-desc')
        wordsPage = 1; applyWordsFilter()
      })
    })
    sortListenersAttached = true
  }
}

document.querySelectorAll('.lang-tab[data-wlang]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lang-tab[data-wlang]').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    wordsLang = tab.dataset.wlang; wordsPage = 1; activeAlpha = null
    document.getElementById('wordsFilter').value = ''
    renderWordsPage()
  })
})

document.getElementById('wordsFilter').addEventListener('input', () => {
  wordsPage = 1; activeAlpha = null
  document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'))
  applyWordsFilter()
})


/* ══════════════════════════════════════════════════
   NAV LINKS
   ══════════════════════════════════════════════════ */
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => { e.preventDefault(); showPage(link.dataset.page) })
})


/* ══════════════════════════════════════════════════
   WORD MODAL
   ══════════════════════════════════════════════════ */
function openWordModal(item) {
  const isKan     = wordsLang === 'kankanaey'
  const word      = item.word || ''
  const english   = getEnglish(item)
  const tagalog   = item.tagalog || ''
  const pos       = item.part_of_speech || ''
  const cardClass = isKan ? 'kankanaey-card' : 'ibaloi-card'
  const posClsName= isKan ? 'sage' : 'rust'
  const langLabel = isKan ? 'Kankanaey' : 'Ibaloi'
  const crossHtml = buildCrossRefs(english, isKan)

  addToHistory({ word, english, lang: langLabel })

  document.getElementById('modalContent').innerHTML = `
    <div class="result-card ${cardClass}">
      <div class="card-word-row">
        <div class="card-word">${word}</div>
        <div class="card-word-actions">
          ${ttsButton(word)}
          ${saveButton(word)}
        </div>
      </div>
      ${pos ? `<span class="card-pos ${posClsName}">${pos}</span>` : ''}
      <div class="card-fields">
        <div class="card-field"><span class="field-label">English</span><span>${english}</span></div>
        ${tagalog ? `<div class="card-field"><span class="field-label">Tagalog</span><span>${tagalog}</span></div>` : ''}
        <div class="card-field"><span class="field-label">Language</span><span>${langLabel}</span></div>
      </div>
      ${crossHtml}
    </div>`

  document.getElementById('wordModal').classList.add('open')
  document.body.style.overflow = 'hidden'
}

function closeWordModal() {
  document.getElementById('wordModal').classList.remove('open')
  document.body.style.overflow = ''
  stopAll()
}

document.getElementById('wordModal').addEventListener('click', e => {
  if (e.target === document.getElementById('wordModal')) closeWordModal()
})
document.getElementById('modalClose').addEventListener('click', closeWordModal)
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeWordModal(); closePremiumModal() } })


/* ══════════════════════════════════════════════════
   LIBRARY PAGE (History + Saved Words)
   ══════════════════════════════════════════════════ */
function renderLibraryPage() {
  const gate    = document.getElementById('libraryGate')
  const content = document.getElementById('libraryContent')

  if (!isPremium()) {
    gate.classList.remove('hidden')
    content.classList.add('hidden')
    return
  }
  gate.classList.add('hidden')
  content.classList.remove('hidden')
  renderHistoryList()
  renderSavedList()
}

function renderHistoryList() {
  const hist  = getHistory()
  const el    = document.getElementById('historyList')
  const count = document.getElementById('historyCount')
  count.textContent = hist.length ? `${hist.length} word${hist.length !== 1 ? 's' : ''}` : ''

  if (!hist.length) {
    el.innerHTML = '<div class="lib-empty">&#128218; No history yet. Start searching!</div>'
    return
  }
  el.innerHTML = hist.map((h, i) => `
    <div class="lib-item" onclick="quickLookup('${(h.word||'').replace(/'/g,"\'")}','${h.lang||''}')">
      <div class="lib-item-word">${h.word || ''}</div>
      <div class="lib-item-meta">
        <span class="lib-item-lang">${h.lang || ''}</span>
        ${h.english ? `<span class="lib-item-eng">${h.english}</span>` : ''}
      </div>
      <button class="lib-item-remove" title="Remove" onclick="event.stopPropagation();removeHistory(${i})">&#10005;</button>
    </div>`).join('')
}

function renderSavedList() {
  const saved = getSaved()
  const el    = document.getElementById('savedList')
  const count = document.getElementById('savedCount')
  count.textContent = saved.length ? `${saved.length} word${saved.length !== 1 ? 's' : ''}` : ''

  if (!saved.length) {
    el.innerHTML = '<div class="lib-empty">&#9733; No saved words yet. Tap the bookmark icon on any result!</div>'
    return
  }
  el.innerHTML = saved.map((s, i) => `
    <div class="lib-item" onclick="quickLookup('${(s.word||'').replace(/'/g,"\'")}','')">
      <div class="lib-item-word">${s.word || ''}</div>
      <div class="lib-item-meta">
        <span class="lib-item-eng">${s.english || ''}</span>
      </div>
      <button class="lib-item-remove" title="Remove" onclick="event.stopPropagation();removeSaved(${i})">&#10005;</button>
    </div>`).join('')
}

function removeHistory(i) {
  const hist = getHistory()
  hist.splice(i, 1)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist))
  renderHistoryList()
  document.getElementById('historyCount').textContent =
    hist.length ? `${hist.length} word${hist.length !== 1 ? 's' : ''}` : ''
}

function removeSaved(i) {
  const saved = getSaved()
  saved.splice(i, 1)
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved))
  renderSavedList()
}

function quickLookup(word, lang) {
  // Switch to home, set the right language, search the word
  if (lang) {
    const targetLang = lang.toLowerCase().includes('ibaloi') ? 'ibaloi' : 'kankanaey'
    if (currentLang !== targetLang) {
      currentLang = targetLang
      document.querySelectorAll('.lang-tab[data-lang]').forEach(t =>
        t.classList.toggle('active', t.dataset.lang === targetLang))
    }
  }
  showPage('home')
  document.getElementById('wordInput').value = word
  doSearch(word)
}

// Library tab switching
document.querySelectorAll('.lib-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lib-tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.lib-panel').forEach(p => p.classList.remove('active'))
    tab.classList.add('active')
    document.getElementById('libPanel-' + tab.dataset.libtab).classList.add('active')
  })
})

document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  if (!confirm('Clear all word history?')) return
  localStorage.removeItem(HISTORY_KEY)
  renderHistoryList()
})

document.getElementById('clearSavedBtn').addEventListener('click', () => {
  if (!confirm('Clear all saved words?')) return
  localStorage.removeItem(SAVED_KEY)
  renderSavedList()
})





/* ══════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════ */
updatePremiumUI()
