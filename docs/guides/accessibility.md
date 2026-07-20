# Accessibility

Implemented design measures include native buttons/links/forms, keyboard-operable tables and selections, visible textual statuses in addition to color, chart text summaries, semantic headings, reduced-motion CSS, responsive layouts, hospital tables as a map fallback, and descriptive loading/error/empty states.

Known limitations: MapLibre interaction is intrinsically complex for keyboard and screen-reader users; dense comparison/trust tables may require horizontal scrolling; focus restoration after every asynchronous transition has not been independently audited; chart/map alternatives need user testing; color contrast and screen-reader announcements have not received a formal WCAG 2.2 AA assessment.

For a demo, keep zoom legible, use the Hospital Impact table if the map is inaccessible, announce state transitions, and avoid communicating status by marker color alone. Contributions should preserve native semantics and add text equivalents for new visualizations.
