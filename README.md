# My Training Coach

Een persoonlijke trainingsplanner voor het plannen en volgen van je trainingsschema's. Ontwikkeld met React, TypeScript, Vite en Supabase.

🏃‍♂️ **Live app**: [https://jochem77.github.io/trainer-app/](https://jochem77.github.io/trainer-app/)  
📖 **Gebruikershandleiding**: [docs/HANDLEIDING.md](docs/HANDLEIDING.md)

---

## Inhoudsopgave
1. [Features](#features)
2. [Technische Stack](#technische-stack)
3. [Installatie](#installatie)
4. [Development](#development)
5. [Database Setup](#database-setup)
6. [Deployment](#deployment)
7. [Project Structuur](#project-structuur)

---

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

---

## Installatie

### Vereisten

- Node.js 18+
- npm of yarn
- Supabase account

### Setup Stappen

1. Clone de repository:
```bash
git clone https://github.com/Jochem77/trainer-app.git
cd trainer-app
```

2. Installeer dependencies:
```bash
npm install
```

3. Maak een `.env.local` bestand met je Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run database migraties (zie [Database Setup](#database-setup))

5. Start development server:
```bash
npm run dev
```

De app draait nu op `http://localhost:5173/trainer-app/`

---

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build voor productie
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Project Structuur

```
trainer-app/
├── src/
│   ├── App.tsx              # Hoofdcomponent met training display
│   ├── SchemaEditor.tsx     # Schema editor component
│   ├── ErrorBoundary.tsx    # Error handling component
│   ├── main.tsx             # Entry point
│   ├── lib/
│   │   └── supabase.ts      # Supabase client configuratie
│   └── types.ts             # TypeScript type definities
├── public/                   # Statische bestanden
├── dist/                     # Build output (gegenereerd)
├── database/                 # SQL migratie scripts
│   ├── add-start-date-column.sql
│   ├── supabase-schema.sql
│   └── ...
├── scripts/                  # Utility scripts
│   ├── reset-database-schema.js
│   └── ...
├── docs/                     # Documentatie
│   └── HANDLEIDING.md        # Gebruikershandleiding
└── backups/                  # Schema backups
```

### Code Architectuur

**App.tsx**
- Hoofdcomponent met training display
- Week navigatie en berekeningen
- Supabase data loading
- Training statistieken

**SchemaEditor.tsx**
- Schema editing interface
- Week en stap management
- Drag & drop functionaliteit
- Manual save met validatie

**types.ts**
- TypeScript interfaces voor schema structuur
- WeekProgram, SimpleStep types
- Interval en Steady step types

---

## Database Setup

### Supabase Project Aanmaken

1. Ga naar [supabase.com](https://supabase.com)
2. Maak een nieuw project aan
3. Noteer de URL en Anon Key
4. Voeg deze toe aan `.env.local`

### Database Schema

Voer het volgende SQL script uit in de Supabase SQL Editor:

```sql
-- Zie database/supabase-schema.sql voor volledig schema
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

### Row Level Security (RLS)

Configureer RLS policies om gebruikers alleen toegang te geven tot hun eigen data:

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

### Migraties

**Voor nieuwe installaties:**
Gebruik `database/supabase-schema.sql`

**Voor bestaande databases:**
Voer migratie scripts uit in volgorde:
1. `database/add-start-date-column.sql` - Voegt start_date kolom toe

**Migratie uitvoeren:**
```bash
# In Supabase SQL Editor
# Kopieer en plak de inhoud van het SQL bestand
# Klik op "Run"
```

---

## Deployment

### GitHub Pages

De app wordt automatisch gedeployed naar GitHub Pages bij elke push naar `main`.

**Configuratie in `vite.config.ts`:**
```typescript
export default defineConfig({
  base: '/trainer-app/',  // Repository naam
  plugins: [react()],
})
```

**Handmatige deployment:**

1. Build de app:
```bash
npm run build
```

2. Deploy naar GitHub Pages:
```bash
# De dist/ folder wordt automatisch gedeployed
git add dist -f
git commit -m "Deploy to GitHub Pages"
git push
```

**GitHub Pages Settings:**
- Ga naar repository Settings → Pages
- Source: Deploy from a branch
- Branch: `main`
- Folder: `/` (root) of `/dist`

### Environment Variables

Voor productie deployment:

1. **GitHub Secrets** (voor CI/CD):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. **Supabase Settings**:
   - Voeg GitHub Pages URL toe aan allowed URLs
   - Configureer email templates met correcte redirect URLs

### Build Optimalisatie

De production build bevat:
- Minified JavaScript en CSS
- Tree-shaking van ongebruikte code
- Code splitting voor betere performance
- Geoptimaliseerde assets

---

## Troubleshooting

### Development Issues

**Port 5173 is al in gebruik:**
```bash
# Kill de process
npx kill-port 5173
# Of gebruik een andere port
npm run dev -- --port 3000
```

**Type errors na npm install:**
```bash
# Clear node_modules en reinstall
rm -rf node_modules package-lock.json
npm install
```

### Database Issues

**"Column does not exist" errors:**
- Run de juiste migratie scripts
- Check of alle kolommen bestaan in de database
- Zie `database/add-start-date-column.sql`

**RLS Policy errors:**
- Controleer of RLS is ingeschakeld op de tabel
- Verify dat policies correct zijn geconfigureerd
- Check of de user authenticated is

**Connection errors:**
- Verify Supabase URL en Key in `.env.local`
- Check of het project actief is in Supabase
- Controleer network/firewall instellingen

### Build Issues

**Vite build fails:**
```bash
# Clear cache
rm -rf node_modules/.vite
npm run build
```

**TypeScript errors:**
```bash
# Check types
npx tsc --noEmit
```

---

## Contributing

1. Fork het project
2. Create een feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit je changes (`git commit -m 'Add some AmazingFeature'`)
4. Push naar de branch (`git push origin feature/AmazingFeature`)
5. Open een Pull Request

---

## License

MIT

---

## Contact & Support

- **Issues**: [github.com/Jochem77/trainer-app/issues](https://github.com/Jochem77/trainer-app/issues)
- **Repository**: [github.com/Jochem77/trainer-app](https://github.com/Jochem77/trainer-app)
- **Gebruikershandleiding**: [docs/HANDLEIDING.md](docs/HANDLEIDING.md)

---

**Ontwikkeld met ❤️ voor hardlopers en fitness enthousiastelingen**
