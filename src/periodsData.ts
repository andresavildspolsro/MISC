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
    'https://en.wikipedia.org/wiki/Crusades',
    [
      // The dataset maps no crusader states in the Levant at these snapshots,
      // so the crusader side tints the sponsoring powers of Latin Europe.
      { names: ['Křižácké mocnosti', 'Crusader powers', 'Potencias cruzadas'],
        territories: ['Kingdom of France', 'Holy Roman Empire', 'England', 'English territory', 'Angevin Empire', 'Venice', 'Sicily', 'Papal States'] },
      { names: ['Muslimské říše', 'Muslim states', 'Estados musulmanes'],
        territories: ['Fatimid Caliphate', 'Seljuk Empire', 'Seljuk Caliphate', 'Kwarizm-Shah', 'Mamluke Sultanate'] },
      { names: ['Byzantská říše', 'Byzantine Empire', 'Imperio bizantino'],
        territories: ['Byzantine Empire'] },
    ]),

  P('hundred-years-war', 1337, 1453, 'war', [[-6, 42], [5, 54]],
    ['Stoletá válka', 'Hundred Years\' War', 'Guerra de los Cien Años'],
    [
      'Anglicko-francouzský zápas o francouzskou korunu; od Kresčaku přes Janu z Arku po Castillon.',
      'The Anglo-French struggle for the French crown; from Crécy through Joan of Arc to Castillon.',
      'La pugna anglo-francesa por la corona de Francia; de Crécy, pasando por Juana de Arco, hasta Castillon.',
    ],
    ['hundred-years-1337', 'crecy-1346', 'poitiers-1356', 'agincourt-1415', 'orleans-1429', 'castillon-1453'],
    'https://en.wikipedia.org/wiki/Hundred_Years%27_War',
    [
      { names: ['Anglie', 'England', 'Inglaterra'],
        territories: ['English territory', 'England'] },
      { names: ['Francie a spojenci', 'France and allies', 'Francia y aliados'],
        territories: ['France', 'Scotland', 'Scottland', 'Castile', 'Castille'] },
    ]),

  P('hussite-wars', 1419, 1436, 'war', [[11, 48], [19, 51.5]],
    ['Husitské války', 'Hussite Wars', 'Guerras husitas'],
    [
      'Od první pražské defenestrace po jihlavská kompaktáta — česká reformace se ubránila pěti křížovým výpravám. Datová sada v tomto snímku nekreslí samostatné Čechy, strany proto nebarvíme.',
      'From the First Defenestration of Prague to the Compacts of Jihlava — the Bohemian reformation fought off five crusades. The dataset draws no separate Bohemia at this snapshot, so no sides are tinted.',
      'De la primera defenestración de Praga a los pactos de Jihlava: la reforma bohemia resistió cinco cruzadas. El conjunto de datos no dibuja una Bohemia separada en esta instantánea, por lo que no se tiñen bandos.',
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
    'https://en.wikipedia.org/wiki/Age_of_Discovery',
    [
      { names: ['Portugalsko', 'Portugal', 'Portugal'],
        territories: ['Portugal'] },
      { names: ['Kastilie a Aragon (Španělsko)', 'Castile and Aragon (Spain)', 'Castilla y Aragón (España)'],
        territories: ['Castille', 'Castile', 'Aragón', 'Spain'] },
      { names: ['Americké říše', 'American empires', 'Imperios americanos'],
        territories: ['Aztec Empire', 'Inca Empire', 'Mexihcah (Triple Alliance)'] },
    ]),

  P('thirty-years-war', 1618, 1648, 'war', [[2, 45], [20, 56]],
    ['Třicetiletá válka', 'Thirty Years\' War', 'Guerra de los Treinta Años'],
    [
      'Od pražské defenestrace po vestfálský mír — náboženská válka, která zpustošila střední Evropu.',
      'From the Defenestration of Prague to the Peace of Westphalia — the religious war that devastated Central Europe.',
      'De la defenestración de Praga a la Paz de Westfalia: la guerra religiosa que devastó Europa Central.',
    ],
    ['defenestration-1618', 'bila-hora-1620', 'execution-1621', 'verneuerte-1627', 'breitenfeld-1631', 'lutzen-1632', 'valdstejn-1634', 'westphalia-1648'],
    'https://en.wikipedia.org/wiki/Thirty_Years%27_War',
    [
      { names: ['Habsburský tábor', 'Habsburg camp', 'Bando de los Habsburgo'],
        territories: ['Holy Roman Empire', 'Spain', 'Austrian Empire', 'Habsburg Netherlands'] },
      { names: ['Protihabsburská koalice', 'Anti-Habsburg coalition', 'Coalición antihabsburgo'],
        territories: ['France', 'Sweden', 'Denmark-Norway', 'Dutch Republic'] },
    ]),

  P('french-revolution', 1789, 1799, 'revolution', [[-5, 42], [8, 51]],
    ['Velká francouzská revoluce', 'French Revolution', 'Revolución francesa'],
    [
      'Od pádu Bastily po Napoleonův převrat — deset let, které svrhly starý režim.',
      'From the fall of the Bastille to Napoleon\'s coup — ten years that overthrew the old regime.',
      'De la toma de la Bastilla al golpe de Napoleón: diez años que derribaron el antiguo régimen.',
    ],
    ['bastille-1789', 'valmy-1792', 'louis-1793', 'thermidor-1794', 'brumaire-1799'],
    'https://en.wikipedia.org/wiki/French_Revolution',
    [
      { names: ['Revoluční Francie', 'Revolutionary France', 'Francia revolucionaria'],
        territories: ['France'] },
      { names: ['Koaliční monarchie', 'Coalition monarchies', 'Monarquías de la coalición'],
        territories: ['United Kingdom', 'Austrian Empire', 'Prussia', 'Russian Empire'] },
    ]),

  P('napoleonic-wars', 1799, 1815, 'war', [[-10, 35], [40, 60]],
    ['Napoleonské války', 'Napoleonic Wars', 'Guerras napoleónicas'],
    [
      'Evropa proti Napoleonovi — od brumairu přes Slavkov a Borodino po Waterloo a Vídeňský kongres.',
      'Europe against Napoleon — from Brumaire through Austerlitz and Borodino to Waterloo and the Congress of Vienna.',
      'Europa contra Napoleón: del brumario, pasando por Austerlitz y Borodinó, hasta Waterloo y el Congreso de Viena.',
    ],
    ['brumaire-1799', 'napoleon-1804', 'trafalgar-1805', 'austerlitz-1805', 'hre-end-1806', 'borodino-1812', 'leipzig-1813', 'waterloo-1815', 'vienna-congress-1815'],
    'https://en.wikipedia.org/wiki/Napoleonic_Wars',
    [
      { names: ['Napoleonská Francie', 'Napoleonic France', 'Francia napoleónica'],
        territories: ['France'] },
      { names: ['Koalice proti Napoleonovi', 'Coalitions against Napoleon', 'Coaliciones contra Napoleón'],
        territories: ['United Kingdom', 'United Kingdom of Great Britain and Ireland', 'Austrian Empire', 'Prussia', 'Russian Empire', 'Spain', 'Portugal', 'Sweden', 'Sweden–Norway'] },
    ]),

  P('wwi', 1914, 1918, 'war', [[-5, 40], [35, 58]],
    ['První světová válka', 'First World War', 'Primera Guerra Mundial'],
    [
      'Od Sarajeva po příměří v Compiègne — velká válka, která ukončila čtyři říše.',
      'From Sarajevo to the Compiègne armistice — the Great War that ended four empires.',
      'De Sarajevo al armisticio de Compiègne: la Gran Guerra que acabó con cuatro imperios.',
    ],
    ['sarajevo-1914', 'marne-1914', 'verdun-1916', 'zborov-1917', 'october-1917', 'czechoslovakia-1918', 'armistice-1918'],
    'https://en.wikipedia.org/wiki/World_War_I',
    [
      { names: ['Ústřední mocnosti', 'Central Powers', 'Potencias Centrales'],
        // "Kingfom of Italy" below is the dataset's own spelling, on the
        // Entente side; Germany covers the 1920 snapshot.
        territories: ['German Empire', 'Germany', 'Austro-Hungarian Empire', 'Ottoman Empire', 'Bulgaria'] },
      { names: ['Dohoda', 'Entente (Allies)', 'La Entente (Aliados)'],
        territories: ['France', 'United Kingdom of Great Britain and Ireland', 'Russian Empire', 'Serbia', 'Belgium', 'Montenegro', 'Kingfom of Italy', 'Italy', 'Empire of Japan'] },
    ]),

  P('wwii', 1939, 1945, 'war', [[-125, -10], [155, 65]],
    ['Druhá světová válka', 'Second World War', 'Segunda Guerra Mundial'],
    [
      'Od okupace zbytku Československa a útoku na Polsko po Hirošimu — nejničivější konflikt dějin.',
      'From the occupation of rump Czechoslovakia and the attack on Poland to Hiroshima — the most destructive conflict in history.',
      'De la ocupación del resto de Checoslovaquia y el ataque a Polonia hasta Hiroshima: el conflicto más destructivo de la historia.',
    ],
    ['occupation-1939', 'westerplatte-1939', 'britain-1940', 'barbarossa-1941', 'pearl-harbor-1941', 'wannsee-1942', 'heydrich-1942', 'lidice-1942', 'stalingrad-1943', 'dday-1944', 'snp-1944', 'warsaw-1944', 'yalta-1945', 'prague-uprising-1945', 'hiroshima-1945', 'potsdam-1945'],
    'https://en.wikipedia.org/wiki/World_War_II',
    [
      // The chapter's only snapshot is 1945, after the surrender: Germany and
      // Japan appear as occupation zones and are tinted under those names.
      { names: ['Osa', 'Axis', 'El Eje'],
        territories: ['Germany (Soviet)', 'Germany (UK)', 'Germany (USA)', 'Germany (France)', 'Japan (USA)', 'Italy'] },
      { names: ['Spojenci', 'Allies', 'Los Aliados'],
        territories: ['United Kingdom', 'USSR', 'United States', 'France', 'China', 'Poland', 'Czechoslovakia'] },
    ]),

  P('cold-war', 1946, 1991, 'era', [[-130, -40], [160, 70]],
    ['Studená válka', 'Cold War', 'Guerra Fría'],
    [
      'Od Churchillova projevu o železné oponě po rozpad SSSR — půlstoletí rozděleného světa.',
      'From Churchill\'s Iron Curtain speech to the dissolution of the USSR — half a century of a divided world.',
      'Del discurso del Telón de Acero de Churchill a la disolución de la URSS: medio siglo de un mundo dividido.',
    ],
    ['fulton-1946', 'february-1948', 'berlin-blockade-1948', 'nato-1949', 'prc-1949', 'korea-1950', 'stalin-1953', 'warsaw-pact-1955', 'hungary-1956', 'sputnik-1957', 'gagarin-1961', 'berlin-wall-1961', 'cuba-1962', 'vietnam-1965', 'prague-spring-1968', 'moon-1969', 'helsinki-1975', 'solidarity-1980', 'gorbachev-1985', 'chernobyl-1986', 'velvet-1989', 'wall-falls-1989', 'ussr-end-1991'],
    'https://en.wikipedia.org/wiki/Cold_War',
    [
      { names: ['Západní blok (NATO)', 'Western bloc (NATO)', 'Bloque occidental (OTAN)'],
        territories: ['United States', 'United Kingdom', 'France', 'West Germany', 'Italy', 'Canada', 'Norway', 'Denmark', 'Netherlands', 'Belgium', 'Portugal', 'Greece', 'Turkey'] },
      { names: ['Východní blok', 'Eastern bloc', 'Bloque oriental'],
        territories: ['USSR', 'Russia', 'Poland', 'Czechoslovakia', 'Hungary', 'Romania', 'Bulgaria', 'East Germany', 'Albania', 'Cuba'] },
    ]),

  P('greco-persian', -499, -449, 'war', [[18, 33], [32, 42]],
    ['Řecko-perské války', 'Greco-Persian Wars', 'Guerras médicas'],
    [
      'Od iónského povstání po Marathón, Thermopyly a Plataje — řecké obce ubránily svou svobodu proti perské říši.',
      'From the Ionian Revolt through Marathon, Thermopylae and Plataea — the Greek cities defended their freedom against the Persian Empire.',
      'De la revuelta jónica a Maratón, las Termópilas y Platea: las ciudades griegas defendieron su libertad frente al Imperio persa.',
    ],
    ['ionian-499', 'marathon', 'thermopylae', 'salamis', 'plataea-479'],
    'https://en.wikipedia.org/wiki/Greco-Persian_Wars',
    [
      { names: ['Řecké obce', 'Greek cities', 'Ciudades griegas'],
        territories: ['Greek city-states', 'Greek colonies'] },
      { names: ['Perská říše', 'Persian Empire', 'Imperio persa'],
        territories: ['Achaemenid Empire'] },
    ]),

  P('peloponnesian-war', -431, -404, 'war', [[18, 33], [30, 42]],
    ['Peloponéská válka', 'Peloponnesian War', 'Guerra del Peloponeso'],
    [
      'Athény proti Spartě — bratrovražedná válka, která vyčerpala klasické Řecko. Datová sada kreslí řecké obce jako jeden celek, strany proto nebarvíme.',
      'Athens against Sparta — the fratricidal war that exhausted classical Greece. The dataset draws the Greek cities as one unit, so no sides are tinted.',
      'Atenas contra Esparta: la guerra fratricida que agotó a la Grecia clásica. El conjunto de datos dibuja las ciudades griegas como una sola unidad, por lo que no se tiñen bandos.',
    ],
    ['peloponnesian', 'sicily-415', 'aegospotami-405'],
    'https://en.wikipedia.org/wiki/Peloponnesian_War'),

  P('alexander', -334, -323, 'war', [[18, 22], [72, 42]],
    ['Tažení Alexandra Velikého', 'Campaigns of Alexander the Great', 'Campañas de Alejandro Magno'],
    [
      'Od Gráníku po smrt v Babylonu — deset let, které spojily Řecko s Egyptem, Persií a Indií.',
      'From the Granicus to his death in Babylon — ten years that joined Greece to Egypt, Persia and India.',
      'Del Gránico a su muerte en Babilonia: diez años que unieron Grecia con Egipto, Persia y la India.',
    ],
    ['granicus', 'issus-333', 'gaugamela', 'alexander-death'],
    'https://en.wikipedia.org/wiki/Wars_of_Alexander_the_Great',
    [
      { names: ['Alexandrova říše', 'Empire of Alexander', 'Imperio de Alejandro'],
        territories: ['Empire of Alexander'] },
    ]),

  P('punic-wars', -264, -146, 'war', [[-10, 30], [25, 46]],
    ['Punské války', 'Punic Wars', 'Guerras púnicas'],
    [
      'Řím proti Kartágu o vládu nad západním Středomořím — od Sicílie přes Hannibala po zničení Kartága.',
      'Rome against Carthage for the western Mediterranean — from Sicily through Hannibal to the destruction of Carthage.',
      'Roma contra Cartago por el Mediterráneo occidental: de Sicilia, pasando por Aníbal, hasta la destrucción de Cartago.',
    ],
    ['punic1', 'aegates-241', 'cannae', 'zama', 'carthage-146'],
    'https://en.wikipedia.org/wiki/Punic_Wars',
    [
      { names: ['Řím', 'Rome', 'Roma'],
        territories: ['Rome', 'Roman Republic'] },
      { names: ['Kartágo', 'Carthage', 'Cartago'],
        territories: ['Carthage'] },
    ]),

  P('migration-period', 375, 568, 'era', [[-10, 34], [42, 56]],
    ['Stěhování národů', 'Migration Period', 'Período de las migraciones'],
    [
      'Od příchodu Hunů po vpád Langobardů — dvě staletí, která proměnila římský Západ v barbarská království.',
      'From the coming of the Huns to the Lombard invasion — two centuries that turned the Roman West into barbarian kingdoms.',
      'De la llegada de los hunos a la invasión lombarda: dos siglos que convirtieron el Occidente romano en reinos bárbaros.',
    ],
    ['huns-375', 'empire-split-395', 'rome-410', 'catalaunian', 'rome-fall-476', 'lombards-568'],
    'https://en.wikipedia.org/wiki/Migration_Period',
    [
      { names: ['Římské říše', 'Roman empires', 'Imperios romanos'],
        territories: ['Western Roman Empire', 'Eastern Roman Empire'] },
      { names: ['Stěhující se kmeny', 'Migrating peoples', 'Pueblos migratorios'],
        territories: ['Hunnic Empire', 'Visigoths', 'Ostrogoths', 'Franks', 'Visigothic Kingdom', 'Frankish Kingdom', 'Lombard principalities'] },
    ]),

  P('viking-age', 793, 1066, 'discovery', [[-62, 44], [30, 67]],
    ['Vikinská expanze', 'Viking Age', 'Era vikinga'],
    [
      'Od Lindisfarne po Hastings — nájezdy, obchod a plavby, které dosáhly Islandu, Grónska i Ameriky.',
      'From Lindisfarne to Hastings — raids, trade and voyages that reached Iceland, Greenland and America.',
      'De Lindisfarne a Hastings: incursiones, comercio y travesías que alcanzaron Islandia, Groenlandia y América.',
    ],
    ['lindisfarne-793', 'paris-845', 'iceland-874', 'vinland-1000', 'hastings-1066'],
    'https://en.wikipedia.org/wiki/Viking_Age',
    [
      { names: ['Severské domoviny', 'Norse homelands', 'Tierras nórdicas'],
        territories: ['Kingdom of Norway', 'Norway', 'Denmark', 'Denmark-Norway', 'Sweden'] },
    ]),

  P('mongol-expansion', 1206, 1279, 'war', [[10, 15], [135, 60]],
    ['Mongolská expanze', 'Mongol conquests', 'Conquistas mongolas'],
    [
      'Od Čingischánova nástupu po pád songské Číny — největší souvislá pozemní říše dějin.',
      'From Genghis Khan\'s rise to the fall of Song China — the largest contiguous land empire in history.',
      'Del ascenso de Gengis Kan a la caída de la China Song: el mayor imperio terrestre contiguo de la historia.',
    ],
    ['genghis-1206', 'kalka-1223', 'legnica-1241', 'baghdad-1258', 'yamen-1279'],
    'https://en.wikipedia.org/wiki/Mongol_invasions_and_conquests',
    [
      { names: ['Mongolské říše', 'Mongol khanates', 'Kanatos mongoles'],
        territories: ['Mongol Empire', 'Great Khanate', 'Chagatai Khanate', 'Ilkhanate', 'Khanate of the Golden Horde'] },
    ]),

  P('reconquista', 711, 1492, 'era', [[-11, 34], [6, 45]],
    ['Reconquista', 'Reconquista', 'Reconquista'],
    [
      'Od vylodění muslimů v Iberii po pád Granady — osm století zápasu o Pyrenejský poloostrov.',
      'From the Muslim landing in Iberia to the fall of Granada — eight centuries of struggle for the peninsula.',
      'Del desembarco musulmán en Iberia a la caída de Granada: ocho siglos de lucha por la península.',
    ],
    ['iberia-711', 'covadonga-722', 'tours-732', 'tolosa-1212', 'granada-1492'],
    'https://en.wikipedia.org/wiki/Reconquista',
    [
      { names: ['Křesťanská království', 'Christian kingdoms', 'Reinos cristianos'],
        territories: ['Asturias', 'León', 'Castilla', 'Castile', 'Castille', 'Aragón', 'Navarre', 'Portugal'] },
      { names: ['Muslimská Iberie', 'Muslim Iberia', 'Iberia musulmana'],
        territories: ['Emirate of Córdoba', 'Caliphate of Córdoba', 'Almoravid dynasty', 'Almohad Caliphate', 'Granada'] },
    ]),

  P('great-northern-war', 1700, 1721, 'war', [[8, 48], [36, 70]],
    ['Velká severní válka', 'Great Northern War', 'Gran Guerra del Norte'],
    [
      'Od Narvy po Nystad — Švédsko ztratilo nadvládu nad Baltem a velmocí se stalo Petrovo Rusko.',
      'From Narva to Nystad — Sweden lost its Baltic dominance and Peter\'s Russia became a great power.',
      'De Narva a Nystad: Suecia perdió su dominio del Báltico y la Rusia de Pedro se convirtió en gran potencia.',
    ],
    ['narva-1700', 'poltava-1709', 'nystad-1721'],
    'https://en.wikipedia.org/wiki/Great_Northern_War',
    [
      { names: ['Švédská říše', 'Swedish Empire', 'Imperio sueco'],
        territories: ['Sweden'] },
      { names: ['Protišvédská koalice', 'Anti-Swedish coalition', 'Coalición antisueca'],
        territories: ['Tsardom of Muscovy', 'Denmark-Norway', 'Polish–Lithuanian Commonwealth', 'Prussia'] },
    ]),

  P('seven-years-war', 1756, 1763, 'war', [[-82, 25], [36, 60]],
    ['Sedmiletá válka', 'Seven Years\' War', 'Guerra de los Siete Años'],
    [
      'První „světová" válka — bojovalo se v Evropě, Americe i Indii; Prusko uhájilo Slezsko a Británie získala Kanadu.',
      'The first "world" war — fought in Europe, America and India; Prussia kept Silesia and Britain gained Canada.',
      'La primera guerra «mundial»: se combatió en Europa, América y la India; Prusia retuvo Silesia y Gran Bretaña ganó Canadá.',
    ],
    ['lobositz-1756', 'kolin-1757', 'quebec-1759', 'paris-1763'],
    'https://en.wikipedia.org/wiki/Seven_Years%27_War',
    [
      { names: ['Prusko a Británie', 'Prussia and Britain', 'Prusia y Gran Bretaña'],
        territories: ['Prussia', 'United Kingdom'] },
      { names: ['Rakousko a spojenci', 'Austria and allies', 'Austria y aliados'],
        territories: ['Austrian Empire', 'France', 'Russian Empire', 'Sweden', 'Spain'] },
    ]),

  P('american-revolution', 1773, 1783, 'revolution', [[-100, 24], [-58, 50]],
    ['Americká revoluce', 'American Revolution', 'Revolución americana'],
    [
      'Od bostonského pití čaje po pařížský mír — třináct kolonií si vybojovalo nezávislost.',
      'From the Boston Tea Party to the Peace of Paris — thirteen colonies won their independence.',
      'Del Motín del té de Boston a la Paz de París: trece colonias conquistaron su independencia.',
    ],
    ['boston-1773', 'independence-1776', 'saratoga-1777', 'yorktown-1781', 'paris-1783'],
    'https://en.wikipedia.org/wiki/American_Revolution',
    [
      { names: ['Spojené státy a Francie', 'United States and France', 'Estados Unidos y Francia'],
        territories: ['United States of America', 'France'] },
      { names: ['Británie', 'Britain', 'Gran Bretaña'],
        territories: ['United Kingdom'] },
    ]),

  P('revolutions-1848', 1848, 1849, 'revolution', [[-5, 42], [26, 55]],
    ['Revoluce 1848–1849', 'Revolutions of 1848', 'Revoluciones de 1848'],
    [
      '„Jaro národů" — od Paříže přes Prahu a Frankfurt po Világoš; revoluce byly poraženy, jejich požadavky přežily.',
      'The "Springtime of Nations" — from Paris through Prague and Frankfurt to Világos; the revolutions were defeated, their demands survived.',
      'La «Primavera de los Pueblos»: de París, pasando por Praga y Fráncfort, hasta Világos; las revoluciones fueron vencidas, sus demandas sobrevivieron.',
    ],
    ['paris-1848', 'prague-1848', 'frankfurt-1848', 'vilagos-1849'],
    'https://en.wikipedia.org/wiki/Revolutions_of_1848'),

  P('crimean-war', 1853, 1856, 'war', [[19, 39], [45, 56]],
    ['Krymská válka', 'Crimean War', 'Guerra de Crimea'],
    [
      'Rusko proti Osmanům, Británii a Francii — první moderní válka s telegrafem, železnicí a válečnými zpravodaji.',
      'Russia against the Ottomans, Britain and France — the first modern war, with telegraph, railways and war correspondents.',
      'Rusia contra los otomanos, Gran Bretaña y Francia: la primera guerra moderna, con telégrafo, ferrocarril y corresponsales.',
    ],
    ['crimea-1853', 'sevastopol-1855', 'paris-1856'],
    'https://en.wikipedia.org/wiki/Crimean_War',
    [
      { names: ['Rusko', 'Russia', 'Rusia'],
        territories: ['Russian Empire'] },
      { names: ['Spojenci', 'Allies', 'Aliados'],
        territories: ['Ottoman Empire', 'France', 'United Kingdom of Great Britain and Ireland'] },
    ]),

  P('italy-unification', 1859, 1870, 'era', [[6, 36], [19, 47]],
    ['Sjednocení Itálie', 'Unification of Italy', 'Unificación de Italia'],
    [
      'Od Solferina po dobytí Říma — risorgimento spojilo poloostrov do jednoho království.',
      'From Solferino to the capture of Rome — the Risorgimento joined the peninsula into one kingdom.',
      'De Solferino a la toma de Roma: el Risorgimento unió la península en un solo reino.',
    ],
    ['solferino-1859', 'marsala-1860', 'italy-1861', 'rome-1870'],
    'https://en.wikipedia.org/wiki/Unification_of_Italy',
    [
      { names: ['Sjednocená Itálie', 'Unified Italy', 'Italia unificada'],
        territories: ['Italy'] },
      { names: ['Rakousko', 'Austria', 'Austria'],
        territories: ['Austria Hungary'] },
    ]),

  P('germany-unification', 1862, 1871, 'era', [[-5, 45], [20, 57]],
    ['Sjednocení Německa', 'Unification of Germany', 'Unificación de Alemania'],
    [
      'Bismarckovy tři války — s Dánskem, Rakouskem a Francií — vyvrcholily vyhlášením císařství ve Versailles.',
      'Bismarck\'s three wars — against Denmark, Austria and France — culminated in the empire proclaimed at Versailles.',
      'Las tres guerras de Bismarck —contra Dinamarca, Austria y Francia— culminaron con el imperio proclamado en Versalles.',
    ],
    ['bismarck-1862', 'duppel-1864', 'koniggratz-1866', 'sedan-1870', 'versailles-1871'],
    'https://en.wikipedia.org/wiki/Unification_of_Germany',
    [
      { names: ['Prusko / Německo', 'Prussia / Germany', 'Prusia / Alemania'],
        territories: ['Germany'] },
      { names: ['Francie a Rakousko', 'France and Austria', 'Francia y Austria'],
        territories: ['France', 'Austria Hungary'] },
    ]),

  P('us-civil-war', 1861, 1865, 'war', [[-107, 24], [-68, 46]],
    ['Občanská válka v USA', 'American Civil War', 'Guerra de Secesión'],
    [
      'Od Fort Sumteru po Appomattox — válka o jednotu Unie a konec otroctví. Datová sada Konfederaci nekreslí, strany proto nebarvíme.',
      'From Fort Sumter to Appomattox — the war over the Union and the end of slavery. The dataset does not draw the Confederacy, so no sides are tinted.',
      'De Fort Sumter a Appomattox: la guerra por la Unión y el fin de la esclavitud. El conjunto de datos no dibuja la Confederación, por lo que no se tiñen bandos.',
    ],
    ['sumter-1861', 'gettysburg-1863', 'appomattox-1865', 'lincoln-1865'],
    'https://en.wikipedia.org/wiki/American_Civil_War'),

  P('scramble-africa', 1881, 1914, 'era', [[-20, -36], [52, 38]],
    ['Dělení Afriky', 'Scramble for Africa', 'Reparto de África'],
    [
      'Od berlínské konference po rok 1914, kdy zůstaly nezávislé jen Etiopie a Libérie.',
      'From the Berlin Conference to 1914, when only Ethiopia and Liberia remained independent.',
      'De la Conferencia de Berlín a 1914, cuando solo Etiopía y Liberia seguían siendo independientes.',
    ],
    ['berlin-1885', 'adwa-1896', 'fashoda-1898', 'boer-1899'],
    'https://en.wikipedia.org/wiki/Scramble_for_Africa',
    [
      { names: ['Koloniální mocnosti', 'Colonial powers', 'Potencias coloniales'],
        territories: ['United Kingdom of Great Britain and Ireland', 'France', 'Germany', 'Kingfom of Italy', 'Italy', 'Portugal', 'Spain', 'Belgium'] },
      { names: ['Nezávislé africké státy', 'Independent African states', 'Estados africanos independientes'],
        territories: ['Ethiopia', 'Abyssinia', 'Liberia', 'Morocco'] },
    ]),

  P('first-republic', 1918, 1938, 'era', [[11, 47], [24, 52]],
    ['První republika', 'First Czechoslovak Republic', 'Primera República Checoslovaca'],
    [
      'Od vzniku Československa po Mnichov — dvacet let demokracie mezi dvěma katastrofami.',
      'From the founding of Czechoslovakia to Munich — twenty years of democracy between two catastrophes.',
      'De la fundación de Checoslovaquia a Múnich: veinte años de democracia entre dos catástrofes.',
    ],
    ['czechoslovakia-1918', 'ustava-1920', 'crash-1929', 'masaryk-1937', 'munich-1938'],
    'https://en.wikipedia.org/wiki/First_Czechoslovak_Republic',
    [
      { names: ['Československo', 'Czechoslovakia', 'Checoslovaquia'],
        territories: ['Czechoslovakia'] },
    ]),

  P('decolonization', 1945, 1975, 'era', [[-20, -40], [112, 42]],
    ['Dekolonizace', 'Decolonization', 'Descolonización'],
    [
      'Od nezávislosti Indie po rozpad portugalské říše — během třiceti let vznikly desítky nových států.',
      'From Indian independence to the end of the Portuguese empire — dozens of new states in thirty years.',
      'De la independencia de la India al fin del imperio portugués: decenas de nuevos estados en treinta años.',
    ],
    ['india-1947', 'dienbienphu-1954', 'suez-1956', 'ghana-1957', 'congo-1960', 'algeria-1962', 'angola-1975'],
    'https://en.wikipedia.org/wiki/Decolonization',
    [
      { names: ['Koloniální říše', 'Colonial empires', 'Imperios coloniales'],
        territories: ['United Kingdom', 'France', 'Portugal', 'Belgium', 'Netherlands', 'Spain'] },
    ]),

  P('yugoslav-wars', 1991, 1999, 'war', [[12, 39], [25, 47]],
    ['Jugoslávské války', 'Yugoslav Wars', 'Guerras yugoslavas'],
    [
      'Od Vukovaru přes Sarajevo a Srebrenici po Kosovo — krvavý rozpad federace na nástupnické státy.',
      'From Vukovar through Sarajevo and Srebrenica to Kosovo — the bloody breakup of the federation into successor states.',
      'De Vukovar, pasando por Sarajevo y Srebrenica, hasta Kosovo: la sangrienta desintegración de la federación en estados sucesores.',
    ],
    ['yugoslavia-1991', 'sarajevo-1992', 'srebrenica-1995', 'dayton-1995', 'kosovo-1999'],
    'https://en.wikipedia.org/wiki/Yugoslav_Wars',
    [
      { names: ['Nástupnické státy Jugoslávie', 'Yugoslav successor states', 'Estados sucesores de Yugoslavia'],
        territories: ['Slovenia', 'Croatia', 'Bosnia and Herzegovina', 'Serbia', 'Montenegro', 'Macedonia'] },
    ]),
];
