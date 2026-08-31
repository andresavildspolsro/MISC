import { P, type Period } from './periods';

/**
 * The first batch of chapters. Milestone ids reference src/eventsData.ts; the
 * app verifies every reference at start-up (see resolveMilestones) and drops
 * anything unknown or outside the chapter's range, loudly.
 *
 * Bounds are reading frames, not claims: they are chosen so the chapter's
 * milestones and main theatre are in view.
 */
export const PERIODS: Period[] = [
  P('crusades', 1095, 1291, 'war', [[-10, 25], [45, 55]],
    ['Křížové výpravy', 'The Crusades', 'Las cruzadas'],
    [
      'Dvě staletí výprav z latinské Evropy do Svaté země — od Klermontského koncilu po pád Akkonu.',
      'Two centuries of expeditions from Latin Europe to the Holy Land — from the Council of Clermont to the fall of Acre.',
      'Dos siglos de expediciones de la Europa latina a Tierra Santa: del Concilio de Clermont a la caída de Acre.',
    ],
    ['clermont-1095', 'jerusalem-1099', 'hattin-1187', 'constantinople-1204', 'acre-1291'],
    'https://en.wikipedia.org/wiki/Crusades'),

  P('hundred-years-war', 1337, 1453, 'war', [[-6, 42], [5, 54]],
    ['Stoletá válka', 'Hundred Years\' War', 'Guerra de los Cien Años'],
    [
      'Anglicko-francouzský zápas o francouzskou korunu; od Kresčaku přes Janu z Arku po Castillon.',
      'The Anglo-French struggle for the French crown; from Crécy through Joan of Arc to Castillon.',
      'La pugna anglo-francesa por la corona de Francia; de Crécy, pasando por Juana de Arco, hasta Castillon.',
    ],
    ['hundred-years-1337', 'crecy-1346', 'poitiers-1356', 'agincourt-1415', 'orleans-1429', 'castillon-1453'],
    'https://en.wikipedia.org/wiki/Hundred_Years%27_War'),

  P('hussite-wars', 1419, 1436, 'war', [[11, 48], [19, 51.5]],
    ['Husitské války', 'Hussite Wars', 'Guerras husitas'],
    [
      'Od první pražské defenestrace po jihlavská kompaktáta — česká reformace se ubránila pěti křížovým výpravám.',
      'From the First Defenestration of Prague to the Compacts of Jihlava — the Bohemian reformation fought off five crusades.',
      'De la primera defenestración de Praga a los pactos de Jihlava: la reforma bohemia resistió cinco cruzadas.',
    ],
    ['defenestration-1419', 'vitkov-1420', 'zizka-1424', 'domazlice-1431', 'lipany-1434', 'jihlava-1436'],
    'https://en.wikipedia.org/wiki/Hussite_Wars'),

  P('age-of-discovery', 1415, 1522, 'discovery', [[-85, -40], [45, 45]],
    ['Objevné plavby', 'Age of Discovery', 'Era de los descubrimientos'],
    [
      'Od dobytí Ceuty po návrat Elcanovy Victorie — století, v němž se mapy světa protnuly.',
      'From the conquest of Ceuta to the return of Elcano\'s Victoria — the century in which the world\'s maps were joined.',
      'De la conquista de Ceuta al regreso de la Victoria de Elcano: el siglo en que los mapas del mundo se unieron.',
    ],
    ['ceuta-1415', 'dias-1488', 'columbus-1492', 'gama-1498', 'cabral-1500', 'magellan-1519', 'tenochtitlan-1521', 'elcano-1522'],
    'https://en.wikipedia.org/wiki/Age_of_Discovery'),

  P('thirty-years-war', 1618, 1648, 'war', [[2, 45], [20, 56]],
    ['Třicetiletá válka', 'Thirty Years\' War', 'Guerra de los Treinta Años'],
    [
      'Od pražské defenestrace po vestfálský mír — náboženská válka, která zpustošila střední Evropu.',
      'From the Defenestration of Prague to the Peace of Westphalia — the religious war that devastated Central Europe.',
      'De la defenestración de Praga a la Paz de Westfalia: la guerra religiosa que devastó Europa Central.',
    ],
    ['defenestration-1618', 'bila-hora-1620', 'execution-1621', 'verneuerte-1627', 'breitenfeld-1631', 'lutzen-1632', 'valdstejn-1634', 'westphalia-1648'],
    'https://en.wikipedia.org/wiki/Thirty_Years%27_War'),

  P('french-revolution', 1789, 1799, 'revolution', [[-5, 42], [8, 51]],
    ['Velká francouzská revoluce', 'French Revolution', 'Revolución francesa'],
    [
      'Od pádu Bastily po Napoleonův převrat — deset let, které svrhly starý režim.',
      'From the fall of the Bastille to Napoleon\'s coup — ten years that overthrew the old regime.',
      'De la toma de la Bastilla al golpe de Napoleón: diez años que derribaron el antiguo régimen.',
    ],
    ['bastille-1789', 'valmy-1792', 'louis-1793', 'thermidor-1794', 'brumaire-1799'],
    'https://en.wikipedia.org/wiki/French_Revolution'),

  P('napoleonic-wars', 1799, 1815, 'war', [[-10, 35], [40, 60]],
    ['Napoleonské války', 'Napoleonic Wars', 'Guerras napoleónicas'],
    [
      'Evropa proti Napoleonovi — od brumairu přes Slavkov a Borodino po Waterloo a Vídeňský kongres.',
      'Europe against Napoleon — from Brumaire through Austerlitz and Borodino to Waterloo and the Congress of Vienna.',
      'Europa contra Napoleón: del brumario, pasando por Austerlitz y Borodinó, hasta Waterloo y el Congreso de Viena.',
    ],
    ['brumaire-1799', 'napoleon-1804', 'trafalgar-1805', 'austerlitz-1805', 'hre-end-1806', 'borodino-1812', 'leipzig-1813', 'waterloo-1815', 'vienna-congress-1815'],
    'https://en.wikipedia.org/wiki/Napoleonic_Wars'),

  P('wwi', 1914, 1918, 'war', [[-5, 40], [35, 58]],
    ['První světová válka', 'First World War', 'Primera Guerra Mundial'],
    [
      'Od Sarajeva po příměří v Compiègne — velká válka, která ukončila čtyři říše.',
      'From Sarajevo to the Compiègne armistice — the Great War that ended four empires.',
      'De Sarajevo al armisticio de Compiègne: la Gran Guerra que acabó con cuatro imperios.',
    ],
    ['sarajevo-1914', 'marne-1914', 'verdun-1916', 'zborov-1917', 'october-1917', 'czechoslovakia-1918', 'armistice-1918'],
    'https://en.wikipedia.org/wiki/World_War_I'),

  P('wwii', 1939, 1945, 'war', [[-125, -10], [155, 65]],
    ['Druhá světová válka', 'Second World War', 'Segunda Guerra Mundial'],
    [
      'Od okupace zbytku Československa a útoku na Polsko po Hirošimu — nejničivější konflikt dějin.',
      'From the occupation of rump Czechoslovakia and the attack on Poland to Hiroshima — the most destructive conflict in history.',
      'De la ocupación del resto de Checoslovaquia y el ataque a Polonia hasta Hiroshima: el conflicto más destructivo de la historia.',
    ],
    ['occupation-1939', 'westerplatte-1939', 'britain-1940', 'barbarossa-1941', 'pearl-harbor-1941', 'wannsee-1942', 'heydrich-1942', 'lidice-1942', 'stalingrad-1943', 'dday-1944', 'snp-1944', 'warsaw-1944', 'yalta-1945', 'prague-uprising-1945', 'hiroshima-1945', 'potsdam-1945'],
    'https://en.wikipedia.org/wiki/World_War_II'),

  P('cold-war', 1946, 1991, 'era', [[-130, -40], [160, 70]],
    ['Studená válka', 'Cold War', 'Guerra Fría'],
    [
      'Od Churchillova projevu o železné oponě po rozpad SSSR — půlstoletí rozděleného světa.',
      'From Churchill\'s Iron Curtain speech to the dissolution of the USSR — half a century of a divided world.',
      'Del discurso del Telón de Acero de Churchill a la disolución de la URSS: medio siglo de un mundo dividido.',
    ],
    ['fulton-1946', 'february-1948', 'berlin-blockade-1948', 'nato-1949', 'prc-1949', 'korea-1950', 'stalin-1953', 'warsaw-pact-1955', 'hungary-1956', 'sputnik-1957', 'gagarin-1961', 'berlin-wall-1961', 'cuba-1962', 'vietnam-1965', 'prague-spring-1968', 'moon-1969', 'helsinki-1975', 'solidarity-1980', 'gorbachev-1985', 'chernobyl-1986', 'velvet-1989', 'wall-falls-1989', 'ussr-end-1991'],
    'https://en.wikipedia.org/wiki/Cold_War'),
];
