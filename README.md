# Trainer App - Persoonlijke Trainingsplanner

Een webapplicatie voor het plannen en volgen van je trainingsschema's. Ontwikkeld met React, TypeScript, Vite en Supabase.

🏃‍♂️ **Live app**: [https://jochem77.github.io/trainer-app/](https://jochem77.github.io/trainer-app/)

---

## Inhoudsopgave
1. [Introductie](#introductie)
2. [Features](#features)
3. [Technische Stack](#technische-stack)
4. [Aan de Slag](#aan-de-slag)
5. [Gebruikershandleiding](#gebruikershandleiding)
6. [Development](#development)
7. [Deployment](#deployment)

---

## Introductie

De Trainer App is een persoonlijke trainingsplanner waarmee je je eigen trainingsschema kunt maken en volgen. De app berekent automatisch welke week je in je trainingsprogramma zit op basis van de startdatum.

## Features

✅ **Schema Management**
- Meerdere trainingsschema's beheren
- Aangepaste startdatum per schema
- Week-voor-week trainingsplanning

✅ **Training Types**
- Steady trainingen (doorlopend tempo)
- Interval trainingen (hard/rust afwisseling)
- Aanpasbare snelheid, duur en herhalingen

✅ **Week Management**
- Weken toevoegen, kopiëren en verwijderen
- Drag & drop om weken te herschikken
- Onbeperkt aantal weken

✅ **Statistieken**
- Totale trainingstijd per week
- Geschatte afstand in kilometers
- Calorieën verbranding

✅ **User Management**
- Supabase authenticatie (magic link)
- Persoonlijke schema's per gebruiker
- Cloud sync van je data

## Technische Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Backend**: Supabase (PostgreSQL + Auth)
- **Deployment**: GitHub Pages
- **Styling**: Inline styles (CSS-in-JS)

## Aan de Slag

### Vereisten

- Node.js 18+
- npm of yarn
- Supabase account

### Installatie

1. Clone de repository:
```bash
git clone https://github.com/Jochem77/trainer-app.git
cd trainer-app
```

2. Installeer dependencies:
```bash
npm install
```

3. Maak een `.env` bestand met je Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run database migratie:
```sql
-- Voer uit in Supabase SQL Editor
-- Zie: add-start-date-column.sql
```

5. Start development server:
```bash
npm run dev
```

---

## Gebruikershandleiding

### Inloggen

1. Open de app op [https://jochem77.github.io/trainer-app/](https://jochem77.github.io/trainer-app/)
2. Klik op **"Inloggen met E-mail"**
3. Vul je e-mailadres in
4. Klik op **"Stuur Magic Link"**
5. Check je e-mail en klik op de link om in te loggen

### Hoofdscherm

#### Week Navigatie

Bovenaan zie je de huidige week in je trainingsprogramma:
```
← Week 13 →
```
- Gebruik de **pijltjes** om tussen weken te navigeren
- De app toont automatisch de huidige week op basis van je startdatum

#### Week Informatie

Onder de week zie je:
- **Datum periode**: bijv. "23 nov - 29 nov"
- **Calorieën**: Geschatte calorieverbranding voor die week

#### Trainingsoverzicht

Voor elke week zie je:
- **Totale trainingstijd** in minuten
- **Totale afstand** in kilometers
- **Geschatte calorieën** verbranding

#### Trainingsstappen

Elke training bestaat uit stappen:

**Steady Stappen** (doorlopend tempo):
- **Label**: bijv. "Warming-up", "Cool-down", "Basis tempo"
- **Snelheid**: in km/u
- **Duur**: in minuten
- **Herhalingen**: aantal keer dat deze stap herhaald wordt

**Interval Stappen** (hard/rust afwisselend):
- **Hard interval**: snelheid en duur
- **Rust interval**: snelheid en duur
- **Aantal herhalingen**: hoeveel keer het hard/rust patroon herhaald wordt

#### Knoppen

- **📊 Stats**: Bekijk trainingsstatistieken
- **✏️ Schema Editor**: Bewerk je trainingsschema
- **🚪 Uitloggen**: Log uit van de app

### Schema Editor

Klik op **"✏️ Schema Editor"** om je trainingsschema te bewerken.

#### Schema Naam

Geef je schema een herkenbare naam, bijvoorbeeld:
- "10K Voorbereiding"
- "Marathon Training"
- "Basis Conditie"

#### Startdatum Programma

Stel de startdatum in van je trainingsprogramma. De app berekent automatisch in welke week je zit op basis van deze datum.

**Voorbeeld:**
- Startdatum: 31 augustus 2025
- Vandaag: 13 december 2025
- Huidige week: Week 15

#### Week Manager

Hier zie je alle weken in je schema:

**Week toevoegen:**
1. Klik op **"➕ Week Toevoegen"**
2. Er wordt een nieuwe lege week toegevoegd

**Week kopiëren:**
1. Klik op het **📄 icoon** bij een week
2. Er wordt een kopie gemaakt van die week

**Week verwijderen:**
1. Klik op het **🗑️ icoon** bij een week
2. De week wordt verwijderd

**Weken herschikken:**
1. Sleep een week met je muis
2. Plaats deze tussen twee andere weken
3. De week wordt op de nieuwe positie ingevoegd

#### Training Stappen Bewerken

Klik op een week om de trainingsstappen te bewerken.

**Stap Toevoegen:**

1. **Steady (doorlopend tempo):**
   - Klik op **"+ Steady"**
   - Vul in:
     - **Label**: bijv. "Warming-up", "Basis tempo"
     - **Snelheid**: km/u (bijv. 10)
     - **Duur**: minuten (bijv. 5)
     - **Herhalingen**: aantal keer (meestal 1)

2. **Interval (hard/rust):**
   - Klik op **"+ Interval"**
   - Vul in voor **Hard**:
     - **Label**: bijv. "Sprint"
     - **Snelheid**: km/u (bijv. 14)
     - **Duur**: minuten (bijv. 1)
   - Vul in voor **Rust**:
     - **Label**: bijv. "Herstel"
     - **Snelheid**: km/u (bijv. 8)
     - **Duur**: minuten (bijv. 2)
   - **Herhalingen**: aantal keer dit patroon (bijv. 5)

**Stap Bewerken:**
1. Klik op een bestaande stap
2. Pas de waarden aan
3. De wijzigingen worden automatisch bijgewerkt

**Stap Verplaatsen:**
1. Gebruik de **⬆️** en **⬇️** knoppen
2. De stap wordt omhoog of omlaag verplaatst

**Stap Verwijderen:**
1. Klik op het **🗑️** icoon
2. De stap wordt verwijderd

#### Opslaan

1. Klik op **"💾 Opslaan"** (rechts bovenaan)
2. Je ziet de status:
   - **💾 Opslaan...**: Bezig met opslaan
   - **✅ Opgeslagen**: Succesvol opgeslagen
   - **❌ Fout bij opslaan**: Er is iets misgegaan

**Let op**: De knop is alleen actief als je wijzigingen hebt gemaakt (je ziet dan **⚠️ Niet opgeslagen wijzigingen**).

### Training Uitvoeren

#### Trainingsweergave

Voor elke stap zie je:

**Steady stappen:**
```
🏃 Warming-up
⚡ 10 km/u | ⏱️ 5 min
```

**Interval stappen:**
```
💨 Intervaltraining (5x)

Hard: Sprint
⚡ 14 km/u | ⏱️ 1 min

Rust: Herstel  
⚡ 8 km/u | ⏱️ 2 min
```

#### Statistieken

Onderaan elke training zie je:
- **Totale tijd**: Som van alle stappen (inclusief herhalingen)
- **Totale afstand**: Berekend op basis van snelheid × tijd
- **Calorieën**: Geschatte verbranding (ongeveer 1 cal per kg lichaamsgewicht per km)

### Tips & Tricks

#### Een Goed Trainingsschema Opbouwen

1. **Start met warming-up** (5-10 min, lage snelheid)
2. **Bouw intensiteit op** (geleidelijk harder)
3. **Eindig met cool-down** (5-10 min, lage snelheid)

**Voorbeeld trainingsweek:**
- Week 1-4: Basis opbouwen (30-40 min steady)
- Week 5-8: Intervallen toevoegen
- Week 9-12: Langere afstanden

#### Startdatum Instellen

- Stel de startdatum in op de **zaterdag** dat je begint
- De app berekent weken van zaterdag tot vrijdag
- Wijzig de startdatum als je opnieuw wilt beginnen

#### Weken Kopiëren

Gebruik de kopieer functie om:
- Een succesvolle week te herhalen
- Een basisweek als template te gebruiken
- Snel variaties te maken

#### Interval Training

Intervallen zijn perfect voor:
- **Snelheid opbouwen**: Korte sprints (30 sec - 1 min)
- **VO2 max verbeteren**: Middellange intervallen (2-3 min)
- **Tempo training**: Langere intervallen (5-10 min)

Stel altijd genoeg rusttijd in tussen intervallen!

### Problemen Oplossen

#### Ik kan niet opslaan

**Mogelijke oorzaak**: Database kolom ontbreekt

**Oplossing**: 
1. Ga naar Supabase dashboard
2. Open SQL Editor
3. Voer het script uit: `add-start-date-column.sql`

#### Verkeerde week wordt getoond

**Controleer**:
1. Is de startdatum correct ingesteld?
2. Staat je systeemdatum correct?
3. Klik op de pijltjes om handmatig te navigeren

#### Wijzigingen worden niet opgeslagen

**Let op**:
1. Klik altijd op **"💾 Opslaan"** 
2. Wacht op **"✅ Opgeslagen"** bevestiging
3. Check je internetverbinding

#### Ik zie geen schema's

**Mogelijke oorzaken**:
1. Je bent niet ingelogd - log opnieuw in
2. Je hebt nog geen schema gemaakt - maak een nieuw schema
3. Database connectie probleem - herlaad de pagina

### Veelgestelde Vragen

**Q: Kan ik mijn schema's delen met anderen?**  
A: Momenteel niet, elk account heeft eigen schema's.

**Q: Werkt de app offline?**  
A: Nee, je hebt een internetverbinding nodig voor opslaan en laden.

**Q: Hoeveel schema's kan ik maken?**  
A: Momenteel één actief schema per account.

**Q: Kan ik mijn oude schema terugzien?**  
A: Ja, alle wijzigingen worden opgeslagen in de database (geen versiebeheer).

**Q: Hoe bereken ik mijn trainingssnelheid?**  
A: Gebruik je normale loopsnelheid als basis. Bijvoorbeeld: 10 km/u = 6 min/km.

---

## Development

### Project Structuur

```
trainer-app/
├── src/
│   ├── App.tsx              # Hoofdcomponent met training display
│   ├── SchemaEditor.tsx     # Schema editor component
│   ├── lib/
│   │   └── supabase.ts      # Supabase client configuratie
│   └── types.ts             # TypeScript type definities
├── public/                   # Statische bestanden
├── dist/                     # Build output (gegenereerd)
└── add-start-date-column.sql # Database migratie script
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build voor productie
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Database Schema

```sql
CREATE TABLE user_schemas (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  schema_data JSONB NOT NULL,
  schema_name TEXT DEFAULT 'Mijn Trainingsschema',
  is_active BOOLEAN DEFAULT true,
  start_date DATE DEFAULT '2025-08-31',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, schema_name)
);
```

### Migrations

Voer `add-start-date-column.sql` uit in Supabase SQL Editor om de `start_date` kolom toe te voegen aan bestaande databases.

---

## Deployment

### GitHub Pages

De app wordt automatisch gedeployed naar GitHub Pages bij elke push naar `main`.

**Handmatige deployment:**

```bash
npm run build
git add dist -f
git commit -m "Deploy to GitHub Pages"
git push
```

**GitHub Pages configuratie:**
- Source: Deploy from a branch
- Branch: `main`
- Folder: `/dist` (of root als dist is committed)

### Supabase Setup

1. Maak een Supabase project aan
2. Kopieer de URL en Anon Key
3. Voeg toe aan environment variables
4. Run de database migraties
5. Configureer Row Level Security (RLS) policies:

```sql
-- Gebruikers kunnen alleen hun eigen schema's zien
CREATE POLICY "Users can view own schemas" ON user_schemas
  FOR SELECT USING (auth.uid() = user_id);

-- Gebruikers kunnen alleen hun eigen schema's aanmaken
CREATE POLICY "Users can insert own schemas" ON user_schemas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Gebruikers kunnen alleen hun eigen schema's updaten
CREATE POLICY "Users can update own schemas" ON user_schemas
  FOR UPDATE USING (auth.uid() = user_id);

-- Gebruikers kunnen alleen hun eigen schema's verwijderen
CREATE POLICY "Users can delete own schemas" ON user_schemas
  FOR DELETE USING (auth.uid() = user_id);
```

---

## Support

Heb je vragen of problemen? 

- **Issues**: [github.com/Jochem77/trainer-app/issues](https://github.com/Jochem77/trainer-app/issues)
- **Source**: [github.com/Jochem77/trainer-app](https://github.com/Jochem77/trainer-app)

---

## License

MIT

---

**Veel succes met je training! 🏃‍♂️💪**
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
