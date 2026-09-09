import type { Strings } from './types';

export const cs: Strings = {
  localeTag: 'cs',
  localeName: 'Čeština',
  wikipediaHost: 'cs.wikipedia.org',

  languageLabel: 'Jazyk',

  zoomIn: 'Přiblížit',
  zoomOut: 'Oddálit',
  toggleAttribution: 'Zobrazit/skrýt atribuci',
  mapAriaLabel: 'Mapa historických hranic',
  panelAriaLabel: 'Detail území',
  factsAriaLabel: 'Zajímavosti',

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
    'Uvnitř každého úseku běží osa lineárně v čase; šířka úseků odpovídá počtu snímků, ne délce jejich trvání. Názvy epoch jsou orientační nálepky, nikoli součást datové sady.',
  helpAxisHeading: 'Osa',
  eraNames: ['Pravěk', 'Starověk', 'Středověk', 'Novověk', 'Moderní doba'],
  goToYear: (year) => `Přejít na snímek pro rok ${year}`,
  snapshotPosition: (index, total) => `Snímek ${index} z ${total}`,

  yearJumpTitle: 'Přejít na rok — klikni a napiš',
  yearJumpPlaceholder: 'např. 1416, záporné = př. n. l.',
  nearestSnapshotShown: (requested, shown) =>
    `Pro rok ${requested} datová sada snímek nemá; zobrazen nejbližší (${shown}).`,

  layersLabel: 'Vrstvy',
  labelsToggle: 'Názvy',
  basemapToggle: 'Dnešní pobřeží',
  basemapHintAncient:
    'Před rokem 1000 n. l. je podklad ve výchozím stavu vypnutý: dnešní pobřeží, jezera a řeky se od dávných liší a mohou být zavádějící.',

  searchLabel: 'Hledat',
  searchPlaceholder: 'Hledat území, událost, kapitolu nebo rok',
  searchNoResults: 'Nic nenalezeno. Hledá se v názvech datové sady, v událostech a v kapitolách.',
  searchKindTerritory: 'Území v tomto snímku',
  searchTerritoryYears: (first, last, count) => {
    if (count === 1) return `Území · v datové sadě jen ve snímku ${first}`;
    const noun = count >= 5 ? 'snímků' : 'snímky';
    return `Území · v datové sadě ${first}–${last} (${count} ${noun})`;
  },
  searchKindEvent: 'Událost',
  searchKindChapter: 'Kapitola',
  searchGoToYear: (year) => `Přejít na rok ${year}`,
  searchJumpedToYear: (name, year) =>
    `„${name}“ v předchozím snímku není; zobrazen snímek ${year}, kde se vyskytuje.`,
  searchNotInLoadedSnapshot: (name, year) =>
    `„${name}“ se v načteném snímku ${year} nenašlo.`,

  helpToggle: 'Legenda a nápověda',
  helpClose: 'Zavřít nápovědu',
  helpStartHeading: 'Jak začít',
  helpSteps: [
    'Posuňte rok na ose pod mapou nebo klepněte na letopočet a napište vlastní.',
    'Klepněte na území: otevře se jeho záznam z datové sady.',
    'Otevřete Kapitoly v dolní liště a projděte milníky některé z nich.',
    'Do pole nahoře napište území, událost, kapitolu nebo rok.',
  ],

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

  eventsToggle: 'Události',
  eventsDisclaimer:
    'Doplněná vrstva událostí podle středoškolského učiva — není součástí datové sady hranic; polohy bodů jsou přibližné.',
  eventYearShown: (eventYear, snapshotYear) =>
    `Událost roku ${eventYear} — hranice jsou ze snímku ${snapshotYear}, prvního po ní.`,
  eventMarkerTitle: (year, names) => `${year}: ${names}`,

  chaptersHeading: 'Kapitoly',
  chapterCategoryWar: 'Války',
  chapterCategoryDiscovery: 'Objevy a expanze',
  chapterCategoryRevolution: 'Revoluce a převraty',
  chapterCategoryEra: 'Éry',
  chapterExit: 'Zpět na celou osu',
  chapterBordersFrom: (snapshotYear) => `Hranice: snímek ${snapshotYear}`,
  chapterNoSnapshotInRange:
    'V rozsahu této kapitoly nemá datová sada žádný snímek hranic; mapa proto ukazuje nejbližší snímek a říká který.',
  chapterAxisHelp:
    'Osa kapitoly běží lineárně v čase; značky jsou milníky s přesnými letopočty. Hranice na mapě vždy pocházejí z uvedeného snímku datové sady, nikdy se nedopočítávají.',
  chapterPreState: (snapshotYear) => `Stav před obdobím (snímek ${snapshotYear})`,
  chapterMilestonePosition: (current, total) => `Milník ${current} z ${total}`,
  previousMilestone: 'Předchozí milník',
  nextMilestone: 'Další milník',
  playChapter: 'Přehrát milníky',
  pauseChapter: 'Zastavit přehrávání',
  chapterOpenAria: (name, range) => `Otevřít kapitolu ${name} (${range})`,
  chapterSidesLabel: 'Strany',

  modernToggle: 'Dnešní hranice',
  modernToggleTitle: (snapshotYear) =>
    `Zobrazit dnešní hranice jako obrys pro srovnání (nejnovější snímek datové sady, rok ${snapshotYear})`,

  chaptersDrawerIntro:
    'Ohraničená období s milníky na vlastní ose. Hranice na mapě pocházejí vždy z uvedeného snímku datové sady.',
  chaptersClose: 'Zavřít kapitoly',

  aboutButton: 'O datech',

  guideToggle: 'Průvodce',
  guideToggleTitle:
    'Režim průvodce: úvodní rozcestník, kapitoly jako vyprávění, změny mezi snímky a historie místa',
  welcomeTitle: 'Kudy do historie?',
  welcomeIntro:
    'Mapa ukazuje hranice tak, jak je zaznamenává otevřená datová sada, snímek po snímku. Vyberte si cestu:',
  welcomeExplore: 'Prozkoumat mapu',
  welcomeExploreHint: 'Volně procházet roky a území.',
  welcomeChapters: 'Projít kapitolu',
  welcomeChaptersHint: 'Války, objevy, revoluce a éry s milníky.',
  welcomeSearch: 'Najít místo',
  welcomeSearchHint: 'Území, událost nebo rok.',
  changesToggle: 'Změny',
  changesTitle: (previousYear) =>
    `Zvýraznit území, která mají podle záznamů datové sady jiného držitele než ve snímku ${previousYear}`,
  changesNone: 'První snímek nemá s čím srovnávat.',
  changesSummary: (count, compared, previousYear) =>
    `${count} z ${compared} pojmenovaných území má jiného držitele než ve snímku ${previousYear}. Jde o porovnání záznamů datové sady, ne o seznam událostí.`,
  historyToggle: 'Historie místa',
  historyTitle: 'Klepnutím na mapu zjistíte, kdo dané místo držel v každém snímku',
  historyHint: 'Klepněte kamkoli na mapu.',
  historyLoading: (done, total) => `Načítá se vyhledávací sada… ${done} z ${total}`,
  historyHeading: (lat, lon) => `Historie místa ${lat}, ${lon}`,
  historyNote:
    'Odpověď pochází ze zjednodušené kopie datové sady určené pro vyhledávání; přesné tvary vidíte na mapě. Prázdný řádek znamená, že v daném snímku místo žádné území nepokrývá.',
  historyNowhere: 'mimo zmapovaná území',

  disclaimerTitle: 'Hranice před rokem 1648 jsou přibližné',
  disclaimerBody:
    'Autoři datové sady upozorňují, že v Evropě dává pojem pevné státní hranice smysl až po vestfálském míru (1648). Dřívější útvary měly překrývající se, pozvolné a často nevymezené hranice. Každou čáru na této mapě berte jako odborný odhad, nikoli jako zaměřenou hranici.',
  disclaimerDismiss: 'Rozumím',

  legendHeading: 'Legenda a nápověda',
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
  footerBasemapAttribution: 'Pobřeží: Natural Earth (volné dílo), servírováno přímo z tohoto webu — bez poskytovatele dlaždic a bez API klíče',
  footerRendererHeading: 'Vykreslování',
  footerRenderer: 'Vykresleno pomocí MapLibre GL JS, licence BSD-3-Clause.',
  footerFontsAttribution:
    'Písmo popisků: Noto Sans (SIL Open Font License 1.1), servírováno z tohoto webu.',
  footerMethodHeading: 'Metodika',
  footerMethodology:
    'Hranice jsou historické odhady z otevřené odborné datové sady; jejich přesnost se liší a zobrazuje se u každého území. Snímky jsou nespojité — tento web mezi nimi nikdy neinterpoluje. Podrobnost dělení se navíc liší podle regionu a období: mimo Evropu jsou území zpravidla zakreslena jako mnohem větší celky.',
  footerSimplified: (tolerance) =>
    `Geometrie zjednodušena při sestavení (mapshaper, ${tolerance}) kvůli rychlosti načítání.`,
  footerUnsimplified:
    'Geometrie se zobrazuje přesně tak, jak je publikována ve zdroji, bez zjednodušení.',
  footerLanguageNote:
    'Přeloženo je rozhraní a u známých celků i název v titulku a bublině (ručně sestavený překlad). Samotný záznam datové sady — řádky NAME, SUBJECTO a další — se vždy zobrazuje doslovně tak, jak jej sada uvádí.',
};
