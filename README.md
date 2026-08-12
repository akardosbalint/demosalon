# Demo Salon — foglalási rendszer

Production-grade foglalási rendszer szépségszalon számára: több alkalmazott,
kombinálható szolgáltatások, feldolgozási idő (pl. hajfestés pácolása) és
adatbázis-szintű ütközés-detektálás.

**Ez a repó jelenlegi állapota:**
1. ✅ Prisma séma + adatbázis-szintű ütközés-detektálás (tesztelve)
2. ✅ Vendégoldali foglalási folyamat, 4 lépésben (`/foglalas`)
3. ✅ Admin felület: bejelentkezés, napi naptár-nézet, manuális foglalás,
   no-show/lemondás jelölés, alapstatisztika (`/admin`)

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Prisma 7 + PostgreSQL (`@prisma/adapter-pg` driver adapter)
- Vitest az egység- és integrációs tesztekhez

## A dupla-foglalás elleni garancia

A `booking_segments` tábla `(employee_id, tstzrange(start_time, end_time))`
oszlopain egy PostgreSQL **`EXCLUDE USING gist`** constraint fut
(`prisma/migrations/.../migration.sql`). Ez azt jelenti, hogy két átfedő
időszakot ugyanahhoz az alkalmazotthoz **az adatbázis fizikailag nem enged
beszúrni** — nem csak alkalmazás-logika ellenőrzi. Két egyidejű foglalási
kísérlet ugyanarra az utolsó szabad slotra esetén a második tranzakció a
constraint-ellenőrzésnél elbukik (Postgres hibakód `23P01`), amit a
`src/lib/booking.ts` emberi nyelvű hibává alakít, és felajánlja a
legközelebbi szabad időpontot.

Ezt a `src/lib/__tests__/race-condition.test.ts` teszt valódi konkurens
tranzakciókkal bizonyítja (2 és 8 egyidejű foglalási kísérlet ugyanarra a
slotra — pontosan egy nyer).

**Fontos korlát:** a `EXCLUDE` constraint nem fejezhető ki a Prisma DSL-ben,
ezért a `prisma/schema.prisma` önmagában nem tudja leírni. A migrációt
`prisma migrate dev --create-only`-val hoztuk létre, majd kézzel egészítettük
ki a constraint-tel a `migration.sql` végén. **Ha később a `booking_segments`
táblát módosítod, mindig `--create-only`-val generálj migrációt, és kézzel
őrizd meg (vagy migráld át) az `EXCLUDE` constraint-et** — a Prisma drift
detection nem ismeri, így egy automatikusan generált migráció eltávolítaná.

## Adatbázis: Supabase (élő) + helyi Postgres (tesztekhez)

Az alkalmazás (`.env` → `DATABASE_URL`) egy éles **Supabase** Postgres
projektre van kötve — nem helyi adatbázisra. A `.env.test` viszont
szándékosan **helyi** Postgres-t használ, hogy a tesztek (főleg a
race-condition teszt, ami sok konkurens tranzakciót indít egy másodperc
alatt) gyorsak és a Supabase-kvótától függetlenek maradjanak.

- **Projekt**: `demosalon` (ref: `xgrqjbmqxnbkyughfzeq`), régió `eu-central-1`,
  Supabase org "MI Építettük DEMO1".
- **Kapcsolódási mód**: Supavisor **session-mode pooler** (5432, IPv4-kompatibilis,
  támogat prepared statement-eket) — ugyanaz a connection string szolgálja ki
  az appot ÉS a `prisma migrate` parancsokat, a Supabase hivatalos
  "server-based deployments" Prisma-útmutatója szerint. Ha később
  serverless/edge platformra (pl. Vercel Edge Functions) telepíted és sok
  rövid életű konkurens kapcsolatra van szükség, válts a **transaction-mode**
  poolerre (port 6543, `?pgbouncer=true&connection_limit=1`) az app
  futásidejéhez, és tarts meg egy külön `DIRECT_URL`-t (session/direct, 5432)
  a migrációkhoz.
- **Dedikált `app_prisma` szerepkör**: nem a `postgres` superuser fut a
  Prisma-kapcsolaton, hanem egy külön `app_prisma` role, ami a `public` séma
  és minden tábla tulajdonosa (ez pontosan a Supabase saját Prisma-útmutatójában
  is ajánlott minta). A jelszavát csak ebben a beszélgetésben generáltuk —
  ha kompromittálódna, cseréld le: `ALTER USER app_prisma WITH PASSWORD '...';`
  a Supabase SQL Editorban, majd frissítsd a `DATABASE_URL`-t.
- **Row Level Security**: mind a 9 táblán **be van kapcsolva, policy nélkül**.
  Supabase alapból minden `public` séma alatti táblát elérhetővé tesz a
  PostgREST API-n (anon/authenticated kulccsal) — mivel ez az app kizárólag
  Prisma-n keresztül, közvetlen DB-kapcsolattal éri el az adatokat (soha nem
  supabase-js/PostgREST-en), az RLS policy nélküli bekapcsolása lezárja ezt a
  nem szándékolt API-elérést anélkül, hogy az appot érintené (az `app_prisma`
  a táblák tulajdonosa, ami automatikusan megkerüli az RLS-t).
- **`btree_gist`** kiterjesztés az `extensions` sémában van (nem `public`-ban)
  — Supabase best practice.

**Fontos korlát ebben a fejlesztői környezetben**: ez a sandbox csak proxyzott
HTTPS-t enged kifelé, nyers TCP-t (Postgres port) nem — így a séma és a demo
adatok a Supabase MCP eszközökön keresztül (`apply_migration`/`execute_sql`)
kerültek fel, nem a helyi `prisma migrate deploy`/`db seed` paranccsal. A
`_prisma_migrations` táblát kézzel szinkronizáltuk a helyi checksumokkal, hogy
egy jövőbeli `prisma migrate deploy` (valódi hálózati hozzáféréssel futtatva)
ne ütközzön. **Ezt a lépést senki nem tesztelte ténylegesen `npm run dev`-vel
Supabase ellen** — ha valódi hálózatú gépről futtatod, és valami nem
kapcsolódik, először a `DATABASE_URL`-t ellenőrizd a Supabase Dashboard →
Connect panelen (az `aws-0-eu-central-1` host-szegmens elméletileg helyes, de
csak a dashboard a hiteles forrás).

## Fejlesztői környezet

```bash
npm install                 # a postinstall lefuttatja a `prisma generate`-et

# A teszteknek külön, helyi Postgres kell (nem a Supabase-t használják):
createdb demosalon_test
psql demosalon_test -c 'CREATE EXTENSION IF NOT EXISTS btree_gist;'
DATABASE_URL=<teszt db url> npx prisma migrate deploy

# .env: már Supabase-re van állítva (lásd fent) — AUTH_SECRET (session JWT
#       aláíráshoz, pl. `openssl rand -hex 32`), ADMIN_SEED_EMAIL/PASSWORD
# .env.test: helyi teszt adatbázishoz

npm test                    # egység- és integrációs tesztek (.env.test-et használja, helyi DB)
npm run dev                 # Next.js dev szerver (Supabase-t használja)
```

**Vigyázat jövőbeli séma-változtatásnál:** mivel `DATABASE_URL` most Supabase-re
mutat, `npm run db:migrate` (`prisma migrate dev`) **ne** fusson közvetlenül
ellene — a `migrate dev` drift-észlelésnél reset-et ajánlhat fel, ami törölné
az éles/demo adatokat. Helyes sorrend: `prisma migrate dev` **helyi**
`DATABASE_URL`-lel generáld le az új migrációt, ellenőrizd, majd
`DATABASE_URL=<supabase-url> npx prisma migrate deploy`-jal (vagy a Supabase
`apply_migration` MCP eszközzel) vidd fel Supabase-re — ugyanígy jártunk el az
eddigi két migrációval is.

## Adatmodell

```
Employee ──< EmployeeService >── Service ──< ServiceComboItem >── ServiceCombo
   │                                │
   └──────────< BookingSegment >────┘
                     │
                  Booking
```

- **`Service.processingTimeMinutes`**: az az idő a szolgáltatás vége után,
  amíg a vendég "foglalt" (pl. hajfestés pácolása), de az alkalmazott szabad.
  A `src/lib/scheduling.ts` `planSequentialSegments` ezt egy szegmens nélküli
  réssel modellezi — mivel arra a résre nem jön létre `BookingSegment` sor, az
  alkalmazott automatikusan szabadnak látszik bárki más foglalásához.
- **Lemondás**: a `cancelBooking` törli a `BookingSegment` sorokat (felszabadítja
  az időpontot), de a `Booking` sort megtartja `CANCELLED` státusszal statisztikai
  célra. Ezért a lemondott foglalások pontos időpontja utólag nem kereshető —
  ez tudatos MVP-egyszerűsítés.

## Vendégoldali foglalási folyamat

A `/foglalas` útvonal egy 4 lépéses, mobil-first varázslót valósít meg a
specifikáció szerint: (1) szolgáltatás/kombináció, (2) szakember (kedvenc
vagy "első szabad"), (3) nap+idő napszak szerint csoportosítva, (4)
adatok+megerősítés. Regisztráció nem szükséges. Sticky "Tovább" gomb minden
lépésen, konkrét CTA-szöveggel ("Időpont lefoglalása").

- **"Első szabad időpontot kérem" mód**: a `resolveAutoAssignment`
  (`src/lib/booking.ts`) megkeresi, melyik egyetlen alkalmazott végzi el a
  teljes kombinációt leghamarabb; ha senki nem fedi le egyedül, egy
  determinisztikus (első jogosult alkalmazottankénti) többszemélyes
  felosztásra esik vissza — ez egy tudatosan egyszerű heurisztika, nem teljes
  kombinatorikus optimalizáló.
- **Ütközés-visszajelzés élesben**: ha valaki időközben lefoglalja a
  kiválasztott slotot, a szerver a DB `EXCLUDE` constraint hibáját emberi
  üzenetté + konkrét alternatív időponttá alakítja, amit a UI egy kattintással
  megajánl ("foglalom ezt helyette") — a `StepDetails` komponens ezt azonnal
  újra is próbálja, új tranzakcióban.
- **Időzóna**: az üzleti órák (`DEFAULT_BUSINESS_HOURS`) Europe/Budapest helyi
  idő szerint értendők; a `src/lib/timezone.ts` dependency-mentes,
  nyári/téli időszámítás-biztos konverziót végez UTC és helyi idő között
  (lásd `timezone.test.ts`, benne egy explicit DST-határnap teszttel).
- **Email/SMS**: `src/lib/notifications.ts` jelenleg csak naplóz (nincs
  Resend/Twilio API-kulcs ebben a környezetben) — a hívási pontok már a
  helyükön vannak, éles bekötéskor csak ezt a fájlt kell cserélni.

## Admin felület

A `/admin` (bejelentkezés után `/admin/naptar`-ra irányít) egy saját,
egyszerű session-alapú auth mögött fut — nem NextAuth/Lucia, hanem közvetlen
`bcryptjs` jelszó-hash + `jose`-val aláírt, httpOnly cookie-ban tárolt JWT
session, amit a `src/proxy.ts` (Next.js 16-ban ez a "middleware" új neve)
ellenőriz minden `/admin/*` kérésnél. Az `AdminUser` táblát a seed script
tölti fel (`ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` env várokból, alapértelmezett
demo jelszóval — élesben ezt mindenképp cseréld le).

- **Naptár** (`/admin/naptar`): napi nézet, oszloponként egy-egy
  alkalmazottal, óránkénti rácsvonalakkal. Egy foglalásra kattintva
  Megtörtént / No-show / Lemondás választható. A "+ Új foglalás" telefonos
  vendégeknek szól — **ugyanazt a `createBooking`/`listAvailableSlotsForDate`/
  `resolveAutoAssignment` logikát hívja**, mint a vendégoldali folyamat, tehát
  nincs kétféle igazság az ütközés-ellenőrzésben.
- **Statisztika** (`/admin/statisztika`): kihasználtság alkalmazottanként és
  legnépszerűbb szolgáltatások, az elmúlt 30 nap alapján (`src/lib/admin.ts`).
- **Korlát**: csak napi nézet készült el, heti nézet még nincs (a
  specifikáció "napi/heti" közül egyelőre csak az első). A telefonos
  foglalásnál az "automatikus szakember" mód egy egyszerű, determinisztikus
  heurisztikát használ több-alkalmazottas kombinációknál (lásd
  `resolveAutoAssignment` dokumentációját fent) — ugyanaz az egyszerűsítés,
  mint a vendégoldalon.

## Fájlok

- `prisma/schema.prisma` — adatmodell
- `prisma/migrations/*/migration.sql` — migráció, benne az `EXCLUDE` constraint
- `prisma/seed.ts` — demo adatok (5 alkalmazott, 10 szolgáltatás, 3 kombináció)
- `src/lib/scheduling.ts` — tiszta, DB-mentes időzítés-számítás (egység tesztelt)
- `src/lib/booking.ts` — tranzakciós foglalás-létrehozás, lemondás, szabad
  időpont keresés, auto-hozzárendelés
- `src/lib/booking-errors.ts` — emberi nyelvű domain hibák
- `src/lib/catalog.ts` — csak-olvasható lekérdezések (szolgáltatások, kombók,
  alkalmazottak)
- `src/lib/timezone.ts` — Europe/Budapest ⇄ UTC konverzió, DST-biztos
- `src/lib/notifications.ts` — email/SMS visszaigazolás és emlékeztető (stub)
- `src/lib/admin.ts` — admin-only lekérdezések (napi szegmensek, statisztika)
- `src/lib/auth.ts` / `src/lib/session.ts` — admin jelszó-hash + JWT session
  (session.ts a proxy/Edge-biztos fele, auth.ts a Node-only bcrypt fele)
- `src/proxy.ts` — `/admin/*` útvonalak auth-védelme (Next.js 16 "proxy",
  korábban "middleware")
- `src/app/foglalas/` — a 4 lépéses vendég-foglalási folyamat (wizard,
  server actions, komponensek)
- `src/app/admin/` — admin bejelentkezés, naptár, statisztika
- `src/lib/__tests__/` — egység- és integrációs tesztek, beleértve a
  race-condition tesztet
