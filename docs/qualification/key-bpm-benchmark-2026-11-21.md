# Key & BPM benchmark (2026-11-21)

Commit `fe01b7f`. Engine: the Key & BPM worker path (Sattari AutoKey + site tempo tracker, rough fallback). Node v24.14.1, FFmpeg decode at 44.1 kHz.

**Scope:** these sets have labels known by construction or authored with the audio. They are small and not representative of commercial music across genres, so they do not establish real-world accuracy. Add a licensed labelled set with `KEYBPM_BENCH_MANIFEST`.

| Set             | Tracks | Key exact | Key weighted (MIREX) | Tempo Acc1 (±4%) | Tempo Acc2 (incl. ×2, ×½, ×3, ×⅓) |
| --------------- | ------ | --------- | -------------------- | ---------------- | --------------------------------- |
| synthetic       | 24     | 95.8%     | 97.9%                | 100.0%           | 100.0%                            |
| sattari-lessons | 17     | 35.3%     | 43.5%                | 70.6%            | 76.5%                             |

## Does the "tentative" label mean anything?

| Set             | Evidence label | Tracks | Exact  | Weighted |
| --------------- | -------------- | ------ | ------ | -------- |
| synthetic       | supported      | 15     | 100.0% | 100.0%   |
| synthetic       | tentative      | 9      | 88.9%  | 94.4%    |
| sattari-lessons | tentative      | 7      | 14.3%  | 30.0%    |
| sattari-lessons | supported      | 6      | 83.3%  | 88.3%    |
| sattari-lessons | insufficient   | 4      | 0.0%   | 0.0%     |

## Error types

- **synthetic**: key {"exact":23,"fifth":1}; tempo {"exact":24}
- **sattari-lessons**: key {"other":3,"exact":6,"none":4,"relative":3,"fifth":1}; tempo {"double":1,"exact":12,"none":3,"other":1}

## Misses

- synthetic / synthetic-F-minor-90: key F minor → A# minor (tentative, margin 0.016424318116432857); BPM 90 → 91 (supported)
- sattari-lessons / ode-to-joy: key C major → D minor (tentative, margin 0.015112463502688245); BPM 88 → 176 (rough)
- sattari-lessons / foundations-01: key C major → none (insufficient, margin —); BPM 64 → none (insufficient)
- sattari-lessons / foundations-02: key C major → none (insufficient, margin —); BPM 64 → none (insufficient)
- sattari-lessons / foundations-04: key C major → none (insufficient, margin —); BPM 64 → 64 (supported)
- sattari-lessons / foundations-05: key C major → none (insufficient, margin —); BPM 76 → 77 (tentative)
- sattari-lessons / foundations-06: key C major → E minor (tentative, margin 0.09252698133130632); BPM 76 → 77 (supported)
- sattari-lessons / foundations-07: key C major → A minor (tentative, margin 0.0011010989019821782); BPM 76 → none (insufficient)
- sattari-lessons / foundations-08: key C major → E minor (tentative, margin 0.022442492889633403); BPM 76 → 77 (tentative)
- sattari-lessons / foundations-09: key E minor → E minor (supported, margin 0.16588688512852134); BPM 76 → 115 (rough)
- sattari-lessons / foundations-10: key G major → E minor (tentative, margin 0.00426085407541732); BPM 76 → 77 (supported)
- sattari-lessons / night-shift: key E minor → A minor (tentative, margin 0.0431833748242334); BPM 84 → 83 (supported)
- sattari-lessons / sattari-practice-demo: key A minor → C major (supported, margin 0.18686713231499397); BPM 120 → 120 (supported)
