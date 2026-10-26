# Panduan Lengkap: Cara Membuat Roaster Baru di Minit Catch!

Dokumentasi ini menjelaskan secara menyeluruh dan terperinci mengenai cara menambahkan karakter ayam petarung (**Roaster**) baru ke dalam game *Minit Catch!*.

Game ini dirancang dengan arsitektur **Data-Driven & Modular**. Artinya, Anda dapat menambahkan karakter roaster baru secara utuh hanya dengan mendaftarkan data, sprite pixel art, dan kemampuannya tanpa perlu memodifikasi engine simulasi (`src/sim/`).

---

## 1. Struktur Anatomi Sebuah Roaster

Sebuah Roaster di Minit Catch terdiri dari 5 komponen inti:

1. **Identitas (`id` & `name`)**: ID unik berbasis type-safe (`RoasterId`) dan nama tampilan (maksimal 6 karakter untuk keterbacaan HUD optimal).
2. **Peran & Deskripsi (`role` & `description`)**:
   - `role`: Peran atau arketipe roaster (misal: `BOMBER`, `SPEEDSTER`, `GUARDIAN`) yang ditampilkan di info kartu editor dan menentukan strategi AI otomatis.
   - `description`: Deskripsi singkat kemampuan untuk tooltip HUD di editor scene (terpusat langsung di definisi roaster, tidak perlu mengedit file scene UI terpisah).
3. **Statistik Dasar (`stats`)**:
   - `moveSpeed`: Kecepatan bergerak normal (dalam meter/detik, standar: 4.4 – 4.7 m/s).
   - `pickupRadius`: Jangkauan tangkapan ayam liar (dalam meter, standar: 1.0 – 1.2 m).
   - `carrySlots`: Kapasitas membawa ayam (selalu bernilai `1` sesuai aturan GDD).
   - `mass`: Massa tubuh untuk kalkulasi dorongan dan tabrakan (standar: 0.8 – 2.0).
4. **Kemampuan Khusus (`ability`)**: Referensi ke `AbilityId` yang menentukan skill aktif AI roaster.
5. **Visual Pixel Art (`sprite` & `colors`)**:
   - Sprite 12x13 piksel dengan frame animasi `idle`, `run`, `carry`, dan `stun`.
   - Warna `primary` (tubuh) dan `accent` (jengger/topi/peralatan).
6. **Slot Warna Arena (`colors`)**: Digunakan untuk rendering warna kandang, bayangan nomor, dan sorotan antarmuka.

---

## 2. File-File yang Terlibat

| File Path | Fungsi |
|---|---|
| `src/core/ids.ts` | Mendefinisikan helper dan tipe `roasterId(...)` & `spriteId(...)`. |
| `src/shared/types.ts` | Definisi TypeScript interface `RoasterDef` dan `RoasterStats`. |
| `src/data/roasters.ts` | Daftar katalog utama (`ROASTER_DEFS`) di mana roaster baru didaftarkan (termasuk role & deskripsi UI). |
| `src/data/sprites/roasters.ts` | Generator pixel art frame roaster (matriks karakter dan headgear unik). |
| `src/data/abilities.ts` | Daftar kemampuan yang tersedia dan dapat dipasangkan ke roaster. |
| `src/domain/strategies/abilities.ts` | Implementasi logika jika ingin membuat tipe ability baru. |

---

## 3. Langkah Demi Langkah Pembuatan Roaster Baru

Mari kita buat contoh Roaster baru bernama **"Blaze"** (Spesialis Kecepatan Api).

### Langkah 1: Daftarkan Karakter di `src/data/roasters.ts`

Buka file `src/data/roasters.ts`, lalu tambahkan definisi roaster baru ke dalam array `ROASTER_DEFS`:

```typescript
import { abilityId, roasterId, spriteId } from '../core/ids.ts';
import type { Registry } from '../core/Registry.ts';
import type { RoasterDef, RoasterStats } from '../shared/types.ts';

const stats = (moveSpeed: number, pickupRadius: number, mass: number): RoasterStats => ({
  moveSpeed,
  pickupRadius,
  carrySlots: 1,
  mass,
});

export const ROASTER_DEFS: readonly RoasterDef[] = [
  // ... roaster yang sudah ada ...
  
  // ROASTER BARU: BLAZE
  {
    id: roasterId('blaze'),
    name: 'Blaze',
    role: 'Speedster',
    description: 'BURSTS FORWARD WITH FLAME DASH',
    ability: abilityId('sprinter'), // Menggunakan ability sprinter atau ability kustom
    stats: stats(4.65, 1.05, 0.9), // Kecepatan 4.65 m/s, jangkauan 1.05m, massa 0.9kg
    sprite: spriteId('roaster_blaze'),
    colors: {
      primary: 0xff4500, // Oranye Merah Menyala
      accent: 0xffd700,  // Kuning Emas
    },
  },
];
```

---

### Langkah 2: Buat Hiasan Kepala / Headgear di `src/data/sprites/roasters.ts`

Game ini menggunakan generator sprite zero-asset berukuran 12x13 piksel. Tubuh roaster dibentuk otomatis menggunakan palet warna `primary` dan `accent`. Anda hanya perlu menambahkan aksesoris kepala / jengger unik pada dictionary `HEADS`.

Format matriks string kepala terdiri dari 2 baris, masing-masing sepanjang 12 karakter:
- `.` = Transparan
- `H` = Warna Aksen (`colors.accent`)
- `h` = Warna Aksen Gelap
- `r` = Merah Terang
- `A` = Jengger Atas

Buka `src/data/sprites/roasters.ts` dan tambahkan entry untuk `blaze`:

```typescript
const HEADS: Readonly<Record<string, readonly [string, string]>> = {
  boomer: ['....r.......', '...hhhh.....'],
  netta: ['..H.H.H.H...', '...HHHHH....'],
  dash: ['............', '..HHHHHH....'],
  magna: ['..r....r....', '..rrhhrr....'],
  guard: ['...HHHH.....', '..HHHHHH....'],
  trix: ['..H..HH..H..', '...HHHHHH...'],
  sabo: ['............', '...hhhhh....'],
  tank: ['....AA......', '...AAAA.....'],
  
  // HEADGEAR UNTUK BLAZE: Api berkobar di atas kepala
  blaze: ['...H..H.....', '..HHHHHH....'],
};
```

Setiap roaster yang ada di `ROASTER_DEFS` akan otomatis dibuatkan 4 animasi:
- `idle`: 2 frame animasi bernapas dan mengedipkan mata.
- `run`: 4 frame kaki melangkah dan tubuh mengayun.
- `carry`: Membawa ayam di atas kepala dengan animasi lari.
- `stun`: Posisi pusing/berputar saat terkena bom/tabrakan.

---

### Langkah 3: Menghubungkan atau Membuat Kemampuan (Ability) Baru

Jika ingin menggunakan ability yang sudah ada:
- `bomber`: Melempar bom yang meledak dan memingsankan lawan.
- `netter`: Melempar jaring sudut kerucut untuk mengunci pergerakan lawan (*root*).
- `sprinter`: Menerjang cepat (*dash*) ke arah ayam liar terdekat dan kebal sesaat.
- `magnetizer`: Menarik 3+ ayam liar di sekitarnya secara bersamaan.
- `guardian`: Mengaktifkan perisai pelindung yang menangkis stun dan drop.
- `trickster`: Memasang ayam umpan (*decoy lure*) untuk mengecoh ayam lain.
- `saboteur`: Mengunci kandang lawan terdepan (*lock coop*) selama beberapa detik.
- `heavy`: Menghantam tanah (*ground slam*) dengan knockback dan stun area.

Jika ingin membuat **Ability Baru**:
1. Buat fungsi factory di `src/domain/strategies/abilities.ts`:
   ```typescript
   export function createFlameDash(id: AbilityId, cfg: { cooldown: number }): AbilityStrategy {
     return {
       id,
       cooldown: cfg.cooldown,
       canUse(roaster, ctx) {
         // Siap (cooldown selesai & tidak stun) dan situasi menguntungkan
         if (roaster.cooldownLeft > 0 || ctx.time < roaster.stunUntil) return false;
         return roaster.carried >= 0 || roaster.intent.hasTarget;
       },
       use(roaster, ctx) {
         // Efek skill: akselerasi, shield, atau efek area
         ctx.grantShield(roaster, 1.5);
         ctx.emit({ t: 'ability', tick: ctx.tick, roaster: roaster.id, ability: id, hits: 0 });
         return 0;
       },
     };
   }
   ```
2. Daftarkan di `src/data/abilities.ts`:
   ```typescript
   export const ABILITY_DEFS: readonly AbilityDef[] = [
     // ...
     {
       id: id('flame_dash'),
       role: 'Speedster',
       maxStunSec: 0,
       countersDisable: true,
       make: () => createFlameDash(id('flame_dash'), { cooldown: 6 }),
     },
   ];
   ```

---

## 4. Aturan Keseimbangan (Game Balance Rules)

Agar game tetap adil dan kompetitif bagi penonton, roaster baru **wajib** mematuhi pedoman keseimbangan berikut:

1. **Kecepatan Gerak (`moveSpeed`)**:
   - Rentang yang diizinkan: **4.0 m/s hingga 5.0 m/s**.
   - Kecepatan standar ayam liar adalah **1.5 – 3.0 m/s**, sehingga roaster harus mampu mengejar tetapi tidak terlalu cepat hingga simulasi menjadi kacau.
2. **Durasi Efek Stun / Pingsan**:
   - Maksimum durasi stun adalah **1.2 detik**. Aturan ini ditegakkan oleh `verifyInvariants()`. Stun di atas 1.2 detik akan memicu `InvariantError`.
3. **Massa Tubuh (`mass`)**:
   - Rentang yang dianjurkan: **0.8 hingga 2.0**. Roaster dengan massa lebih berat akan lebih tahan terhadap dorongan ledakan bom.
4. **Distribusi Kemenangan (Winrate Sweep)**:
   - Tidak boleh ada satu pun roaster yang memenangkan lebih dari **38%** match dalam sweep simulasi 100 ronde pada semua arena. Game menguji ini secara otomatis via unit test balance.

---

## 5. Cara Menguji Roaster Baru

Setelah menambahkan roaster baru, lakukan validasi melalui langkah berikut:

### 1. Menjalankan Unit Tests Otomatis
Jalankan perintah pengujian:
```bash
npm test
```
Vitest akan menjalankan:
- `tests/architecture.test.ts`: Memastikan tidak ada ketergantungan circular atau layer breaking.
- `tests/simulation.test.ts`: Menguji invariant simulasi, kapasitas ayam, dan skor kandang.
- `tests/balance.test.ts`: Menjalankan sweep statistik untuk memastikan roaster baru seimbang.
- `tests/determinism.test.ts`: Memastikan simulasi tetap 100% deterministik.

### 2. Menjalankan Headless Balance Sweep 100 Match
Untuk melihat statistik menang/kalah roaster secara rinci di terminal:
```bash
node scripts/headless.ts 100 8 open
```
Perintah ini menyimulasikan 100 ronde 8-peserta secara headless dalam beberapa detik dan mencetak persentase kemenangan setiap roaster.

### 3. Uji Coba Visual Langsung di Browser
1. Buka aplikasi di browser (`http://localhost:3000`).
2. Di layar **Editor**, tap salah satu kartu roaster di panel **ROSTER (TAP TO CHANGE)**.
3. Roaster baru Anda akan muncul di rotasi, lengkap dengan sprite pixel art, nama, warna, dan ability label-nya.
4. Tekan **START MATCH** untuk menonton roaster baru Anda berlaga di arena!
