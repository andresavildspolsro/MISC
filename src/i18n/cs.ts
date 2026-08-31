import type { Strings } from './types';

export const cs: Strings = {
  localeTag: 'cs',
  localeName: 'Čeština',
  wikipediaHost: 'cs.wikipedia.org',

  languageLabel: 'Jazyk',

  appTitle: 'Historické hranice světa',
  appTagline: 'Politické a kulturní hranice, snímek po snímku',

  loading: 'Načítání…',
  loadingSnapshot: (year) => `Načítá se snímek pro rok ${year}…`,
  loadError: (year) =>
    `Snímek pro rok ${year} se nepodařilo načíst. Pro tento rok se nezobrazují žádné hranice.`,
  unknownYearRequested: (requested, shown) =>
    `Datová sada nemá snímek pro rok ${requested}. Zobrazuje se ${shown} — nejbližší rok se nedosazuje.`,

  manifestLoadError: 'Nepodařilo se načíst seznam snímků. Obnovte prosím stránku.',

  showingYear: 'Zobrazeno',
  featureCount: (n) => `${n} území v tomto snímku`,

  yearBc: (n) => `${n} př. n. l.`,
  yearAd: (n) => `${n} n. l.`,

  play: 'Přehrát snímky',
  pause: 'Pozastavit',
  previousSnapshot: 'Předchozí snímek',
  nextSnapshot: 'Další snímek',
  timelineLabel: 'Rok snímku',
  timelineHelp:
    'Mezi snímky se pohybujte šipkami vlevo a vpravo. Posuvník se zastaví jen na letech, která v datové sadě existují — mezi nimi není nic.',
  timelineNote:
    'Snímky jsou na této ose rozmístěny rovnoměrně, nikoli úměrně uplynulému času. Mezery mezi nimi sahají od deseti let po desítky tisíciletí.',
  goToYear: (year) => `Přejít na snímek pro rok ${year}`,
  snapshotPosition: (index, total) => `Snímek ${index} z ${total}`,

  yearJumpTitle: 'Přejít na rok — klikni a napiš',
  yearJumpPlaceholder: 'např. 1416, záporné = př. n. l.',
  nearestSnapshotShown: (requested, shown) =>
    `Pro rok ${requested} datová sada snímek nemá; zobrazen nejbližší, ${shown}.`,

  basemapToggle: 'Moderní podklad',
  basemapOn: 'zap.',
  basemapOff: 'vyp.',
  basemapHintAncient:
    'Před rokem 1000 n. l. je podklad ve výchozím stavu vypnutý: dnešní pobřeží, jezera a řeky se od dávných liší a mohou být zavádějící.',

  resetView: 'Evropa',
  resetViewTitle: 'Vrátit pohled na Evropu',

  resetWorld: 'Svět',
  resetWorldTitle: 'Zobrazit celý svět',

  panelClose: 'Zavřít',
  panelNoSelection: 'Vyberte území na mapě a zobrazí se jeho záznam z datové sady.',
  panelPreviewHint: 'Náhled — kliknutím na území ho ukotvíte.',
  panelPinnedHint: 'Ukotveno. Zavřením panelu se vrátíte k náhledu při najetí myší.',
  unnamedTerritory: 'Nepojmenované území',
  notInDataset: 'není v datové sadě',

  datasetProperties: 'Záznam v datové sadě',
  propertyLabels: {
    NAME: 'Název',
    ABBREVN: 'Zkrácený název',
    SUBJECTO: 'Pod svrchovaností',
    PARTOF: 'Součást',
    BORDERPRECISION: 'Přesnost hranic',
    wikipedia: 'Wikipedie (z datové sady)',
    weblnks: 'Webové odkazy (z datové sady)',
    weblinks: 'Webové odkazy (z datové sady)',
    INFO_UR: 'Informační URL (z datové sady)',
    type: 'Typ',
    TYPE: 'Typ',
    CONTROL: 'Pod kontrolou',
    cat: 'Kód kategorie',
    FIPS_CO: 'Kód země FIPS',
    WB_CNTR: 'Kód země Světové banky',
    BORDER_: 'Kód hranice',
    BORDERI: 'Sousedí s',
  },
  otherProperties: 'Další vlastnosti v tomto souboru',

  borderPrecisionScale: {
    '1': '1 — přibližná',
    '2': '2 — středně přesná',
    '3': '3 — určená mezinárodním právem',
  },
  borderPrecisionUndocumented: (value) =>
    `${value} — hodnota mimo dokumentovanou škálu 1–3`,

  sourceHeading: 'Odkud tento tvar pochází',
  sourceNote: (filename, year) =>
    `Geometrie pro rok ${year} je načtena ze souboru ${filename}, což je snímek datové sady pro tento rok. Není interpolována ani upravována.`,

  externalHeading: 'Vyhledat jinde',
  externalDisclaimer: 'Externí vyhledávání — není součástí datové sady.',
  wikipediaSearch: (name) => `Hledat „${name}“ na Wikipedii`,

  factsToggle: 'Zajímavosti',
  factsHeading: 'Zajímavosti',
  factsDisclaimer: 'Doplněný kontext — není součástí datové sady hranic.',
  factsSource: 'Zdroj',
  factsUnverified: 'bez uvedeného zdroje — neověřeno',
  factsNoneForYear: 'K tomuto snímku zatím žádné zajímavosti nejsou.',
  factsUntranslated: 'V tomto jazyce není k dispozici; zobrazeno v původním znění.',

  disclaimerTitle: 'Hranice před rokem 1648 jsou přibližné',
  disclaimerBody:
    'Autoři datové sady upozorňují, že v Evropě dává pojem pevné státní hranice smysl až po vestfálském míru (1648). Dřívější útvary měly překrývající se, pozvolné a často nevymezené hranice. Každou čáru na této mapě berte jako odborný odhad, nikoli jako zaměřenou hranici.',
  disclaimerDismiss: 'Rozumím',

  legendHeading: 'Jak číst tuto mapu',
  legendColorNote:
    'Barva seskupuje území pod stejnou mocností („pod svrchovaností“). Barvy se opakují — označují seskupení, nikoli konkrétní státy. Název území zjistíte najetím myší nebo kliknutím.',
  legendPrecise: 'Plná linka: hranice zaznamenaná jako přesná (3)',
  legendApproximate: 'Čárkovaná a zesvětlená: hranice zaznamenaná jako přibližná (1–2)',

  footerDataHeading: 'Data hranic',
  footerDataset: 'Historical Basemaps',
  footerDatasetAuthor: 'André Ourednik a přispěvatelé',
  footerLicense: 'Licencováno pod',
  footerLicenseName: 'GNU General Public License v3.0',
  footerSnapshotCommit: (commit) => `Verze datové sady: commit ${commit}`,
  footerBasemapHeading: 'Podkladová mapa',
  basemapAttributionShort: 'Pobřeží: Natural Earth',
  footerBasemapAttribution: 'Pobřeží: Natural Earth (volné dílo), servírováno přímo z tohoto webu — bez poskytovatele dlaždic a bez API klíče',
  footerRendererHeading: 'Vykreslování',
  footerRenderer: 'Vykresleno pomocí MapLibre GL JS, licence BSD-3-Clause.',
  footerMethodHeading: 'Metodika',
  footerMethodology:
    'Hranice jsou historické odhady z otevřené odborné datové sady; jejich přesnost se liší a zobrazuje se u každého území. Snímky jsou nespojité — tento web mezi nimi nikdy neinterpoluje. Podrobnost dělení se navíc liší podle regionu a období: mimo Evropu jsou území zpravidla zakreslena jako mnohem větší celky.',
  footerSimplified: (tolerance) =>
    `Geometrie zjednodušena při sestavení (mapshaper, ${tolerance}) kvůli rychlosti načítání.`,
  footerUnsimplified:
    'Geometrie se zobrazuje přesně tak, jak je publikována ve zdroji, bez zjednodušení.',
  footerLanguageNote:
    'Přeloženo je pouze rozhraní. Názvy území a všechny ostatní hodnoty se zobrazují přesně tak, jak je uvádí datová sada, v jejím vlastním jazyce.',
};
