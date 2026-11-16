# FitTracker 2.0

Trainings-PWA: Wochenplan, Workout-Logging, Progression, Muskel-Analyse und KI-Coach.
Live: https://hydra-nt1.github.io/Fitnessapp/ · Demo ohne Konto: https://hydra-nt1.github.io/Fitnessapp/?demo

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · TanStack Query · Supabase (Auth, Postgres mit RLS, Edge Function) · PWA (offline-fähig)

## Funktionen

- **Heute:** Wochenleiste, geplante Einheiten, Workout starten / Check-in / Schnell-Log, Serien, Erholungsstatus je Muskel
- **Plan:** Wochenplan (mehrere Pläne pro Tag), Pläne mit Übungen, Wiederholungsbereich, Pause, Notizen, Supersätze, Vorlagen (Push/Pull/Beine …)
- **Workout:** Satz-Tracking mit kg/Wdh./RPE, Satztypen (Aufwärmen, Drop, Versagen), Supersätze, Pausentimer mit Ton & Vibration, Display bleibt an, Aufwärmsätze, Scheibenrechner, Übung ersetzen/umsortieren, läuft auch nach App-Neustart weiter
- **Progression:** Vorschlag fürs nächste Training (doppelte Progression), geschätztes 1RM, PR-Erkennung mit Zusammenfassung
- **Statistik:** Wochenvergleich, Volumen-Verlauf, Heatmap, Serien, harte Sätze pro Muskel vs. Zielbereich, Rekorde, Verlauf
- **Übungen:** 600+ Übungen mit Muskelzuordnung, eigene Übungen, Fortschrittsdiagramme
- **KI-Coach:** kennt Pläne, Workouts, Volumen & Erholung; kann Pläne direkt anlegen (API-Key bleibt auf dem Server)
- **Profil:** Körpergewicht & Maße mit Verlauf, BMI, Dunkel/Hell + Akzentfarbe, Export (CSV/JSON)
- **Offline:** Daten werden zwischengespeichert, beendete Workouts werden bei fehlender Verbindung später synchronisiert

## Einrichtung

### 1. Datenbank (einmalig)
Supabase Dashboard → Projekt → **SQL Editor** → Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen → **Run**.
Die alte Tabelle `profiles` (v1-Backup) bleibt unverändert. Beim ersten Login übernimmt die App die alten Daten automatisch in die neuen Tabellen (idempotent, kann gefahrlos wiederholt werden).

### 2. KI-Coach (optional)
1. Supabase Dashboard → **Edge Functions** → *Deploy a new function* → *Via Editor* → Name `coach` → Inhalt von [`supabase/functions/coach/index.ts`](supabase/functions/coach/index.ts) einfügen → Deploy.
2. **Edge Functions → Secrets:** `GROQ_API_KEY` setzen (kostenloser Key auf console.groq.com).

### 3. Deployment
Push auf `main` → GitHub Action baut und veröffentlicht auf GitHub Pages
(Repo → Settings → Pages → Source: **GitHub Actions**).

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173/Fitnessapp/  (…/?demo für Demo-Daten)
npm run build
```

Optional `.env.local` mit `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, sonst wird das Standard-Projekt verwendet.

Die alte Version (v1) ist unter dem Git-Tag `v1-legacy` archiviert.
