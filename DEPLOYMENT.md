# Vercel Pe Deploy Kaise Kare — Step by Step

## ✅ Pre-Deployment Checklist (Yeh Sab Ho Gaya Hai)

- [x] `prisma.config.ts` fix ho gaya
- [x] `app/lib/prisma.ts` production-safe logging
- [x] `tsconfig.json` mein `prisma.config.ts` exclude
- [x] `package.json` mein `postinstall: prisma generate`
- [x] `.env.example` file bana di
- [x] Local build test: `npx next build` ✅ PASS

---

## Step 1 — GitHub Pe Push Karo

```bash
git add .
git commit -m "fix: deployment ready - prisma config fixed"
git push origin main
```

---

## Step 2 — Vercel Dashboard Mein Environment Variables Add Karo

1. Vercel dashboard kholo: https://vercel.com
2. Apna project select karo
3. **Settings** → **Environment Variables** pe jao
4. Neeche diye gaye **har ek variable** ko add karo:

### Required Variables (Yeh Sab Zaroori Hain)

```
DATABASE_URL
Value: postgresql://neondb_owner:npg_pb8hJsNwPMk1@ep-proud-scene-aorybdvp-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

JWT_SECRET
Value: CodingKeda-@NPA@%&%-April-$$-project##

SMTP_HOST
Value: smtp.gmail.com

SMTP_PORT
Value: 587

SMTP_USER
Value: princechoudhary26102610@gmail.com

SMTP_PASS
Value: qltlpqbuftrctwzr

NEXT_PUBLIC_BASE_URL
Value: https://your-project-name.vercel.app
(⚠️ Deployment ke baad yeh URL milega — pehle localhost:3000 rakh do, baad mein update kar dena)

BASE_URL
Value: https://your-project-name.vercel.app
(⚠️ Same as above)
```

**Important:** Har variable ke liye **Environment** dropdown mein **Production, Preview, Development** teeno select karo.

---

## Step 3 — Redeploy Trigger Karo

Environment variables add karne ke baad:

1. **Deployments** tab pe jao
2. Latest deployment pe **⋯ (three dots)** click karo
3. **Redeploy** select karo
4. **Use existing Build Cache** ko **UNCHECK** karo (fresh build chahiye)
5. **Redeploy** button click karo

---

## Step 4 — Build Logs Check Karo

Deployment start hone ke baad:

1. **Building** status pe click karo
2. Logs mein yeh dekhna hai:
   ```
   ✓ Running "prisma generate"
   ✓ TypeScript compilation successful
   ✓ Build completed successfully
   ```

Agar koi error aaye, logs screenshot leke mujhe dikhana.

---

## Step 5 — Deployment Success Ke Baad

1. Vercel tumhe ek URL dega: `https://your-project-name.vercel.app`
2. Woh URL copy karo
3. Vercel dashboard mein wapas jao → **Settings** → **Environment Variables**
4. `NEXT_PUBLIC_BASE_URL` aur `BASE_URL` ko edit karke yeh naya URL paste karo
5. Ek aur baar **Redeploy** karo (Step 3 repeat karo)

---

## Testing After Deployment

Deployment successful hone ke baad yeh test karo:

```bash
# 1. Signup API test
curl -X POST https://your-project-name.vercel.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Expected: {"success":true,"token":"..."}
```

```bash
# 2. Login API test
curl -X POST https://your-project-name.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Expected: {"success":true,"token":"..."}
```

---

## Common Deployment Errors Aur Solutions

### Error 1: "DATABASE_URL is not defined"
**Solution:** Vercel dashboard mein `DATABASE_URL` variable add karo (Step 2 dekho)

### Error 2: "Prisma Client not generated"
**Solution:** `package.json` mein `postinstall` script check karo — already fix ho gaya hai

### Error 3: "Module not found: Can't resolve 'prisma/config'"
**Solution:** `tsconfig.json` mein `prisma.config.ts` exclude hai ya nahi check karo — already fix ho gaya hai

### Error 4: Build successful but APIs 500 error de rahe hain
**Solution:** 
- Vercel logs check karo: **Deployments** → latest deployment → **Functions** tab
- `JWT_SECRET` missing ho sakta hai
- `DATABASE_URL` galat ho sakta hai

---

## Final Checklist Before Going Live

- [ ] Vercel dashboard mein sab 8 environment variables add ho gaye
- [ ] Build successful (green checkmark)
- [ ] `/api/auth/signup` test kiya — working
- [ ] `/api/auth/login` test kiya — working
- [ ] Frontend pages (`/login`, `/signup`) browser mein khul rahe hain
- [ ] Form submit karne pe backend se response aa raha hai

---

## Agar Kuch Fail Ho Jaye

1. Vercel deployment logs screenshot lo
2. Browser console errors screenshot lo (F12 press karke)
3. Mujhe dikhao — main exact fix bataunga

---

## Production Best Practices (Baad Mein Implement Karna)

1. **Custom Domain:** Vercel mein apna domain add karo (e.g., codingkeda.com)
2. **Database Backups:** Neon dashboard mein automatic backups enable karo
3. **Error Monitoring:** Sentry ya LogRocket integrate karo
4. **Rate Limiting:** API routes pe rate limiting add karo (DDoS protection)
5. **CORS:** Agar separate frontend domain use karoge toh CORS headers add karo

---

Deployment successful hone ke baad mujhe batana! 🚀
