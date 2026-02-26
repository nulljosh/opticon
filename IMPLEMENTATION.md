# Opticon Implementation Notes

## Palantir Gotham Feature Map

Research doc mapping Gotham capabilities to Opticon, identifying gaps and implementation priorities.

### Gotham Core Modules

| Module | Function |
|--------|----------|
| **Ontology** | Unified semantic data model (entities, properties, relationships). Foundation for everything else. |
| **Entity Resolution** | AI-powered dedup + cross-source record linkage with confidence scoring |
| **Graph** | Interactive link analysis canvas. Cork-and-string network visualization. |
| **Gaia** | Geospatial analysis: heatmaps, polygon search, geotemporal trails, time slider |
| **Timeline** | Temporal scrubber synced to map + data feeds. Event sequencing. |
| **Ava** | AI/ML engine: automated pattern detection, anomaly alerts, connection discovery |
| **Object Explorer** | Faceted search: histograms, pivot tables, drill-down by property |
| **Dossier** | Collaborative intelligence reports that update as underlying data changes |
| **Table** | High-scale search/filter/sort/export data grid |
| **COVs** | Custom Object Views: domain-specific multi-panel entity dashboards |
| **Federated Search** | Query external systems without ingestion |

### Coverage Matrix

| Gotham Feature | Opticon Status | Coverage |
|---|---|---|
| Ontology | None (siloed hooks) | 0% |
| Entity Resolution | None | 0% |
| Graph / Link Analysis | None | 0% |
| Gaia / Geospatial | LiveMapBackdrop + markers | 40% |
| Timeline / Temporal | None | 0% |
| Ava / AI Engine | Monte Carlo only | 10% |
| Object Explorer | Stock list + filters | 15% |
| Dossier / Reports | None | 0% |
| Table / Search | Partial lists | 20% |
| COVs | Per-stock detail | 15% |
| Federated Search | None | 0% |
| Security / Governance | Auth + tiers | 25% |
| Workflow Automation | None | 0% |
| Decision Support | Trading sim + Monte Carlo | 30% |

### High-Impact Gaps

1. **Unified Data Ontology** (Critical): Define entity types (Company, Stock, Prediction, Event, Location) and relationships. Client-side adjacency list. `useOntology()` hook.
2. **Entity Resolution** (Critical): Link tickers across stocks, predictions, map events. Basic matcher connects existing sources.
3. **Timeline Scrubber** (High): Horizontal drag bar syncing map, charts, predictions to selected timestamp. `useTimeContext()` hook.
4. **Graph Visualization** (High): Force-directed graph (d3-force) showing entity relationships. Click to open detail.
5. **Alerts / Anomaly Detection** (High): Threshold + rate-of-change + proximity triggers. Notification feed.
6. **Geospatial Upgrades** (Medium-High): Heatmaps, polygon search, geotemporal trails.
7. **Object Explorer** (Medium): Histogram sliders, category facets, pivot tables.
8. **Dossier Export** (Medium): Dashboard snapshot as PDF/markdown.
9. **Workflow Automation** (Medium): User-defined alert rules.

### Implementation Order

1. Ontology + Entity Resolution (foundation)
2. Timeline Scrubber (killer UX, uses existing temporal data)
3. Alerts + Anomaly Detection (traverses ontology graph)
4. Graph Visualization (renders ontology as interactive network)
5. Geospatial Upgrades (enhance map to Gaia-level)
6. Object Explorer + Reports (faceted search, export)

---

## Legacy: Trading Simulator Notes

### FIB_LEVELS Extension
- Extended to $10T

### Milestone State Management
- pausedAtMilestone, currentMilestone, nextMilestone state
- Pause simulation at milestones, show continue UI

### Position Sizing for $1T+
- $1T-$2T: 40%, $2T-$5T: 38%, $5T+: 35%
