# Product Requirements Document — Trainer App
**Versie:** 2.0  
**Datum:** mei 2026  
**Platform:** Progressive Web App (GitHub Pages)  
**URL:** https://jochem77.github.io/trainer-app/

---

## 1. Productoverzicht

De Trainer App is een persoonlijke hardlooptraining-webapp die een gebruiker door een gestructureerd meerweken loopprogramma leidt. De app stuurt de loopband automatisch aan via Bluetooth (FTMS-protocol), sla schema's op in de cloud, en biedt volledige bewerkings- en beheersfunctionaliteit.

### Kernfuncties samengevat
| Functie | Omschrijving |
|---|---|
| Trainingsscherm | Timer, stappenoverzicht, snelheidsweergave, grafiek |
| Bluetooth loopband | Automatische snelheids- en hellingbesturing via FTMS |
| Schema-editor | Volledig bewerkbaar weekschema met stappen en herhalingen |
| Cloud sync | Schema's opgeslagen in Supabase per gebruikersaccount |
| Authenticatie | Magic link via e-mail (passwordless) |
| Loopband testpagina | Diagnostische pagina voor Bluetooth-debugging |

---

## 2. Technische Stack

| Component | Technologie |
|---|---|
| Frontend | React 19, TypeScript 5.8, Vite 7 |
| Styling | Inline CSS + `<style>`-tags (geen CSS framework) |
| Backend / database | Supabase (PostgreSQL + Auth) |
| Bluetooth | Web Bluetooth API (FTMS, service UUID `0x1826`) |
| Hosting | GitHub Pages via GitHub Actions CI/CD |
| Authenticatie | Supabase Auth — Magic Link (OTP per e-mail) |

### Browser-vereisten
- Web Bluetooth API vereist **Chrome of Edge** op Windows of Android
- iOS/Safari wordt **niet ondersteund** voor Bluetooth-functies
- De rest van de app (training, editor) werkt in alle moderne browsers

---

## 3. Schermen en navigatie

### 3.1 Navigatiestructuur

```
App
├── Trainingsscherm  (standaard)
├── Schema Editor
└── Loopband Bedieningspagina
```

Navigatie vindt plaats via een **hamburgermenu** dat als een slide-in drawer van rechts verschijnt. Er is geen URL-routing; de pagina-wisseling is volledig in-memory via een `currentPage` state (`'training' | 'editor' | 'treadmill'`).

---

## 4. Scherm 1 — Trainingsscherm

### 4.1 Lay-out (verticaal, maximale breedte 720px, gecentreerd)

```
┌─────────────────────────────────────────────────┐
│  ☰   ←   Week 5 (cal ±180)    →                  │  ← Top bar (sticky)
│           14 jun – 20 jun                         │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  stap          totaal                        │ │  ← Status card (sticky)
│  │  4:23           31:12                        │ │
│  │  (0,512 km)     (5,234 km)                   │ │
│  │                                              │ │
│  │         10.5 km/u  (→ 6.0 km/u)             │ │
│  │           Interval hard  3                   │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌──────────────────┐  ┌──────┐                  │
│  │  ▶ Start         │  │  📶  │  ← Actie-rij     │
│  │  (of ⏸ Pauze)    │  │      │                  │
│  └──────────────────┘  └──────┘                  │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  ≡ snelheidsgrafiek (SVG, blauw/groen)      │ │  ← Grafiek
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  00:00  6 km/u   5.0 min  Warming-up        │ │  ← Scrollbare stappenlijst
│  ├─────────────────────────────────────────────┤ │
│  │  05:00  10.5 km/u 1.0 min  Interval hard 1  │ │  ← Huidig (groen omlijnd)
│  ├─────────────────────────────────────────────┤ │
│  │  06:00  6.0 km/u  2.0 min  Interval rust 1  │ │
│  │  ...                                         │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 4.2 Top bar
- **Hamburgermenu-knop** (blauw, links): opent het zijmenu
- **← navigatiepijl** (groen): ga naar vorige week; uitgeschakeld bij week 1
- **Weekinformatie** (gecentreerd, twee regels):
  - Regel 1: `Week N (cal ±XXX)` — weeknummer en verwacht calorieënverbruik
  - Regel 2: datumrange van die week, bijv. `14 jun – 20 jun`
  - De weergegeven week is automatisch de huidige kalenderweek op basis van de ingestelde startdatum van het programma
- **→ navigatiepijl** (groen): ga naar volgende week; uitgeschakeld bij laatste week

### 4.3 Status card
Witte kaart met afgeronde hoeken en schaduw. Toont real-time trainingsinfo:

**Tijdrij (twee kolommen):**
| Kolom | Inhoud | Kleur |
|---|---|---|
| Stap | Resterende tijd in huidige stap (MM:SS) | Groen |
| Totaal | Resterende tijd van volledige training (MM:SS) | Blauw |

Onder elke timer staat de **resterende afstand** in km:
- Stap: `(X,XXX km)` — berekend als `resterende_seconden / 3600 * snelheid`
- Totaal: som van alle toekomstige stappen inclusief huidig restant

**Snelheidsregel:**
- Grote vetgedrukte waarde: huidige snelheid in km/u
- Rechts ervan (kleiner, groen): `(→ X.X km/u)` — snelheid van de volgende stap
- Als er geen volgende stap is, wordt de pijl niet getoond

**Labelregel:**
- Naam van de huidige stap + evt. herhaalindex, bijv. `Interval hard  3`

### 4.4 Actie-rij
Twee knoppen naast elkaar:

**Start/Pauze knop** (flexibel breed, groene/oranje achtergrond):
- Staat: `▶ Start` (groen) of `⏸ Pauze` (oranje)
- Klik bij pauzeren: timer stopt; als loopband verbonden: geleidelijk afremmen naar 0
- Klik bij starten: timer loopt; als loopband verbonden: Start-commando + huidige snelheid sturen

**Loopband-knop** (vaste breedte ~58px, hoogte 52px):
- Toont een icoon en een label:
  | Status | Achtergrond | Icoon | Label |
  |---|---|---|---|
  | Verbonden | Groen `#28a745` | ✓ | Eerste woord van apparaatnaam |
  | Verbinden | Oranje `#fd7e14` | ⏳ | `...` |
  | Fout | Rood `#dc3545` | 📶 | `Fout` |
  | Verbroken | Grijs `#455a64` | 📶 | `Loopband` |
- Klik: start verbinding of verbreek verbinding
- Uitgeschakeld tijdens verbinden
- Tooltip: apparaatnaam + hint om te verbreken (als verbonden)

### 4.5 Snelheidsgrafiek
SVG-grafiek (breedte 100%, hoogte 120px op desktop, 90-100px op mobiel):
- Toont snelheid (y-as, minimaal 4 km/u) over tijd (x-as)
- **Groene lijn + gevuld groen** = afgelopen deel (voor de cursor)
- **Blauwe lijn + gevuld blauw** = toekomend deel (na de cursor)
- **Rode stippellijn** = live positie (huidige seconde)
- **Rode cirkel** = beginpunt (nulpunt)
- Y-assen: drie gridlines zonder labels (min, midden, max snelheid)
- Wordt alleen getoond als er meer dan 1 stap aanwezig is
- Verdwijnt niet bij scrollen (staat binnen de sticky container)

### 4.6 Stappenlijst
Scrollbare lijst van alle afgevlakte stappen van de training:

**Kolommen per stap:**
| Breedte | Inhoud |
|---|---|
| 68px | Starttijd (MM:SS) |
| 80px | Snelheid (X.X km/u), rechts uitgelijnd, blauw |
| 72px | Duur (X.X min), rechts uitgelijnd, blauw |
| flex | Label + evt. herhaalnummer |

**Stijlen per type:**
| Type | Achtergrond | Linker rand |
|---|---|---|
| `steady` | Lichtgroen `#e8f8ea` | Groen `#2e7d32` |
| `interval_hard` | Lichtrood `#fdecec` | Rood `#c62828` |
| `interval_rest` | Lichtblauw `#e8f1ff` | Blauw `#1976d2` |
| `end` | Geen opmaak | Geen |

**Status per stap:**
- **Voorbij (done):** 55% opaciteit, licht grijsfilter
- **Huidig (cur):** Knipperende groene omlijning (animatie `blink-border`, 1s oneindig), groene `outline: 6px`
- **Toekomst:** Standaard

**Interactie:**
- Dubbelklikken op een stap: springt de timer naar het begin van die stap
  - Als de timer liep, herstart de basis-referentietijd accurate met de nieuwe positie
- De huidige stap scrollt automatisch in beeld bij een stapwissel (`scrollIntoView({ behavior: 'smooth', block: 'start' })`)

### 4.7 Timer-mechanisme
- Timer loopt op basis van `Date.now()` (drift-vrij), niet op `setInterval`-ticks
- Poll-interval: 200ms
- Formule: `elapsed = Math.floor((Date.now() - baseTime) / 1000)`
- Bij pauzeren: basisreferentie bewaard in `timerValRef`
- Bij wisselen van week: timer en running worden gereset naar 0

### 4.8 Piepjes
Bij elke stap piept de app bij 3, 2 en 1 seconden resterend (hoorbaar), en triggert silent bij 5 en 4 seconden (ter voorbereiding). Technisch via Web Audio API:
- Oscillator: sinusgolf, 1200 Hz, duur 0,15s
- Triggers worden slechts één keer per drempel per stap afgevuurd (via een sleutel-guard)
- Beeps worden niet opnieuw afgespeeld als de timer teruggeplaatst wordt

### 4.9 Wake Lock
De app vraagt automatisch een Wake Lock aan zodat het scherm niet dimmer of vergrendelt tijdens een training. Werkt via de Screen Wake Lock API. Bij verlies van de lock (bijv. na alt-tab) hernieuwt de app de aanvraag automatisch zodra de pagina weer zichtbaar is.

### 4.10 Automatische weekberekening
De actieve week wordt bepaald via:
```
currentWeek = floor((vandaag - startdatum) / 7) + 1
```
Begrensd tussen week 1 en de laatste week van het programma. Wordt herberekend wanneer het schema of de startdatum wijzigt.

---

## 5. Scherm 2 — Schema Editor

### 5.1 Toegang
Via het hamburgermenu → Trainingsschema's → Bewerken (blauwe knop).

### 5.2 Lay-out

```
┌─────────────────────────────────────────────────────────────┐
│  📋 Schema Editor          💾 Opslaan    ← Terug            │  ← Header
│  Bewerk je trainingsschema                                   │
├─────────────────────────────────────────────────────────────┤
│  📝 Schema Naam: [_____________________]                     │
│  Startdatum: [datum-picker]                                  │
├─────────────────────────────────────────────────────────────┤
│  📅 Week Manager                        [➕ Week Toevoegen]  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│  │Week 1│ │Week 2│ │Week 3│ │ ...  │  ← Drag & drop grid    │
│  └──────┘ └──────┘ └──────┘ └──────┘                        │
├─────────────────────────────────────────────────────────────┤
│  ⏱️ Training Overzicht - Week N                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ 45.0min  │  │    4     │  │ 300 kcal │                   │
│  │ Totale   │  │ Stappen  │  │ Verwacht │                   │
│  │ Duur     │  │          │  │          │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
│  📈 Snelheid Profiel                                         │
│  [SVG grafiek — snelheid over tijd, blauw]                  │
├─────────────────────────────────────────────────────────────┤
│  🔥 Calorieën - Week N                                       │
│  🎯 Verwachte kcal: [___]  Berekend: 312 kcal  [🧮 Pas toe] │
├─────────────────────────────────────────────────────────────┤
│  Trainingsstappen - Week N                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  🏃‍♂️ Stap 1   [Steady ▼]   🔄 Herh [1]   [🗑️ Verwijder] │  │
│  │  Label [Warming-up]  km/u [6]  min [5]  km [0,500]   │  │
│  └───────────────────────────────────────────────────────┘  │
│  [➕ Toevoegen]                                               │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  🏃‍♂️ Stap 2   [Interval ▼]  🔄 Herh [8]   [🗑️ Verwijder]│  │
│  │  🔥 Hard                                              │  │
│  │  Label [Interval hard]  km/u [10]  min [1]  km [0,167]│  │
│  │  💤 Rust                                              │  │
│  │  Label [Interval rust]  km/u [6]   min [2]  km [0,200]│  │
│  └───────────────────────────────────────────────────────┘  │
│  [➕ Toevoegen]                                               │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Header
- Titel: `📋 Schema Editor`
- **Opslaan knop**: groen als er onopgeslagen wijzigingen zijn, grijs als niets gewijzigd; bij opslaan wordt tijdelijk `💾 Opslaan...` getoond, daarna `✅ Opgeslagen`
- **Terug knop**: terug naar trainingsscherm (niet-opgeslagen wijzigingen worden NIET automatisch verloren — de gebruiker verlaat de pagina)
- Statusindicator:
  - `⚠️ Niet opgeslagen wijzigingen` (geel)
  - `💾 Opslaan...` (blauw)
  - `✅ Opgeslagen` (groen)
  - `❌ Fout bij opslaan` + foutmelding (rood)

### 5.4 Schema Naam en Startdatum
- **Schema Naam**: vrij tekstveld; wordt opgeslagen als `schema_name` in de database
- **Startdatum**: HTML datumpicker (`input type="date"`); bepaalt welke week "nu" actief is in het trainingsscherm

### 5.5 Week Manager
- Grid van weekknoppen, automatisch uitlopend (`auto-fit minmax(100px, 1fr)`)
- **Geselecteerde week**: blauwe achtergrond
- **Niet-geselecteerde week**: witte achtergrond, grijze rand
- Elke week heeft twee micro-knoppen (rechtsboven op de kaart):
  - **× (rood)**: week verwijderen (met `confirm()` dialoog); minimaal 1 week vereist
  - **📄 (groen)**: week kopiëren (dupliceert alle stappen naar een nieuwe week aan het einde)
- **Drag & drop**: weken kunnen versleept worden om de volgorde aan te passen; weken worden automatisch hernummerd (1, 2, 3...) na elke versleep-actie
- **➕ Week Toevoegen**: voegt een standaardweek toe (warming-up, hoofdtraining, cooling-down)

### 5.6 Training Overzicht
Drie statistiekenkaartjes voor de geselecteerde week:
- **Totale Duur** (blauw): berekend uit alle stappen inclusief herhalingen; formaat `Xu YY.Zmin`
- **Aantal Stappen** (oranje): totaal stap-objecten (vóór uitklapping van herhalingen)
- **Verwacht Verbruik** (groen): handmatig ingevoerd calorieëndoel in kcal

Eronder: **Snelheid Profiel** — SVG-grafiek van snelheid over tijd (statisch; geen live cursor in de editor).

### 5.7 Calorieënbeheer
- **Handmatig invoerveld**: directe aanpassing van verwachte kcal voor die week
- **Berekend veld** (groen): automatisch berekende schatting op basis van snelheid en duur:
  - Steady: `(4 + speed × 1.15) × duration_min × repeats`
  - Hard interval: `(6 + speed × 1.2) × duration_min × repeats`
  - Rest interval: `(4 + speed × 0.8) × duration_min × repeats`
- **🧮 Pas Berekening Toe**: overschrijft het handmatige veld met de berekende waarde

### 5.8 Stap-editor

#### Stap-types
| Type | Omschrijving |
|---|---|
| `steady` | Enkelvoudig blok: label, snelheid (km/u), duur (min of km) |
| `interval_pair` | Paar van hard + rust, met herhalingen |

#### Steady-stap velden
| Veld | Type | Omschrijving |
|---|---|---|
| Label | Tekst | Naam van het blok (bijv. "Warming-up") |
| km/u | Getal | Snelheid, komma of punt als scheidingsteken |
| min | Getal | Duur in minuten (aanpassen past km automatisch aan) |
| km | Getal | Afstand (aanpassen past min automatisch aan: `min = km / kmh × 60`) |
| 🔄 Herh | Getal | Aantal keer dat dit blok herhaald wordt |

#### Interval-stap velden
Per fase (hard / rust):
| Veld | Omschrijving |
|---|---|
| Label | Naam (bijv. "Interval hard" / "Interval rust") |
| km/u | Snelheid |
| min | Duur |
| km | Afstand (gekoppeld aan min) |
| +km/u | Snelheidstoename per herhaling (progressieve opbouw) |

Gemeenschappelijk:
| Veld | Omschrijving |
|---|---|
| 🔄 Herh | Aantal herhalingen van het hard+rust paar |

#### Type-omzetting
Als een stap van `steady` naar `interval_pair` wordt omgezet:
- Duurt de hard-fase 1/3 van de originele duur
- Snelheid hard = originele snelheid
- Rust-snelheid = 6 km/u standaard

Als terug naar `steady`:
- Neemt de hard-snelheid en -duur over

#### Stappen beheren
- **🗑️ Verwijder**: verwijdert de stap direct
- **➕ Toevoegen** (knop onder elke stap): voegt een nieuwe standaard steady-stap in ná die positie
- **➕ Stap Toevoegen** (onderaan als lijst leeg is): voegt een eerste stap toe

### 5.9 Opslaan
- Opslaan is **handmatig** (geen auto-save)
- Opslaanlogica (Supabase upsert met conflict-handling):
  1. Probeer upsert op `(user_id, schema_name)` conflict
  2. Fallback: upsert op `user_id` alleen
  3. Fallback: directe UPDATE als er een conflict is
- Validatie vóór opslaan:
  - Iedere week heeft een geldig `week`-nummer en `steps`-array
  - Iedere stap heeft een geldig `type` (`steady` of `interval_pair`)
  - Steady-stap vereist `label`, `speed_kmh` en `duration_min`
  - Interval-stap vereist `hard` en `rest`

---

## 6. Scherm 3 — Loopband Bedieningspagina

### 6.1 Toegang
Via hamburgermenu → Loopband → Loopband Verbinden & Bedienen.

### 6.2 Doeleinde
Diagnostische en handmatige bedienspagina om de Bluetooth-verbinding te testen, loopbanddata te bekijken en commando's te sturen onafhankelijk van de training.

### 6.3 Lay-out

```
┌─────────────────────────────────────────────────┐
│  ← 🏃 Loopband Bediening                        │  ← Header
├─────────────────────────────────────────────────┤
│  ● Niet verbonden               [🔗 Verbinden]  │  ← Verbindingskaart
│  (apparaatnaam)                  of [✕ Verbreken]│
├─────────────────────────────────────────────────┤
│  📊 Live Data                                    │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ 8.5    │ │  1.0   │ │ 2,340  │               │
│  │ km/u   │ │  %     │ │  km    │               │
│  └────────┘ └────────┘ └────────┘               │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ 12:34  │ │  145   │ │  312   │               │
│  │        │ │ bpm    │ │ kcal   │               │
│  └────────┘ └────────┘ └────────┘               │
├─────────────────────────────────────────────────┤
│  ⚙️ Bediening                                    │
│  [▶ Start]    [⏸ Pauze]    [■ Stop]             │
├─────────────────────────────────────────────────┤
│  💨 Snelheid                                     │
│  [-1] [-0.5] [-0.1]  8.5 km/u  [+0.1] [+0.5] [+1]│
│  [Stuur 8.5 km/u naar loopband]                 │
├─────────────────────────────────────────────────┤
│  📐 Helling                                      │
│  [-2] [-1] [-0.5]   1.0 %    [+0.5] [+1] [+2]  │
│  [Stuur 1.0 % naar loopband]                    │
├─────────────────────────────────────────────────┤
│  🔧 Handmatig commando (hex bytes)               │
│  [input: "02 E8 03"]  [Stuur]                   │
│  [Req Control] [Reset] [Start] [Stop]            │
│  [6 km/u] [8 km/u] [10 km/u] [12 km/u]         │
│  [Helling 0%] [Helling 1%] [Helling 2%]         │
├─────────────────────────────────────────────────┤
│  🔍 Gevonden karakteristieken (na verbinding)   │
│  00002ad9-... [write, indicate]                  │
│  00002acd-... [notify]                           │
├─────────────────────────────────────────────────┤
│  📋 Log (max 120 regels, omgekeerd chronologisch)│
│                              [Wissen]            │
│  [10:23:14] ✅ Verbonden!                        │
│  [10:23:13] Request Control (0x00) ✓             │
│  [10:23:12] FTMS service (0x1826) ✓              │
│  [10:23:11] GATT verbonden ✓                     │
│  [10:23:10] Apparaat: Loopband Pro 3000          │
│  ...                                             │
└─────────────────────────────────────────────────┘
```

### 6.4 Verbindingskaart
- **StatusDot**: gekleurde stip met statuslabel:
  - Grijs + "Niet verbonden"
  - Oranje + "Verbinden…"
  - Groen (met gloed) + "Verbonden"
  - Rood + "Fout"
- Apparaatnaam wordt getoond na verbinding
- Knop wisselt tussen "🔗 Verbinden" en "✕ Verbreken"

### 6.5 Live Data (6 tegels)
| Tegel | Eenheid | Kleur | Opmerking |
|---|---|---|---|
| Snelheid | km/u | Blauw | 1 decimaal |
| Helling | % | Paars | 1 decimaal |
| Afstand | km | Groen | 2 decimalen (invoer in meters) |
| Tijd | MM:SS | Oranje | Verstreken tijd |
| Hartslag | bpm | Rood | — |
| Calorieën | kcal | Geel | Geheel getal |

Worden gevuld via FTMS Treadmill Data characteristic (UUID `0x2ACD`) notificaties. Als een waarde niet aanwezig is in het signaal: `—`.

### 6.6 Bedieningsknoppen
| Knop | FTMS opcode | Bytes |
|---|---|---|
| ▶ Start | 0x07 | `[0x07]` |
| ⏸ Pauze | 0x08 | `[0x08, 0x02]` |
| ■ Stop | 0x08 | `[0x08, 0x01]` |

### 6.7 Snelheid aanpassen
- Aanpasrij met knoppen: −1, −0.5, −0.1, huidige waarde, +0.1, +0.5, +1
- Waarde wordt lokaal opgeslagen totdat op "Stuur" gedrukt wordt
- Bereik: 0 – 30 km/u (geconverteerd naar uint16 × 0.01 km/u; FTMS opcode 0x02)

### 6.8 Helling aanpassen
- Aanpasrij: −2, −1, −0.5, huidige waarde, +0.5, +1, +2
- Bereik: −3% tot +15% (geconverteerd naar int16 × 0.1%; FTMS opcode 0x03)
- Negatieve waarden: two's complement (16-bit)

### 6.9 Handmatig hex-commando
- Invoerveld met monospacefont
- Enter-toets of "Stuur"-knop verstuurt bytes
- Input-formaat: bytes gescheiden door spaties, komma's of puntkomma's, bijv. `02 E8 03`
- Preset-knoppen vullen het invoerveld én versturen direct:
  - `Req Control` = `00`
  - `Reset` = `01`
  - `Start` = `07`
  - `Stop` = `08 01`
  - `6 km/u` = `02 58 02`
  - `8 km/u` = `02 20 03`
  - `10 km/u` = `02 E8 03`
  - `12 km/u` = `02 B0 04`
  - `Helling 0%` = `03 00 00`
  - `Helling 1%` = `03 0A 00`
  - `Helling 2%` = `03 14 00`

### 6.10 Gevonden karakteristieken
Wordt gevuld na verbinding. Toont alle FTMS karakteristieken met hun properties (bijv. `[write, indicate]`). Dient als diagnostische tool.

### 6.11 Log
- Maximaal 120 berichten
- Omgekeerd chronologisch (nieuwste bovenaan)
- Kleurcodering:
  - ❌ rood = fout
  - ✅ / ✓ groen = succes
  - 📡 / 📨 grijs = raw data/notifications
  - Anders: donkergrijs
- Wissen-knop verwijdert alle regels
- CP-respons parsing: opcode 0x80 geeft `opcode XX: Succes ✓ / Niet ondersteund / Ongeldige param / Mislukt / ...`

### 6.12 Verbindingsproces (technisch)
1. FTMS-filter (`services: [0x1826]`) — werkt voor loopbanden die zich adverteren als FTMS
2. Fallback: `acceptAllDevices: true` met `optionalServices: [0x1826]` — voor apparaten die FTMS niet in advertisement zetten
3. Na GATT verbinding: alle primaire services enumereren (diagnostisch)
4. FTMS service ophalen + alle karakteristieken enumereren
5. Notificaties starten op alle notifiable karakteristieken
6. Control Point (0x2AD9) aparte handler voor CP-respons parsing
7. Request Control (opcode 0x00) versturen — **verplicht** vóór alle andere commando's
8. Status → "Verbonden"

---

## 7. Hamburgermenu (Drawer)

### 7.1 Lay-out
Slide-in van rechts, breedte 400px (max 90vw), full-height. Achtergrond-overlay sluit het menu bij klikken buiten.

```
┌───────────────────────────────────────┐
│  🏃‍♂️ Trainer App              [✕]      │  ← Header (paars gradient)
│  Training Management                  │
├───────────────────────────────────────┤
│  🎯 Trainingsschema's (alleen ingelogd)│
│  [Schema dropdown ▼]                  │  ← SchemaSelector component
│                                       │
│  Beheer:                              │
│  [📝 Bewerken]                        │
│  [➕ Nieuw]          (todo)           │
│  [📋 Kopiëren]       (todo)           │
│  [🗑️ Verwijderen]    (todo)           │
├───────────────────────────────────────┤
│  👤 Account                           │
│  Ingelogd                             │
│  gebruiker@example.com                │
│  [🚪 Uitloggen]                       │
│  —— of —— (niet ingelogd):            │
│  [email input]                        │
│  [🔐 Stuur login-link]                │
├───────────────────────────────────────┤
│  🏃 Loopband                          │
│  [🔗 Loopband Verbinden & Bedienen]   │
├───────────────────────────────────────┤
│  ℹ️ Informatie                        │
│  Versie: 2.0                          │
│  Cloud Sync: ✅ Actief / ❌ Login      │
│  Made with ❤️ for training             │
└───────────────────────────────────────┘
```

### 7.2 SchemaSelector (in menu)
- Dropdown met alle beschikbare schema's voor de ingelogde gebruiker
- Actief schema heeft `(actief)` achter de naam
- Selecteren activeert het schema en herlaadt het trainingsscherm automatisch (via `schemaVersion` counter)
- ➕ Nieuw Schema: vraagt naam via `prompt()`, maakt nieuw schema aan met standaarddata

### 7.3 Account sectie
**Ingelogd:**
- Groene kaart met "Ingelogd" + e-mailadres
- Uitloggen knop (rood): `supabase.auth.signOut()`

**Niet ingelogd:**
- E-mailinvoer + knop "Stuur login-link"
- Verstuurt een Magic Link via Supabase Auth OTP
- Redirect URL: `localhost` in development, `https://jochem77.github.io/trainer-app/` in productie
- Na klikken op de link in de e-mail wordt de gebruiker ingelogd en de URL-hash verwijderd

---

## 8. Authenticatie

### 8.1 Methode
Magic Link (Supabase Auth OTP). De gebruiker voert zijn e-mailadres in en ontvangt een eenmalige inloglink. Geen wachtwoord vereist.

### 8.2 Sessie
- Auto-refresh: ja
- Sessie persistentie: ja (localStorage)
- Auto-detectie URL hash: ja (voor Magic Link callback)

### 8.3 Gastmodus
De app is volledig bruikbaar zonder account, met het lokale standaardschema (12 weken, opgeslagen in `src/backups/schema.json`). Schema's worden dan niet opgeslagen in de cloud.

---

## 9. Datalaag — Supabase

### 9.1 Tabel: `user_schemas`
| Kolom | Type | Omschrijving |
|---|---|---|
| `id` | UUID / serial | Primary key |
| `user_id` | UUID | Verwijst naar `auth.users` |
| `schema_data` | JSONB | Volledig weekprogramma als JSON-array |
| `schema_name` | text | Naam van het schema |
| `is_active` | boolean | Of dit het actieve schema is voor de gebruiker |
| `start_date` | date | Startdatum van het programma (gebruikt voor weekberekening) |
| `created_at` | timestamptz | Aanmaakmtijdstip |
| `updated_at` | timestamptz | Laatste bijwerkmoment |

### 9.2 Backward compatibility
De applicatie heeft fallback-logica voor drie dataformaten:
1. **Huidig formaat** (v2): schema_name, is_active, start_date kolommen aanwezig
2. **Legacy formaat** (v1): alleen schema_data; schema_name ingebed in de JSON als `{ schema_name, weeks }`
3. **Oud formaat** (v0): stappen met `tijd`/`beschrijving` velden i.p.v. `duration_min`/`label`

Bij laadfouten door ontbrekende kolommen (PostgreSQL error code `42703`) schakelt de app automatisch naar het lagere formaat.

### 9.3 Schema JSON-structuur

```json
[
  {
    "week": 1,
    "cal": 350,
    "steps": [
      {
        "type": "steady",
        "label": "Warming-up",
        "speed_kmh": 6,
        "duration_min": 5,
        "repeats": 1,
        "speed_increase_kmh": 0
      },
      {
        "type": "interval_pair",
        "repeats": 8,
        "hard": {
          "label": "Interval hard",
          "speed_kmh": 10.5,
          "duration_min": 1,
          "speed_increase_kmh": 0.1
        },
        "rest": {
          "label": "Interval rust",
          "speed_kmh": 6,
          "duration_min": 2,
          "speed_increase_kmh": 0
        }
      }
    ]
  }
]
```

### 9.4 Data-transformatie (flattenSteps)
Vóór weergave in het trainingsscherm worden de schema-stappen afgevlakt naar een lineaire lijst met exacte seconde-offsets:

```
steady (1×):    → 1 stap
steady (N×):    → N stappen (met snelheidstoename per herhaling)
interval_pair:  → 2×N stappen (hard₁, rust₁, hard₂, rust₂, ...)
```

Elke afgevlakte stap heeft: `label`, `duration_min`, `duration_sec`, `speed_kmh`, `start_min`, `start_sec`, `type`, `repIndex?`.

---

## 10. Bluetooth FTMS Integratie

### 10.1 Protocol
**Fitness Machine Service (FTMS)** — Bluetooth GATT service UUID `0x1826`

Gebruikte karakteristieken:
| UUID | Naam | Gebruik |
|---|---|---|
| `0x2AD9` | Fitness Machine Control Point | Schrijven van commando's |
| `0x2ACD` | Treadmill Data | Uitlezen live data (notify) |
| `0x2ADA` | Fitness Machine Status | Statuswijzigingen (subscribe) |

### 10.2 FTMS Opcodes
| Opcode | Hex | Beschrijving | Bytes |
|---|---|---|---|
| Request Control | 0x00 | Verplicht vóór alle andere commando's | `[0x00]` |
| Set Target Speed | 0x02 | Snelheid instellen | `[0x02, lo, hi]` (uint16, ×0.01 km/h) |
| Set Target Inclination | 0x03 | Helling instellen | `[0x03, lo, hi]` (int16, ×0.1%) |
| Start or Resume | 0x07 | Loopband starten of hervatten | `[0x07]` |
| Stop or Pause | 0x08 | Stoppen (0x01) of pauzeren (0x02) | `[0x08, 0x01]` of `[0x08, 0x02]` |
| Reset | 0x01 | Reset | `[0x01]` |

### 10.3 useTreadmill hook
De hook `src/lib/useTreadmill.ts` beheert de Bluetooth-verbinding centraal:

**Geëxporteerde interface:**
```typescript
{
  btStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  btDeviceName: string;
  connect(): Promise<void>;
  disconnect(): void;
  sendSpeed(speed: number): Promise<void>;
  sendInclination(incl: number): Promise<void>;
  start(): Promise<void>;
  pause(): void;   // start geleidelijk afremmen
  writeCp(bytes: number[]): Promise<void>;
}
```

**Gedrag van `pause()`:**
- Remt de loopband geleidelijk af met stappen van 0.5 km/u per 400ms
- Zodra snelheid ≤ 0: stuurt speed=0 dan FTMS Pause (0x08 0x02)
- Het afreminterval wordt geannuleerd als er tussentijds een `sendSpeed()` of `start()` call binnenkomt

**Opslaan van huidige snelheid:**
- `sendSpeed()` werkt `currentSpeedRef` bij zodat `pause()` weet waar de snelheid staat

**Write methode:**
1. Probeert `writeValueWithResponse`
2. Fallback naar `writeValueWithoutResponse`
3. Fouten worden stil genegeerd

**Reconnect na disconnect:**
Geen automatische reconnect; gebruiker moet handmatig opnieuw verbinden.

### 10.4 Integratie in trainingsscherm
**Auto-send snelheid:**
- `useEffect` observeert `[currentIdx, running, btStatus]`
- Als running && connected: stuurt snelheid van de huidige stap
- Als stap type = `'end'`: roept `btPause()` aan (loopband remt af)

**Start/Pauze knop:**
- Klik op Start: `setRunning(true)` + `btStart()` (als verbonden)
- Klik op Pauze: `setRunning(false)` + `btPause()` (als verbonden)

---

## 11. Hosting en Deployment

### 11.1 GitHub Pages
- Repository: `https://github.com/Jochem77/trainer-app`
- Live URL: `https://jochem77.github.io/trainer-app/`
- Branch: `main`

### 11.2 CI/CD via GitHub Actions
Workflow (`.github/workflows/pages.yml`):
1. Trigger: push naar `main`
2. Stap 1: `npm ci`
3. Stap 2: `npm run build` (`tsc -b && vite build`)
4. Stap 3: Deploy `dist/` naar GitHub Pages

### 11.3 Vite build
- Output: `dist/`
- Assets: hash-gebaseerde bestandsnamen (cache-busting)
- Bundlegrootte: ~405 kB JS (gzip: ~115 kB), ~0.7 kB CSS

---

## 12. Niet-functionele vereisten

### 12.1 Responsiveness
- Maximale breedte: 720px (trainingsscherm), 900px (schema-editor), 560px (loopbandpagina)
- Gecentreerd op brede schermen
- Mobile breakpoints:
  - `≤ 768px`: kleinere padding, kleinere grafiek
  - `≤ 520px`: kleinere font-sizes in status card
  - `≤ 480px`: grafiekhoogte 90px

### 12.2 Safe area support
- `env(safe-area-inset-top)` en `env(safe-area-inset-bottom)` voor notch/thuisbalk op iOS en Android
- `100dvh` via `@supports` voor correcte full-screen weergave

### 12.3 Performance
- `flattenSteps()` is gememoized via `useMemo` (herberekend alleen bij schema-wijziging)
- Timer tickt elke 200ms via `setInterval`, maar gebruikt `Date.now()` voor drift-vrije tijdmeting

### 12.4 PWA kenmerken
- Wake Lock API: houdt scherm aan tijdens training
- Werkt als standalone webpagina (geen native app vereist)
- Geen service worker / offline support in huidige versie

---

## 13. Bekende beperkingen en toekomstige wensen

| # | Beperking / Wens | Status |
|---|---|---|
| 1 | Menu-knoppen "Nieuw", "Kopiëren" en "Verwijderen" zijn nog niet functioneel (`alert` placeholder) | Open |
| 2 | Geen offline-ondersteuning (service worker) | Open |
| 3 | Bluetooth werkt niet op iOS/Safari | Platform-beperking |
| 4 | Geen automatische reconnect na Bluetooth-verbreking | Open |
| 5 | Enkel één actief schema per gebruiker tegelijk | Open |
| 6 | Geen hartslag-integratie in trainingsscherm | Open |
| 7 | Geen helling-sync naar loopband vanuit trainingsschema | Open |
| 8 | Geen gedeelde/publieke schema's | Open |
| 9 | Geen trainingshistorie of statistieken | Open |
| 10 | Geen notificaties of push-alerts | Open |

---

## 14. Projectstructuur

```
trainer-app/
├── src/
│   ├── App.tsx               # Hoofdcomponent + routing + alle schermcomponenten
│   ├── TreadmillPage.tsx     # Loopband diagnostisch scherm
│   ├── SchemaEditor.tsx      # Schema-bewerkingsscherm
│   ├── main.tsx              # React root render
│   ├── ErrorBoundary.tsx     # React error boundary
│   ├── index.css             # Globale CSS (minimaal)
│   ├── types.ts              # Globale TypeScript types
│   ├── backups/
│   │   └── schema.json       # Standaard 12-weken schema (fallback voor gasten)
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client initialisatie
│   │   └── useTreadmill.ts   # Bluetooth FTMS hook
│   └── assets/               # Statische assets
├── database/
│   ├── supabase-schema.sql   # Database schema
│   └── *.sql                 # Migraties
├── docs/
│   ├── HANDLEIDING.md        # Gebruikershandleiding
│   └── PRD.md                # Dit document
├── public/                   # Publieke bestanden
├── .github/workflows/
│   └── pages.yml             # CI/CD GitHub Actions
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

*Einde PRD*
