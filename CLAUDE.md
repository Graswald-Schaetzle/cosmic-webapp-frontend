# Cosmic – Basiswissen für jede Session

Antworte dem Nutzer immer auf Deutsch (Code, Commit-Messages und Bezeichner bleiben englisch).

## Worum es geht
Cosmic ist eine Web-App für digitale Räume ("Spaces"): ein per Gaussian Splat erfasster 3D-Raum wird mit Aufgaben, Listen,
Dokumenten, Tags, Benachrichtigungen, Kalender und Wetter verknüpft.
Zentrales Domänenobjekt ist der **Space** (Mitgliedschaften, Floors, Rooms, Tags hängen daran).
Der **Splat-Viewer** (.spz + collision.glb, z. B. Spaitial-Importe) ist der Hauptweg. Dazu gehören Minimap, Space-Koordinatensystem
mit Kalibrierung und ein Start-Space pro Nutzer.
**Matterport wird perspektivisch ersetzt**: kein neuer Code und keine neuen Features dafür; Neues nur für den Splat-Viewer bauen.

## Mehrere Räume pro Space (Zielbild, vom Nutzer festgelegt)
- Ein Space (Haus/Wohnung) besteht aus mehreren Räumen und Stockwerken. **Jeder Raum hat seinen eigenen Splat**
  (eigener `reconstruction_job` mit `room_id`, Aufnahme über die iOS-App und SpAItial Echo-3).
- Aufgenommen wird Raum für Raum bei **geschlossenen Türen**: Ein Splat wird beendet, dann beginnt im nächsten Raum ein neuer.
- Warum: Ändert sich in einem Raum etwas, muss nur dieser Raum neu gefilmt werden. Bei geschlossenen Türen steckt kein veralteter Nachbarraum im Splat;
  bei offenen Türen wären die Räume nach einer Neuaufnahme nicht mehr synchron. Kleinere Splats laden außerdem schneller.
- Der Viewer lädt zuerst den **Startraum**. Er ist **pro Space festlegbar**; ohne Festlegung gilt der Raum des **allerersten Fotos** des Spaces.
  Alle weiteren Räume werden **nachgeladen, sobald man an der Tür bzw. Schwelle zum nächsten Raum steht oder ihn betritt**, nicht alle auf einmal.
- Ausrichtung der Räume: Der Nutzer markiert in der iOS-App die Tür zum nächsten Raum und startet dort direkt hinter der Tür.
  Das ergibt eine grobe Zuordnung des Übergangs, auch wenn das ARKit-Tracking abreißt (Details: `cosmic-ios/docs/echo3-capture-plan.md`).
- Stand im Code (Viewer, Schritt 5 des Plans, umgesetzt; mit echten Mehrraum-Daten noch nicht geprüft):
  - **API** (`src/api/spaces/spacesApi.ts`): `getSpaceRooms` (`GET /spaces/:id/rooms`) und `setSpaceStartRoom`
    (`PUT /spaces/:id/start-room`). Vertrag: `cosmic-backend/docs/multi-room-spaces.md`.
  - **Umschaltung** (`SplatBackground`): Hat der Space mindestens einen Raum mit Status `completed` und Splat, läuft der
    Mehrraum-Modus (`SplatScene`-Prop `rooms`). Sonst (`rooms: []`, Anfrage fehlgeschlagen) gilt unverändert der
    Ein-Splat-Weg über `latest_job` und `GET /reconstruction-jobs/:id/output`. Die Szene startet erst, wenn die Raum-Anfrage
    beantwortet ist. `space_frame` kommt im Mehrraum-Modus aus dem Job-Output des Startraums.
    `ViewerSwitch` zeigt den Splat-Viewer auch dann, wenn nur Räume (kein fertiger `latest_job`) vorhanden sind.
  - **Reine Logik mit Tests** (`src/features/splat/roomLayout.ts`): Raum-Matrix = Space-Platzierung ∘ `room_frame`, Türen in den
    Space-Frame, aktueller Raum, Lade-/Sichtbarkeitsmenge, Startraum, Einstiegsposition.
    `multiRoomController.ts` wendet das auf die Raum-Einheiten an, `roomSplat.ts` ist eine Einheit (eigenes `SplatMesh`
    plus optionales Kollisionsmesh), `RoomSwitcher.tsx` die Raumliste.
  - **Laden**: Startraum zuerst. Ein Nachbarraum lädt, sobald die Kamera höchstens 1,5 m (horizontal) von der Türschwelle
    entfernt ist und die Schwelle ungefähr auf Fußhöhe liegt (±1,2 m). Nie alle Räume auf einmal.
  - **Aktueller Raum**: Wechsel, wenn die Kamera mehr als 0,3 m hinter der Türebene steht (Türposition + Normale, seitlich
    Türbreite/2 + 0,6 m); zurück erst 0,3 m auf der anderen Seite. Ersatz ohne Tür (man kann durch Wände gehen): Ist die Kamera
    mehr als 0,5 m außerhalb der Bounding-Box des aktuellen Raums, gewinnt der geladene Raum, dessen Box sie enthält, sonst
    der Raum hinter der nächsten durchschrittenen Tür (bis 4 m).
  - **Speicher**: Im Speicher bleiben der aktuelle Raum und seine bereits geladenen direkten Nachbarn (höchstens 4 Räume;
    darüber fliegen die Nachbarn mit den entferntesten Türen raus, aber nur jenseits von 3 m). Räume, die zwei Türen entfernt
    sind, werden entsorgt (`SplatMesh.dispose()`). Angezeigt werden nur der aktuelle Raum und Nachbarn, deren Tür höchstens
    3 m entfernt ist.
  - **Neuaufnahme**: Eine Einheit hängt an der `job_id` des Raums. Ändert sie sich, wird nur dieser Raum ersetzt.
    Solange ein Raum `processing` ist, wird die Raumliste alle 30 s neu abgefragt.
  - **Raumliste** (Pille unten rechts, Glas-HUD): Räume nach Stockwerk, Tippen springt in den Raum (Einstieg 1,8 m hinter der
    Eingangstür, sonst Mitte des Splats). Stern = „Als Startraum festlegen“, darunter „Startraum automatisch wählen“.
    Räume mit `processing`/`failed` sind deaktiviert. Räume ohne `room_frame` („Nicht ausgerichtet“) werden allein gezeigt,
    solange man darin ist; die Tags des Spaces sind dort ausgeblendet.
  - **Ohne Kollisionsmesh** (bei Raum-Aufnahmen bisher immer): Gehen auf fester Augenhöhe (1,6 m über der Türschwelle), keine
    Wände. Minimap, Kalibrieren, Tag-Anlegen per Rechtsklick/Langdruck und Tag-Objekte sind im Mehrraum-Modus aus;
    vorhandene Tags werden als Marker gezeigt. Hat ein Raum ein `collision_url`, dient das Mesh für Bodenhöhe, Tag-Anlegen und
    das Verdecken von Markern, aber nicht als Wand (die Türen sind in den Aufnahmen geschlossen).
  - **Vorbehalt**: Ob Echo-3 die Splats in den Capture-Koordinaten zurückgibt, ist ungeklärt. `room_frame` aus Türen ist
    deshalb eine Schätzung; Räume können sich überlappen oder Lücken haben. Der Viewer rechnet damit (nur nahe Nachbarn
    sichtbar, kein Raumwechsel innerhalb der eigenen Box, Raumliste als Ausweg), sieht dann aber nicht richtig aus.
  - Offen: Feinausrichtung der Räume, Kollisionsmeshes für Raum-Aufnahmen, Minimap über mehrere Räume, Treppen (ohne Mesh
    wechselt man das Stockwerk nur über die Raumliste), `SpaceViewerWindow`/`LazySplatViewer` zeigen weiter nur einen Splat.

## Repos (GitHub-Organisation `Graswald-Schaetzle`)
| Repo | Inhalt |
|---|---|
| `cosmic-webapp-frontend` | React-Frontend (aktuell) |
| `cosmic-backend` | Node/Express-API und Supabase-Migrationen |
| `cosmic-infra` | Infrastruktur (privat) |
| `cosmic-ios` | iOS-App |
| `cosmic` | älteres Repo |
| `cosmic-webapp-fe`, `cosmic-webapp-be`, `cosmic-webapp-infra` | Vorgänger, nicht mehr aktiv – nicht verwenden |

Aktuelle Arbeit passiert in `cosmic-webapp-frontend` und `cosmic-backend`. Default-Branch ist `main`.

## Stack
**Frontend**: React 18, TypeScript, Vite, MUI + Tailwind (v4, shadcn-Stil in `src/components/ui`, Icons: lucide und MUI-Icons),
Redux Toolkit/RTK Query, React Router, `three` + `@sparkjsdev/spark` für Splats.
Struktur nach Features in `src/features/*` (splat, spaces, reconstruction, tasks, documents, list, mattertag, notifications, calendar, dashboard, ...),
API-Layer in `src/api/*`, Kontexte in `src/contexts/*`.
Befehle: `npm install`, `npm run dev`, `npm run build` (= `tsc && vite build`), `npm run lint` (0 Warnings erlaubt),
`npm run type-check`, `npm run format`, `npm test` (vitest).

**Backend**: Node.js, Express-Monolith (`server.js`, Routen in `app/routes/*`), Supabase-Client,
JWT-Login (`/auth/login`), Swagger unter `/api-docs`. Befehle: `yarn install`, `yarn dev`, `yarn build`, `yarn start`.
Doku: `docs/architecture.md`, `docs/domain-model.md`, `docs/space-coordinate-system.md`, `docs/minimap.md`.

## Dienste & Konnektoren
- **Supabase**: Postgres + Storage. Projekt-Ref `haaaayxcejprzqjainzp` (`https://haaaayxcejprzqjainzp.supabase.co`).
  **Splat- und Mesh-Dateien liegen in Supabase Storage**, Bucket `splats` (z. B. `splats/imports/<name>/splat.spz` und `collision.glb`).
  Dokumente liegen im Bucket `documents`.
  Schema-Änderungen immer als Migration in `cosmic-backend/supabase/migrations/` (Dateiname `YYYYMMDDNNNNNN_beschreibung.sql`).
- **GitHub**: Code, PRs, Actions.
- **Vercel**: Frontend, Live-Version `https://cosmic-webapp-frontend.vercel.app` (Projekt `cosmic-webapp-frontend`).
- **Backend-Hosting: Google Cloud Run** (Projekt `cosmic-489720`, Region `europe-west4`, Dienst `cosmic-backend`,
  URL `https://cosmic-backend-701520654148.europe-west4.run.app`). Das Backend läuft NICHT in Supabase (dort gibt es keine Backend-Edge-Functions,
  nur DB und Storage). Der Workflow `.github/workflows/deploy.yml` baut bei jedem Push auf `main` ein Docker-Image und deployt es automatisch.
  Das Frontend ruft diese URL auf (Stand 29.10.2026 im Live-Bundle auf Vercel bestätigt).
- Das Frontend wird ausschließlich über Vercel ausgeliefert (der frühere Cloud-Run-Workflow, `Dockerfile` und `nginx.conf` wurden entfernt).
- **Nicht mehr aktuell, nicht verwenden**: die RunPod-3D-Rekonstruktions-Pipeline (`worker/`, `infra/`, `docs/3d-pipeline.md`, Workflow `build-worker.yml`).
  Neue Splats kommen als Import (`scripts/import-splat-space.js`) nach Supabase Storage.
- Die MCP-Konnektoren (Supabase, GitHub, Vercel) werden in den Claude-Einstellungen verbunden, nicht in dieser Datei.

## Geheimnisse
Keine Keys, Passwörter oder Tokens in Dateien, Commits oder Chats schreiben. Sie liegen in GitHub-Secrets,
den Umgebungsvariablen der Dienste und der lokalen `.env` (nur Variablennamen siehe `.env.example`).
Frontend-Variablen mit `VITE_`-Präfix, u. a. `VITE_API_BASE_URL`.

## Arbeitsweise
- Änderungen direkt auf `main` committen und pushen (kein Feature-Branch, kein PR), außer der Nutzer verlangt ausdrücklich einen PR.
- Vor dem Push `npm run lint`, `npm run type-check` und `npm run build` (Frontend) laufen lassen.
- Kleine, gezielte Änderungen; bestehende Muster und Dateistruktur des jeweiligen Repos übernehmen.
- Wenn Frontend und Backend zusammenhängen (neuer Endpunkt, neue Spalte): Backend + Migration zuerst, dann Frontend.
- Jeder Push auf `main` deployt automatisch (Backend -> Cloud Run, Frontend -> Vercel): nur getestete Änderungen pushen.
- Vor dem Ändern von Datenbank oder Live-Diensten (Supabase, Vercel, Cloud Run) kurz sagen, was passiert, und bei Löschen/Überschreiben nachfragen.

## UI-Leitlinien (aus der bestehenden UI abgeleitet)
Die App ist ein **dunkler "Glas"-Look über dem 3D-Raum**: Panels schweben als halbtransparente Fenster über dem Splat.
- **Fenster/Panels**: Hintergrund `rgba(46, 46, 46, 0.35)` (Menüs/Popover `0.85`) mit `backdropFilter: blur(100px)`, kein Schatten (`boxShadow: none`),
  große Rundungen (Fenster `32px`, Menüs `16px`, Karten/Buttons `20px`, Chips/Pills und Tab-Leisten `100px`).
- **Text**: weiß (`#FFFFFF`), deaktiviert `rgba(255,255,255,0.3)`. Schrift Inter, sonst sans-serif.
  Überschriften 16 px / Gewicht 700, Fließtext und Buttons 14 px (Buttons Gewicht 600), Labels/Chips 11–12 px.
- **Flächen im Panel**: Tab-Leisten und Eingabefelder `rgba(0,0,0,0.15)`, Hover `rgba(255,255,255,0.15)`, aktiver Tab hell hinterlegt.
- **Farben**: Fehler/Löschen `#FF6B6B`; Raum-Chips orange `#FFA600`, Orte/Tags blau `#3380FF` (jeweils mit 25 % Deckkraft als Hintergrund);
  Status Erfolg `#34C759`, Warnung `#FF9500`, Gefahr `#FF3B30`.
- **Mobile-first**: Dialoge sind auf dem Handy Vollbild-Sheets von unten (`useIsMobile`, obere Ecken `24px`, `safe-area-inset-bottom` beachten);
  Minimap auf Handys ausgeblendet; keine überlappenden Menüs/Icons; Touch-Ziele groß genug.
- Neue Fenster über die vorhandene `Dialog`-Komponente (`src/components/Dialog.tsx`) und bestehende Fenster wie `MatterTagWindow` als Vorlage bauen,
  vorhandene Komponenten aus `src/components/ui` und MUI wiederverwenden, keine neue UI-Bibliothek einführen.
- Texte in der UI: Sprache wie in der jeweiligen Komponente bereits vorhanden, nicht mischen.
- Logo, Markenfarbe und Tonalität sind noch nicht festgelegt (im Code gibt es keine einheitliche Primärfarbe).

## Bekannte Stolpersteine
- Frontend-`README.md` ist teilweise veraltet (nennt Clerk und ein altes GitLab-Repo; tatsächlich läuft Login über das Backend/Supabase).
  `src/config.js` enthält noch eine alte Render-Backend-URL – maßgeblich ist `VITE_API_BASE_URL`.
- Das Wetter-Widget kann ohne Standortfreigabe `Failed to get location` loggen (harmlos).
- Browser-Screenshots der Splat-Ansicht können in der Cloud-Umgebung in ein Timeout laufen (WebGL); Logs und Netzwerk-Checks sind zuverlässiger.
