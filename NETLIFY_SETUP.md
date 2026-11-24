# ขึ้นเว็บแบบฟรีด้วย Netlify (แนะนำถ้า Vercel บังคับ Pro)

Netlify แบบฟรี (Starter) ใส่ Environment Variables ได้ ไม่ต้องสมัครโปรครับ

---

## ขั้นตอนที่ 1: สร้างเว็บจาก GitHub

1. เปิด <https://app.netlify.com/> → กด **Sign up** หรือ **Log in** → เลือก **GitHub**
2. กด **Add new site → Import an existing project**
3. เลือก **GitHub** → เลือก repo **Book-a-meeting-room-HR**
4. Netlify จะเจอว่าเป็น Next.js เอง ไม่ต้องเปลี่ยนอะไร → กด **Deploy site**
5. รอประมาณ 1–2 นาที แล้วจะได้ลิงก์แบบนี้:
   ```
   https://ชื่อสุ่ม.netlify.app
   ```
   ตัวอย่าง: `https://bookmeetingroomhr.netlify.app`

---

## ขั้นตอนที่ 2: เพิ่ม URL ใน Google

เปิด <https://console.cloud.google.com/> → โปรเจกต์ `dinoeater-merchant` → **APIs & Services → Credentials** → กด OAuth client ID แบบ Web application → ช่อง **Authorized redirect URIs** → กด **+ ADD URI** ใส่:

```
https://ชื่อสุ่ม.netlify.app/api/auth/callback/google
```

แล้ว **SAVE**

---

## ขั้นตอนที่ 3: ใส่ค่าใน Netlify (ฟรี)

เข้าเว็บ Netlify → เลือก site ของคุณ → **Site configuration → Environment variables** → กด **Add a variable** ทีละตัวครับ

เปิดไฟล์ `.env.local` ในโปรเจกต์ด้วย Notepad แล้วก็อปค่าหลัง `=` มาใส่:

| ชื่อตัวแปร | ค่าที่ใส่ |
|---|---|
| `GOOGLE_SHEETS_ID` | ก็อปจาก `.env.local` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ก็อปจาก `.env.local` |
| `GOOGLE_SHEETS_TAB` | `Bookings` |
| `GOOGLE_PRIVATE_KEY` | ก็อปจาก `.env.local` **ไม่เอา `"` รอบนสุด** |
| `GOOGLE_CLIENT_ID` | ก็อปจาก `.env.local` |
| `GOOGLE_CLIENT_SECRET` | ก็อปจาก `.env.local` |
| `AUTH_SECRET` | ก็อปจาก `.env.local` |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` | `kku.ac.th` |
| `ADMIN_EMAILS` | `pongka@kku.ac.th` |

> ถ้า Netlify มีช่อง **Scopes** ให้เลือก **All scopes** หรือปล่อยค่าเริ่มต้นก็ได้ครับ

---

## ขั้นตอนที่ 4: Deploy ใหม่และลองใช้

1. ไปที่แถบ **Deploys** → กด **Trigger deploy → Deploy site**
2. รอจนเสร็จ แล้วเปิดลิงก์ `.netlify.app`
3. ต้องเห็นคำว่า **Google Sheets** แทนคำว่า **โหมดทดลอง**
4. กด **เข้าสู่ระบบด้วย Google** → ล็อกอินด้วย `@kku.ac.th`
5. ลองจอง / แก้ไข / ยกเลิก 1 รายการ แล้วเช็กแท็บ `สรุป …` ใน Google Sheet

---

## ถ้าติดปัญหา

| อาการ | แก้ |
|---|---|
| ขึ้น `redirect_uri_mismatch` | ยังไม่เพิ่มลิงก์ Netlify ใน Google OAuth client (ขั้นตอนที่ 2) |
| ขึ้น `Configuration` | ยังไม่ใส่ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `AUTH_SECRET` |
| เว็บขึ้นแต่เป็นโหมดทดลอง | ยังไม่ใส่ key Google Sheet ใน Netlify |
| Build ไม่ผ่าน | ดู **Deploys → Deploy log** แล้วก็อปข้อความผิดพลาดมาให้ผม |

---

## หมายเหตุ

- เว็บ Vercel เดิม (`bookmeetingroomhr.vercel.app`) ปล่อยทิ้งไว้ได้ ไม่เป็นไร แต่จะยังเป็นโหมดทดลองเพราะไม่มี key
- กุญแจทั้งหมดอยู่ใน `.env.local` เท่านั้น และไฟล์นี้ถูกกันไม่ให้ขึ้น GitHub แล้ว
- ไม่ต้องสมัคร Netlify Pro ครับ ฟรีก็ใช้ได้ตามนี้เลย
