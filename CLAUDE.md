# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

**Development:**
```bash
npm install
npm run dev              # Start dev server on http://localhost:5173/trainer-app/
```

**Build & Deploy:**
```bash
npm run build            # Type-check and build for production
npm run lint             # Run ESLint
npm run preview          # Preview production build
```

**Key paths:** `/src` (React components), `/database` (SQL migrations), `/scripts` (utilities)

---

## Project Architecture

**Trainer App** is a personal training planner with treadmill control. Built with React 19 + TypeScript (strict mode), Vite, Supabase backend, and Bluetooth Web API for hardware integration.

### High-Level Data Flow

1. **Authentication** (Supabase magic link) → User can view/edit training schemas
2. **Schema management** (App.tsx + SchemaEditor.tsx) → Read/write schema JSON to `user_schemas` table
3. **Display & scheduling** (App.tsx) → Show current week, calculate stats, navigate weeks
4. **Treadmill control** (TreadmillPage.tsx + useTreadmill hook) → Send FTMS commands via Bluetooth

### Core Components

- **[App.tsx](src/App.tsx)**: Main display with week navigation, schema selector, stats (distance, calories, time). Loads schema from Supabase as JSON in `schema_data` field. Handles authentication check.
- **[SchemaEditor.tsx](src/SchemaEditor.tsx)**: Schema editing interface. Week/step management, drag & drop reordering, save-on-demand with validation.
- **[TreadmillPage.tsx](src/TreadmillPage.tsx)**: Treadmill control UI. Displays workout steps and sends commands via Bluetooth.
- **[useTreadmill.ts](src/lib/useTreadmill.ts)**: Custom hook wrapping Bluetooth Web API. Uses FTMS service (0x1826) and control point UUID for FTMS commands. Handles connection, sending speed/incline commands, auto-slowdown on step finish.

### Data Model

**user_schemas table** (Supabase):
```
id (BIGSERIAL)
user_id (UUID, references auth.users)
schema_name (TEXT, default: 'Mijn Trainingsschema')
schema_data (JSONB) — nested structure with weeks, steps, etc.
is_active (BOOLEAN)
start_date (DATE)
created_at, updated_at (TIMESTAMPTZ)
```

Schema structure (in schema_data field):
```typescript
{
  weeks: [
    {
      steps: [
        { label, duration_sec, speed?, repeat?, incline? }
      ]
    }
  ]
}
```

Row-level security (RLS) ensures users see only their own schemas.

### Bluetooth / Hardware Integration

- **FTMS (Fitness Machine Status Service)**: Standard Bluetooth service for treadmills.
- **useTreadmill hook**: Manages WebBluetooth connection, wraps commands.
- **Command format**: Byte arrays sent to control point characteristic (e.g., `[0x01, speed_int, speed_frac]` for speed, `[0x05, incline]` for incline).
- **Types**: `navigator.bluetooth.requestDevice()` type-augmented; see useTreadmill.ts line 37.

---

## Key Config & Constraints

### GitHub Pages Base Path
- Vite configured with `base: '/trainer-app/'` (see vite.config.ts)
- All routing assumes this base path; imports work correctly

### TypeScript Strict Mode
- `strict: true`, `noUnusedLocals`, `noUnusedParameters` enabled (tsconfig.app.json)
- All React components typed; avoid implicit `any`

### Environment Variables
- `.env.local` required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Never commit `.env.local`

### Styling
- Inline styles (CSS-in-JS) throughout; no external CSS framework
- Colors/spacing defined inline per component

---

## Typical Workflow

1. **Schema editing**: User modifies training plan in SchemaEditor.tsx, clicks save → updates Supabase.
2. **Week navigation**: App.tsx calculates week offset from start_date, displays current or selected week.
3. **Workout display**: TreadmillPage.tsx shows steps from current week, calculates ETA.
4. **Treadmill sync**: useTreadmill hook sends speed/incline updates; TreadmillPage triggers based on user input or step progression.

---

## Common Tasks

**Add a new training metric** (e.g., new step property):
- Modify schema_data structure (App.tsx, SchemaEditor.tsx)
- Update types.ts if adding type-safe interfaces
- Test serialization/deserialization in Supabase round-trip

**Extend Bluetooth commands**:
- Reference FTMS standard for command bytes
- Update useTreadmill.ts writeCp calls
- Test against real hardware if available

**Database migration**:
- Add SQL script to `/database` folder
- Document in README.md Database Setup section
- Run via Supabase SQL Editor; store backup after successful migration

**Styling changes**:
- Edit inline styles in component files
- No global CSS; prefer passing style objects as props

---

## Recent Work & Known Issues

- **BLE writes are sequential** (await per write) during step switching to prevent command collisions
- **Max incline** capped at 12% on y-axis (recent graph update)
- **Incline as dashed orange line** on right y-axis (recent visualization change)
- **Speed + incline sent at start** and incline sent at step switches
- **Decimal input handling**: defaultValue + onBlur for comma decimals (km/u inputs)

Multiple temp/backup files in `/src` (`SchemaEditor - kopie.tsx`, `SchemaEditor_temp.tsx`); can be removed if no longer in use.

---

## Troubleshooting

**Build errors after changes**:
- TypeScript strict mode is enforced; ensure all types are correct
- Run `npm run lint` to check for style issues

**Supabase auth fails**:
- Verify `.env.local` has correct Supabase credentials
- Check RLS policies are enabled on `user_schemas` table

**Bluetooth won't connect**:
- Browser must support WebBluetooth (Chrome, Edge, Opera on desktop/Android)
- FTMS device must be powered and broadcasting
- Check useTreadmill.ts error handling; user may have cancelled device picker

**Week calculations off**:
- Verify start_date is correct and matches user's intent
- App.tsx calculates week offset from start_date; edge cases around day boundaries may need adjustment
