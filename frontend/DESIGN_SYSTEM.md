# Design System - SmartEnergy Hub

## 1. Principes

Le design system de SmartEnergy Hub vise à créer une interface professionnelle, cohérente et accessible pour la supervision énergétique industrielle.

**Objectifs :**
- Clarté des données et hiérarchie visuelle forte
- Interactions discrètes et performantes
- Accessibilité WCAG 2.2 AA
- Responsive : desktop, tablette, mobile

**Anti-patterns à éviter :**
- Dégradés excessifs, glassmorphism omniprésent
- Halos lumineux, néons, animations décoratives
- Gros titres disproportionnés
- Cartes visuellement identiques sans hiérarchie

---

## 2. Palette de Couleurs

### Couleurs Principales

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--navy` | `#0f1b3d` | Sidebar, navigation principale |
| `--navy-2` | `#16244d` | Hover sidebar |
| `--blue` | `#2563eb` | Actions principales, liens, icônes |
| `--blue-soft` | `#e8f0fe` | Fond badges blue, hover |

### Couleurs Sémantiques

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--green` | `#10b981` | État normal, succès |
| `--green-soft` | `#e3f8ef` | Fond badges green |
| `--orange` | `#f59e0b` | Avertissements |
| `--orange-soft` | `#fef3dc` | Fond badges orange |
| `--red` | `#ef4444` | Erreurs, critiques |
| `--red-soft` | `#fde8e8` | Fond badges red |
| `--purple` | `#8b5cf6` | Température, anomalies température |
| `--purple-soft` | `#efe9fe` | Fond badges purple |
| `--teal` | `#14b8a6` | Capteurs actifs |
| `--teal-soft` | `#dff7f4` | Fond badges teal |
| `--yellow-soft` | `#fff6d6` | Fond badges yellow |

### Couleurs Neutres

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--bg` | `#f3f6fb` | Fond principal (gris bleuté très clair) |
| `--card` | `#ffffff` | Fond des cartes |
| `--text` | `#0f172a` | Texte principal |
| `--muted` | `#64748b` | Texte secondaire |
| `--line` | `#e7ecf3` | Bordures, séparateurs |

### Règles d'Utilisation

- **Jamais utiliser une couleur seule pour transmettre une information** - Toujours accompagner d'un texte, icône ou symbole
- **Contraste minimum** : Ratio 4.5:1 pour texte normal, 3:1 pour texte large
- **États sémantiques** : Vert = normal, Orange = avertissement, Rouge = critique

---

## 3. Typographie

### Échelle Typographique (Base 14px)

| Taille | Usage | Classe CSS |
|--------|-------|------------|
| 11px | Badges, badges de navigation | `.badge`, `.nav-badge` |
| 12px | Labels de formulaires, pieds de page | `.field > span`, `.table-foot` |
| 13px | Tableaux, listes, sous-titres | `td`, `.alerts li` |
| 14px | Corps de texte par défaut | `body` |
| 16px | Titres de cartes | `.card-head h3` |
| 22px | Titres de page | `.page-head h1` |
| 24px | Valeurs KPI | `.kpi-value` |

### Poids

- **Normal (400)** : Corps de texte
- **Medium (500)** : Labels, navigation
- **Semi-bold (600)** : Titres, valeurs importantes
- **Bold (700)** : Titres de page

### Police

```css
font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
```

### Règles d'Utilisation

- **Tailles cohérentes** : Respecter l'échelle typographique
- **Pas de tailles arbitraires** : Toujours utiliser une valeur de l'échelle
- **Lisibilité** : Minimum 12px pour les textes informatifs

---

## 4. Espacements

### Échelle d'Espacement (Base 4px)

| Valeur | Usage | Classe CSS |
|--------|-------|------------|
| 4px | Espacement minimal | - |
| 6px | Gap entre éléments petits | `.kpi-top`, `.status` |
| 8px | Gap entre éléments moyens | `.sidebar nav`, `.badge` |
| 10px | Padding badges | `.badge` |
| 12px | Padding cellules tableau | `td`, `th` |
| 14px | Gap grilles | `.grid` |
| 16px | Padding modal | `.modal header` |
| 18px | Gap grilles principales | `.grid`, `.content` |
| 24px | Padding contenu principal | `.content` |
| 28px | Padding topbar | `.topbar` |

### Règles d'Utilisation

- **Systématique** : Utiliser des multiples de 4px
- **Cohérence** : Respecter l'échelle d'espacement
- **Pas de valeurs arbitraires** : Toujours utiliser une valeur de l'échelle

---

## 5. Composants

### 5.1 Cartes (Card)

**Structure :**
```jsx
<Card title="Titre" icon={Icon}>
  <Contenu />
</Card>
```

**Styles :**
- Fond : `--card` (#ffffff)
- Bordure : 1px solid `--line`
- Border-radius : `--radius` (12px)
- Ombre : `--shadow`
- Padding : 14px 18px

**Variantes :**
- `pad={false}` : Pas de padding (tableaux)

### 5.2 KPI

**Structure :**
```jsx
<Kpi icon={Icon} color="blue" label="Label" value="100" unit="kW" sub="Sous-titre" />
```

**Couleurs d'icône :**
- `green`, `blue`, `orange`, `red`, `purple`, `teal`

**Styles :**
- Icône : 42px x 42px, cercle, fond coloré
- Valeur : 24px, bold
- Label : 13px, muted
- Sous-titre : 12px, muted

### 5.3 Badges

**Structure :**
```jsx
<Badge tone="green">Texte</Badge>
```

**Tones :**
- `red`, `orange`, `yellow`, `blue`, `green`, `purple`, `gray`

**Styles :**
- Padding : 3px 9px
- Border-radius : 6px
- Font-size : 11px
- Font-weight : 600

### 5.4 Boutons

**Structure :**
```jsx
<button className="btn">Action</button>
<button className="btn ghost">Annuler</button>
<button className="btn sm">Petit</button>
```

**Styles :**
- Hauteur : 38px (30px pour `.sm`)
- Padding : 0 16px (0 10px pour `.sm`)
- Border-radius : 8px
- Font-weight : 600

**Variantes :**
- Par défaut : Fond `--blue`, texte blanc
- `.ghost` : Fond blanc, bordure `--line`
- `.sm` : Hauteur réduite

### 5.5 Formulaires

**Champs :**
```jsx
<Field label="Label">
  <input />
</Field>
```

**Styles :**
- Hauteur : 38px
- Border-radius : 8px
- Border : 1px solid `--line`
- Focus : Border `--blue`, shadow 3px rgba(37, 99, 235, 0.12)

### 5.6 Tableaux

**Structure :**
```jsx
<div className="table-wrap">
  <table>
    <thead>...</thead>
    <tbody>...</tbody>
  </table>
</div>
```

**Styles :**
- Header : Fond `#fafbfd`, sticky top
- Cellules : Padding 12px 18px
- Hover : Fond `#fafbfd`
- Bordure : 1px solid `--line`

**Variantes :**
- `.scroll` : Max-height 420px, overflow-y auto

### 5.7 États

**Status :**
```jsx
<Status ok /> {/* Actif */}
<Status ok={false} /> {/* Inactif */}
```

**ErrorBox :**
```jsx
<ErrorBox error={error} onRetry={reload} />
```

**Empty :**
```jsx
<Empty>Aucune donnée</Empty>
```

**Loading :**
```jsx
<Loading label="Chargement…" />
```

**Skeleton :**
```jsx
<Skeleton height="20px" width="100%" />
<CardSkeleton title lines={3} />
```

---

## 6. Layout

### Structure Principale

```
.app
├── .sidebar
│   ├── .brand
│   ├── nav
│   └── .side-foot
└── .main
    ├── .topbar
    │   ├── .search
    │   └── .top-right
    └── .content
```

### Sidebar

- Largeur : 232px
- Fond : `--navy`
- Sticky : top 0, height 100vh
- Navigation : Flex column, gap 4px

### Topbar

- Hauteur : 60px
- Fond : #ffffff
- Border-bottom : 1px solid `--line`
- Sticky : top 0, z-index 5

### Content

- Padding : 24px 28px 40px
- Flex column, gap 18px

---

## 7. Grilles

### Classes

| Classe | Colonnes | Usage |
|--------|----------|-------|
| `.grid.kpis` | 4 | KPIs dashboard |
| `.grid.two` | 2 | Deux colonnes égales |
| `.grid.two-one` | 1.6fr 1fr | Deux colonnes inégales |
| `.stack` | 1 | Colonne unique |

### Responsive

- **< 1100px** : `.grid.kpis` → 2 colonnes
- **< 760px** : Toutes les grilles → 1 colonne

---

## 8. Icônes

**Bibliothèque :** Lucide React

**Tailles :**
- Navigation : 18px
- KPIs : 42px (dans cercle)
- Boutons icon : 16-18px
- Alertes : 14px

**Couleurs :**
- Par défaut : `--blue`
- Navigation active : #ffffff
- Status : Couleur sémantique

---

## 9. Graphiques

**Bibliothèque :** Recharts

**Styles :**
- Axes : Font-size 11px, color `--muted`
- Tooltip : Formatter avec unités
- Lignes : Stroke-width 2
- Aires : Gradient avec opacité

**Règles :**
- Toujours afficher les unités
- Légende explicite si plusieurs séries
- Info-bulles lisibles avec valeurs formatées

---

## 10. Accessibilité

### Navigation Clavier

- Focus visible sur tous les éléments interactifs
- Ordre logique de tabulation
- Raccourcis clavier si applicable

### Contraste

- Ratio minimum 4.5:1 pour texte normal
- Ratio minimum 3:1 pour texte large
- Vérifier avec outils d'accessibilité

### ARIA Labels

- Icônes sans texte : `aria-label`
- Boutons : Texte explicite ou aria-label
- Liens : Texte descriptif

### Réduction d'Animations

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 11. Responsive

### Breakpoints

| Breakpoint | Largeur | Modifications |
|------------|--------|---------------|
| Desktop | > 1100px | Layout complet |
| Tablet | 760px - 1100px | Grilles adaptées |
| Mobile | < 760px | Sidebar horizontale, grilles 1 colonne |

### Mobile

- Sidebar : Horizontale, overflow-x auto
- Brand : Masqué
- Side-foot : Masqué
- Grilles : 1 colonne
- Padding réduit : 16px

---

## 12. États et Interactions

### Chargement

- Skeletons avec animation shimmer
- Spinner pour actions longues
- Indicateur de progression si applicable

### Erreur

- ErrorBox avec message explicite
- Bouton de retry si applicable
- Contexte de l'erreur affiché

### Absence de données

- Empty avec message contextuel
- Call-to-action si applicable
- Illustration optionnelle

### Hover

- Boutons : Fond assombri
- Liens : Souligné
- Cartes : Légère ombre augmentée

### Focus

- Border `--blue`
- Shadow 3px rgba(37, 99, 235, 0.12)
- Visible pour navigation clavier

---

## 13. Performance

### Chargement

- Code splitting par route (React.lazy)
- Lazy loading des images
- Virtualisation des grandes listes

### Cache

- React Query pour les données API
- Cache time : 10 minutes
- Stale time : 5 minutes

### Optimisation

- Pagination serveur pour gros volumes
- Limitation des données chargées
- Debounce sur les recherches

---

## 14. Conventions de Code

### Nommage

- Composants : PascalCase (`Card`, `Kpi`)
- Classes CSS : kebab-case (`.card-head`, `.kpi-value`)
- Variables : camelCase (`isLoading`, `sensorId`)
- Constantes : UPPER_SNAKE_CASE (`API_BASE_URL`)

### Structure des Fichiers

```
src/
├── components/
│   ├── Layout.jsx
│   ├── ui.jsx
│   └── feedback/
├── pages/
├── hooks/
├── lib/
├── types/
└── styles.css
```

### Imports

```jsx
// 1. React
import React from 'react'

// 2. Bibliothèques externes
import { useQuery } from '@tanstack/react-query'

// 3. Composants internes
import { Card } from './components/ui'

// 4. Hooks internes
import { useServices } from './services'

// 5. Utilitaires
import { num } from './utils'

// 6. Styles
import './styles.css'
```

---

## 15. Checklist de Validation

Avant de considérer une modification comme terminée :

- [ ] Les couleurs respectent la palette définie
- [ ] La typographie suit l'échelle définie
- [ ] Les espacements sont des multiples de 4px
- [ ] Le contraste respecte WCAG 2.2 AA
- [ ] Les icônes ont des aria-labels si nécessaires
- [ ] Les états (hover, focus, active) sont définis
- [ ] Le responsive est testé (desktop, tablette, mobile)
- [ ] Le composant est accessible au clavier
- [ ] Les animations respectent prefers-reduced-motion
- [ ] Le code respecte les conventions de nommage

---

## 16. Évolution

Ce design system est évolutif. Pour toute modification :

1. Discuter avec l'équipe
2. Mettre à jour ce document
3. Appliquer les modifications de manière cohérente
4. Tester l'impact sur les composants existants
5. Mettre à jour les tests si nécessaire
