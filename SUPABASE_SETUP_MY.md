# MUXI — Supabase Setup (မြန်မာလို)

ဒီ package မှာ Supabase database/security အခြေခံကို ထည့်ထားပါတယ်။ SQL ကို production data ရှိတဲ့ project မှာ မစမ်းခင် test project မှာ အရင်စမ်းပါ။

## ၁။ Database တည်ဆောက်ရန်
1. Supabase Dashboard ကိုဖွင့်ပါ။
2. **SQL Editor > New query** ကိုနှိပ်ပါ။
3. `supabase/schema.sql` ကိုဖွင့်ပြီး code အားလုံး copy/paste လုပ်ပါ။
4. **Run** နှိပ်ပါ။ Error ဖြစ်ရင် error စာသားနဲ့ screenshot ကိုပို့ပါ။

## ၂။ Google Login
1. Supabase > **Authentication > Sign In / Providers > Google** ကိုဖွင့်ပါ။
2. Google Cloud Console မှ OAuth Client ID/Secret ဖန်တီးပြီး Supabase Google provider ထဲထည့်ပါ။
3. Supabase > **Authentication > URL Configuration** မှ Site URL နဲ့ Redirect URLs သတ်မှတ်ပါ။
4. Vite ကပြတဲ့ local URL ကို development redirect list ထဲထည့်ပါ။
5. Google OAuth secret ကို `.env.local` ထဲ မထည့်ပါနဲ့။

## ၃။ Project ချိတ်ရန်
1. `.env.example` ကို `.env.local` အဖြစ် copy လုပ်ပါ။
2. `VITE_SUPABASE_URL` နဲ့ `VITE_SUPABASE_ANON_KEY` ထဲမှာ Project URL နဲ့ publishable/anon key ထည့်ပါ။
3. `service_role` key ကို frontend ထဲ လုံးဝမထည့်ပါနဲ့။
4. Terminal ကို restart လုပ်ပြီး `npm run dev` ပြန်ဖွင့်ပါ။

## ၄။ Admin က Producer အကောင့်ပေးရန်
Auth user အသစ်တွေကို database က `buyer` role ပေးထားပါတယ်။ Producer role ကို Admin Team ကသာ ပေးနိုင်ဖို့ ရည်ရွယ်ထားပါတယ်။
1. Supabase Dashboard > Authentication > Users မှာ သက်ဆိုင်ရာ user ကို invite/create လုပ်ပါ။
2. User UUID ကို စစ်ပါ။
3. SQL Editor မှာ အောက်ပါ query ကို real UUID နဲ့ အစားထိုးပြီး Admin က run လုပ်ပါ။
```sql
update public.profiles set role = 'producer'
where id = 'PUT_REAL_AUTH_USER_UUID_HERE';
```
Admin role ကို သတ်မှတ်ရာမှာလည်း trusted admin UUID ကိုပဲ အသုံးပြုပါ:
```sql
update public.profiles set role = 'admin'
where id = 'PUT_REAL_ADMIN_USER_UUID_HERE';
```
ဒီ SQL ကို public website မှာ မထည့်ပါနဲ့။ Dashboard မှာသာ Admin က လုပ်ပါ။

## ၅။ Storage ကို လုံခြုံအောင်ထားရန်
`supabase/schema.sql` ကို SQL Editor မှာ run လုပ်တဲ့အခါ Storage buckets နဲ့ policies တွေကိုလည်း ဖန်တီးပေးပါတယ်။ မူဝါဒအရ:
- `beat-previews` — Public bucket; preview/demo audio ပဲထားပါ။ Full beat မတင်ပါနဲ့။
- `beat-files` — Private bucket; Full WAV နဲ့ Stem ZIP ကိုထားပါ။ Producer ကိုယ်တိုင်၊ Admin နဲ့ အတည်ပြုပြီးသား buyer သာ ဖတ်နိုင်ပါတယ်။
- `payment-proofs` — Private bucket; ငွေလွှဲ screenshot ကိုထားပါ။ Buyer/သက်ဆိုင်ရာ Producer/Admin သာ ဖတ်နိုင်ပါတယ်။

SQL ကို run လုပ်ပြီးနောက် Supabase Dashboard > Storage မှာ bucket သုံးခုနဲ့ policies တွေ အောင်မြင်စွာဖန်တီးထား/မထား စစ်ပါ။ Preview ထဲမှာလည်း သီးသန့်ဖြန့်ချိခွင့်ရှိတဲ့ audio ကိုပဲ တင်ပါ။

## ၆။ MUXI ရဲ့ သတ်မှတ် flow
- Producer တင်တဲ့ Beat = `pending`; Admin approve လုပ်မှ Marketplace မှာပေါ်မယ်။
- Buyer order နဲ့ payment screenshot တင်မယ်။
- Producer က ငွေဝင်မှုကို စစ်ပြီး approve လုပ်ရင် database function က order ကို `approved` လုပ်ပြီး Beat ကို တစ်ပြိုင်နက် `sold_out=true` ပြောင်းမယ်။
- အခြား pending orders ရှိရင် decline လုပ်မယ်။
- Decline လုပ်ရင် Beat က ဆက်ရောင်းနိုင်မယ်။

## ၇။ Run / Build
```powershell
npm install
npm run dev
npm run build
```
Android အတွက် Android Studio + Android SDK + JDK 17 လိုအပ်ပါတယ်။ Build အောင်မြင်ပြီးမှ:
```powershell
npx cap add android
npm run android:sync
npx cap open android
```

## လက်ရှိအခြေအနေနှင့် သတိပြုရန်
- Google OAuth, Beat Upload, Preview Audio, KBZPay screenshot order, Admin listing review နဲ့ Producer payment review UI ကို `src/App.jsx` မှာ ချိတ်ထားပါတယ်။
- Google OAuth ကို Supabase/Google Cloud မှာ မှန်ကန်စွာ configure လုပ်ထားဖို့လိုပါတယ်။ Producer/Admin role ကို Dashboard မှာ trusted admin ကသာ သတ်မှတ်ပါ။
- Payment ကို အလိုအလျောက် verify မလုပ်ပါ။ Screenshot နဲ့ ငွေဝင်မှုကို Producer က စစ်ပြီးမှ approve လုပ်ရပါမယ်။
- Buyer download flow ကို အပြည့်အဝ မပြီးသေးပါ။ Paid WAV/Stem file ကို customer ဆီပို့မယ့်အခါ approved order ကို server-side မှာစစ်တဲ့ secure download endpoint/Edge Function ထပ်တည်ဆောက်ပါ။
- `.env.local` ကို ကိုယ့်စက်မှာပဲ ထားပါ။ Git/ZIP ထဲ မထည့်ပါနဲ့။ `.env.example` ကို copy လုပ်ပြီး `VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co` နဲ့ `VITE_SUPABASE_ANON_KEY=...` ကို အမှန်တကယ်တန်ဖိုးတွေနဲ့ သီးခြားဖြည့်ပါ။ `service_role` key ကို frontend မှာ လုံးဝမထည့်ပါနဲ့။
- ဒီ environment မှာ `npm run build` ကို အပြည့်အဝအောင်မြင်ကြောင်း မစစ်နိုင်ခဲ့ပါ။ Upload လုပ်ထားတဲ့ `node_modules` က Windows binaries ပါပြီး Linux build tool နဲ့ မကိုက်ညီတာကြောင့် clean project ထဲမှာ `npm install` ပြီးမှ build စမ်းပါ။
