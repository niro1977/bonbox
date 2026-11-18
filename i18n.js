/* Candoku languages. English is the source text everywhere in the code; when the language is Spanish, every piece of
   text that reaches the screen is translated here (exact phrases in D, phrases with numbers or names in P).
   Canvas text, the narrator and the share message call window.T() directly. */
(function (root) {
  let lang = null;
  try { lang = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  if (!lang) { try { const v = localStorage.getItem('candoku.lang'); if (v) lang = JSON.parse(v); } catch (e) {} }
  if (lang !== 'es' && lang !== 'en') lang = /^es/i.test(navigator.language || '') ? 'es' : 'en';
  root.LANG = lang;
  root.setLang = (l) => { try { localStorage.setItem('candoku.lang', JSON.stringify(l)); } catch (e) {} const u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u.toString()); };
  const btn = () => { const b = document.getElementById('optLang'); if (b) { b.textContent = lang === 'es' ? 'English' : 'Español'; b.onclick = () => root.setLang(lang === 'es' ? 'en' : 'es'); } };
  if (document.body) btn(); else document.addEventListener('DOMContentLoaded', btn);
  if (lang !== 'es') { root.T = (s) => s; return; }
  document.documentElement.lang = 'es';

  const D = {
    // ---- candies, ranks, worlds ----
    'Lollipop': 'Paleta', 'Wrapped Candy': 'Caramelo', 'Chocolate Bar': 'Barra de chocolate', 'Glazed Donut': 'Dona glaseada', 'Cupcake': 'Cupcake',
    'Choc Chip Cookie': 'Galleta con chispas', 'Cherries': 'Cerezas', 'Soft Serve': 'Helado suave', 'Shortcake': 'Pastelito', 'Candy Dango': 'Dango dulce', 'Swirl Pop': 'Paleta espiral',
    'Rookie': 'Novato', 'Candy Fan': 'Fan de los dulces', 'Sweet Tooth': 'Goloso', 'Sugar Pro': 'Pro del azúcar', 'Candy Master': 'Maestro dulce', 'Candy Legend': 'Leyenda dulce',
    'Player': 'Jugador',
    'Lollipop Meadow': 'Pradera de Paletas', 'Chocolate River': 'Río de Chocolate', 'Frosting Mountains': 'Montañas de Glaseado', 'Cotton Candy Sky': 'Cielo de Algodón de Azúcar',
    'Ice Cream Beach': 'Playa de Helado', 'Gingerbread Winter': 'Invierno de Jengibre', 'Donut Lake': 'Lago de Donas', 'Cookie Canyon': 'Cañón de Galletas', 'Crystal Caves': 'Cuevas de Cristal',
    'Jelly Jungle': 'Selva de Gelatina', 'Cupcake Village': 'Villa Cupcake', 'Candy Cane Forest': 'Bosque de Bastones de Caramelo', 'Caramel Falls': 'Cascadas de Caramelo',
    'Carnival Fairground': 'Feria de Carnaval', 'Macaron Mesa': 'Meseta de Macarons', 'Waffle Castle': 'Castillo de Waffles', 'Soda Springs': 'Manantiales de Soda',
    'Honey Hive Hills': 'Colinas de Miel', 'Berry Bog': 'Pantano de Moras', 'Mint Mountain': 'Montaña de Menta', 'Licorice Night Market': 'Mercado Nocturno de Regaliz',
    'Sugar Dunes Oasis': 'Oasis de Dunas de Azúcar', 'Pudding Pools': 'Pozas de Pudín', 'Cinnamon Autumn Forest': 'Bosque Otoñal de Canela', 'Starlight Sprinkle Galaxy': 'Galaxia de Chispas Estelares',
    'Toffee Treehouse Village': 'Aldea de Casas del Árbol', 'Gumdrop Garden': 'Jardín de Gomitas', 'Royal Cake Palace': 'Palacio Real del Pastel', 'Rainbow Sherbet Glacier': 'Glaciar de Sorbete Arcoíris',
    'Sweet Kingdom Gate': 'Puerta del Reino Dulce',
    'Sour Lemon Grove': 'Huerto de Limón Ácido', 'Bubblegum Swamp': 'Pantano de Chicle', 'Marshmallow Clouds': 'Nubes de Malvavisco', 'Popcorn Peaks': 'Picos de Palomitas', 'Jellybean Harbor': 'Puerto de Grageas', 'Peppermint Blizzard': 'Ventisca de Menta', 'Fudge Volcano': 'Volcán de Chocolate', 'Taffy Twister Plains': 'Llanuras del Tornado de Caramelo', 'Sprinkle Desert': 'Desierto de Chispas', 'Gummy Bear Woods': 'Bosque de Ositos de Goma', 'Candy Carnival Night': 'Noche de Carnaval Dulce', 'Blueberry Moon Lagoon': 'Laguna de la Luna Azul', 'Maple Syrup Marsh': 'Ciénaga de Miel de Maple', 'Rock Candy Cliffs': 'Acantilados de Azúcar Cristal', 'Churro Canyon': 'Cañón de Churros', 'Strawberry Storm Fields': 'Campos de Fresa y Tormenta', 'Licorice Ruins': 'Ruinas de Regaliz', 'Thundercloud Citadel': 'Ciudadela de las Nubes de Trueno', 'Sour Storm Summit': 'Cumbre de la Tormenta Ácida', "Vinegar's Castle": 'Castillo de Vinagre',
    // ---- home, ranking ----
    'Loading…': 'Cargando…', 'Loading': 'Cargando', 'Daily Candy': 'Dulce diario', 'Daily Challenge': 'Desafío diario', "Gumi's Cake": 'El pastel de Gumi', 'Sugar Stars': 'Estrellas de azúcar', 'Got it': 'Entendido',
    'Win new levels in a row to stack layers. Losing a level takes one layer away.': 'Gana niveles nuevos seguidos para sumar pisos. Si pierdes un nivel, se va un piso.',
    'At the start of every level your cake gives you:': 'Al empezar cada nivel tu pastel te da:', 'Every new level you win in a row adds a layer to your cake (up to 3).': 'Cada nivel nuevo que ganas seguido suma un piso a tu pastel (hasta 3).', 'Each layer helps you on the next level: candies already in the right place on the board, and more points. Lose a level and the top layer falls off.': 'Cada piso te ayuda en el siguiente nivel: dulces ya colocados en su lugar en el tablero, y más puntos. Si pierdes un nivel, se cae el piso de arriba.', 'What your cake gives you at the start of a level:': 'Lo que te da tu pastel al empezar un nivel:', '1 layer': '1 piso', '2 layers': '2 pisos', '3 layers': '3 pisos',
    '1 candy already in place': '1 dulce ya colocado', '2 candies already in place': '2 dulces ya colocados', '3 candies in place + a heart shield': '3 dulces colocados + un escudo de corazón',
    'Points ×2': 'Puntos ×2', 'Points ×3': 'Puntos ×3', 'Points ×4': 'Puntos ×4', 'Your first win of each day pays double coins!': '¡Tu primera victoria de cada día paga monedas dobles!',
    'Win a level without losing a heart to earn a sugar star. Collect 10 for a surprise prize!': 'Gana un nivel sin perder corazones y ganas una estrella de azúcar. ¡Junta 10 para un premio sorpresa!',
    'Sugar Stars complete!': '¡Estrellas de azúcar completas!', 'Loved it?': '¿Te gustó?', 'Hundreds more levels are waiting in the app': 'Cientos de niveles más te esperan en la app',
    'Cakes, candy bombs, gummy cars, new worlds and Vinegar to beat. Your Daily Challenge stays free here every day.': 'Pasteles, bombas de dulce, autos de gomita, mundos nuevos y Vinagre por vencer. Tu Desafío diario sigue gratis aquí todos los días.',
    'Get it on Google Play': 'Disponible en Google Play', 'Not now': 'Ahora no', 'Leave this level?': '¿Salir de este nivel?', 'Are you sure you want to quit?': '¿Seguro que quieres salir?', 'Replay': 'Repetir', 'Quit': 'Salir', 'Gummy Car': 'Auto de gomita', 'Candy Rocket': 'Cohete de dulce', 'Gummy cars': 'Autos de gomita', 'Candy rockets': 'Cohetes de dulce',
    'Use 1 gummy car': 'Usar 1 auto de gomita', 'Use 1 candy rocket': 'Usar 1 cohete de dulce',
    'Tap the gummy car, then tap any square: it drives along that whole row and uncovers all of it, the candy too.': 'Toca el auto de gomita y luego cualquier casilla: recorre toda esa fila y la descubre entera, también el dulce.',
    'Tap the candy rocket, then tap any square: it flies up that whole column and uncovers all of it, the candy too.': 'Toca el cohete de dulce y luego cualquier casilla: sube por toda esa columna y la descubre entera, también el dulce.',
    'Very rare: won in big chests and boss levels, or buy one with coins.': 'Muy raro: se gana en cofres grandes y niveles de jefe, o cómpralo con monedas.',
    '🚗 Tap a square: the car uncovers its whole row': '🚗 Toca una casilla: el auto descubre toda su fila', '🚀 Tap a square: the rocket uncovers its whole column': '🚀 Toca una casilla: el cohete descubre toda su columna', "Each layer gives you a candy bomb on the next level's board: tap it and it shows what its square holds. And more points! Lose a level and the top layer falls off.": 'Cada piso te da una bomba de dulce en el tablero del siguiente nivel: tócala y verás lo que esconde su casilla. ¡Y más puntos! Si pierdes un nivel, se cae el piso de arriba.',
    '1 bomb on the board': '1 bomba en el tablero', '2 bombs on the board': '2 bombas en el tablero', '3 bombs on the board + a heart shield': '3 bombas en el tablero + un escudo de corazón', 'Year of birth': 'Año de nacimiento', 'Opens at level 10': 'Se abre en el nivel 10', 'From level 10 on, every new level you win in a row adds a layer to your cake (up to 3).': 'Desde el nivel 10, cada nivel nuevo que ganas seguido suma un piso a tu pastel (hasta 3).', "🎂 Gumi's Cake opens at level 10!": '🎂 ¡El pastel de Gumi se abre en el nivel 10!', '🔒 Lv 10': '🔒 Nv 10', 'New cake layer!': '¡Nuevo piso de pastel!', 'Cake complete!': '¡Pastel completo!', '☀️ First win today ×2': '☀️ Primera victoria de hoy ×2',
    '🎂 Your cake lost its top layer. Keep playing to save it!': '🎂 Tu pastel perdió su piso de arriba. ¡Sigue jugando para salvarlo!', 'Welcome!': '¡Bienvenido!', 'Please enter your year of birth.': 'Indica tu año de nacimiento.', 'Year': 'Año', 'League prizes': 'Premios de la liga', "Yesterday's League": 'Liga de ayer', 'Prizes for the top 10': 'Premios para el top 10', 'You won the league!': '¡Ganaste la liga!', 'Reach the top 10 today to win a prize!': '¡Llega al top 10 hoy para ganar un premio!', 'On the podium! Hold your place until midnight': '¡En el podio! Mantén tu puesto hasta la medianoche', 'Top 10: a prize is waiting at midnight': 'Top 10: te espera un premio a medianoche', 'League medals': 'Medallas de liga', '1 place to the prize zone': 'A 1 puesto de la zona de premios', 'Claim': 'Reclamar', 'My helpers': 'Mis ayudas', 'Current level': 'Nivel actual', "Today's League": 'Liga de hoy', 'YOU': 'TÚ', 'You are #1 today!': '¡Eres el #1 de hoy!', 'You climbed 1 place!': '¡Subiste 1 puesto!', 'Tap and double tap': 'Toca y doble toque', 'Tap once for an X (no candy here). Double tap to place a candy!': 'Toca una vez para una X (aquí no va dulce). ¡Toca dos veces para poner un dulce!', 'Drag for many X': 'Arrastra para muchas X', 'Hold and drag your finger to mark a whole line of Xs in one move.': 'Mantén y arrastra el dedo para marcar toda una línea de X de una sola vez.', 'Start over?': '¿Empezar de nuevo?', "All your candies and X's on this board will be cleared.": 'Se borrarán todos tus dulces y X de este tablero.', 'Yes, start over': 'Sí, empezar de nuevo', 'Keep playing': 'Seguir jugando', 'Please choose another name.': 'Elige otro nombre, por favor.', 'Report?': '¿Reportar?', 'Thank you. The name was reported and hidden.': 'Gracias. El nombre fue reportado y ocultado.', 'ⓘ What is inside?': 'ⓘ ¿Qué hay dentro?', 'What this chest gives, and the chance of each prize.': 'Lo que da este cofre y la probabilidad de cada premio.', 'Always inside': 'Siempre incluye', 'Plus one of these': 'Más uno de estos', 'One of these': 'Uno de estos', 'Plus one rare prize': 'Más un premio raro', 'Challenge': 'Desafío', 'Beat the clock and win:': 'Gana al reloj y llévate:', 'Daily Challenge streak': 'Racha de desafío diario', '⏱ Play': '⏱ Jugar', 'Start': 'Empezar', "Time's up!": '¡Se acabó el tiempo!', 'The prize is still waiting. Try the challenge again!': 'El premio sigue esperando. ¡Intenta el desafío otra vez!', 'Challenge complete!': '¡Desafío superado!', 'Beat the clock, win a prize': 'Gana al reloj y llévate un premio', 'Done for today ✓ Come back tomorrow for a new challenge.': 'Listo por hoy ✓ Vuelve mañana por un nuevo desafío.', 'New board every day': 'Un tablero nuevo cada día', 'Play': 'Jugar', 'pts today': 'pts hoy',
    'Solve a board to start climbing': 'Resuelve un tablero para empezar a subir', '🏆 Daily ranking': '🏆 Ranking diario', 'FREE': 'GRATIS', 'EVENTS': 'EVENTOS', 'START': 'INICIAR',
    'Cannot reach the ranking. Check your connection and try again.': 'No se pudo cargar el ranking. Revisa tu conexión e inténtalo de nuevo.',
    'No one has scored yet today. Be the first!': 'Nadie ha anotado hoy. ¡Sé el primero!', 'Solve a board to join the ranking today': 'Resuelve un tablero para entrar al ranking de hoy',
    'Top rank reached!': '¡Rango máximo alcanzado!', 'Hard': 'Difícil', '👑 Very Hard': '👑 Muy difícil', '💀 Extremely Hard': '💀 Extremadamente difícil',
    'HARD': 'DIFÍCIL', 'VERY HARD': 'MUY DIFÍCIL', 'EXTREME': 'EXTREMO', 'Solved today ✓ come back tomorrow': 'Resuelto hoy ✓ vuelve mañana', 'new board today': 'tablero nuevo hoy',
 'Your name': 'Tu nombre',
    'Quests': 'Misiones', 'Home': 'Inicio', 'Ranking': 'Ranking', 'Shop': 'Tienda', 'Gifts': 'Regalos', 'Sound': 'Sonido', 'Profile': 'Perfil', 'Settings': 'Ajustes', 'Main': 'Principal',
    // ---- level screen ----
    'Tap: X (tap again to remove). Double tap: candy. Hold a square or use Maybe to mark a ?': 'Toca: X (toca otra vez para quitarla). Doble toque: dulce. Mantén presionada una casilla o usa Quizás para marcar un ?',
    'first time!': '¡primera vez!', 'Continue': 'Continuar', 'Shield': 'Escudo', 'x2 Points': 'Puntos x2', 'You have none. Buy one in the shop!': 'No tienes ninguno. ¡Compra uno en la tienda!',
    'Welcome back! Continuing where you left off.': '¡Qué bueno verte! Sigues donde lo dejaste.', '🛡 Heart Shield is on!': '🛡 ¡Escudo de corazón activado!',
    '👑 Boss level! Beat it for a big prize.': '👑 ¡Nivel de jefe! Gánalo y llévate un gran premio.', 'New candy unlocked': 'Nuevo dulce desbloqueado',
    'Sweet!': '¡Dulce!', 'Yummy!': '¡Rico!', 'Tasty!': '¡Sabroso!', 'Nice!': '¡Bien!', 'Delicious!': '¡Delicioso!', 'Super!': '¡Súper!', 'Great!': '¡Genial!', 'Perfect!': '¡Perfecto!',
    '♾️ Unlimited hearts: no heart lost!': '♾️ Corazones ilimitados: ¡no perdiste ninguno!', '🛡 The shield saved your heart!': '🛡 ¡El escudo salvó tu corazón!',
    'Back': 'Atrás', 'Undo': 'Deshacer', 'Hint': 'Pista', 'Magic wand': 'Varita mágica', 'Magic Wand': 'Varita mágica', 'Sweeper': 'Escoba', 'Magnifier': 'Lupa', 'Maybe': 'Quizás', 'Restart': 'Reiniciar',
    'Hearts per level': 'Corazones por nivel',
    // ---- helpers ----
    'A hint finds a square where an X surely belongs and marks it for you, and tells you why. It places a candy only when that is the last choice left.': 'La pista encuentra una casilla donde seguro va una X, la marca por ti y te explica por qué. Solo coloca un dulce cuando es la última opción que queda.',
    'The wand puts one correct candy on the board for you, with no risk. Use it when you are really stuck.': 'La varita coloca un dulce correcto en el tablero, sin riesgo. Úsala cuando de verdad estés atorado.',
    'Heart Shield': 'Escudo de corazón', 'Pick it before a level starts. The first mistake of that level will not cost you a heart.': 'Elígelo antes de empezar un nivel. El primer error de ese nivel no te costará un corazón.',
    'Pick the shield on the screen before a level starts.': 'Elige el escudo en la pantalla antes de empezar un nivel.',
    'Won in the Daily Bonus, the lucky wheel, chests and boss levels, or buy one with coins.': 'Se gana en el Bono diario, la ruleta, los cofres y los niveles de jefe, o cómpralo con monedas.',
    'Double Points': 'Puntos dobles', 'Pick it before a level starts. That level gives you double points for the daily ranking.': 'Elígelo antes de empezar un nivel. Ese nivel te da el doble de puntos para el ranking diario.',
    'Pick the x2 on the screen before a level starts.': 'Elige el x2 en la pantalla antes de empezar un nivel.', 'Won in the lucky wheel and chests, or buy one with coins.': 'Se gana en la ruleta y los cofres, o cómpralo con monedas.',
    'The sweeper marks an X on every square that cannot hold a candy because of the candies you already placed: same row, same column, same color and the squares around them.': 'La escoba marca con X todas las casillas donde ya no puede ir un dulce por los que ya colocaste: misma fila, misma columna, mismo color y las casillas de alrededor.',
    'Won in the Daily Bonus, quests and chests, or buy one with coins.': 'Se gana en el Bono diario, las misiones y los cofres, o cómprala con monedas.',
    'Tap the magnifier, then tap any square. It tells you the truth: a candy goes there, or it gets an X.': 'Toca la lupa y luego cualquier casilla. Te dice la verdad: ahí va un dulce, o va una X.',
    'Won in the Daily Bonus, the lucky wheel and boss levels, or buy one with coins.': 'Se gana en el Bono diario, la ruleta y los niveles de jefe, o cómprala con monedas.',
    'Use 1 hint': 'Usar 1 pista', 'Not now': 'Ahora no', "Nothing left to hint. You're almost there!": 'No queda nada por señalar. ¡Ya casi lo logras!', 'Place a candy first, then sweep!': '¡Primero coloca un dulce y luego barre!',
    '🔍 Tap a square to peek at the truth': '🔍 Toca una casilla para descubrir la verdad', '✅ Yes! A candy goes right here': '✅ ¡Sí! Aquí va un dulce', '❌ Not here. Marked with an X': '❌ Aquí no. Marcada con una X',
    'Every candy is already placed!': '¡Ya están todos los dulces!', '✨ The wand placed a candy for you!': '✨ ¡La varita colocó un dulce por ti!',
    // ---- hints.js ----
    'This color can only go in one row, so cross out the other spots in that row.': 'Este color solo puede ir en una fila, así que tacha las otras casillas de esa fila.',
    'This color can only go in one column, so cross out the other spots in that column.': 'Este color solo puede ir en una columna, así que tacha las otras casillas de esa columna.',
    'This row only has spots of one color, so cross out that color everywhere else.': 'En esta fila solo quedan casillas de un color, así que tacha ese color en todo lo demás.',
    'This column only has spots of one color, so cross out that color everywhere else.': 'En esta columna solo quedan casillas de un color, así que tacha ese color en todo lo demás.',
    'A candy here would leave another color, row or column with nowhere to go. Cross it out.': 'Un dulce aquí dejaría a otro color, fila o columna sin lugar. Táchala.',
    'This color has only one spot left!': '¡A este color solo le queda una casilla!', 'This row has only one spot left!': '¡A esta fila solo le queda una casilla!', 'This column has only one spot left!': '¡A esta columna solo le queda una casilla!',
    'Not here. Cross this spot out.': 'Aquí no. Tacha esta casilla.', 'This is the spot!': '¡Aquí es!',
    // ---- prizes, bonus, profile, shop ----
    'You got a prize!': '¡Ganaste un premio!', 'Awesome!': '¡Genial!', 'Find it in My Collection (Profile).': 'Búscalo en Mi colección (Perfil).', 'Pick a card to get your reward!': '¡Elige una carta y llévate tu premio!',
    'big prize day!': '¡día de gran premio!', 'come back tomorrow for more': 'vuelve mañana por más', 'Big prize day!': '¡Día de gran premio!', 'Daily Bonus!': '¡Bono diario!', 'Daily Bonus': 'Bono diario', 'Claim': 'Reclamar',
    'My Profile': 'Mi perfil', 'My collection': 'Mi colección', 'My Collection': 'Mi colección', 'Levels passed': 'Niveles superados', 'Stars': 'Estrellas', 'Best day': 'Mejor día', 'Today': 'Hoy',
    'Daily bonus streak': 'Racha de bono diario', 'Daily Candy streak': 'Racha de dulce diario', 'Coins': 'Monedas', 'Hints · Wands': 'Pistas · Varitas', 'Hints': 'Pistas', 'Wands': 'Varitas',
    'Special offers': 'Ofertas especiales', 'Free rewards': 'Premios gratis', 'Spend your coins': 'Gasta tus monedas', 'Earn coins by solving levels and from the Daily Bonus.': 'Gana monedas resolviendo niveles y con el Bono diario.',
    'Not enough coins': 'No tienes suficientes monedas', 'Starter Pack': 'Paquete inicial', 'ONE TIME · BEST DEAL': 'OFERTA ÚNICA', 'ONE TIME': 'SOLO UNA VEZ', 'BEST DEAL': 'MEJOR OFERTA',
    'Bag of Coins': 'Bolsa de monedas', 'Jar of Coins': 'Frasco de monedas', 'POPULAR': 'POPULAR', 'Chest of Coins': 'Cofre de monedas', 'BEST VALUE': 'MÁS VALOR', 'Helper Pack': 'Paquete de ayudas', 'No Ads': 'Sin anuncios',
    'Ads removed. Thank you!': 'Anuncios eliminados. ¡Gracias!', 'You already have this': 'Ya lo tienes', 'The purchase did not go through': 'La compra no se completó', '(test) purchase approved': '(prueba) compra aprobada',
    'Purchases open with the Bonbox app on Google Play': 'Las compras estarán disponibles en la app de Bonbox en Google Play', 'Remove the ads forever': 'Quita los anuncios para siempre', 'Owned ✓': 'Comprado ✓',
    '+1 life': '+1 vida', '+1 hint': '+1 pista', 'Free hint!': '¡Pista gratis!', '+3 coins': '+3 monedas', 'Free coins!': '¡Monedas gratis!', '▶ Watch': '▶ Ver', 'Video rewards arrive with the app': 'Los premios por video llegan con la app',
    'No more videos today. Come back tomorrow!': 'No hay más videos por hoy. ¡Vuelve mañana!', 'Watch the whole video to get the reward': 'Mira el video completo para recibir el premio', 'No video available right now': 'No hay video disponible en este momento',
    '▶ (test) video playing…': '▶ (prueba) reproduciendo video…', 'Video rewards arrive with the Bonbox app on Google Play': 'Los premios por video llegan con la app de Bonbox en Google Play',
    '×2 booster': '×2 potenciador',
    // ---- win / lose ----
    'Level reward!': '¡Premio de nivel!', 'Big level reward!': '¡Gran premio de nivel!', 'no hints': 'sin pistas', '🪄 Big reward!': '🪄 ¡Gran premio!', '+1 magic wand': '+1 varita mágica', '🎁 and +1 hint': '🎁 y +1 pista',
    '🎁 Reward!': '🎁 ¡Premio!', '👑 Boss defeated!': '👑 ¡Jefe derrotado!', 'No hearts lost = an even bigger prize!': 'Sin perder corazones = ¡un premio aún mayor!', 'Next level': 'Siguiente', 'Back to map': 'Volver al mapa',
    'Share': 'Compartir', 'Copied!': '¡Copiado!', 'Out of hearts': 'Sin corazones', 'Take a breath and try this level again.': 'Respira hondo e intenta este nivel otra vez.', '▶ Watch video · keep playing': '▶ Video · sigue jugando',
    'Try again': 'Intentar de nuevo', '❤️ One more heart. Keep going!': '❤️ Un corazón más. ¡Sigue!', 'Close': 'Cerrar',
    // ---- intro, tutorial, how to play ----
    'Bonbox Land was the sweetest place in the world.': 'El País de los Dulces era el lugar más dulce del mundo.', 'Then came a giant sneeze. Achoo! Every candy got mixed up!': 'Entonces llegó un estornudo gigante. ¡Achú! ¡Todos los dulces se revolvieron!',
    'Help Gumi put them back. One candy in every color, and no two candies can touch!': 'Ayuda a Gumi a ponerlos en su lugar. ¡Un dulce en cada color, y dos dulces nunca se pueden tocar!',
    'In Bonbox Land, every sweet lived in the great Bonbox, each one in its own perfect spot.': 'En el País de los Dulces, cada dulce vivía en la gran Bonbox, cada uno en su lugar perfecto.',
    'But up in the clouds lived Vinegar, the grumpy storm king. He could not stand all that sweetness!': 'Pero en las nubes vivía Vinagre, el gruñón rey de la tormenta. ¡No soportaba tanta dulzura!',
    'He took a giant breath and... ACHOO! A wild candy storm blew every candy out of the Bonbox!': 'Tomó aire y... ¡ACHÚ! ¡Una tormenta salvaje sacó a todos los dulces de la Bonbox!',
    'Only Gumi can fix it! Help him find the perfect spot for every candy: one in every color, and no two candies touching!': '¡Solo Gumi puede arreglarlo! Ayúdalo a encontrar el lugar perfecto para cada dulce: ¡uno en cada color, y que nunca se toquen!',
    'Vinegar': 'Vinagre', '👑 Vinegar': '👑 Vinagre', 'Vinegar blocks the way!': '¡Vinagre bloquea el camino!', 'Vinegar is defeated!': '¡Vinagre fue derrotado!', '👑 Vinegar defeated!': '👑 ¡Vinagre cayó!',
    'Vinegar blocks the way! You can beat him!': '¡Vinagre bloquea el camino! ¡Tú puedes vencerlo!', 'You defeated Vinegar! Amazing!': '¡Venciste a Vinagre! ¡Increíble!',
    'Full Lives': 'Vidas completas', 'Unlimited Lives': 'Vidas ilimitadas', '2 HOURS': '2 HORAS', 'Refill all 5 lives': 'Rellena tus 5 vidas', '❤️ Lives refilled!': '❤️ ¡Vidas completas!', 'Refill all lives · $0.99': 'Rellenar vidas · $0.99', 'Refill all lives': 'Rellenar vidas',
    'At the top of the storm, Gumi did not fight. He held out one sweet lollipop and said: try it, just once.': 'En lo alto de la tormenta, Gumi no peleó. Le ofreció una paleta dulce y dijo: pruébala, solo una vez.',
    'Vinegar took one tiny taste... and his sour face melted into the biggest smile Bonbox Land had ever seen!': 'Vinagre probó un poquito... ¡y su cara agria se derritió en la sonrisa más grande que el País de los Dulces había visto!',
    'From that day on, Vinegar was the sweetest cloud in Bonbox Land, and the Bonbox was full again. Thank you for playing!': 'Desde ese día, Vinagre fue la nube más dulce del País de los Dulces, y la Bonbox volvió a estar llena. ¡Gracias por jugar!',
    "You'll never fix my mess!": '¡Nunca arreglarás mi desorden!',
    'Sweet things make me sick!': '¡Lo dulce me enferma!',
    'This board is mine!': '¡Este tablero es mío!',
    'Ha! Wrong!': '¡Ja! ¡Mal!',
    "Sour, isn't it?": 'Agrio, ¿verdad?',
    'Hehehe!': '¡Jejeje!',
    'Hey! Stop that!': '¡Oye! ¡Basta!',
    'Too sweet!': '¡Demasiado dulce!',
    "Noooo! I'll be back!": '¡Nooo! ¡Volveré!',
    'N-not you again!': '¡O-otra vez tú no!',
    'Stay away from my castle!': '¡Aléjate de mi castillo!',
    'You just got lucky before!': '¡Antes solo tuviste suerte!',
    'Phew... wrong!': 'Uf... ¡mal!',
    'Yes! Keep missing!': '¡Sí! ¡Sigue fallando!',
    'Eek!': '¡Ay, no!',
    'Not again!': '¡Otra vez no!',
    'Stop, please!': '¡Basta, por favor!',
    'Why are you so good at this?!': '¿¡Por qué eres tan bueno en esto!?',
    'Vinegar sent me!': '¡Me mandó Vinagre!',
    'Bleh!': '¡Blee!',
    'Nyah nyah!': '¡Ña ña!',
    'Ow!': '¡Au!',
    'Waaah!': '¡Buaaa!',
    'Sour Cloud': 'Nube Agria',
    'Hehe! A little fog for you!': '¡Jeje! ¡Un poco de niebla para ti!',
    'Can you see now? Hehe!': '¿Y ahora ves? ¡Jeje!',
    'Boo! Miss me?': '¡Bu! ¿Me extrañaste?',
    'Sticker won back!': '¡La recuperaste!',
    'Replay the ending': 'Repetir el final',
    'Sour Storm': 'Tormenta Agria',
    'Sour Storm!': '¡Tormenta Agria!',
    'You knocked him out! Claim your prizes.': '¡Lo venciste! Reclama tus premios.',
    'Vinegar is storming Bonbox Land! Every level you win on the map is one hit. Knock him out before the time ends!': '¡Vinagre ataca el País de los Dulces! Cada nivel que ganas en el mapa es un golpe. ¡Véncelo antes de que se acabe el tiempo!',
    'A 24-hour battle. Press Start, then win levels on the map: every win is one hit on Vinegar!': 'Una batalla de 24 horas. Presiona Iniciar y gana niveles en el mapa: ¡cada victoria es un golpe a Vinagre!',
    'Vinegar is hiding. He will be back in a few days.': 'Vinagre se esconde. Volverá en unos días.',
    'Pfff! Bye bye, X marks!': '¡Pfff! ¡Adiós, tus X!', 'One puff... and your X marks are gone!': 'Un soplido... ¡y tus X desaparecen!',
    'Enjoying Bonbox?': '¿Te gusta Bonbox?', 'Tap the stars to rate the game': 'Toca las estrellas para calificar el juego', 'Not now': 'Ahora no', 'Rate on Google Play': 'Calificar en Google Play',
    'Thank you! Your stars on Google Play help us a lot.': '¡Gracias! Tus estrellas en Google Play nos ayudan mucho.', 'Thank you! We will keep making the game better.': '¡Gracias! Seguiremos mejorando el juego.',
    'Album prize ready!': '¡Premio del álbum!',
    'Nicely done!': '¡Muy bien hecho!', 'Great job!': '¡Gran trabajo!', 'Well played!': '¡Bien jugado!', 'So close to perfect!': '¡Casi perfecto!', 'Phew! That was close!': '¡Uf! ¡Estuvo cerca!', 'Wow, you just made it!': '¡Guau, por poco!', 'By a whisker!': '¡Por un pelo!', 'What a narrow escape!': '¡Te salvaste!',
    'ACHOO!': '¡ACHÚ!', 'Tap to start': 'Toca para empezar', 'Welcome to Bonbox!': '¡Bienvenido a Bonbox!', "Let's play!": '¡A jugar!', 'Next': 'Siguiente', 'Skip': 'Saltar', 'Got it': 'Entendido',
    'Welcome! Your goal: put exactly ONE candy in every color. The row up here shows which candies you still need.': '¡Bienvenido! Tu meta: poner exactamente UN dulce en cada color. La fila de arriba muestra los dulces que te faltan.',
    'Tap a square to mark an X, a square that cannot hold a candy. Tap the X again to remove it. Drag across squares to mark many.': 'Toca una casilla para marcar una X: ahí no puede ir un dulce. Toca la X otra vez para quitarla. Arrastra el dedo para marcar varias.',
    'Double-tap a square to place a candy. Only ONE candy in each row and each column, and candies can never touch, not even diagonally.': 'Toca dos veces una casilla para colocar un dulce. Solo UN dulce en cada fila y en cada columna, y los dulces nunca se tocan, ni en diagonal.',
    '✅ Do: one candy in every row, column and color.  ❌ Never: two candies in the same row, column or color, or touching each other, even diagonally.': '✅ Sí: un dulce en cada fila, columna y color.  ❌ Nunca: dos dulces en la misma fila, columna o color, ni tocándose, ni siquiera en diagonal.',
    'Careful! A wrong candy costs a heart. Lose all three hearts and you try the level again.': '¡Cuidado! Un dulce equivocado cuesta un corazón. Si pierdes los tres, vuelves a intentar el nivel.',
    'Stuck? The light bulb gives a hint, and the wand places a correct candy for you. You start with a few of each.': '¿Atorado? El foco te da una pista y la varita coloca un dulce correcto por ti. Empiezas con algunos de cada uno.',
    'Place all the candies to win! You earn stars, coins and prizes. Good luck!': '¡Coloca todos los dulces para ganar! Ganas estrellas, monedas y premios. ¡Suerte!',
    'How to mark': 'Cómo marcar', 'Tap a square for an X (no candy here). Double-tap to place a candy.': 'Toca una casilla para poner una X (aquí no va dulce). Toca dos veces para colocar un dulce.',
    'Rows and columns': 'Filas y columnas', 'Two candies can never share a row or a column.': 'Dos dulces nunca comparten fila ni columna.', 'One per colour': 'Uno por color', 'Each colour area holds exactly one candy.': 'En cada zona de color va exactamente un dulce.',
    'No touching!': '¡Sin tocarse!', 'Not side by side, and not even corner to corner.': 'Ni lado a lado, ni siquiera esquina con esquina.', 'Hearts & helpers': 'Corazones y ayudas',
    'A wrong candy costs a heart. Stuck? The light bulb gives a hint and the wand places a candy for you.': 'Un dulce equivocado cuesta un corazón. ¿Atorado? El foco te da una pista y la varita coloca un dulce por ti.',
    'How to play': 'Cómo jugar', 'Put': 'Pon', 'one candy': 'un dulce', 'in every color.': 'en cada color.', 'Only': 'Solo', 'one candy per row': 'un dulce por fila', 'and': 'y', 'one per column': 'uno por columna',
    'Candies can': 'Los dulces', 'never touch': 'nunca se tocan', ', not even diagonally.': ', ni siquiera en diagonal.',
    'Tap a square once for an X, tap the X to remove it. Double tap a square for a candy. Hold a square, or switch on Maybe, to mark a ? on a square you are unsure about. You start with 3 hints and win 1 more for every 5 levels you pass. A hint shows where an X belongs, and places a candy only when it is the last choice. Every board has exactly one answer.': 'Toca una casilla una vez para poner una X; toca la X para quitarla. Toca dos veces para colocar un dulce. Mantén presionada una casilla, o activa Quizás, para marcar un ? donde tengas dudas. Empiezas con algunas pistas y ganas más al pasar niveles. La pista muestra dónde va una X y solo coloca un dulce cuando es la última opción. Cada tablero tiene una única solución.',
    'Touch vibration': 'Vibración al tocar', 'Music': 'Música', 'Narrator voice': 'Voz del narrador', 'All sound': 'Todo el sonido', 'Replay the tutorial': 'Repetir el tutorial', 'Replay the story': 'Repetir la historia',
    // ---- collection ----
    'Outfits': 'Trajes', 'Frames': 'Marcos', 'Stickers': 'Calcomanías', 'Varsity Gumi': 'Gumi Deportista', 'Chef Gumi': 'Gumi Chef', 'Firefighter Gumi': 'Gumi Bombero', 'Pirate Gumi': 'Gumi Pirata', 'Cowboy Gumi': 'Gumi Vaquero',
    'Wizard Gumi': 'Gumi Mago', 'King Gumi': 'Gumi Rey', 'Ninja Gumi': 'Gumi Ninja', 'Pink': 'Rosa', 'Blue': 'Azul', 'Green': 'Verde', 'Orange': 'Naranja', 'Purple': 'Morado', 'Yellow': 'Amarillo',
    'Cream': 'Crema', 'Mint': 'Menta', 'Sky': 'Cielo', 'Rose': 'Rosado', 'Gold': 'Dorado', 'Night': 'Noche', 'Bear colour · tap one, then pick an outfit': 'Color del oso · toca uno y luego elige un traje',
    'Start with two bears, and win a new outfit every 15 levels. A new colour comes every 20 levels, from level 10.': 'Empiezas con dos osos y ganas un traje nuevo cada 15 niveles. Un color nuevo llega cada 20 niveles, desde el nivel 10.',
    'Your board frame, used in every level.': 'El marco de tu tablero, se usa en todos los niveles.', 'Claimed ✓': 'Reclamado ✓', 'Album prize!': '¡Premio del álbum!', 'claim a prize every 5 stickers': 'reclama un premio cada 5 calcomanías',
    'New outfit!': '¡Traje nuevo!', 'Rare sticker!': '¡Calcomanía rara!', 'New board frame!': '¡Marco nuevo!', 'New sticker!': '¡Calcomanía nueva!', 'Open My Collection → Stickers to claim it': 'Abre Mi colección → Calcomanías para reclamarlo',
    // ---- quests ----
    'Challenges': 'Desafíos', 'Daily': 'Diarios', 'Weekly': 'Semanales', 'Trophies': 'Trofeos', 'Solve 15 levels this week': 'Resuelve 15 niveles esta semana', 'Win 3 Hard (or harder) levels': 'Gana 3 niveles difíciles (o más)',
    'Win 5 levels without losing a heart': 'Gana 5 niveles sin perder un corazón', 'Pass 10 levels': 'Pasa 10 niveles', 'Pass 50 levels': 'Pasa 50 niveles', 'Pass 100 levels': 'Pasa 100 niveles', 'Pass 200 levels': 'Pasa 200 niveles',
    'Win 10 levels without losing a heart': 'Gana 10 niveles sin perder un corazón', 'Win 50 levels without losing a heart': 'Gana 50 niveles sin perder un corazón', 'Win 10 levels with no hints': 'Gana 10 niveles sin pistas',
    'Defeat 3 bosses': 'Derrota a 3 jefes', 'Sky Path: 5 flawless levels in a row': 'Camino del cielo: 5 niveles perfectos seguidos', 'Daily Bonus streak of 7 days': 'Racha de 7 días de Bono diario', 'Quest complete!': '¡Misión completada!',
    '🎡 Bonus won: 1 extra wheel spin!': '🎡 ¡Bono ganado: 1 giro extra de ruleta!', 'Finish all three for a free wheel spin': 'Completa las tres y gana un giro gratis de ruleta', 'Weekly challenge!': '¡Desafío semanal!',
    'Weekly challenges restart every Monday': 'Los desafíos semanales se reinician cada lunes', 'Trophy won!': '¡Trofeo ganado!', 'Trophies are earned once, for good': 'Los trofeos se ganan una vez, para siempre',
    'Solve 3 levels': 'Resuelve 3 niveles', 'Solve a level with no hints': 'Resuelve un nivel sin pistas', 'Solve a level without losing a heart': 'Resuelve un nivel sin perder un corazón',
    // ---- gifts, chest, wheel ----
    'Soon': 'Pronto', 'OPEN': 'ABRIR', 'OPEN!': '¡ABRIR!', 'CLAIM': 'RECLAMAR', 'Free presents just for coming back.': 'Regalos gratis solo por volver.', 'Daily gift': 'Regalo diario', 'Ready to collect!': '¡Listo para recoger!',
    'Come back tomorrow': 'Vuelve mañana', 'Free hint': 'Pista gratis', 'Get': 'Tomar', 'A gift for you!': '¡Un regalo para ti!', 'Small chest': 'Cofre pequeño', 'Medium chest': 'Cofre mediano', 'Large chest': 'Cofre grande',
    'Candy Chest': 'Cofre dulce', 'Open chest': 'Abrir cofre', 'Open now': 'Abrir ahora', 'Start opening': 'Empezar a abrir', 'Opening…': 'Abriendo…', 'Lucky Wheel': 'Ruleta de la suerte', 'Spin': 'Girar', 'Spin (free!)': 'Girar (¡gratis!)',
    'Spin the wheel for a prize!': '¡Gira la ruleta y gana un premio!', 'Finish the daily quests for an extra spin.': 'Completa las misiones diarias para un giro extra.', 'Good luck…': 'Suerte…', 'Lucky Wheel!': '¡Ruleta de la suerte!', 'FREE SPIN': 'GIRO GRATIS',
    // ---- mini-games, events ----
    'Mini-games': 'Minijuegos', 'Mini-game': 'Minijuego', 'Two free plays of each game every day.': 'Dos partidas gratis de cada juego al día.', 'Events': 'Eventos', 'Memory Match': 'Memoria', 'Find all the pairs in 14 moves': 'Encuentra todos los pares en 14 movimientos',
    'Candy Toss': 'Tiro de dulces', 'Toss 5 candies into the jar': 'Lanza 5 dulces al frasco', 'Odd One Out': 'El diferente', 'Spot the different candy before time runs out': 'Encuentra el dulce diferente antes de que se acabe el tiempo',
    'Sugar Jars': 'Frascos de azúcar', 'Tap the jar that matches the drop': 'Toca el frasco del mismo color que la gota', 'Candy Shooter': 'Lanzadulces', 'Hoop Shot': 'Tiro al aro', 'Cart Race': 'Carrera de carritos',
    'Give up': 'Rendirse', 'Done': 'Listo', 'Tap the candy that is different. Wrong taps cost 3 seconds.': 'Toca el dulce que es diferente. Cada error cuesta 3 segundos.', 'All found!': '¡Todos encontrados!', 'Find the different candy on 6 boards in 15 seconds!': '¡Encuentra el dulce diferente en 6 tableros en 15 segundos!',
    'Tap the jar with the same colour. 3 mistakes and it is over.': 'Toca el frasco del mismo color. Con 3 errores se acaba.', 'Come back tomorrow for more plays': 'Vuelve mañana para jugar más', 'Back tomorrow': 'Vuelve mañana',
    'Tap to shoot. Match 3 or more to pop them before they reach the hole!': 'Toca para disparar. ¡Junta 3 o más para reventarlos antes de que lleguen al hoyo!', 'Cleared!': '¡Despejado!', 'Amazing!': '¡Increíble!', 'Pop!': '¡Pop!',
    'Pull the ball back, aim, and let go. Fill the hoops!': 'Jala la pelota, apunta y suelta. ¡Llena los aros!', 'LINE!': '¡LÍNEA!', 'HOOPS': 'AROS', 'LINES': 'LÍNEAS', 'BALLS': 'PELOTAS', '▼ pull down ▼': '▼ jala hacia abajo ▼',
    'Swish!': '¡Adentro!', 'Taken!': '¡Ocupado!', 'Rim!': '¡Borde!', 'Miss': 'Fallo', 'GO!': '¡YA!', 'Ouch!': '¡Ay!', 'BONUS!': '¡BONUS!', 'Drag the cart. Grab coins,': 'Arrastra el carrito. Junta monedas,', 'dodge rocks: 3 hits and you are out!': 'esquiva rocas: ¡3 golpes y quedas fuera!', 'Bonus: Cart Race': 'Bonus: Carrera', 'Drag the cart. Grab coins, dodge rocks: 3 hits and you are out!': 'Arrastra el carrito. Junta monedas y esquiva rocas: ¡3 golpes y quedas fuera!', 'Crashed! No prize this time': '¡Chocaste! Esta vez no hay premio',
    'Hold the cart and drag it left or right. Dodge rocks, grab coins, beat the rival!': 'Mantén presionado el carrito y arrástralo a los lados. ¡Esquiva rocas, junta monedas y gana al rival!', 'You won the race!': '¡Ganaste la carrera!', 'The rival won this time': 'Esta vez ganó el rival',
    'Great memory!': '¡Gran memoria!', 'Out of moves.': 'Sin movimientos.', 'Tap to launch. The candy takes a moment to fly, so aim ahead of the jar!': 'Toca para lanzar. El dulce tarda un momento en volar, ¡apunta adelante del frasco!',
    'Daily Candy is done for today. Come back tomorrow!': 'El dulce diario de hoy ya está hecho. ¡Vuelve mañana!', 'PLAY': 'JUGAR',
    // ---- pass, lives, climb, rush ----
    'Candy Pass': 'Pase dulce', 'Candy Pass!': '¡Pase dulce!', 'Win levels without losing a heart to climb the pass.': 'Gana niveles sin perder un corazón para avanzar en el pase.', 'Pass complete! Start a fresh one.': '¡Pase completo! Empieza uno nuevo.',
    'Win levels without losing a heart to climb': 'Gana niveles sin perder un corazón para avanzar', 'Start a new pass': 'Empezar un pase nuevo', 'Lives': 'Vidas', 'You lose a life when you fail a level. One life comes back every 30 minutes.': 'Pierdes una vida cuando fallas un nivel. Cada 30 minutos regresa una vida.',
    '▶ Watch a video · +1 life': '▶ Mira un video · +1 vida', 'Refill all': 'Rellenar todo', 'Open the shop': 'Abrir la tienda', 'Unlimited hearts are on!': '¡Corazones ilimitados activados!', 'You are full of lives. Go play!': 'Tienes todas tus vidas. ¡A jugar!',
    '❤️ +1 life': '❤️ +1 vida', 'Candy Climb': 'Escalada dulce', 'Candy Climb!': '¡Escalada dulce!', 'Start · 24 hours': 'Iniciar · 24 horas', 'Play level': 'Jugar nivel', 'Candy Climb is back tomorrow': 'La Escalada dulce vuelve mañana', 'Top of the climb!': '¡La cima de la escalada!',
    'Play the normal levels on the map.': 'Juega los niveles normales del mapa.', 'Every level you win': 'Cada nivel que ganas', 'lifts the bear one platform,': 'sube al oso una plataforma,', 'every level you lose': 'cada nivel que pierdes',
    'drops him one. Come back here to claim the prizes.': 'lo baja una. Vuelve aquí para reclamar los premios.', 'Today is over. A new climb opens tomorrow.': 'Por hoy terminó. Mañana se abre una escalada nueva.',
    'A 24-hour challenge. Press Start, then play the normal levels: every win lifts the bear one platform to a bigger prize!': 'Un desafío de 24 horas. Presiona Iniciar y juega los niveles normales: ¡cada victoria sube al oso una plataforma hacia un premio mayor!',
    'Coin Rush': 'Fiebre de monedas', '⚡ Coin Rush is on: double coins from every level you win!': '⚡ Fiebre de monedas activa: ¡monedas dobles en cada nivel que ganes!', 'Coin Rush is back tomorrow': 'La Fiebre de monedas vuelve mañana',
    '⚡ Coin Rush! Double coins from level wins for 30 minutes': '⚡ ¡Fiebre de monedas! Monedas dobles por ganar niveles durante 30 minutos',
    // ---- narrator ----
    'Nice one!': '¡Bien hecho!', 'Delicious! Perfect!': '¡Delicioso! ¡Perfecto!', 'Divine! Perfect!': '¡Divino! ¡Perfecto!', 'Sugar-tastic! Perfect!': '¡Dulcísimo! ¡Perfecto!', 'Very tasty!': '¡Muy sabroso!',
    'Sweet! That was close!': '¡Dulce! ¡Estuvo cerca!', 'Oh no! Try again!': '¡Oh, no! ¡Inténtalo otra vez!', "Let's go!": '¡Vamos!', 'Ready? Go!': '¿Listo? ¡Ya!', 'Hard level! You can do it!': '¡Nivel difícil! ¡Tú puedes!',
    'Very hard level! Good luck!': '¡Nivel muy difícil! ¡Suerte!', 'Extremely hard level! Good luck!': '¡Nivel extremadamente difícil! ¡Suerte!', 'Congratulations!': '¡Felicidades!', 'Wow! Nice reward!': '¡Guau! ¡Qué buen premio!',
    'Amazing! A big reward!': '¡Increíble! ¡Un gran premio!', 'A magic wand! Use it wisely!': '¡Una varita mágica! ¡Úsala con sabiduría!',
    'Language': 'Idioma'
  };
  const DL = {}; Object.keys(D).forEach((k) => { DL[k.toLowerCase()] = D[k]; });

  // prize lists: "3 coins and 1 magic wand"
  const PZ = { 'gummy car': ['auto de gomita', 'autos de gomita'], 'candy rocket': ['cohete de dulce', 'cohetes de dulce'], 'life': ['vida', 'vidas'], 'coin': ['moneda', 'monedas'], 'hint': ['pista', 'pistas'], 'magic wand': ['varita mágica', 'varitas mágicas'], 'heart shield': ['escudo de corazón', 'escudos de corazón'],
    'double-points booster': ['potenciador de puntos dobles', 'potenciadores de puntos dobles'], 'sweeper': ['escoba', 'escobas'], 'magnifier': ['lupa', 'lupas'], 'min of unlimited heart': ['min de corazones ilimitados', 'min de corazones ilimitados'] };
  const PZ_RE = /^(\d+) (coin|hint|magic wand|heart shield|double-points booster|sweeper|magnifier|min of unlimited heart)s?$/;
  function prize(s) {
    const parts = s.split(' and '), out = [];
    for (const p of parts) { const m = p.match(PZ_RE); if (!m) return null; out.push(m[1] + ' ' + PZ[m[2]][+m[1] === 1 ? 0 : 1]); }
    return out.length > 1 ? out.slice(0, -1).join(', ') + ' y ' + out[out.length - 1] : out[0];
  }
  const low = (s) => { const t = tr(s); return t.charAt(0).toLowerCase() + t.slice(1); };
  const pl = (n, one, many) => n + ' ' + (+n === 1 ? one : many);

  // phrases with numbers / names. $1 = as is, a function gets the match
  const P = [
    [/^Level (\d+)$/, 'Nivel $1'], [/^Top players today\. Resets every day at midnight \((GMT[+-]\d+)\)\.$/, 'Los mejores jugadores de hoy. Se reinicia cada día a la medianoche ($1).'], [/^(\d+) hits$/, '$1 golpes'], [/^Vinegar stole this world's sticker! Beat him on level (\d+) to win it back!$/, '¡Vinagre robó la calcomanía de este mundo! ¡Véncelo en el nivel $1 para recuperarla!'], [/^WORLD (\d+)$/, 'MUNDO $1'], [/^(\d+) NEW$/, (m) => m[1] + (+m[1] === 1 ? ' NUEVO' : ' NUEVOS')],
    [/^You are #(\d+) of (\d+) today with (\d+) pts$/, 'Eres el #$1 de $2 hoy con $3 pts'], [/^(\d+) pts to (.+)$/, (m) => 'Faltan ' + m[1] + ' pts para ' + tr(m[2])],
    [/^next board ×(\d+)$/, 'próximo tablero ×$1'], [/^🎂 Cake gift: (\d) bombs? on the board · points ×(\d)$/, (m) => '🎂 Regalo del pastel: ' + m[1] + (m[1] === '1' ? ' bomba' : ' bombas') + ' en el tablero · puntos ×' + m[2]],
    [/^🎂 Cake gift: (\d) bombs on the board \+ a heart shield · points ×(\d)$/, '🎂 Regalo del pastel: $1 bombas en el tablero + un escudo · puntos ×$2'], [/^❤️ \+1 heart · (\d+)$/, '❤️ +1 corazón · $1'], [/^Cake ×(\d)$/, 'Pastel ×$1'],
    [/^🎂 Cake gift: (\d) candy in place · points ×(\d)$/, '🎂 Regalo del pastel: $1 dulce colocado · puntos ×$2'], [/^🎂 Cake gift: (\d) candies in place · points ×(\d)$/, '🎂 Regalo del pastel: $1 dulces colocados · puntos ×$2'],
    [/^🎂 Cake gift: (\d) candies in place \+ a heart shield · points ×(\d)$/, '🎂 Regalo del pastel: $1 dulces colocados + un escudo · puntos ×$2'], [/^best day (\d+)$/, 'mejor día $1'], [/^(\d+) pts$/, '$1 pts'], [/^(\d+×\d+)$/, '$1'],
    [/^🔥 (\d+) day streak$/, '🔥 Racha de $1 días'], [/^(\d+)×(\d+) board$/, 'Tablero $1×$2'], [/^(\d+) candies to find$/, '$1 dulces por encontrar'],
    [/^♾️ Unlimited hearts for ([\d:]+)!$/, '♾️ ¡Corazones ilimitados por $1!'], [/^Row (\d+) column (\d+)$/, 'Fila $1 columna $2'],
    [/^You win 1 free hint for every (\d+) levels you pass \((\d+) more to go\), and in the Daily Bonus\.$/, 'Ganas 1 pista gratis por cada $1 niveles que pasas (faltan $2), y en el Bono diario.'],
    [/^You win a free wand every (\d+) levels you pass \((\d+) more to go\), in the Daily Bonus, or buy one with coins\.$/, 'Ganas una varita gratis cada $1 niveles que pasas (faltan $2), en el Bono diario, o cómprala con monedas.'],
    [/^Use 1 (.+)$/, (m) => 'Usar 1 ' + (DL[m[1].toLowerCase()] || m[1]).toLowerCase()], [/^Buy for (\d+)$/, 'Comprar por $1'], [/^Need (\d+)$/, 'Necesitas $1'],
    [/^🧹 Swept (\d+) squares?!$/, (m) => '🧹 ¡' + pl(m[1], 'casilla marcada', 'casillas marcadas') + '!'],
    [/^Your (.+) will be added to your bag\.$/, (m) => 'Se agregó a tu bolsa: ' + (prize(m[1]) || m[1]) + '.'], [/^You won (.+)!$/, (m) => '¡Ganaste ' + (prize(m[1]) || tr(m[1])) + '!'],
    [/^🔥 Day (\d+)$/, '🔥 Día $1'], [/^you have (\d+)$/, 'tienes $1'], [/^\+(\d+) pts$/, '+$1 pts'], [/^×(.+) in a row$/, (m) => '×' + m[1].replace('booster', 'potenciador') + ' seguidas'], [/^(\d+) today$/, '$1 hoy'],
    [/^(\d+×\d+)(?: (.+))? solved$/, (m) => m[1] + (m[2] ? ' ' + low(m[2]) : '') + ' resuelto'], [/^(\d+) hints?$/, (m) => pl(m[1], 'pista', 'pistas')],
    [/^for passing (\d+) levels$/, 'por pasar $1 niveles'], [/^wand in (\d+) more$/, 'varita en $1 más'], [/^(\d+) \/ (\d+) levels to a free hint$/, '$1 / $2 niveles para una pista gratis'],
    [/^👑 Vinegar defeated! Prizes: (.+)$/, (m) => '👑 ¡Vinagre derrotado! Premios: ' + (prize(m[1]) || m[1])],
    [/^Bonbox 🍬 (.+) (\d+×\d+) solved( with no hints)?$/, (m) => 'Bonbox 🍬 ' + tr(m[1]) + ' ' + m[2] + ' resuelto' + (m[3] ? ' sin pistas' : '')],
    [/^Tutorial (\d+) \/ (\d+)$/, 'Tutorial $1 / $2'], [/^Pass (\d+) levels to unlock the (.+) bear \(you are at (\d+)\)$/, (m) => 'Pasa ' + m[1] + ' niveles para desbloquear el oso ' + low(m[2]) + ' (vas en ' + m[3] + ')'],
    [/^Pass (\d+) levels to unlock (.+)$/, (m) => 'Pasa ' + m[1] + ' niveles para desbloquear a ' + tr(m[2])], [/^(\d+) \/ (\d+) stickers$/, '$1 / $2 calcomanías'],
    [/^(\d+) days$/, (m) => pl(m[1], 'día', 'días')], [/^(\d+) stickers$/, '$1 calcomanías'], [/^Extreme Champion (\d+)$/, 'Campeón extremo $1'], [/^Album prize ready! (\d+) stickers$/, '¡Premio del álbum listo! $1 calcomanías'], [/^Ready in (.+)$/, 'Listo en $1'],
    [/^(.+ chest) is ready!$/, (m) => '¡' + tr(m[1]) + ' listo!'], [/^(.+ chest) opens in (.+)$/, (m) => tr(m[1]) + ' se abre en ' + m[2]], [/^Full! It will be a (.+)\.$/, (m) => '¡Lleno! Será un ' + (DL[m[1].toLowerCase()] || m[1]).toLowerCase() + '.'],
    [/^Solve (\d+) more levels?$/, (m) => 'Resuelve ' + pl(m[1], 'nivel', 'niveles') + ' más'], [/^(.+ chest) so far \(keep your hearts for a bigger one\)$/, (m) => tr(m[1]) + ' por ahora (cuida tus corazones para uno más grande)'],
    [/^Spin \((\d+) bonus\)$/, 'Girar ($1 extra)'], [/^(\d+)\/(\d+) today$/, '$1/$2 hoy'], [/^ready in (.+)$/, 'listo en $1'], [/^🎟️ Candy Pass: step (\d+) \/ (\d+)$/, '🎟️ Pase dulce: paso $1 / $2'],
    [/^(\d+) videos left today$/, (m) => +m[1] === 1 ? 'Queda 1 video hoy' : 'Quedan ' + m[1] + ' videos hoy'], [/^No lives left\. Next life in ([\d:]+)$/, 'Sin vidas. Próxima vida en $1'], [/^Next life in ([\d:]+)$/, 'Próxima vida en $1'],
    [/^Lives left: (\d+) \/ (\d+)$/, 'Vidas restantes: $1 / $2'], [/^🧗 Candy Climb: platform (\d+) \/ (\d+)!$/, '🧗 Escalada dulce: ¡plataforma $1 / $2!'], [/^🧗 Candy Climb: down to platform (\d+)$/, '🧗 Escalada dulce: bajas a la plataforma $1'],
    [/^Play level (\d+)$/, 'Jugar nivel $1'], [/^Time! (\d+) \/ (\d+)$/, '¡Tiempo! $1 / $2'], [/^(\d+) \/ (\d+) in the jar$/, '$1 / $2 en el frasco'], [/^They got through! (\d+) popped$/, '¡Se escaparon! $1 reventados'],
    [/^(\d+) hoops$/, (m) => pl(m[1], 'aro', 'aros')], [/^(\d+) lines?$/, (m) => pl(m[1], 'línea', 'líneas')], [/^Board (\d+) \/ (\d+)$/, 'Tablero $1 / $2'], [/^Board (\d+) \/ (\d+) · ⏱ (\d+)$/, 'Tablero $1 / $2 · ⏱ $3'], [/^Drop (\d+) \/ (\d+)$/, 'Gota $1 / $2'],
    [/^CLAIM (\d+)$/, 'RECLAMAR $1'], [/^(\d+) \/ (\d+) steps$/, '$1 / $2 pasos'], [/^⚡ (\d+) min left$/, (m) => '⚡ ' + (+m[1] === 1 ? 'queda 1 min' : 'quedan ' + m[1] + ' min')], [/^(\d+) left$/, (m) => +m[1] === 1 ? 'queda 1' : 'quedan ' + m[1]],
    [/^Popped (\d+)$/, 'Reventados $1'], [/^left (\d+)$/, 'quedan $1'], [/^Balls (\d+)$/, 'Pelotas $1'], [/^hoops (\d+)$/, 'aros $1'], [/^lines (\d+)$/, 'líneas $1'], [/^Coins (\d+)$/, 'Monedas $1'], [/^(\d+) m to go$/, 'faltan $1 m'], [/^You finished #(\d+) of (\d+)$/, 'Terminaste #$1 de $2'], [/^(\d+) places to the prize zone$/, 'A $1 puestos de la zona de premios'], [/^The league ends in (.+)$/, 'La liga termina en $1'], [/^ends in (.+)$/, 'termina en $1'], [/^You climbed (\d+) places!$/, '¡Subiste $1 puestos!'], [/^You climbed (\d+) places! Only (\d+) pts behind (.+)$/, '¡Subiste $1 puestos! Solo a $2 pts de $3'], [/^You climbed 1 place! Only (\d+) pts behind (.+)$/, '¡Subiste 1 puesto! Solo a $1 pts de $2'], [/^Only (\d+) pts behind (.+)$/, 'Solo a $1 pts de $2'], [/^Solve today's (\d+)×(\d+) board before the time runs out\.$/, 'Resuelve el tablero $1×$2 de hoy antes de que se acabe el tiempo.'], [/^(\d+)×(\d+) · beat the clock, win a prize$/, '$1×$2 · gana al reloj y llévate un premio'], [/^⏱ Challenge prize: $/, '⏱ Premio del desafío: '],
    [/^Moves left: (\d+)$/, 'Movimientos: $1'], [/^Candies left (\d+)$/, 'Dulces restantes $1'], [/^in the jar (\d+)$/, 'en el frasco $1'], [/^Combo x(\d+)!$/, '¡Combo x$1!'], [/^Combo x$/, 'Combo x'],
    [/^Welcome to (.+)!$/, (m) => '¡Bienvenido a ' + tr(m[1]) + '!'],
    [/^These (\d+) colors must use these (\d+) (row|column)s, so cross out the other colors there\.$/, (m) => 'Estos ' + m[1] + ' colores deben usar estas ' + m[2] + (m[3] === 'row' ? ' filas' : ' columnas') + ', así que tacha ahí los demás colores.'],
    [/^These (\d+) (row|column)s only hold (\d+) colors, so those colors can't go anywhere else\.$/, (m) => 'En estas ' + m[1] + (m[2] === 'row' ? ' filas' : ' columnas') + ' solo caben ' + m[3] + ' colores, así que esos colores no pueden ir en ningún otro lugar.'],
    [/^(\d+)× (coin|hint|magic wand|heart shield|double-points booster|sweeper|magnifier|min of unlimited hearts?)s?$/, (m) => m[1] + '× ' + PZ[m[2].replace(/hearts$/, 'heart')][+m[1] === 1 ? 0 : 1]],
    [/^(coin|hint|magic wand|heart shield|double-points booster|sweeper|magnifier|min of unlimited hearts)s?$/, (m) => PZ[m[1].replace(/hearts$/, 'heart')][/s$/.test(m[0]) && m[1] !== 'min of unlimited hearts' ? 1 : 0]],
    [/^(.+\S) \+(\d+)$/, (m) => { const t = tr(m[1]); return t === m[1] ? null : t + ' +' + m[2]; }]
  ];

  const cache = new Map(), miss = new Set();
  root.__i18nMiss = miss;
  function core(c) {
    if (D[c] !== undefined) return D[c];
    for (let i = 0; i < P.length; i++) { const m = c.match(P[i][0]); if (m) { const r = typeof P[i][1] === 'function' ? P[i][1](m) : P[i][1].replace(/\$(\d)/g, (x, n) => m[+n]); if (r != null) return r; } }
    const pz = prize(c); if (pz) return pz;
    if (c.indexOf(' · ') > 0) { const parts = c.split(' · '), out = parts.map((p) => tr(p)); if (out.some((o, i) => o !== parts[i])) return out.join(' · '); }
    return null;
  }
  function tr(s) {
    if (typeof s !== 'string' || !/[A-Za-z]{2}/.test(s)) return s;
    const hit = cache.get(s); if (hit !== undefined) return hit;
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/); let c = m[2].replace(/\s+/g, ' '), r = core(c);
    if (r == null && /^· /.test(c)) { const x = core(c.slice(2)); if (x != null) r = '· ' + x; }
    if (r == null && / ·$/.test(c)) { const x = core(c.slice(0, -2)); if (x != null) r = x + ' ·'; }
    const out = r == null ? s : m[1] + r + m[3];
    if (r == null && /[A-Za-z]{3}/.test(c)) miss.add(c);
    if (cache.size > 4000) cache.clear(); cache.set(s, out); if (out !== s) cache.set(out, out);
    return out;
  }
  root.T = tr;

  // ---- everything that lands in the page is translated on the way in ----
  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'], SKIP = { SCRIPT: 1, STYLE: 1, INPUT: 1, TEXTAREA: 1 };
  const skip = (n) => { for (let p = n.nodeType === 1 ? n : n.parentNode; p && p.nodeType === 1; p = p.parentNode) { if (SKIP[p.tagName] || (p.dataset && p.dataset.noI18n !== undefined)) return true; } return false; };
  function textNode(n) { const v = n.nodeValue, t = tr(v); if (t !== v) n.nodeValue = t; }
  function attrs(el) { for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } } }
  function walk(n) {
    if (n.nodeType === 3) { if (!skip(n)) textNode(n); return; }
    if (n.nodeType !== 1 || SKIP[n.tagName] || skip(n)) return;
    attrs(n);
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: (x) => (x.nodeType === 1 && (SKIP[x.tagName] || (x.dataset && x.dataset.noI18n !== undefined)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let x; while ((x = w.nextNode())) { if (x.nodeType === 3) textNode(x); else attrs(x); }
  }
  const mo = new MutationObserver((list) => {
    for (const r of list) {
      if (r.type === 'characterData') { if (!skip(r.target)) textNode(r.target); }
      else if (r.type === 'attributes') { if (!skip(r.target)) attrs(r.target); }
      else r.addedNodes.forEach(walk);
    }
  });
  function start() { walk(document.body); mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS }); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})(window);
