# Projektmanagement – Frontend

## GitHub Project Board

Das Projekt-Board für das Frontend findest du unter:
**[Cosmic Frontend – Entwicklungs-Roadmap](https://github.com/Graswald-Schaetzle/cosmic-webapp-frontend/projects)**

---

## Board-Struktur

Das Board ist als **Kanban-Board** organisiert mit folgenden Spalten:

| Spalte | Bedeutung |
|--------|-----------|
| **Backlog** | Alle gesammelten Ideen und Aufgaben, noch nicht priorisiert |
| **Bereit** | Priorisierte Aufgaben, die als nächstes umgesetzt werden |
| **In Bearbeitung** | Aktuell aktiv bearbeitet (max. 2-3 Items gleichzeitig) |
| **Review / QA** | PR erstellt, wartet auf Review oder Testabnahme |
| **Erledigt** | Abgeschlossen und gemergt |

---

## Themen-Steuerung

Issues werden über **Labels** nach Themen organisiert. Dies ermöglicht gezielte Board-Filterung:

### Frontend-Themen

| Label | Farbe | Beschreibung |
|-------|-------|-------------|
| `thema: matterport` | Lila | 3D-Visualisierung und SDK |
| `thema: tasks` | Blau | Aufgabenverwaltung |
| `thema: dokumente` | Dunkelblau | Dokumentenverwaltung |
| `thema: benachrichtigungen` | Gelb | Notification-System |
| `thema: auth` | Rot | Authentifizierung (Clerk) |
| `thema: kalender` | Hellblau | Kalender-Feature |
| `thema: dashboard` | Hellblau | Dashboard |
| `thema: ui-ux` | Rosa | UI/UX Verbesserungen |
| `thema: api` | Grün | API-Integration |
| `thema: performance` | Orange | Performance |
| `thema: devops` | Dunkelrot | CI/CD und Deployment |

### Status-Labels

| Label | Bedeutung |
|-------|-----------|
| `status: backlog` | Noch nicht priorisiert |
| `status: bereit` | Bereit zur Bearbeitung |
| `status: in-bearbeitung` | Aktiv in Arbeit |
| `status: review` | Wartet auf Review |
| `status: blockiert` | Blockiert durch externe Abhängigkeit |

---

## Issue-Workflow

1. **Issue erstellen** → Vorlage auswählen (Bug / Feature / Task)
2. **Thema zuweisen** → Themen-Label setzen
3. **Status setzen** → `status: backlog` initial
4. **Priorisierung** → In Weekly-Meeting: `status: bereit`
5. **Entwicklung** → Status auf `status: in-bearbeitung` setzen
6. **PR erstellen** → Branch: `feature/thema-kurzbeschreibung`
7. **Review** → Status auf `status: review`
8. **Merge & Close** → Issue schließt sich automatisch via PR

---

## Branch-Konvention

```
feature/   → Neue Features
fix/       → Bugfixes
refactor/  → Refactoring
docs/      → Dokumentation
chore/     → Build/Konfiguration
```

**Beispiele:**
- `feature/matterport-tag-editing`
- `fix/task-drag-drop-mobile`
- `refactor/auth-context-cleanup`

---

## Commit-Convention

Wir nutzen [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(thema): kurze Beschreibung
fix(thema): was wurde behoben
refactor(thema): was wurde umgebaut
docs(thema): Dokumentation
chore(ci): CI/CD Änderung
```

**Beispiele:**
- `feat(tasks): add drag-and-drop sorting`
- `fix(matterport): resolve SDK initialization race condition`
- `feat(auth): integrate Clerk webhook`
