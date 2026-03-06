# Project Management – Frontend

## GitHub Project Board

The project board for the frontend can be found at:
**[Cosmic Frontend – Development Roadmap](https://github.com/Graswald-Schaetzle/cosmic-webapp-frontend/projects)**

---

## Board Structure

The board is organized as a **Kanban board** with the following columns:

| Column | Meaning |
|--------|---------|
| **Backlog** | All collected ideas and tasks, not yet prioritized |
| **Ready** | Prioritized tasks to be worked on next |
| **In Progress** | Currently being actively worked on (max. 2-3 items simultaneously) |
| **Review / QA** | PR created, waiting for review or testing |
| **Done** | Completed and merged |

---

## Topic-Based Management

Issues are organized by **labels** according to topics. This enables targeted board filtering:

### Frontend Topics

| Label | Color | Description |
|-------|-------|-------------|
| `topic: matterport` | Purple | 3D visualization and SDK |
| `topic: tasks` | Blue | Task management |
| `topic: documents` | Dark blue | Document management |
| `topic: notifications` | Yellow | Notification system |
| `topic: auth` | Red | Authentication (Clerk) |
| `topic: calendar` | Light blue | Calendar feature |
| `topic: dashboard` | Light blue | Dashboard |
| `topic: ui-ux` | Pink | UI/UX improvements |
| `topic: api` | Green | API integration |
| `topic: performance` | Orange | Performance |
| `topic: devops` | Dark red | CI/CD and deployment |

### Status Labels

| Label | Meaning |
|-------|---------|
| `status: backlog` | Not yet prioritized |
| `status: ready` | Ready to be worked on |
| `status: in-progress` | Actively being worked on |
| `status: review` | Waiting for review |
| `status: blocked` | Blocked by external dependency |

---

## Issue Workflow

1. **Create issue** → Select template (Bug / Feature / Task)
2. **Assign topic** → Set topic label
3. **Set status** → `status: backlog` initially
4. **Prioritization** → In weekly meeting: `status: ready`
5. **Development** → Set status to `status: in-progress`
6. **Create PR** → Branch: `feature/topic-short-description`
7. **Review** → Set status to `status: review`
8. **Merge & Close** → Issue closes automatically via PR

---

## Branch Convention

```
feature/   → New features
fix/       → Bug fixes
refactor/  → Refactoring
docs/      → Documentation
chore/     → Build / configuration
```

**Examples:**
- `feature/matterport-tag-editing`
- `fix/task-drag-drop-mobile`
- `refactor/auth-context-cleanup`

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(topic): short description
fix(topic): what was fixed
refactor(topic): what was restructured
docs(topic): documentation
chore(ci): CI/CD change
```

**Examples:**
- `feat(tasks): add drag-and-drop sorting`
- `fix(matterport): resolve SDK initialization race condition`
- `feat(auth): integrate Clerk webhook`
