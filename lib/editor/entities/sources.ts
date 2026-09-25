/** The local data is pinned; these links are provenance, never fetched during correction. */
export const entitySources = {
  'statistics-2025': {
    url: 'https://www.stat.gov.az/menu/6/statistical_yearbooks/source/regions_2025.pdf',
    version: 'Azərbaycanın regionları 2025', accessed: '2026-09-25',
  },
  'orthography-2019-2020': {
    url: 'https://frameworks.e-qanun.az/42/c_f_42073.html',
    version: 'Nazirlər Kabineti 174 (2019), böyük hərf normaları, son dəyişikliklər daxil', accessed: '2026-09-25',
  },
  'reviewed-local': {
    url: 'https://github.com/Sanan2030/SlothAI',
    version: 'SlothAI reviewed, finite local name inventory, 2026-09-25', accessed: '2026-09-25',
  },
} as const;
