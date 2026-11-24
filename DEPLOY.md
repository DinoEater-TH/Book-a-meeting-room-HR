# วิธีนำเว็บไปใช้งานจริง (GitHub → Vercel)

> **แนะนำ:** ถ้า Vercel บังคับให้สมัคร Pro ตอนเพิ่ม Environment Variables ให้ใช้ **[NETLIFY_SETUP.md](NETLIFY_SETUP.md)** แทนครับ (ฟรีเหมือนกันและใส่ค่าได้)

เอกสารนี้เขียนเป็นขั้นตอนกดต่อกดครับ ไม่ต้องพิมพ์คำสั่งเองถ้าไม่สะดวก

## สิ่งที่มีแล้ว

- โค้ดเว็บเสร็จ (หน้าเว็บ + ล็อกอิน Google `@kku.ac.th` + อ่าน/เขียน/แก้/ลบ Google Sheet)
- ข้อมูลเดิม 44 รายการ และแท็บ `สรุป …` อยู่ใน Google Sheet แล้ว
- admin คือ `pongka@kku.ac.th`
- Key ทั้งหมดอยู่ในไฟล์ `.env.local` **ห้ามอัปโหลดไฟล์นี้ขึ้น GitHub**

---

## ขั้นตอนที่ 1: เพิ่ม URL ของเว็บจริงใน Google

ต้องทำตอนที่รู้ URL จาก Vercel แล้ว (ได้ในขั้นตอนที่ 3)

1. เปิด <https://console.cloud.google.com/> → โปรเจกต์ `dinoeater-merchant`
2. **APIs & Services → Credentials**
3. กดชื่อ **OAuth client ID** แบบ Web application ที่ใช้ล็อกอิน
4. ช่อง **Authorized redirect URIs** → กด **+ ADD URI** → ใส่:
   ```
   https://ชื่อโปรเจกต์.vercel.app/api/auth/callback/google
   ```
   (เช่น `https://book-a-meeting-room-hr.vercel.app/api/auth/callback/google`)
5. **SAVE**

> ถ้าไม่เพิ่มขั้นตอนนี้ เว็บจริงจะขึ้น `redirect_uri_mismatch` ตอนล็อกอินครับ

---

## ขั้นตอนที่ 2: โค้ดขึ้น GitHub

 repo ที่เชื่อมอยู่แล้วคือ:
 `https://github.com/DinoEater-TH/Book-a-meeting-room-HR.git`

ถ้าผม push ให้แล้ว ไม่ต้องทำอะไรในขั้นตอนนี้

ถ้าต้อง push เอง ให้พิมพ์ในโฟลเดอร์โปรเจกต์:
```
git push origin main
```

---

## ขั้นตอนที่ 3: สร้างเว็บจริงใน Vercel

1. เปิด <https://vercel.com/> → ล็อกอินด้วยบัญชี GitHub เดียวกับ repo
2. กด **Add New… → Project**
3. เลือก/Import repo `Book-a-meeting-room-HR` → กด **Import**
4. Framework จะตรงเป็น **Next.js** อัตโนมัติ ไม่ต้องเปลี่ยนค่า Build
5. **กด Deploy ก่อนยังไม่ต้องใส่ Environment Variables** (รอ domain ในขั้นตอนถัดไป)

---

## ขั้นตอนที่ 4: ใส่ค่าใน Vercel (สำคัญที่สุด)

เข้า **Project → Settings → Environment Variables** แล้วกด **Add New** ทีละตัว
(เลือก **Production**, **Preview** และ **Development** ได้ทั้งหมด)

| ชื่อ | ค่าที่ใส่ |
|---|---|
| `GOOGLE_SHEETS_ID` | copied from `.env.local` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | copied from `.env.local` |
| `GOOGLE_SHEETS_TAB` | `Bookings` |
| `GOOGLE_PRIVATE_KEY` | copied from `.env.local` **without the outer quotes** |
| `GOOGLE_CLIENT_ID` | copied from `.env.local` |
| `GOOGLE_CLIENT_SECRET` | copied from `.env.local` |
| `AUTH_SECRET` | copied from `.env.local` |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN` | `kku.ac.th` |
| `ADMIN_EMAILS` | `pongka@kku.ac.th` |

### วิธีก็อป `GOOGLE_PRIVATE_KEY` ให้ถูกต้อง

เปิด `.env.local` ด้วย Notepad จะเห็นบรรทัดประมาณนี้:

```
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

- **อย่าใส่เครื่องหมาย `"` รอบสุดท้าย** ในช่องของ Vercel
- ให้ก็อปตั้งแต่ `-----BEGIN` ถึง `-----END PRIVATE KEY-----\n` รวม `\n` ด้วย
- ถ้าใส่ quotes ไปด้วย Google จะ reject key ทันที

---

## ขั้นตอนที่ 5: Deploy รอบสุดท้ายและลองใช้งาน

1. กลับไปทำ **ขั้นตอนที่ 1** โดยใช้ URL จริงที่ Vercel ให้
2. ใน Vercel กด **Deployments → … → Redeploy** (หรือ push โค้ดอีกครั้ง)
3. เปิด URL เว็บจริง → กด **เข้าสู่ระบบด้วย Google**
4. ล็อกอินด้วยอีเมล `@kku.ac.th` → ต้องเห็นตารางห้องและข้อมูลจาก Google Sheet
5. ลองจอง → แก้ไข → ยกเลิก 1 รายการ แล้วเช็กว่าแท็บ `สรุป …` อัปเดต

---

## ถ้ามีปัญหา

| อาการ | สาเหตุ / แก้ |
|---|---|
| ขึ้น `redirect_uri_mismatch` | ยังไม่เพิ่ม URL จริงใน Google OAuth client (ขั้นตอนที่ 1) |
| ขึ้น `Configuration` | ยังไม่ใส่ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `AUTH_SECRET` ใน Vercel |
| เว็บขึ้น แต่ข้อมูลไม่ใช่ Google Sheet | ยังไม่ใส่ key Google Sheet ใน Vercel |
| แก้/ลบรายการของคนอื่นไม่ได้ | ใส่ `ADMIN_EMAILS=pongka@kku.ac.th` ให้ถูกต้อง |
| เข้าด้วยอีเมลอื่นแล้วไม่ได้ | ถูกปฏิเสธตามเงื่อนไข `@kku.ac.th` (เป็นเรื่องที่ตั้งใจไว้) |

---

## หมายเหตุเรื่องความปลอดภัย

- ไฟล์ `.env.local`, `dinoeater-merchant-*.json`, `pass supabase.txt` ถูกกันไม่ให้ขึ้น GitHub แล้ว
- Supabase ไม่ได้ถูกใช้แล้ว สามารถลบโปรเจกต์ทิ้งได้ถ้าต้องการ
- ถ้า Client secret หลุด ให้สร้าง OAuth client ใหม่ใน Google Cloud แล้วอัปเดตค่าใน Vercel
