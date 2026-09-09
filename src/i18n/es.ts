import type { Strings } from './types';

export const es: Strings = {
  localeTag: 'es',
  localeName: 'Español',
  wikipediaHost: 'es.wikipedia.org',

  languageLabel: 'Idioma',

  zoomIn: 'Acercar',
  zoomOut: 'Alejar',
  toggleAttribution: 'Mostrar u ocultar la atribución',
  mapAriaLabel: 'Mapa de fronteras históricas',
  panelAriaLabel: 'Detalle del territorio',
  factsAriaLabel: 'Curiosidades',

  appTitle: 'Fronteras históricas del mundo',
  appTagline: 'Fronteras políticas y culturales, instantánea a instantánea',

  loading: 'Cargando…',
  loadingSnapshot: (year) => `Cargando la instantánea de ${year}…`,
  loadError: (year) =>
    `No se pudo cargar la instantánea de ${year}. No se muestra ninguna frontera para este año.`,
  unknownYearRequested: (requested, shown) =>
    `El conjunto de datos no tiene ninguna instantánea de ${requested}. Se muestra ${shown} en su lugar: no se sustituye por el año más cercano.`,

  manifestLoadError: 'No se pudo cargar la lista de instantáneas. Recarga la página, por favor.',

  showingYear: 'Mostrando',
  featureCount: (n) => `${n} territorios en esta instantánea`,

  yearBc: (n) => `${n} a. C.`,
  yearAd: (n) => `${n} d. C.`,

  play: 'Reproducir las instantáneas',
  pause: 'Pausar',
  previousSnapshot: 'Instantánea anterior',
  nextSnapshot: 'Instantánea siguiente',
  timelineLabel: 'Año de la instantánea',
  timelineHelp:
    'Usa las flechas izquierda y derecha para avanzar entre instantáneas. El control solo se detiene en años que existen en el conjunto de datos: no hay nada entre ellos.',
  timelineNote:
    'Dentro de cada tramo el eje es lineal en el tiempo; la anchura de los tramos sigue el número de instantáneas, no los años que abarcan. Los nombres de las épocas son etiquetas de orientación, no parte del conjunto de datos.',
  helpAxisHeading: 'El eje',
  eraNames: ['Prehistoria', 'Antigüedad', 'Edad Media', 'Edad Moderna', 'Época contemporánea'],
  goToYear: (year) => `Ir a la instantánea de ${year}`,
  snapshotPosition: (index, total) => `Instantánea ${index} de ${total}`,

  yearJumpTitle: 'Ir a un año: haz clic y escribe',
  yearJumpPlaceholder: 'p. ej. 1416, negativo = a. C.',
  nearestSnapshotShown: (requested, shown) =>
    `El conjunto de datos no tiene instantánea de ${requested}; se muestra la más cercana (${shown}).`,

  layersLabel: 'Capas',
  labelsToggle: 'Nombres',
  basemapToggle: 'Costas actuales',
  basemapHintAncient:
    'Antes del año 1000 d. C. el mapa base está desactivado por defecto: las costas, los lagos y los ríos actuales difieren de los antiguos y pueden inducir a error.',

  searchLabel: 'Buscar',
  searchPlaceholder: 'Buscar un territorio, evento, capítulo o año',
  searchNoResults: 'No se encontró nada. La búsqueda cubre los nombres del conjunto de datos, los eventos y los capítulos.',
  searchKindTerritory: 'Territorio en esta instantánea',
  searchTerritoryYears: (first, last, count) =>
    count === 1
      ? `Territorio · en el conjunto de datos solo en la instantánea de ${first}`
      : `Territorio · en el conjunto de datos ${first}–${last} (${count} instantáneas)`,
  searchKindEvent: 'Evento',
  searchKindChapter: 'Capítulo',
  searchGoToYear: (year) => `Ir al año ${year}`,
  searchJumpedToYear: (name, year) =>
    `«${name}» no está en la instantánea anterior; se muestra ${year}, donde aparece.`,
  searchNotInLoadedSnapshot: (name, year) =>
    `«${name}» no se encontró en la instantánea cargada de ${year}.`,

  helpToggle: 'Ayuda: cómo leer este mapa',
  helpClose: 'Cerrar la ayuda',
  helpStartHeading: 'Cómo empezar',
  helpSteps: [
    'Mueve el año en el eje bajo el mapa, o haz clic en el año y escribe uno.',
    'Haz clic en un territorio para abrir su registro del conjunto de datos.',
    'Abre Capítulos en la barra inferior y recorre los hitos de uno de ellos.',
    'Escribe un territorio, evento, capítulo o año en el cuadro superior.',
  ],

  resetView: 'Europa',
  resetViewTitle: 'Restablecer la vista a Europa',

  resetWorld: 'Mundo',
  resetWorldTitle: 'Restablecer la vista al mundo entero',

  panelClose: 'Cerrar',
  panelNoSelection:
    'Selecciona un territorio en el mapa para ver su registro en el conjunto de datos.',
  panelPreviewHint: 'Vista previa: haz clic en el territorio para fijarlo.',
  panelPinnedHint: 'Fijado. Cierra el panel para volver a la vista previa al pasar el ratón.',
  unnamedTerritory: 'Territorio sin nombre',
  notInDataset: 'no está en el conjunto de datos',

  datasetProperties: 'Registro del conjunto de datos',
  propertyLabels: {
    NAME: 'Nombre',
    ABBREVN: 'Nombre abreviado',
    SUBJECTO: 'Bajo la autoridad de',
    PARTOF: 'Parte de',
    BORDERPRECISION: 'Precisión de la frontera',
    wikipedia: 'Wikipedia (del conjunto de datos)',
    weblnks: 'Enlaces web (del conjunto de datos)',
    weblinks: 'Enlaces web (del conjunto de datos)',
    INFO_UR: 'URL informativa (del conjunto de datos)',
    type: 'Tipo',
    TYPE: 'Tipo',
    CONTROL: 'Controlado por',
    cat: 'Código de categoría',
    FIPS_CO: 'Código de país FIPS',
    WB_CNTR: 'Código de país del Banco Mundial',
    BORDER_: 'Código de frontera',
    BORDERI: 'Limita con',
  },
  otherProperties: 'Otras propiedades de este archivo',

  borderPrecisionScale: {
    '1': '1 — aproximada',
    '2': '2 — moderadamente precisa',
    '3': '3 — determinada por el derecho internacional',
  },
  borderPrecisionUndocumented: (value) =>
    `${value} — valor fuera de la escala 1–3 documentada del conjunto de datos`,

  sourceHeading: 'De dónde procede esta forma',
  sourceNote: (filename, year) =>
    `La geometría de ${year} procede de ${filename}, la instantánea del conjunto de datos para ese año. No está interpolada ni ajustada.`,

  externalHeading: 'Buscarlo en otro sitio',
  externalDisclaimer: 'Búsqueda externa: no forma parte del conjunto de datos.',
  wikipediaSearch: (name) => `Buscar «${name}» en Wikipedia`,

  factsToggle: 'Curiosidades',
  factsHeading: 'Curiosidades',
  factsDisclaimer: 'Contexto añadido: no forma parte del conjunto de datos de fronteras.',
  factsSource: 'Fuente',
  factsUnverified: 'sin fuente indicada — sin verificar',
  factsNoneForYear: 'Aún no hay curiosidades para esta instantánea.',
  factsUntranslated: 'No disponible en este idioma; se muestra en su idioma original.',

  eventsToggle: 'Acontecimientos',
  eventsDisclaimer:
    'Capa añadida de acontecimientos del temario escolar — no forma parte del conjunto de datos de fronteras; las ubicaciones son aproximadas.',
  eventYearShown: (eventYear, snapshotYear) =>
    `Acontecimiento de ${eventYear}: las fronteras proceden de la instantánea de ${snapshotYear}, la primera posterior.`,
  eventMarkerTitle: (year, names) => `${year}: ${names}`,

  chaptersHeading: 'Capítulos',
  chapterCategoryWar: 'Guerras',
  chapterCategoryDiscovery: 'Descubrimientos y expansión',
  chapterCategoryRevolution: 'Revoluciones y convulsiones',
  chapterCategoryEra: 'Eras',
  chapterExit: 'Volver a la línea completa',
  chapterBordersFrom: (snapshotYear) => `Fronteras: instantánea de ${snapshotYear}`,
  chapterNoSnapshotInRange:
    'El conjunto de datos no tiene ninguna instantánea de fronteras dentro del rango de este capítulo; el mapa muestra por tanto la más cercana e indica cuál es.',
  chapterAxisHelp:
    'El eje del capítulo es lineal en el tiempo; las marcas son hitos con años exactos. Las fronteras del mapa provienen siempre de la instantánea indicada — nunca se calculan.',
  chapterPreState: (snapshotYear) => `Estado antes del período (instantánea de ${snapshotYear})`,
  chapterMilestonePosition: (current, total) => `Hito ${current} de ${total}`,
  previousMilestone: 'Hito anterior',
  nextMilestone: 'Hito siguiente',
  playChapter: 'Reproducir hitos',
  pauseChapter: 'Pausar reproducción',
  chapterOpenAria: (name, range) => `Abrir el capítulo ${name} (${range})`,
  chapterSidesLabel: 'Bandos',

  modernToggle: 'Fronteras actuales',
  modernToggleTitle: (snapshotYear) =>
    `Mostrar las fronteras actuales como contorno para comparar (la instantánea más reciente del conjunto de datos, ${snapshotYear})`,

  chaptersDrawerIntro:
    'Periodos acotados con hitos en su propio eje. Las fronteras del mapa proceden siempre de la instantánea indicada del conjunto de datos.',
  chaptersClose: 'Cerrar los capítulos',

  aboutButton: 'Sobre los datos',

  guideToggle: 'Guía',
  guideToggleTitle:
    'Modo guía: tarjeta de bienvenida, capítulos narrados, cambios entre instantáneas e historia de un lugar',
  welcomeTitle: '¿Por dónde empezar?',
  welcomeIntro:
    'El mapa muestra las fronteras tal como las registra un conjunto de datos abierto, instantánea a instantánea. Elige un camino:',
  welcomeExplore: 'Explorar el mapa',
  welcomeExploreHint: 'Recorrer libremente los años y los territorios.',
  welcomeChapters: 'Seguir un capítulo',
  welcomeChaptersHint: 'Guerras, descubrimientos, revoluciones y épocas con hitos.',
  welcomeSearch: 'Buscar un lugar',
  welcomeSearchHint: 'Un territorio, un evento o un año.',
  changesToggle: 'Cambios',
  changesTitle: (previousYear) =>
    `Resaltar los territorios cuyo titular difiere, según los registros del conjunto de datos, de la instantánea de ${previousYear}`,
  changesNone: 'La primera instantánea no tiene con qué compararse.',
  changesSummary: (count, compared, previousYear) =>
    `${count} de ${compared} territorios con nombre tienen un titular distinto al de la instantánea de ${previousYear}. Es una comparación de registros, no una lista de eventos.`,
  historyToggle: 'Historia del lugar',
  historyTitle: 'Haz clic en el mapa para ver quién tuvo ese lugar en cada instantánea',
  historyHint: 'Haz clic en cualquier punto del mapa.',
  historyLoading: (done, total) => `Cargando el conjunto de búsqueda… ${done} de ${total}`,
  historyHeading: (lat, lon) => `Historia de ${lat}, ${lon}`,
  historyNote:
    'La respuesta procede de una copia simplificada del conjunto de datos hecha para búsquedas; las formas exactas están en el mapa. Una fila vacía significa que ningún territorio cubre el lugar en esa instantánea.',
  historyNowhere: 'fuera de los territorios cartografiados',

  disclaimerTitle: 'Las fronteras anteriores a 1648 son aproximaciones',
  disclaimerBody:
    'Los autores del conjunto de datos señalan que en Europa el concepto de frontera nacional fija solo cobra sentido después de la Paz de Westfalia (1648). Las entidades políticas anteriores tenían fronteras superpuestas, graduales y a menudo indefinidas. Considera cada línea de este mapa una aproximación académica, no una frontera medida.',
  disclaimerDismiss: 'Entendido',

  legendHeading: 'Cómo leer este mapa',
  legendColorNote:
    'El color agrupa los territorios bajo una misma potencia («bajo la autoridad de»). Los colores se repiten: identifican agrupaciones, no Estados concretos. Pasa el ratón o haz clic en un territorio para ver su nombre.',
  legendPrecise: 'Contorno continuo: frontera registrada como precisa (3)',
  legendApproximate: 'Discontinuo y atenuado: frontera registrada como aproximada (1–2)',

  footerDataHeading: 'Datos de fronteras',
  footerDataset: 'Historical Basemaps',
  footerDatasetAuthor: 'André Ourednik y colaboradores',
  footerLicense: 'Publicado bajo',
  footerLicenseName: 'GNU General Public License v3.0',
  footerSnapshotCommit: (commit) => `Versión del conjunto de datos: commit ${commit}`,
  footerBasemapHeading: 'Mapa base',
  footerBasemapAttribution: 'Costas: Natural Earth (dominio público), servidas desde este sitio, sin proveedor de teselas ni clave de API',
  footerRendererHeading: 'Renderizado',
  footerRenderer: 'Renderizado con MapLibre GL JS, licencia BSD-3-Clause.',
  footerFontsAttribution:
    'Tipografía de las etiquetas: Noto Sans (SIL Open Font License 1.1), servida desde este sitio.',
  footerMethodHeading: 'Método',
  footerMethodology:
    'Las fronteras son aproximaciones históricas de un conjunto de datos académico abierto; su precisión varía y se indica en cada territorio. Las instantáneas son discretas: este sitio nunca interpola entre ellas. El grado de subdivisión también varía según la región y el periodo: fuera de Europa, los territorios suelen estar cartografiados como unidades mucho mayores.',
  footerSimplified: (tolerance) =>
    `Geometría simplificada en la compilación (mapshaper, ${tolerance}) para acelerar la carga.`,
  footerUnsimplified:
    'La geometría se sirve exactamente como se publica en el origen, sin simplificar.',
  footerLanguageNote:
    'Se traduce la interfaz y, para entidades conocidas, el nombre del título y la burbuja (traducción curada a mano). El registro del conjunto de datos —las filas NAME, SUBJECTO y demás— se muestra siempre literalmente, tal como lo recoge el conjunto de datos.',
};
