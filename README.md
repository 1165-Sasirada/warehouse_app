=# ระบบจำลองเส้นทางหยิบสินค้าในคลังสินค้า

เว็บแอปสาธิตการจัดการคำสั่งซื้อและการหยิบสินค้าในคลัง ลูกค้าสร้างคำสั่งซื้อ พนักงานดูเส้นทางที่คำนวณให้และยืนยันการหยิบ ระบบอัปเดตสต็อก ประวัติ และฮีตแมป ไม่ได้เชื่อมกับอุปกรณ์คลังสินค้าจริง

## ความสามารถ

- เข้าสู่ระบบด้วย Supabase Auth โดยมีบทบาท `customer`, `picker` และ `manager`
- เลือก SKU ที่มีสต็อกและกำหนดตำแหน่งจัดเก็บให้อัตโนมัติ
- ส่งคำสั่งซื้อผ่าน Upstash Redis และ QStash ไปยัง worker ที่ตรวจลายเซ็น
- ผู้จัดการสร้างชุดคำสั่งซื้อจำลองได้สูงสุด 50 รายการ
- คำนวณและแสดงเส้นทางหยิบสินค้า พร้อมสถานะคำสั่งซื้อและฮีตแมป
- บันทึกการหยิบแบบ atomic ซึ่งตรวจสต็อกและอัปเดต stock, heatmap และสถานะ order item ใน transaction เดียว
- ดูสถานะคำสั่งซื้อของลูกค้าและประวัติรายการที่เสร็จแล้ว
- ค้นหา stock และใช้ `Restock All` เพื่อกำหนดจำนวนทุกรายการเป็น 100 สำหรับการสาธิต

## เทคโนโลยี

| ส่วน | เทคโนโลยี |
|---|---|
| เว็บและ API | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| เส้นทาง | Python, A* และการจัดลำดับจุดหยิบ |
| ฐานข้อมูลและ Auth | Supabase (PostgreSQL, Supabase Auth) |
| คิว | Upstash Redis และ QStash |
| เผยแพร่ | Vercel |

## โครงสร้างโปรเจกต์

```text
api/path.py                         # Python route API บน Vercel
app/                                # หน้าเว็บและ Next.js API routes
  api/orders/                       # ตรวจและส่ง order เข้าคิว
  api/order-batches/                # สร้างชุด order และดูความคืบหน้า
  api/queue/process/                # QStash worker
  create-order/ dashboard/ history/ login/ orders/ stock/
components/                         # Sidebar, WarehouseMap, WarehouseRoute
core/                               # warehouse.py และ pathfinder.py
design-ref/                         # เอกสารสี เลย์เอาต์ และแนวคิด
lib/                                # Supabase clients, auth, queue และ grid
scripts/                            # demo.py, seed.py, new-seed.py
supabase/                           # schema, RLS, grants และ SQL patches
TESTING_GUIDE.txt                   # คู่มือทดสอบ end-to-end
requirements.txt                    # Python dependencies
package.json                        # คำสั่งและ dependencies ของเว็บ
```

## สิ่งที่ต้องเตรียม

- Node.js และ npm
- Python 3
- โปรเจกต์ Supabase
- Upstash Redis และ QStash สำหรับคิวคำสั่งซื้อ
- Vercel สำหรับเผยแพร่ Python route API และ worker URL แบบ HTTPS

## ติดตั้ง

รันจากโฟลเดอร์หลักของโปรเจกต์:

```bash
npm install
python -m venv venv
```

เปิด virtual environment และติดตั้ง Python dependencies:

```powershell
# PowerShell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

```bash
# Git Bash บน Windows
source venv/Scripts/activate
pip install -r requirements.txt
```

```bash
# macOS หรือ Linux
source venv/bin/activate
pip install -r requirements.txt
```

หาก PowerShell บล็อกการ activate ให้รัน `Set-ExecutionPolicy -Scope Process Bypass` ในหน้าต่างนั้นแล้วลองใหม่

## Environment variables

สร้าง `.env.local` ที่โฟลเดอร์หลักสำหรับเว็บแอป:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key

# ฝั่ง server เท่านั้น ห้ามใช้ NEXT_PUBLIC_ กับ secret
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your-key
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-rest-token
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-current-signing-key
QSTASH_NEXT_SIGNING_KEY=your-next-signing-key
ORDER_QUEUE_WORKER_URL=https://your-deployment.example/api/queue/process
```

สคริปต์ seed อ่าน `.env` ที่โฟลเดอร์หลัก ให้สร้างไฟล์นี้ด้วย:

```dotenv
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your-key
```

อ่าน URL และ keys ได้จาก Supabase Project Settings → API Keys ค่า `SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_URL` ใช้ URL เดียวกันได้ แต่ secret key ต้องอยู่ฝั่ง server เท่านั้น ห้าม commit `.env` หรือ `.env.local` เพิ่มค่าที่ต้องใช้ลง Vercel → Project Settings → Environment Variables และ deploy ใหม่หลังเปลี่ยนค่า

## ตั้งค่า Supabase

สำหรับโปรเจกต์ใหม่ เปิด SQL Editor แล้วรันตามลำดับ:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/grants.sql`
4. `supabase/patch-customer-and-heatmap.sql`
5. `supabase/patch-order-ownership.sql`
6. `supabase/queue-and-picking.sql`
7. Deploy โค้ดแอปเวอร์ชันที่รองรับ queue และ RPC เหล่านี้
8. หลัง deploy จึงรัน `supabase/queue-security-hardening.sql`

อย่ารัน `schema.sql` ซ้ำบนฐานข้อมูลเดิม และตรวจสอบ migration ก่อนรัน patch ซ้ำ เพราะบางไฟล์ออกแบบมาสำหรับการตั้งค่าเพียงครั้งเดียว การรัน hardening ก่อน deploy โค้ดที่ตรงกันจะปิดทางเขียน order แบบเดิมก่อนแอปพร้อมใช้งาน

RLS และ GRANT เป็นคนละชั้น: RLS กำหนดแถวที่มองเห็นหรือแก้ไขได้ ส่วน GRANT อนุญาตให้ role เริ่มทำคำสั่งกับตารางได้

## Seed คลังสินค้า

รันจากโฟลเดอร์หลัก และตรวจว่า `.env` ชี้ไปยัง Supabase โปรเจกต์ที่ถูกต้อง

### Seed แบบเดิม

```bash
python scripts/seed.py --test
python scripts/seed.py
```

โหมด `--test` สร้าง 180 locations (aisle 1–2); โหมดเต็มสร้าง 1,800 locations, SKU ตัวอย่าง 50 รายการ และ stock สาธิตสูงสุด 4 แถว สคริปต์นี้ไม่ได้สร้าง stock ให้ทุก location และไม่ได้ backfill heatmap สำหรับ locations ที่เพิ่มใหม่

### Seed เต็ม 200 SKU

ตรวจจำนวนโดยไม่เชื่อมต่อฐานข้อมูล แล้วจึงรันจริง:

```bash
python scripts/new-seed.py --dry-run
python scripts/new-seed.py
```

`new-seed.py` สร้างชื่อสินค้าไม่ซ้ำ 200 SKU (หนึ่ง SKU ต่อ aisle/bay) และ stock 1,800 แถว (หนึ่งแถวต่อ level/bin) โดยตั้ง quantity 100 ให้เฉพาะคู่ SKU/location ที่ยังไม่มี Barcode ของ SKU ใช้ label รูปแบบ `ZONE-AISLE-BAY-LEVEL-BIN` เช่น `A-1-1-1-A`; SKU เดียวกันครอบคลุมทั้ง 9 level/bin ของ bay นั้น สคริปต์เติมเฉพาะ heatmap rows ที่ขาดและคง `pick_count` เดิม

สคริปต์ไม่ลบข้อมูลเดิมและไม่เติม quantity ของ stock ที่มีอยู่กลับเป็น 100 หากเคยใช้ `seed.py` สินค้าสาธิตและ stock เดิมจะยังอยู่ หากพบ barcode ชนหรือ stock คู่เดิมซ้ำ สคริปต์จะหยุดเพื่อตรวจสอบ ห้ามลบ locations ที่ถูกอ้างอิงโดย stock, order items หรือ heatmaps

ตรวจจำนวนข้อมูล:

```sql
select
  (select count(*) from public.locations) as locations,
  (select count(*) from public.location_heatmaps) as heatmap_rows,
  (select count(*) from public.stock) as stock_rows;
```

หากสร้าง locations ด้วยวิธีอื่น ให้สร้าง heatmap rows ที่ขาดโดยไม่เขียนทับค่าที่มี:

```sql
insert into public.location_heatmaps (location_id, pick_count)
select id, 0 from public.locations
on conflict (location_id) do nothing;
```

## บัญชีและบทบาท

สร้างบัญชีใน Supabase Dashboard → Authentication → Users และเพิ่มแถวใน `public.users` โดยแทนชื่อและอีเมล:

```sql
insert into public.users (id, email, full_name, role)
select id, email, 'ชื่อลูกค้าทดสอบ', 'customer'
from auth.users
where email = 'customer@example.com';
```

บทบาทที่รองรับคือ `customer`, `picker` และ `manager`:

| บทบาท | เมนู | หน้าเริ่มต้น |
|---|---|---|
| `customer` | Create Order, Order Status | `/create-order` |
| `picker` | Dashboard, Stock, History | `/dashboard` |
| `manager` | Dashboard, Create Order, Stock, History | `/dashboard` |

เมนูที่ซ่อนไม่ใช่มาตรการความปลอดภัยแทน RLS หรือ API role checks ปัจจุบัน write policies บางส่วน เช่น `Restock All` ยังอนุญาตผู้ใช้ที่ authenticated ไม่ได้จำกัดเฉพาะ manager

## รันและทดสอบในเครื่อง

```bash
npm run dev
```

เปิด [http://localhost:3000/login](http://localhost:3000/login) แล้วเข้าสู่ระบบ `next dev` ไม่ได้รัน Python function ใน `api/path.py`; การทดสอบเส้นทางให้ใช้ `vercel dev` หรือ Vercel deployment ส่วนการให้ QStash ประมวลผล order ต้องใช้ worker URL HTTPS ที่ QStash เข้าถึงได้

ทดลองอัลกอริทึมโดยไม่ต้องเชื่อม Supabase:

```bash
python scripts/demo.py
```

ตรวจโค้ดก่อนส่ง:

```bash
npm run lint
npm run build
python -m py_compile scripts/seed.py scripts/new-seed.py core/warehouse.py core/pathfinder.py api/path.py
python scripts/demo.py
```

ไม่มี automated test suite สำหรับ workflow เต็มระบบในขณะนี้ ดูขั้นตอนทดสอบด้วยตนเองได้ใน [TESTING_GUIDE.txt](TESTING_GUIDE.txt) หาก PowerShell บล็อก `npm` ให้ใช้ `npm.cmd` เช่น `npm.cmd run build`

## การทำงานของระบบ

1. ลูกค้าเลือก SKU และจำนวนจากรายการที่มี stock ระบบใช้ location ที่มี stock ให้โดยอัตโนมัติ
2. API ตรวจ session, role, ข้อมูลคำขอ และ stock ก่อนส่ง order เข้า Redis/QStash
3. Worker ตรวจลายเซ็น QStash แล้วเรียก `create_queued_order` เพื่อสร้าง order และ order items ใน transaction เดียว
4. พนักงานรับ order; Dashboard เรียก `/api/path` เพื่อคำนวณ route แล้วเปลี่ยนสถานะเป็น `PICKING`
5. `pick_order_item` ตรวจพนักงาน สถานะ และ stock จากนั้นอัปเดต stock, heatmap และรายการที่หยิบใน transaction เดียว
6. เมื่อหยิบครบ ระบบบันทึกสถานะ `COMPLETED`, เวลาเสร็จ และระยะทาง

### เส้นทางและฮีตแมป

กริดมี 24 แถว × 16 คอลัมน์ เริ่มและจบทัวร์ที่ Packing Station ใช้ A* หาเส้นทางเดิน คำสั่งซื้อไม่เกิน 8 รายการจะค้นหาลำดับทั้งหมดเพื่อหาทางที่สั้นที่สุด หากมากกว่านั้นใช้ Nearest Neighbor และเลือกเส้นทางเดิมถ้าสั้นกว่า `lib/warehouseGrid.ts` ต้องสอดคล้องกับ `core/warehouse.py`

ฮีตแมปนับหนึ่งครั้งต่อ order line ที่หยิบสำเร็จ ไม่ใช่ต่อจำนวนชิ้น แต่ละช่องบนแผนที่แทน aisle/bay ซึ่งรวมข้อมูลจาก 9 bins

## ข้อจำกัดปัจจุบัน

- การรับ order เก่าสุดยังเป็นการอ่านและอัปเดตจาก Dashboard ไม่ใช่ atomic claim; พนักงานหลายคนอาจพยายามรับ order เดียวกัน
- Dashboard ยังไม่กู้คืน order สถานะ `PICKING` หลัง refresh
- หน้า Order Status ต้อง reload เองเพื่อดูสถานะใหม่ ยังไม่มี realtime refresh
- หน้า Stock แสดงครั้งละ 20 แถวและโหลดข้อมูลจาก Supabase เป็นช่วงละ 1,000 แถว ส่วน Create Order ยังโหลด stock โดยไม่แบ่งหน้า จึงอาจได้รับข้อมูลไม่ครบเมื่อมี stock มากกว่า 1,000 แถว

## เอกสารอ้างอิง

- [TESTING_GUIDE.txt](TESTING_GUIDE.txt): ขั้นตอนทดสอบระบบ
- [design-ref/color-reference.txt](design-ref/color-reference.txt): สีของ UI
- [design-ref/layout-reference.txt](design-ref/layout-reference.txt): โครงสร้างหน้า
- [design-ref/warehouse-app-init-design.txt](design-ref/warehouse-app-init-design.txt): แนวคิดการออกแบบเริ่มต้น