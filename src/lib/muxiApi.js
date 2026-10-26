import { supabase } from './supabase'

// Client helpers; authorization must remain enforced by Supabase RLS/functions.
export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase ချိတ်ရန် .env.local ကို အရင်ပြင်ပါ။')
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` }
  })
}
export async function signOut() {
  if (!supabase) throw new Error('Supabase မချိတ်ဆက်ရသေးပါ။')
  return supabase.auth.signOut()
}
export async function getMyProfile() {
  if (!supabase) throw new Error('Supabase မချိတ်ဆက်ရသေးပါ။')
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (error) throw error
  return data
}
export async function getMarketplaceBeats() {
  if (!supabase) throw new Error('Supabase မချိတ်ဆက်ရသေးပါ။')
  const { data, error } = await supabase.from('beats')
    .select('id,title,genre,bpm,musical_key,description,preview_path,stem_zip_path,sold_out,beat_price_mmk,stem_price_mmk,producer_id,created_at')
    .eq('review_status', 'approved').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
export async function createBeatOrder({ beat, purchaseType, paymentScreenshotPath }) {
  if (!supabase) throw new Error('Supabase မချိတ်ဆက်ရသေးပါ။')
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('ဝယ်ယူရန် Google Account နဲ့ အရင်ဝင်ပါ။')
  const isStem = purchaseType === 'stem_zip'
  const amount = isStem ? beat.stem_price_mmk : beat.beat_price_mmk
  if (!amount) throw new Error('ဒီဖိုင်အမျိုးအစားကို မရနိုင်ပါ။')
  const { data, error } = await supabase.from('orders').insert({
    beat_id: beat.id, buyer_id: user.id, producer_id: beat.producer_id,
    purchase_type: purchaseType, amount_mmk: amount,
    payment_screenshot_path: paymentScreenshotPath, status: 'payment_pending'
  }).select().single()
  if (error) throw error
  return data
}
export async function decideOrder(orderId, approve, note = '') {
  if (!supabase) throw new Error('Supabase မချိတ်ဆက်ရသေးပါ။')
  const { data, error } = await supabase.rpc('producer_decide_order', {
    p_order_id: orderId, p_approve: approve, p_note: note || null
  })
  if (error) throw error
  return data
}
