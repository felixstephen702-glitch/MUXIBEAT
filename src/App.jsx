import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioLines, Bell, ChevronDown, Disc3, Headphones, Heart, Menu, Mic2, Play,
  Plus, Search, ShoppingBag, SlidersHorizontal, Sparkles, TrendingUp, UploadCloud,
  UserRound, X, Pause, LogIn, LogOut, Check, ShieldCheck, FileAudio, Wallet
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { signInWithGoogle, signOut, getMyProfile, getMarketplaceBeats, createBeatOrder, decideOrder } from './lib/muxiApi'

const genres = ['All Beats', 'Trap', 'R&B', 'Drill', 'Boom Bap', 'Afrobeats']
const demoBeats = [
  { id: 'demo-1', title: 'Purple Skies', producer: 'nox.wav', genre: 'Trap', bpm: 142, key: 'F min', price: 30000, color: 'cover-violet', tag: 'TRENDING', shape: 'orb', demo: true },
  { id: 'demo-2', title: 'After Hours', producer: 'lune', genre: 'R&B', bpm: 94, key: 'C min', price: 25000, color: 'cover-blue', tag: 'NEW', shape: 'moon', demo: true },
  { id: 'demo-3', title: 'No Signal', producer: 'Kairo Beats', genre: 'Drill', bpm: 144, key: 'D# min', price: 35000, color: 'cover-red', tag: 'EXCLUSIVE', shape: 'rings', demo: true },
  { id: 'demo-4', title: 'Velvet Motion', producer: 'mira.wav', genre: 'R&B', bpm: 108, key: 'A min', price: 20000, color: 'cover-pink', tag: '', shape: 'sun', demo: true },
  { id: 'demo-5', title: 'Night Runner', producer: 'synthkid', genre: 'Trap', bpm: 150, key: 'G min', price: 30000, color: 'cover-orange', tag: 'HOT', shape: 'lines', demo: true },
  { id: 'demo-6', title: 'Old Soul', producer: 'roomtone', genre: 'Boom Bap', bpm: 86, key: 'E min', price: 20000, color: 'cover-green', tag: '', shape: 'grain', demo: true },
  { id: 'demo-7', title: 'Moon Taxi', producer: 'sora', genre: 'Afrobeats', bpm: 112, key: 'B min', price: 25000, color: 'cover-cyan', tag: 'NEW', shape: 'moon', demo: true },
  { id: 'demo-8', title: 'Cold World', producer: 'westside.wav', genre: 'Drill', bpm: 140, key: 'F# min', price: 35000, color: 'cover-silver', tag: '', shape: 'rings', demo: true },
]
const artClasses = ['cover-violet', 'cover-blue', 'cover-red', 'cover-pink', 'cover-orange', 'cover-green', 'cover-cyan', 'cover-silver']
const shapes = ['orb', 'moon', 'rings', 'sun', 'lines', 'grain']
const money = (amount) => `${Number(amount || 0).toLocaleString('en-US')} MMK`

function CoverArt({ beat, compact = false }) {
  const color = beat.color || artClasses[(Number(String(beat.id).replace(/\D/g, '').slice(-1)) || 0) % artClasses.length]
  const shape = beat.shape || shapes[(Number(String(beat.id).replace(/\D/g, '').slice(-1)) || 0) % shapes.length]
  return <div className={`cover-art ${color} ${compact ? 'cover-compact' : ''}`}><div className={`art-shape ${shape}`} /><span className="cover-mark">M<span>.</span></span><span className="cover-label">MUXI SOUND LAB</span></div>
}

function App() {
  const [activeGenre, setActiveGenre] = useState('All Beats')
  const [query, setQuery] = useState('')
  const [playingId, setPlayingId] = useState(null)
  const [liked, setLiked] = useState([])
  const [mobileMenu, setMobileMenu] = useState(false)
  const [notice, setNotice] = useState('')
  const [sort, setSort] = useState('Featured')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [beats, setBeats] = useState(demoBeats)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [modal, setModal] = useState('')
  const [selectedBeat, setSelectedBeat] = useState(null)
  const [busy, setBusy] = useState(false)
  const [orders, setOrders] = useState([])
  const [pendingBeats, setPendingBeats] = useState([])
  const [audioUrl, setAudioUrl] = useState('')
  const [paymentType, setPaymentType] = useState('beat_wav')
  const audioRef = useRef(null)

  const showNotice = useCallback((message) => { setNotice(message); window.setTimeout(() => setNotice(''), 3500) }, [])

  const loadMarketplace = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    try {
      const rows = await getMarketplaceBeats()
      const mapped = await Promise.all(rows.map(async (row, i) => {
        let previewUrl = ''
        if (row.preview_path) {
          const { data, error } = await supabase.storage.from('beat-previews').createSignedUrl(row.preview_path, 3600)
          console.log('PREVIEW PATH:', row.preview_path)
console.log('PREVIEW URL ERROR:', error)
console.log('PREVIEW URL DATA:', data)
          previewUrl = error ?'' :(data?.signedUrl || '')
        }
        const { data: producer } = await supabase.from('profiles').select('display_name').eq('id', row.producer_id).maybeSingle()
        return { ...row, key: row.musical_key || 'Key N/A', price: row.beat_price_mmk, producer: producer?.display_name || 'Independent Producer', previewUrl, color: artClasses[i % artClasses.length], shape: shapes[i % shapes.length], tag: row.sold_out ? 'SOLD OUT' : '' }
      }))
      setBeats(mapped)
    } catch (error) {
      showNotice(`Supabase ချိတ်ဆက်မှု မအောင်မြင်ပါ: ${error.message || 'Settings/RLS ကို စစ်ပါ။'}`)
    } finally { setLoading(false) }
  }, [showNotice])

  const loadWorkspace = useCallback(async (currentUser, currentProfile) => {
    if (!supabase || !currentUser || !currentProfile) return
    try {
      if (currentProfile.role === 'producer' || currentProfile.role === 'admin') {
        let orderQuery = supabase.from('orders').select('*, beats(title)').in('status', ['payment_pending', 'reviewing']).order('created_at', { ascending: false })
        if (currentProfile.role !== 'admin') orderQuery = orderQuery.eq('producer_id', currentUser.id)
        const { data, error } = await orderQuery
        if (error) throw error
        setOrders(data || [])
      }
      if (currentProfile.role === 'admin') {
        const { data, error } = await supabase.from('beats').select('*, producer:profiles!beats_producer_id_fkey(display_name)').eq('review_status', 'pending').order('created_at', { ascending: true })
        if (error) throw error
        setPendingBeats(data || [])
      }
    } catch (error) { showNotice(`Dashboard ကို မဖတ်နိုင်ပါ: ${error.message}`) }
  }, [showNotice])

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      const currentUser = data.session?.user || null
      setUser(currentUser)
      if (currentUser) {
        try { const p = await getMyProfile(); if (active) { setProfile(p); await loadWorkspace(currentUser, p) } }
        catch (error) { showNotice(`Profile မဖတ်နိုင်ပါ: ${error.message}`) }
      }
      if (active) await loadMarketplace()
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null
      setUser(currentUser)
      if (!currentUser) { setProfile(null); setOrders([]); setPendingBeats([]); }
      else setTimeout(async () => {
        try { const p = await getMyProfile(); setProfile(p); await loadWorkspace(currentUser, p) }
        catch (error) { showNotice(`Profile မဖတ်နိုင်ပါ: ${error.message}`) }
      }, 0)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [loadMarketplace, loadWorkspace, showNotice])

  const filtered = useMemo(() => {
    let list = beats.filter((beat) => {
      const matchesGenre = activeGenre === 'All Beats' || beat.genre === activeGenre
      const q = query.trim().toLowerCase()
      const matchesQuery = !q || `${beat.title} ${beat.producer} ${beat.genre} ${beat.key}`.toLowerCase().includes(q)
      return matchesGenre && matchesQuery
    })
    if (sort === 'Price: Low to High') list = [...list].sort((a, b) => a.price - b.price)
    if (sort === 'BPM: Low to High') list = [...list].sort((a, b) => (a.bpm || 0) - (b.bpm || 0))
    return list
  }, [activeGenre, beats, query, sort])

  const toggleLike = (id) => setLiked((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
  const playBeat = async (beat) => {
    if (!beat.previewUrl) { showNotice(beat.demo ? 'ဒီ beat က Demo ဖြစ်လို့ audio preview မပါသေးပါ။' : 'ဒီ beat အတွက် Preview audio မတင်ရသေးပါ။'); return }
    if (playingId === beat.id) { audioRef.current?.pause(); setPlayingId(null); return }
    setAudioUrl(beat.previewUrl); setPlayingId(beat.id)
    setTimeout(() => { if (audioRef.current) audioRef.current.play().catch(() => showNotice('Preview ဖွင့်မရပါ။ Audio file နဲ့ Storage permission ကို စစ်ပါ။')) }, 0)
  }
  const handleLogin = async () => { try { setBusy(true); const { error } = await signInWithGoogle(); if (error) throw error } catch (e) { showNotice(e.message || 'Google Login မအောင်မြင်ပါ။') } finally { setBusy(false) } }
  const handleLogout = async () => { try { await signOut(); showNotice('Logout လုပ်ပြီးပါပြီ။') } catch (e) { showNotice(e.message) } }

  const uploadBeat = async (event) => {
    event.preventDefault()
    if (!supabase || !user) return showNotice('Google Account နဲ့ Login အရင်ဝင်ပါ။')
    if (!['producer', 'admin'].includes(profile?.role)) return showNotice('Beat တင်ရန် Admin က Producer role ပေးထားဖို့ လိုပါတယ်။')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const title = String(form.get('title') || '').trim()
    const genre = String(form.get('genre') || 'Other')
    const bpm = Number(form.get('bpm')) || null
    const musicalKey = String(form.get('musical_key') || '').trim()
    const description = String(form.get('description') || '').trim()
    const beatPrice = Number(form.get('beat_price_mmk'))
    const stemPrice = Number(form.get('stem_price_mmk')) || null
    const preview = form.get('preview_file')
    const wav = form.get('wav_file')
    const stems = form.get('stem_file')
    if (!title || !wav?.size || !preview?.size || !beatPrice) return showNotice('Title, Preview Audio, WAV ဖိုင်နဲ့ စျေးနှုန်းကို ဖြည့်ပါ။')
    try {
      setBusy(true)
      const safeName = (f) => `${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const previewPath = `${user.id}/${safeName(preview)}`
      const wavPath = `${user.id}/${safeName(wav)}`
      const { error: previewErr } = await supabase.storage.from('beat-previews').upload(previewPath, preview, { upsert: false, contentType: preview.type || 'audio/mpeg' })
      if (previewErr) throw previewErr
      const { error: wavErr } = await supabase.storage.from('beat-files').upload(wavPath, wav, { upsert: false, contentType: wav.type || 'audio/wav' })
      if (wavErr) throw wavErr
      let stemPath = null
      if (stems?.size) {
        stemPath = `${user.id}/${safeName(stems)}`
        const { error } = await supabase.storage.from('beat-files').upload(stemPath, stems, { upsert: false, contentType: stems.type || 'application/zip' })
        if (error) throw error
      }
      const { error } = await supabase.from('beats').insert({ producer_id: user.id, title, genre, bpm, musical_key: musicalKey || null, description: description || null, preview_path: previewPath, wav_path: wavPath, stem_zip_path: stemPath, beat_price_mmk: beatPrice, stem_price_mmk: stemPath ? stemPrice : null, review_status: 'pending', sold_out: false })
      if (error) throw error
      setModal(''); formElement.reset(); showNotice('Beat တင်ပြီးပါပြီ။ Admin approve လုပ်ပြီးမှ Marketplace မှာပေါ်ပါမယ်။')
      await loadMarketplace(); await loadWorkspace(user, profile)
    } catch (e) { showNotice(`Beat Upload မအောင်မြင်ပါ: ${e.message}`) } finally { setBusy(false) }
  }

  const startPurchase = (beat) => {
    if (beat.demo) return showNotice('ဒီ Beat က Demo item ဖြစ်ပါတယ်။ ကိုယ်ပိုင် beat တွေတင်ပြီးမှ ဝယ်ယူနိုင်ပါမယ်။')
    if (!user) return showNotice('ဝယ်ယူရန် Google Account နဲ့ Login အရင်ဝင်ပါ။')
    if (beat.sold_out) return showNotice('ဒီ beat ရောင်းပြီးသွားပါပြီ။')
    setSelectedBeat(beat); setPaymentType('beat_wav'); setModal('purchase')
  }

  const submitPurchase = async (event) => {
    event.preventDefault()
    if (!supabase || !user || !selectedBeat) return
    const form = new FormData(event.currentTarget)
    const screenshot = form.get('payment_screenshot')
    if (!screenshot?.size) return showNotice('KBZPay ငွေလွှဲ Screenshot ကို ရွေးပေးပါ။')
    try {
      setBusy(true)
      const path = `${user.id}/${crypto.randomUUID()}-${screenshot.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(path, screenshot, { upsert: false, contentType: screenshot.type || 'image/jpeg' })
      if (uploadError) throw uploadError
      await createBeatOrder({ beat: selectedBeat, purchaseType: paymentType, paymentScreenshotPath: path })
      setModal(''); showNotice('Order တင်ပြီးပါပြီ။ Producer က ငွေလွှဲမှုကို စစ်ဆေးနေပါတယ်။')
    } catch (e) { showNotice(`Order မတင်နိုင်ပါ: ${e.message}`) } finally { setBusy(false) }
  }

  const moderateBeat = async (beatId, approved) => {
    try {
      setBusy(true)
      const { error } = await supabase.from('beats').update({ review_status: approved ? 'approved' : 'rejected' }).eq('id', beatId)
      if (error) throw error
      showNotice(approved ? 'Beat ကို approve လုပ်ပြီးပါပြီ။' : 'Beat ကို reject လုပ်ပြီးပါပြီ။')
      await loadMarketplace(); await loadWorkspace(user, profile)
    } catch (e) { showNotice(`လုပ်ဆောင်မှု မအောင်မြင်ပါ: ${e.message}`) } finally { setBusy(false) }
  }

  const decidePayment = async (orderId, approve) => {
    try { setBusy(true); await decideOrder(orderId, approve); showNotice(approve ? 'Order approve လုပ်ပြီး Beat ကို Sold Out ပြောင်းလိုက်ပါပြီ။' : 'Order ကို decline လုပ်ပြီးပါပြီ။'); await loadMarketplace(); await loadWorkspace(user, profile) }
    catch (e) { showNotice(`Order ဆုံးဖြတ်မှု မအောင်မြင်ပါ: ${e.message}`) } finally { setBusy(false) }
  }

  return (
    <div className="app-shell">
      <audio ref={audioRef} src={audioUrl || undefined} onEnded={() => setPlayingId(null)} onPause={() => {}} />
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand-row"><div className="brand-icon"><AudioLines size={21} strokeWidth={2.5} /></div><span className="brand-name">MUXI<span className="brand-dot">.</span></span><button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={19} /></button></div>
        <div className="side-section"><p className="side-heading">DISCOVER</p>
          <button className="side-link active" onClick={() => { setActiveGenre('All Beats'); setMobileMenu(false) }}><Disc3 size={18} /> Explore Beats</button>
          <button className="side-link" onClick={() => setModal('favorites')}><Heart size={18} /> Favorites <span className="side-count">{liked.length || ''}</span></button>
          <button className="side-link" onClick={() => showNotice('Producer profile တွေကို Marketplace data ပိုထည့်ပြီးမှ ဖော်ပြနိုင်ပါမယ်။')}><Mic2 size={18} /> Producers</button>
        </div>
        <div className="side-section"><p className="side-heading">YOUR WORKSPACE</p>
          <button className="side-link" onClick={() => user ? setModal('upload') : handleLogin()}><UploadCloud size={18} /> Upload a Beat</button>
          <button className="side-link" onClick={() => setModal('orders')}><ShoppingBag size={18} /> My Orders</button>
          {profile?.role === 'admin' && <button className="side-link" onClick={() => setModal('admin')}><ShieldCheck size={18} /> Admin Review <span className="side-count">{pendingBeats.length}</span></button>}
          {(profile?.role === 'producer' || profile?.role === 'admin') && <button className="side-link" onClick={() => setModal('producer-orders')}><Wallet size={18} /> Payment Review <span className="side-count">{orders.length}</span></button>}
        </div>
        <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={17} /></div><strong>Your sound. Your future.</strong><p>Build your catalog and reach new artists.</p><button onClick={() => user ? showNotice('Producer role ကို Admin က Supabase Dashboard မှာပေးရပါမယ်။') : handleLogin()}>Become a Producer <span>↗</span></button></div>
          <div className="profile-mini"><div className="avatar">{user ? (profile?.display_name || user.email || 'M').slice(0, 1).toUpperCase() : 'M'}</div><div className="profile-copy"><strong>{profile?.display_name || user?.email || 'Guest Listener'}</strong><span>{profile?.role || (user ? 'Signed in' : 'Free account')}</span></div>{user ? <button className="icon-button" onClick={handleLogout} aria-label="Logout"><LogOut size={16} /></button> : <button className="icon-button" onClick={handleLogin} aria-label="Sign in"><LogIn size={16} /></button>}</div>
        </div>
      </aside>
      {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}
      <main className="main-content">
        <header className="topbar"><button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21} /></button><div className="breadcrumb">Marketplace <span>/</span> <b>Explore</b></div>
          <div className="topbar-actions"><label className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search beats, producers..." /><kbd>⌕</kbd></label><button className="icon-button notification-button" onClick={() => showNotice('Notification feature ကို နောက်အဆင့်မှာ ချိတ်ဆက်နိုင်ပါမယ်။')} aria-label="Notifications"><Bell size={18} /></button><button className="avatar top-avatar" onClick={() => user ? setModal('account') : handleLogin()} aria-label="Account">{user ? (profile?.display_name || user.email || 'M').slice(0, 1).toUpperCase() : 'M'}</button></div>
        </header>
        <div className="page-content">
          <section className="hero"><div className="hero-noise" /><div className="hero-content"><div className="eyebrow"><span className="eyebrow-dot" /> THE SOUND OF WHAT'S NEXT</div><h1>Find your<br /><em>next sound.</em></h1><p>Exclusive beats. Independent producers.<br className="desktop-break" /> Your next record starts here.</p><button className="primary-button hero-button" onClick={() => document.getElementById('beat-grid')?.scrollIntoView({ behavior: 'smooth' })}>Explore Beats <span>↘</span></button></div><div className="hero-visual" aria-hidden="true"><div className="hero-disc disc-one" /><div className="hero-disc disc-two" /><div className="hero-disc disc-three" /><div className="hero-center"><AudioLines size={36} /></div><div className="hero-floating float-a">✳</div><div className="hero-floating float-b">M.</div><div className="hero-caption">INDEPENDENT SOUND<br /><b>EST. 2025</b></div></div><div className="hero-index"><span>01</span><i /> 04</div></section>
          <section className="stats-strip"><div><span className="stat-number">{beats.length}<span>+</span></span><span className="stat-label">BEATS IN THE LAB</span></div><div><span className="stat-number">{profile?.role === 'producer' ? 'PRO' : 'INDIE'}</span><span className="stat-label">INDEPENDENT PRODUCERS</span></div><div><span className="stat-number">24/7</span><span className="stat-label">FRESH INSPIRATION</span></div><div className="stats-note"><TrendingUp size={16} /> {loading ? 'Loading beats…' : supabase ? 'Live marketplace' : 'Demo mode — connect Supabase'}</div></section>
          <section className="beats-section" id="beat-grid"><div className="section-top"><div><div className="section-kicker">CURATED FOR YOUR NEXT HIT</div><h2>Explore beats<span className="purple-period">.</span></h2><p className="section-description">Find the sound that brings your idea to life.</p></div><button className="outline-button" onClick={() => { setQuery(''); setActiveGenre('All Beats') }}>Reset filters <span>↗</span></button></div>
            <div className="filter-row"><div className="genre-tabs">{genres.map((genre) => <button key={genre} className={`genre-tab ${activeGenre === genre ? 'selected' : ''}`} onClick={() => setActiveGenre(genre)}>{genre}</button>)}</div><label className="sort-select"><SlidersHorizontal size={15} /><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort beats"><option>Featured</option><option>Price: Low to High</option><option>BPM: Low to High</option></select><ChevronDown size={14} /></label></div>
            {loading ? <div className="empty-state"><AudioLines size={26} /><strong>Loading beats…</strong><span>Marketplace ကို ချိတ်ဆက်နေပါတယ်။</span></div> : filtered.length === 0 ? <div className="empty-state"><Search size={26} /><strong>No beats found</strong><span>Try another search or genre.</span><button onClick={() => { setQuery(''); setActiveGenre('All Beats') }}>Clear filters</button></div> : <div className="beat-grid">{filtered.map((beat, index) => <article className="beat-card" key={beat.id}><div className="beat-art-wrap"><CoverArt beat={beat} />{beat.tag && <span className={`beat-tag ${beat.tag === 'EXCLUSIVE' || beat.tag === 'SOLD OUT' ? 'tag-exclusive' : ''}`}>{beat.tag}</span>}<button className={`art-play ${playingId === beat.id ? 'is-playing' : ''}`} onClick={() => playBeat(beat)} aria-label={playingId === beat.id ? 'Pause beat preview' : 'Play beat preview'}>{playingId === beat.id ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button><button className={`like-button ${liked.includes(beat.id) ? 'liked' : ''}`} onClick={() => toggleLike(beat.id)} aria-label="Toggle favorite"><Heart size={16} fill={liked.includes(beat.id) ? 'currentColor' : 'none'} /></button><div className="art-bottom-line"><span>{String(index + 1).padStart(2, '0')}</span><span>● ● ●</span></div></div><div className="beat-card-info"><div className="beat-title-row"><div><h3>{beat.title}</h3><p>{beat.producer}</p></div><strong className="beat-price">{money(beat.price)}</strong></div><div className="beat-meta"><span>{beat.genre}</span><i /> <span>{beat.bpm || '—'} BPM</span><i /> <span>{beat.key || 'Key N/A'}</span></div><button className="license-button" disabled={beat.sold_out} onClick={() => startPurchase(beat)}>{beat.sold_out ? 'Sold Out' : 'Buy / License'} <Plus size={15} /></button></div></article>)}</div>}
          </section>
          <section className="producer-banner"><div className="banner-orb"><AudioLines size={28} /></div><div><span className="section-kicker">MADE SOMETHING SPECIAL?</span><h2>Your beats belong here.</h2><p>Join independent producers building the next wave of sound.</p></div><button className="primary-button" onClick={() => user ? setModal('upload') : handleLogin()}>Start selling <span>↗</span></button></section>
          <footer className="footer"><div className="footer-brand">MUXI<span>.</span></div><span>Independent sound. Infinite possibility.</span><span>© 2026 MUXI</span></footer>
        </div>
      </main>
      {playingId && <div className="mini-player"><div className="mini-cover"><AudioLines size={19} /></div><div className="mini-track"><strong>{beats.find((b) => b.id === playingId)?.title}</strong><span>{beats.find((b) => b.id === playingId)?.producer} · Preview</span></div><button className="mini-play" onClick={() => { const b = beats.find((x) => x.id === playingId); if (b) playBeat(b) }} aria-label="Pause"><Pause size={18} fill="currentColor" /></button><div className="mini-progress"><i /></div><span className="mini-time">PREVIEW</span><button className="icon-button mini-close" onClick={() => { audioRef.current?.pause(); setPlayingId(null) }} aria-label="Close player"><X size={17} /></button></div>}
      {modal && <div className="muxi-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !busy) setModal('') }}><section className="muxi-modal"><div className="muxi-modal-head"><h2>{({ upload: 'Upload a Beat', purchase: 'Purchase Beat', admin: 'Admin Review', 'producer-orders': 'Payment Review', orders: 'My Orders', favorites: 'Favorites', account: 'Your Account' })[modal] || 'MUXI'}</h2><button className="icon-button" onClick={() => setModal('')} aria-label="Close"><X size={18} /></button></div>
        {modal === 'upload' && <form className="muxi-form" onSubmit={uploadBeat}><p className="modal-hint">Beat တင်ပြီးနောက် Admin approve လုပ်မှ Marketplace မှာ ပေါ်လာပါမယ်။</p><label>Beat Title<input name="title" required maxLength="100" placeholder="ဥပမာ — Midnight Drive" /></label><div className="form-two"><label>Genre<select name="genre"><option>Trap</option><option>R&B</option><option>Drill</option><option>Boom Bap</option><option>Afrobeats</option><option>Pluggnb</option><option>Other</option></select></label><label>BPM<input name="bpm" type="number" min="40" max="250" placeholder="140" /></label></div><label>Musical Key<input name="musical_key" placeholder="F# minor" /></label><label>Description<textarea name="description" rows="2" placeholder="Beat အကြောင်း အတိုချုံးရေးပါ" /></label><div className="form-two"><label>Beat WAV Price (MMK)<input name="beat_price_mmk" type="number" min="1" required placeholder="50000" /></label><label>Stem ZIP Price (optional)<input name="stem_price_mmk" type="number" min="1" placeholder="80000" /></label></div><label><span className="field-title">Preview Audio (MP3/WAV) *</span><input name="preview_file" type="file" accept="audio/*" required /></label><label><span className="field-title">Full Beat WAV *</span><input name="wav_file" type="file" accept="audio/wav,audio/*" required /></label><label><span className="field-title">Stem ZIP (optional)</span><input name="stem_file" type="file" accept=".zip,application/zip" /></label><button className="primary-button modal-submit" disabled={busy} type="submit"><UploadCloud size={16} /> {busy ? 'Uploading…' : 'Submit for Approval'}</button></form>}
        {modal === 'purchase' && selectedBeat && <form className="muxi-form" onSubmit={submitPurchase}><p className="modal-hint">KBZPay သို့ ငွေလွှဲပြီး Screenshot တင်ပါ။ Producer က စစ်ဆေးပြီး approve လုပ်မှ ရောင်းချမှုအတည်ပြုပါမယ်။</p><div className="purchase-summary"><strong>{selectedBeat.title}</strong><span>{selectedBeat.producer}</span></div><label>File Type<select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}><option value="beat_wav">Beat WAV — {money(selectedBeat.beat_price_mmk || selectedBeat.price)}</option>{selectedBeat.stem_zip_path && <option value="stem_zip">Stem ZIP — {money(selectedBeat.stem_price_mmk)}</option>}</select></label><div className="payment-instructions"><Wallet size={18} /><div><strong>KBZPay Payment</strong><span>ငွေလက်ခံမည့်အကောင့်အချက်အလက်ကို MUXI Admin ထံမှ အတည်ပြုပါ။</span></div></div><label><span className="field-title">Payment Screenshot *</span><input name="payment_screenshot" type="file" accept="image/*" required /></label><p className="modal-hint warning-hint">ဒီ UI က payment ကို အလိုအလျောက် verify မလုပ်ပါ။ Screenshot ကို Producer/Admin က ကိုယ်တိုင်စစ်ဆေးရပါမယ်။</p><button className="primary-button modal-submit" disabled={busy} type="submit">{busy ? 'Submitting…' : 'Submit Payment Proof'}</button></form>}
        {modal === 'admin' && <div className="workspace-list">{profile?.role !== 'admin' ? <p>Admin permission လိုအပ်ပါတယ်။</p> : pendingBeats.length === 0 ? <p>Review လုပ်ရန် Beat မရှိသေးပါ။</p> : pendingBeats.map((b) => <div className="workspace-item" key={b.id}><div><strong>{b.title}</strong><span>{b.producer?.display_name || b.producer_id} · {money(b.beat_price_mmk)} · {b.genre}</span></div><button disabled={busy} onClick={() => moderateBeat(b.id, true)}><Check size={15} /> Approve</button><button className="danger-button" disabled={busy} onClick={() => moderateBeat(b.id, false)}>Reject</button></div>)}</div>}
        {modal === 'producer-orders' && <div className="workspace-list">{!['producer', 'admin'].includes(profile?.role) ? <p>Producer permission လိုအပ်ပါတယ်။</p> : orders.length === 0 ? <p>စစ်ဆေးရန် Order မရှိသေးပါ။</p> : orders.map((o) => <div className="workspace-item" key={o.id}><div><strong>{o.beats?.title || 'Beat Order'} · {money(o.amount_mmk)}</strong><span>{o.status} · {new Date(o.created_at).toLocaleDateString()}</span><button className="text-action" onClick={async () => { const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(o.payment_screenshot_path, 120); if (error) showNotice(error.message); else window.open(data.signedUrl, '_blank', 'noopener,noreferrer') }}>View payment screenshot</button></div><button disabled={busy} onClick={() => decidePayment(o.id, true)}><Check size={15} /> Approve & Sell</button><button className="danger-button" disabled={busy} onClick={() => decidePayment(o.id, false)}>Decline</button></div>)}</div>}
        {modal === 'orders' && <div className="workspace-list"><p>Order history ကို ဝင်ရောက်ကြည့်ရှုရန် Login ဝင်ထားရပါမယ်။</p>{!user ? <button className="primary-button" onClick={handleLogin}><LogIn size={15} /> Sign in with Google</button> : <p>Order history view ကို နောက်အဆင့်မှာ ထပ်ထည့်နိုင်ပါမယ်။</p>}</div>}
        {modal === 'favorites' && <div className="workspace-list">{liked.length ? beats.filter((b) => liked.includes(b.id)).map((b) => <div className="workspace-item" key={b.id}><div><strong>{b.title}</strong><span>{b.producer} · {money(b.price)}</span></div><button onClick={() => { setModal(''); startPurchase(b) }}>Buy</button></div>) : <p>Favorite ထည့်ထားတဲ့ Beat မရှိသေးပါ။ Heart icon ကိုနှိပ်ပြီး သိမ်းနိုင်ပါတယ်။</p>}</div>}
        {modal === 'account' && <div className="workspace-list"><p><strong>{profile?.display_name || user?.email}</strong></p><p>Role: {profile?.role || 'buyer'}</p><button className="outline-button" onClick={handleLogout}><LogOut size={15} /> Logout</button></div>}
      </section></div>}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

export default App
