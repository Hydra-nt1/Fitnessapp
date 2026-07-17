// ── Supabase Auth ─────────────────────────────────────────────

var _supabase = null;
try {
  _supabase = window.supabase.createClient(
    'https://lambfcrvsvejmrabjspo.supabase.co',
    ['sb_publishable_VlcBmspTvDs', 'I2Rh4OaR2RA_zbI2UA9E'].join('')
  );
} catch(e) {
  console.error('Supabase init failed:', e);
}
var _currentUser = null;
var _saveTimer = null;

var _authMode = 'login';

window.authShowTab = function(mode) {
  _authMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
  document.getElementById('auth-submit-btn').textContent = mode === 'login' ? 'Anmelden' : 'Registrieren';
  document.getElementById('auth-forgot-btn').style.display = mode === 'login' ? '' : 'none';
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
};

window.authSubmit = async function() {
  var email = (document.getElementById('auth-email').value || '').trim();
  var password = document.getElementById('auth-password').value || '';
  var errEl = document.getElementById('auth-error');
  var btn = document.getElementById('auth-submit-btn');
  if (!email || !password) { errEl.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
  btn.disabled = true;
  btn.textContent = '…';
  errEl.textContent = '';
  var result;
  if (_authMode === 'login') {
    result = await _supabase.auth.signInWithPassword({ email: email, password: password });
  } else {
    result = await _supabase.auth.signUp({ email: email, password: password });
  }
  if (result.error) {
    errEl.textContent = result.error.message;
    btn.disabled = false;
    btn.textContent = _authMode === 'login' ? 'Anmelden' : 'Registrieren';
    return;
  }
  if (_authMode === 'signup' && result.data && !result.data.session) {
    errEl.style.color = '#4ade80';
    errEl.textContent = 'Bestätigungsmail gesendet! Bitte E-Mail bestätigen.';
    btn.disabled = false;
    btn.textContent = 'Registrieren';
    return;
  }
  _currentUser = result.data.user;
  await onLogin();
};

window.authForgot = async function() {
  var email = (document.getElementById('auth-email').value || '').trim();
  if (!email) { document.getElementById('auth-error').textContent = 'Bitte E-Mail eingeben.'; return; }
  await _supabase.auth.resetPasswordForEmail(email);
  document.getElementById('auth-error').style.color = '#4ade80';
  document.getElementById('auth-error').textContent = 'Reset-Link wurde gesendet!';
};

function showAuthOverlay() {
  var ov = document.getElementById('auth-overlay');
  if (ov) { ov.style.display = 'flex'; }
}

function hideAuthOverlay() {
  var ov = document.getElementById('auth-overlay');
  if (ov) { ov.style.display = 'none'; }
}

async function onLogin() {
  hideAuthOverlay();
  await openDB();
  await cloudLoad();
  await seedDefaultPlans();
  await loadCustomExercisesIntoLibrary();
  setupNav();
  updateThemeToggle();
  go('heute');
  startAutoSave();
}

window.authLogout = async function() {
  await cloudSave();
  await _supabase.auth.signOut();
  _currentUser = null;
  if (_saveTimer) clearInterval(_saveTimer);
  location.reload();
};

// ── Theme & Accent ────────────────────────────────────────────

(function() {
  var t = localStorage.getItem('fittracker_theme') || 'dark';
  if (t !== 'dark') document.documentElement.setAttribute('data-theme', t);
  var a = localStorage.getItem('fittracker_accent');
  if (a) document.documentElement.style.setProperty('--accent', a);
})();

var ACCENT_COLORS = [
  { id: 'blue',   hex: '#4f7ef8', label: 'Blau' },
  { id: 'purple', hex: '#8b5cf6', label: 'Lila' },
  { id: 'green',  hex: '#22c55e', label: 'Grün' },
  { id: 'teal',   hex: '#14b8a6', label: 'Türkis' },
  { id: 'orange', hex: '#f97316', label: 'Orange' },
  { id: 'pink',   hex: '#ec4899', label: 'Pink' },
  { id: 'red',    hex: '#ef4444', label: 'Rot' },
  { id: 'yellow', hex: '#eab308', label: 'Gelb' },
];

function applyAccent(hex) {
  localStorage.setItem('fittracker_accent', hex);
  document.documentElement.style.setProperty('--accent', hex);
  renderProfile(document.getElementById('content-inner'));
}

function applyTheme(t) {
  localStorage.setItem('fittracker_theme', t);
  if (t === 'dark') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  updateThemeToggle();
}

function updateThemeToggle() {
  var t = localStorage.getItem('fittracker_theme') || 'dark';
  var moon = document.getElementById('theme-icon-moon');
  var sun = document.getElementById('theme-icon-sun');
  var label = document.getElementById('theme-toggle-label');
  if (!moon) return;
  if (t === 'light') {
    moon.style.display = 'none'; sun.style.display = '';
    if (label) label.textContent = 'Dark Mode';
  } else {
    moon.style.display = ''; sun.style.display = 'none';
    if (label) label.textContent = 'Light Mode';
  }
}

// ── Exercise Library ──────────────────────────────────────────

const EXERCISE_LIBRARY = {
  'Brust': [
    // Langhantel Bankdrücken
    'Langhantel Bankdrücken (Flachbank)',
    'Langhantel Bankdrücken (Schrägbank oben)',
    'Langhantel Bankdrücken (Schrägbank unten)',
    'Langhantel Bankdrücken (enger Griff)',
    'Langhantel Bankdrücken (weiter Griff)',
    // Kurzhantel Bankdrücken
    'Kurzhantel Bankdrücken (Flach)',
    'Kurzhantel Bankdrücken (Schrägbank oben)',
    'Kurzhantel Bankdrücken (Schrägbank unten)',
    'Kurzhantel Bankdrücken (einarmig)',
    'Kurzhantel Bankdrücken (neutral grip)',
    // Kurzhantel Fliegende
    'Kurzhantel Fliegende (Flach)',
    'Kurzhantel Fliegende (Schrägbank oben)',
    'Kurzhantel Fliegende (Schrägbank unten)',
    // Chest Press Maschine
    'Chest Press (Maschine, flach)',
    'Chest Press (Maschine, Schrägbank oben)',
    'Chest Press (Maschine, Schrägbank unten)',
    // Chest Press Kabel
    'Chest Press (Kabel, flach)',
    'Chest Press (Kabel, Schrägbank oben)',
    'Chest Press (Kabel, Schrägbank unten)',
    // Kabel Flyes
    'Kabel Flyes (oben nach unten, untere Brust)',
    'Kabel Flyes (unten nach oben, obere Brust)',
    'Kabel Flyes (mittig, innere Brust)',
    'Kabelcrossover (oben nach unten)',
    'Kabelcrossover (unten nach oben)',
    'Kabelcrossover (mittig)',
    'Kabel Fliegende (Flach)',
    'Kabel Fliegende (Schrägbank oben)',
    'Kabel Fliegende (Schrägbank unten)',
    'Kabel Fliegende (einarmig, flach)',
    'Kabel Fliegende (einarmig, oben nach unten)',
    'Kabel Fliegende (einarmig, unten nach oben)',
    // Pec Deck / Schmetterlingsmaschine
    'Pec Deck (flach)',
    'Pec Deck (Schrägbank)',
    'Schmetterlingsmaschine',
    // Smith Machine
    'Smith Machine Bankdrücken (flach)',
    'Smith Machine Bankdrücken (Schrägbank oben)',
    'Smith Machine Bankdrücken (Schrägbank unten)',
    // Körpergewicht
    'Dips (Brust, vorwärts geneigt)',
    'Push-Ups',
    'Push-Ups (Schrägbank oben)',
    'Push-Ups (Schrägbank unten)',
    'Enge Push-Ups',
    'Wide Push-Ups',
    'Diamant Push-Ups',
    'Archer Push-Ups',
    'Pike Push-Ups',
    // Sonstige
    'Landmine Press',
    'Svend Press',
    'Guillotine Press',
  ],
  'Rücken': [
    // Klimmzüge
    'Klimmzüge (weiter Griff)',
    'Klimmzüge (enger Griff)',
    'Klimmzüge (neutraler Griff)',
    'Klimmzüge (Untergriff / Chin-Ups)',
    'Klimmzüge (Parallel-Griff)',
    'Klimmzüge (Gewicht)',
    'Negativklimmzüge',
    'Assistierte Klimmzüge (Maschine)',
    'Assistierte Klimmzüge (Band)',
    // Latzug
    'Latzug (weiter Griff)',
    'Latzug (enger Griff)',
    'Latzug (neutraler Griff)',
    'Latzug (Untergriff)',
    'Latzug (einarmig)',
    'Latzug (V-Griff)',
    // Langhantel Rudern
    'Langhantel Rudern (Übergriff)',
    'Langhantel Rudern (Untergriff)',
    'Langhantel Rudern (breit)',
    'Langhantel Rudern (eng)',
    'Pendlay Row',
    // Kurzhantel Rudern
    'Kurzhantel Rudern (einarmig)',
    'Kurzhantel Rudern (beidhändig)',
    'Kurzhantel Rudern (einarmig, Schrägbank)',
    // Kabel Rudern
    'Kabel Rudern (eng)',
    'Kabel Rudern (weit)',
    'Kabel Rudern (einarmig)',
    'Kabel Rudern (V-Griff)',
    'Kabel Rudern (Untergriff)',
    // Maschine Rudern
    'Rudern an Maschine (eng)',
    'Rudern an Maschine (weit)',
    'T-Bar Rudern',
    'T-Bar Rudern (Brust gestützt)',
    'Rudern (Hammer Strength)',
    // Kreuzheben & Extensions
    'Kreuzheben (konventionell)',
    'Kreuzheben (Sumo)',
    'Kreuzheben (Trap Bar)',
    'Rack Pull',
    'Rack Pull (hoch)',
    'Rumänisches Kreuzheben',
    'Hyperextension',
    'Hyperextension (Gewicht)',
    'Reverse Hyperextension',
    'Good Mornings',
    // Isolationsübungen
    'Straight-Arm Pulldown (Kabel)',
    'Straight-Arm Pulldown (Band)',
    'Pullover (Kurzhantel)',
    'Pullover (Kabel)',
    'Pullover (Maschine)',
    'Face Pulls',
    'Shrugs mit Langhantel',
    'Shrugs mit Kurzhanteln',
    'Shrugs (Maschine)',
    'Shrugs (Kabel)',
    'Scapula Pull-Ups',
    'Scapula Rows',
    // Kabel Isolationen
    'Kabel Pullover (stehend)',
    'Kabel Pullover (kniend)',
    'High-to-Low Kabelzug',
    'Low-to-High Kabelzug',
    'Kabel Reverse Fly',
    'Kabel Rudern (hoch, Übergriff)',
    // Inverted Rows
    'Inverted Row (Stange)',
    'Inverted Row (Ringe)',
    'Inverted Row (schräg)',
    'TRX Row',
    // Maschinen
    'Latzug (Maschine)',
    'Rudern (Plate Loaded Maschine)',
    'Rudern (Selectorized Maschine)',
    'Low Row Maschine',
    'High Row Maschine',
    // Spezifische Ruder-Varianten
    'Meadows Row',
    'Kroc Row',
    'Chest-Supported Row (Langhantel)',
    'Chest-Supported Row (Kurzhantel)',
    'Seal Row',
    'Yates Row',
    // Unterer Rücken
    'Kreuzheben (Pause)',
    'Kreuzheben (Rumänisch, einbeinig)',
    'Morgengymnastik (Good Mornings, sitzend)',
    'Back Extension (45°)',
    'Back Extension (90°)',
    'Superman',
    'Superman Hold',
    'Bird Dog',
    // Oberer Rücken & Trapez
    'Face Pulls (Band)',
    'Band Pull-Apart',
    'Rear Delt Row (Kabel)',
    'Rear Delt Row (Kurzhantel)',
    'Neck Pull (Lat Pulldown hinter Kopf)',
    'High Pull (Langhantel)',
    'Snatch Grip Deadlift',
    'Trap Bar Shrugs',
  ],
  'Schultern': [
    // Schulterdrücken Langhantel
    'Schulterdrücken (Langhantel, vor Kopf)',
    'Schulterdrücken (Langhantel, hinter Kopf)',
    'Military Press',
    'Push Press',
    // Schulterdrücken Kurzhantel
    'Schulterdrücken (Kurzhanteln, sitzend)',
    'Schulterdrücken (Kurzhanteln, stehend)',
    'Arnold Press',
    'Arnold Press (einarmig)',
    // Schulterdrücken Maschine / Kabel
    'Schulterdrücken (Maschine)',
    'Schulterdrücken (Smith Machine)',
    'Schulterdrücken (Kabel)',
    'Schulterdrücken (Kabel, einarmig)',
    // Sonstige Drückvarianten
    'Landmine Schulterdrücken',
    'Bradford Press',
    'Cuban Press',
    'Z-Press',
    // Seitheben
    'Seitheben (Kurzhanteln)',
    'Seitheben (Kabel)',
    'Seitheben (Maschine)',
    'Seitheben (einarmig, Kabel)',
    'Seitheben (einarmig, Kurzhantel)',
    'Seitheben (liegend, Kabel)',
    'Seitheben (Kabel, hinter dem Rücken)',
    // Frontheben
    'Frontheben (Langhantel)',
    'Frontheben (Kurzhanteln)',
    'Frontheben (Kabel)',
    'Frontheben (Scheibe)',
    'Frontheben (einarmig, Kabel)',
    // Upright Row
    'Upright Rows (Langhantel)',
    'Upright Rows (Kurzhanteln)',
    'Upright Rows (Kabel)',
    'Upright Rows (Smith Machine)',
    // Hintere Schulter
    'Reverse Fliegende (Kurzhanteln)',
    'Reverse Fliegende (Kabel)',
    'Reverse Fliegende (Kabel, einarmig)',
    'Reverse Fliegende (Maschine)',
    'Reverse Pec Deck',
    'Face Pulls (Kabel)',
    'Face Pulls (Band)',
    'Band Pull-Aparts',
    // Rotatorenmanschette
    'Außenrotation (Kabel)',
    'Innenrotation (Kabel)',
    'Außenrotation (Kurzhantel, liegend)',
    'Außenrotation (Band)',
    'YTW Raises',
  ],
  'Bizeps': [
    // Langhantel / EZ
    'Bizepscurls (Langhantel)',
    'Bizepscurls (EZ-Stange)',
    'Bizepscurls (EZ-Stange, enger Griff)',
    'Bizepscurls (EZ-Stange, weiter Griff)',
    'Reverse Curls (Langhantel)',
    'Reverse Curls (EZ-Stange)',
    // Kurzhanteln
    'Bizepscurls (Kurzhanteln, alternierend)',
    'Bizepscurls (Kurzhanteln, gleichzeitig)',
    'Hammercurls (Kurzhanteln)',
    'Hammercurls (Kurzhanteln, alternierend)',
    'Konzentrationscurls',
    'Bizepscurls (Schrägbank, Kurzhantel)',
    'Zottman Curls',
    'Cross-Body Hammercurls',
    'Pinwheel Curls',
    // Kabel
    'Kabelcurls (tief)',
    'Kabelcurls (hoch)',
    'Kabelcurls (einarmig)',
    'Kabelcurls (beidhändig)',
    'Hammercurls (Kabel)',
    'Reverse Curls (Kabel)',
    'Overhead Bizepscurls (Kabel)',
    // Maschine / Bank
    'Preacher Curls (Langhantel)',
    'Preacher Curls (EZ-Stange)',
    'Preacher Curls (Kurzhanteln)',
    'Preacher Curls (Maschine)',
    'Preacher Curls (Kabel)',
    'Spidercurls',
    'Bizepscurls (Maschine)',
    '21s (Bizeps)',
  ],
  'Trizeps': [
    // Kabel Pushdown
    'Trizeps Pushdown (Seil)',
    'Trizeps Pushdown (Stange)',
    'Trizeps Pushdown (einarmig)',
    'Trizeps Pushdown (Untergriff)',
    'Trizeps Pushdown (V-Griff)',
    // Overhead Extension Kabel
    'Overhead Trizepsextension (Kabel, Seil)',
    'Overhead Trizepsextension (Kabel, einarmig)',
    // Overhead Extension Kurzhantel
    'Overhead Trizepsextension (Kurzhantel, beidhändig)',
    'Overhead Trizepsextension (Kurzhantel, einarmig)',
    // Overhead Extension Langhantel / EZ
    'Overhead Trizepsextension (Langhantel)',
    'Overhead Trizepsextension (EZ-Stange)',
    // Skull Crusher
    'Skull Crusher (Langhantel)',
    'Skull Crusher (EZ-Stange)',
    'Skull Crusher (Kurzhanteln)',
    'Skull Crusher (Schrägbank)',
    'Skull Crusher (Kabel)',
    // Drücken
    'Close-Grip Bankdrücken',
    'Close-Grip Bankdrücken (Smith Machine)',
    'JM Press',
    // Kickbacks
    'Kickbacks (Kurzhantel)',
    'Kickbacks (Kabel)',
    'Kickbacks (einarmig, Kabel)',
    // Körpergewicht
    'Trizeps Dips (Bank)',
    'Trizeps Dips (Parallelbarren)',
    'Diamond Push-Ups',
    'Trizeps Strecken (Boden)',
    // Maschine
    'Trizepsdrücken (Maschine)',
    // Sonstige
    'Tate Press',
    'Board Press',
  ],
  'Unterarme': [
    'Handgelenkcurls (Langhantel)',
    'Handgelenkcurls (Kurzhanteln)',
    'Reverse Handgelenkcurls (Langhantel)',
    'Reverse Handgelenkcurls (Kurzhanteln)',
    'Handgelenkcurls (Kabel)',
    'Reverse Handgelenkcurls (Kabel)',
    'Farmer Carries (Griffkraft)',
    'Plate Pinches',
    'Towel Pull-Ups',
    'Dead Hangs',
    'Fingerübungen (Fingerboard)',
    'Unterarmrollen (Wrist Roller)',
    'Reverse Curls (Langhantel)',
    'Reverse Curls (EZ-Stange)',
    'Zottman Curls',
    'Hammer Curls (Unterarm-Fokus)',
  ],
  'Beine — Quadrizeps': [
    // Kniebeugen
    'Kniebeugen (Freie Langhantel)',
    'Kniebeugen (Langhantel, high bar)',
    'Kniebeugen (Langhantel, low bar)',
    'Frontkniebeugen (Langhantel)',
    'Frontkniebeugen (Kurzhanteln)',
    'Kniebeugen (Goblet, Kurzhantel)',
    'Kniebeugen (Goblet, Kettlebell)',
    'Kniebeugen (Smith Machine)',
    'Kniebeugen (Bodyweight)',
    'Kniebeugen (Pause)',
    'Hack Squat (Maschine)',
    'Hack Squat (Langhantel)',
    'Zercher Squat',
    'Box Squat',
    'Safety Bar Squat',
    // Presse
    'Beinpresse',
    'Beinpresse (einbeinig)',
    'Beinpresse (eng)',
    'Beinpresse (weit)',
    'Beinpresse (hoch)',
    'Beinpresse (tief)',
    // Isolationsübungen
    'Beinstrecker (Maschine)',
    'Beinstrecker (einbeinig)',
    'Kabelzug Kniestrecker',
    // Ausfallschritte
    'Ausfallschritte (Langhantel)',
    'Ausfallschritte (Kurzhanteln)',
    'Ausfallschritte (Kabel)',
    'Ausfallschritte (Reverse, Langhantel)',
    'Ausfallschritte (Reverse, Kurzhanteln)',
    'Ausfallschritte (Walking, Langhantel)',
    'Ausfallschritte (Walking, Kurzhanteln)',
    'Ausfallschritte (seitlich)',
    'Bulgarian Split Squats (Langhantel)',
    'Bulgarian Split Squats (Kurzhanteln)',
    'Bulgarian Split Squats (Kabel)',
    'Step-Ups (Langhantel)',
    'Step-Ups (Kurzhanteln)',
    'Step-Ups (einarmig, Kurzhantel)',
    'Sissy Squats',
    'Wand-Sitzen (Wall Sit)',
    'Pistol Squats',
    'Kabel Squats',
  ],
  'Beine — Hamstrings & Gesäß': [
    // Kreuzheben / RDL
    'Rumänisches Kreuzheben (Langhantel)',
    'Rumänisches Kreuzheben (Kurzhanteln)',
    'Einbeiniges Rumänisches Kreuzheben (Langhantel)',
    'Einbeiniges Rumänisches Kreuzheben (Kurzhantel)',
    'Sumo Kreuzheben',
    'Sumo Kreuzheben (Kurzhanteln)',
    // Beinbeuger
    'Beinbeuger liegend (Maschine)',
    'Beinbeuger liegend (einbeinig)',
    'Beinbeuger sitzend (Maschine)',
    'Beinbeuger sitzend (einbeinig)',
    'Beinbeuger stehend (Maschine, einbeinig)',
    'Nordic Hamstring Curls',
    'Glute Ham Raise',
    'Kabelzug Beinbeuger',
    // Hip Thrust / Glute Bridge
    'Hip Thrust (Langhantel)',
    'Hip Thrust (Maschine)',
    'Hip Thrust (einbeinig)',
    'Hip Thrust (Kabel)',
    'Glute Bridge (Langhantel)',
    'Glute Bridge (Körpergewicht)',
    'Glute Bridge (einbeinig)',
    'Frog Pumps',
    // Abduktion / Adduktion
    'Hip Abduktion (Maschine)',
    'Hip Adduktion (Maschine)',
    'Hip Abduktion (Kabel, stehend)',
    'Hip Adduktion (Kabel, stehend)',
    'Hip Abduktion (liegend, Körpergewicht)',
    'Clamshells (Band)',
    // Gesäß Isolation
    'Donkey Kicks',
    'Donkey Kicks (Kabel)',
    'Cable Hip Extension',
    'Cable Kickbacks (Gesäß)',
    'Reverse Hyperextension',
    'Good Mornings',
    'Good Mornings (Kurzhanteln)',
    'Pull-Throughs (Kabel)',
  ],
  'Waden': [
    'Wadenheben stehend (Maschine)',
    'Wadenheben sitzend (Maschine)',
    'Wadenheben (Langhantel)',
    'Wadenheben (Kurzhanteln)',
    'Wadenheben (einbeinig, Körpergewicht)',
    'Wadenheben (einbeinig, Kurzhantel)',
    'Wadenheben (Smith Machine)',
    'Donkey Calf Raises',
    'Tibialis Raises',
    'Wadenheben an Beinpresse',
    'Wadenheben (Kabel)',
    'Wadenheben (explosiv)',
    'Sprungkraft-Wadenheben',
  ],
  'Bauch & Core': [
    // Crunches
    'Crunches',
    'Crunches (Kabel)',
    'Crunches (Maschine)',
    'Crunches (schräg)',
    'Reverse Crunches',
    'Decline Crunches',
    'Decline Crunches (mit Gewicht)',
    'Bicycle Crunches',
    'Crossbody Crunches',
    'Long Arm Crunches',
    // Sit-Ups
    'Sit-Ups',
    'Decline Sit-Ups',
    'Sit-Ups (mit Gewicht)',
    'V-Sit-Ups',
    'Weighted Sit-Ups (Kabel)',
    // Beine heben
    'Leg Raises (liegend)',
    'Leg Raises (hängend)',
    'Leg Raises (hängend, gerade)',
    'Leg Raises (hängend, schräg)',
    'Knee Raises (hängend)',
    'Knee Raises (hängend, schräg)',
    'Hanging Knee Raises (einarmig)',
    'Toes to Bar',
    'Toes to Bar (schräg)',
    'L-Sit Hold',
    'L-Sit (Barren)',
    'L-Sit (Boden)',
    'Windshield Wipers',
    'Windshield Wipers (liegend)',
    'Scissor Kicks',
    'Flutter Kicks',
    'Heel Touches',
    'Toe Touches',
    'V-Ups',
    'Jackknives',
    // Plank
    'Plank',
    'Plank (Unterarmstütz)',
    'Plank (erhöhte Füße)',
    'Plank Shoulder Taps',
    'Plank Hip Dips',
    'Plank Up-Downs',
    'Plank (einarmig)',
    'Plank (einbeinig)',
    'Rocking Plank',
    'Body Saw Plank',
    'Seitstütz (Side Plank)',
    'Seitstütz (mit Abduktion)',
    'Seitstütz (mit Rotation)',
    'Seitstütz (erhöht)',
    'Copenhagen Plank',
    'Hollow Body Hold',
    'Hollow Body Rocks',
    'Arch Body Hold',
    // Rotation & Lateral
    'Russian Twists',
    'Russian Twists (mit Gewicht)',
    'Russian Twists (Kabel)',
    'Woodchoppers (Kabel, oben nach unten)',
    'Woodchoppers (Kabel, unten nach oben)',
    'Woodchoppers (Kurzhantel)',
    'Pallof Press',
    'Pallof Press (Rotation)',
    'Pallof Press (stehend)',
    'Oblique Crunches',
    'Oblique Crunches (Kabel)',
    'Side Bends (Kurzhantel)',
    'Side Bends (Kabel)',
    'Suitcase Deadlift',
    // Rollout & Fortgeschritten
    'Ab Roller',
    'Ab Roller (kniend)',
    'Ab Roller (stehend)',
    'Dragon Flag',
    'Dragon Flag (negativ)',
    'Dead Bug',
    'Dead Bug (mit Gewicht)',
    'Dead Bug (Kabel)',
    'Stir the Pot',
    'Pike (TRX)',
    'Pike Rollout (Gymnastikball)',
    'Jackknife (Gymnastikball)',
    'Crunch (Gymnastikball)',
    // Kabelzug Bauch
    'Kabel Crunch (kniend)',
    'Kabel Crunch (stehend)',
    'Kabel Reverse Crunch',
    'Kabel Crunch (seitlich)',
    'Kabel Woodchopper (diagonal)',
    // Dynamisch
    'Mountain Climbers',
    'Mountain Climbers (langsam)',
    'Mountain Climbers (gekreuzt)',
    'Bear Crawl',
    'Inchworm',
    'Sit-Up to Press',
    'Ab Wheel Rollout (stehend)',
  ],
  'Ganzkörper & Compound': [
    'Kreuzheben (konventionell)',
    'Power Clean',
    'Hang Clean',
    'Power Snatch',
    'Hang Snatch',
    'Clean and Jerk',
    'Thrusters (Langhantel)',
    'Thrusters (Kurzhanteln)',
    'Thrusters (Kettlebell)',
    'Farmers Walk',
    'Suitcase Carry',
    'Overhead Carry',
    'Tire Flips',
    'Battle Ropes',
    'Battle Ropes (alternierend)',
    'Battle Ropes (gleichzeitig)',
    'Kettlebell Swing (einarmig)',
    'Kettlebell Swing (beidhändig)',
    'Kettlebell Clean & Press',
    'Kettlebell Snatch',
    'Kettlebell Goblet Squat',
    'Turkish Get-Up',
    'Burpees',
    'Burpee Box Jumps',
    'Burpee Pull-Ups',
    'Man Maker',
    'Sandbag Carry',
    'Sled Push',
    'Sled Pull',
    'Bear Complex',
  ],
  'Cardio & Kondition': [
    'Laufen (Laufband)',
    'Laufen (Outdoor)',
    'Laufen (Intervall)',
    'Radfahren (Ergometer)',
    'Radfahren (Outdoor)',
    'Rudern (Rudergerät)',
    'Seilspringen',
    'Seilspringen (Double-Under)',
    'Seilspringen (Triple-Under)',
    'Stepper',
    'Ellipsentrainer',
    'Assault Bike',
    'Assault Bike (Intervall)',
    'Skierg',
    'Schwimmen',
    'Box Jumps',
    'Box Step-Ups (Cardio)',
    'Depth Jumps',
    'Jumping Jacks',
    'High Knees',
    'Butt Kicks',
    'Sprints',
    'Intervallläufe',
    'Treppenläufe',
  ],
  'Dehnen & Mobility': [
    'Brustdehnung (Türrahmen)',
    'Brustdehnung (Arm über Brust)',
    'Brustdehnung (Kabel)',
    'Lat-Dehnung',
    'Lat-Dehnung (Kniebeuge)',
    'Hüftbeuger Dehnung',
    'Hüftbeuger Dehnung (kniend)',
    'Pigeon Pose',
    'Thorakale Mobilisation',
    'Schulteröffnung (Band)',
    'Schulteröffnung (Stab)',
    'Hip 90/90 Stretch',
    'Couch Stretch',
    'Foam Rolling (Rücken)',
    'Foam Rolling (Beine)',
    'Foam Rolling (Waden)',
    'Foam Rolling (Schultern)',
    'Foam Rolling (Hüfte)',
    'Waden-Dehnung (Wand)',
    'Hamstring-Dehnung (liegend)',
    'Hamstring-Dehnung (stehend)',
    'Quadrizeps-Dehnung',
    'Trizeps-Dehnung',
    'Nacken-Dehnung (seitlich)',
    "World's Greatest Stretch",
    'Scorpion Stretch',
    'Inchworm Stretch',
    'Katzenkuh (Cat-Cow)',
    'Thread the Needle',
    'Kindspose (Child Pose)',
  ],
};

const MUSCLE_GROUPS = ['Brust','Rücken','Schultern','Bizeps','Trizeps','Arme','Beine','Bauch','Core','Ganzkörper','Cardio'];

// Best 5–6 exercises per muscle group, auto-loaded when a plan is empty
const RECOMMENDED_EXERCISES = {
  'Brust': [
    { name: 'Bankdrücken (Flachbank)',         sets: 4, reps: 8,  weight: 60 },
    { name: 'Bankdrücken (Schrägbank oben)',   sets: 3, reps: 10, weight: 50 },
    { name: 'Kurzhantel Fliegende (Flach)',    sets: 3, reps: 12, weight: 14 },
    { name: 'Kabelcrossover (oben)',           sets: 3, reps: 12, weight: 15 },
    { name: 'Dips (Brust)',                    sets: 3, reps: 12, weight: 0  },
    { name: 'Pec Deck / Schmetterlingsmaschine', sets: 3, reps: 15, weight: 40 },
  ],
  'Rücken': [
    { name: 'Klimmzüge (weiter Griff)',        sets: 4, reps: 8,  weight: 0  },
    { name: 'Rudern mit Stange (Übergriff)',   sets: 4, reps: 8,  weight: 60 },
    { name: 'Latzug (weiter Griff)',           sets: 3, reps: 10, weight: 55 },
    { name: 'Rudern mit Kurzhantel (einarmig)',sets: 3, reps: 10, weight: 24 },
    { name: 'Face Pulls',                      sets: 3, reps: 15, weight: 20 },
    { name: 'Kreuzheben (konventionell)',       sets: 3, reps: 6,  weight: 80 },
  ],
  'Schultern': [
    { name: 'Schulterdrücken mit Kurzhanteln (sitzend)', sets: 4, reps: 10, weight: 20 },
    { name: 'Seitheben (Kurzhanteln)',         sets: 3, reps: 15, weight: 8  },
    { name: 'Frontheben (Kurzhanteln)',        sets: 3, reps: 12, weight: 8  },
    { name: 'Face Pulls (Kabel)',              sets: 3, reps: 15, weight: 20 },
    { name: 'Reverse Fliegende (Kurzhantel)',  sets: 3, reps: 15, weight: 8  },
    { name: 'Upright Rows (Stange)',           sets: 3, reps: 12, weight: 30 },
  ],
  'Bizeps': [
    { name: 'Bizepscurls (Stange)',            sets: 4, reps: 10, weight: 30 },
    { name: 'Hammercurls',                     sets: 3, reps: 12, weight: 14 },
    { name: 'Preacher Curls (Stange)',         sets: 3, reps: 10, weight: 25 },
    { name: 'Konzentrationscurls',             sets: 3, reps: 12, weight: 12 },
    { name: 'Kabelcurls (tief)',               sets: 3, reps: 12, weight: 20 },
    { name: 'Incline Dumbbell Curls',          sets: 3, reps: 12, weight: 10 },
  ],
  'Trizeps': [
    { name: 'Trizepsdrücken am Kabel (Seil)', sets: 4, reps: 12, weight: 25 },
    { name: 'Skull Crusher (EZ-Stange)',       sets: 3, reps: 10, weight: 20 },
    { name: 'Trizeps Dips (Bank)',             sets: 3, reps: 12, weight: 0  },
    { name: 'Overhead Trizepsdrücken (KH, einarmig)', sets: 3, reps: 12, weight: 14 },
    { name: 'Close-Grip Bankdrücken',          sets: 3, reps: 10, weight: 50 },
  ],
  'Arme': [
    { name: 'Bizepscurls (Stange)',            sets: 3, reps: 10, weight: 30 },
    { name: 'Hammercurls',                     sets: 3, reps: 12, weight: 14 },
    { name: 'Preacher Curls (Stange)',         sets: 3, reps: 10, weight: 25 },
    { name: 'Trizepsdrücken am Kabel (Seil)', sets: 3, reps: 12, weight: 25 },
    { name: 'Skull Crusher (EZ-Stange)',       sets: 3, reps: 10, weight: 20 },
    { name: 'Overhead Trizepsdrücken (KH, einarmig)', sets: 3, reps: 12, weight: 14 },
  ],
  'Beine': [
    { name: 'Kniebeugen (Freie Stange)',       sets: 4, reps: 8,  weight: 80 },
    { name: 'Beinpresse',                      sets: 4, reps: 10, weight: 120},
    { name: 'Rumänisches Kreuzheben (Stange)', sets: 3, reps: 10, weight: 60 },
    { name: 'Beinbeuger liegend (Maschine)',   sets: 3, reps: 12, weight: 40 },
    { name: 'Beinstrecker (Maschine)',         sets: 3, reps: 12, weight: 50 },
    { name: 'Wadenheben stehend (Maschine)',   sets: 4, reps: 15, weight: 60 },
  ],
  'Core': [
    { name: 'Plank',                           sets: 3, reps: 60, weight: 0  },
    { name: 'Hanging Leg Raises',              sets: 3, reps: 12, weight: 0  },
    { name: 'Ab Roller',                       sets: 3, reps: 10, weight: 0  },
    { name: 'Russian Twists',                  sets: 3, reps: 20, weight: 10 },
    { name: 'Kabel Crunches',                  sets: 3, reps: 15, weight: 25 },
    { name: 'Dead Bug',                        sets: 3, reps: 10, weight: 0  },
  ],
  'Ganzkörper': [
    { name: 'Kniebeugen (Freie Stange)',       sets: 3, reps: 8,  weight: 60 },
    { name: 'Kreuzheben (konventionell)',       sets: 3, reps: 6,  weight: 80 },
    { name: 'Bankdrücken (Flachbank)',         sets: 3, reps: 8,  weight: 60 },
    { name: 'Klimmzüge (weiter Griff)',        sets: 3, reps: 8,  weight: 0  },
    { name: 'Schulterdrücken mit Kurzhanteln (sitzend)', sets: 3, reps: 10, weight: 18 },
    { name: 'Plank',                           sets: 3, reps: 60, weight: 0  },
  ],
  'Cardio': [
    { name: 'Laufen (Laufband)',               sets: 1, reps: 30, weight: 0  },
    { name: 'Rudern (Rudergerät)',             sets: 1, reps: 15, weight: 0  },
    { name: 'Seilspringen',                    sets: 3, reps: 60, weight: 0  },
    { name: 'Assault Bike',                    sets: 1, reps: 20, weight: 0  },
    { name: 'Box Jumps',                       sets: 3, reps: 10, weight: 0  },
  ],
};

const EXERCISE_MUSCLE = {};
for (const [group, exList] of Object.entries(EXERCISE_LIBRARY)) {
  for (const ex of exList) EXERCISE_MUSCLE[ex] = group;
}

// ── Exercise info: target area & muscle map ───────────────────
// primary/secondary map to body regions: chest, abs, front_shoulder, rear_shoulder,
// biceps, triceps, forearms, upper_back, lats, lower_back, glutes, quads, hamstrings, calves

const EXERCISE_INFO = {
  // Brust
  'Bankdrücken (Flachbank)':              { area: 'Mittlere Brust',                        primary:['chest'],                      secondary:['front_shoulder','triceps'] },
  'Bankdrücken (Schrägbank oben)':        { area: 'Obere Brust & vordere Schulter',        primary:['chest','front_shoulder'],      secondary:['triceps'] },
  'Bankdrücken (Schrägbank unten)':       { area: 'Untere Brust',                          primary:['chest'],                      secondary:['front_shoulder','triceps'] },
  'Kurzhantel Bankdrücken (Flach)':       { area: 'Mittlere Brust',                        primary:['chest'],                      secondary:['front_shoulder','triceps'] },
  'Kurzhantel Bankdrücken (Schrägbank)':  { area: 'Obere Brust',                           primary:['chest','front_shoulder'],     secondary:['triceps'] },
  'Kurzhantel Fliegende (Flach)':         { area: 'Innere & mittlere Brust',               primary:['chest'],                      secondary:['front_shoulder'] },
  'Kurzhantel Fliegende (Schrägbank)':    { area: 'Innere & obere Brust',                  primary:['chest','front_shoulder'],     secondary:[] },
  'Kabelcrossover (oben)':                { area: 'Untere & innere Brust',                 primary:['chest'],                      secondary:['front_shoulder'] },
  'Kabelcrossover (unten)':               { area: 'Obere & innere Brust',                  primary:['chest'],                      secondary:['front_shoulder'] },
  'Kabel Fliegende (Flach)':              { area: 'Innere Brust',                          primary:['chest'],                      secondary:[] },
  'Maschine Brustpresse':                 { area: 'Mittlere Brust',                        primary:['chest'],                      secondary:['triceps'] },
  'Pec Deck / Schmetterlingsmaschine':    { area: 'Innere Brust isoliert',                 primary:['chest'],                      secondary:[] },
  'Dips (Brust)':                         { area: 'Untere Brust & Trizeps',               primary:['chest'],                      secondary:['triceps','front_shoulder'] },
  'Push-Ups':                             { area: 'Brust, Schulter & Trizeps',             primary:['chest'],                      secondary:['front_shoulder','triceps'] },
  'Enge Push-Ups (Trizeps)':              { area: 'Trizeps & innere Brust',               primary:['triceps'],                    secondary:['chest'] },
  // Rücken
  'Klimmzüge (weiter Griff)':             { area: 'Breiter Rücken (Lats) – V-Form',        primary:['lats'],                       secondary:['upper_back','biceps'] },
  'Klimmzüge (enger Griff)':              { area: 'Lats & Bizeps',                         primary:['lats','biceps'],              secondary:['upper_back'] },
  'Klimmzüge (neutraler Griff)':          { area: 'Lats & Bizeps gleichmäßig',             primary:['lats'],                       secondary:['biceps','upper_back'] },
  'Negativklimmzüge':                     { area: 'Breiter Rücken – Kraft aufbauen',       primary:['lats'],                       secondary:['biceps','upper_back'] },
  'Latzug (weiter Griff)':               { area: 'Breiter Rücken – V-Form',               primary:['lats'],                       secondary:['upper_back','biceps'] },
  'Latzug (enger Griff)':                { area: 'Lats & mittlerer Rücken',               primary:['lats'],                       secondary:['biceps','upper_back'] },
  'Latzug (neutraler Griff)':            { area: 'Lats & Bizeps',                         primary:['lats'],                       secondary:['biceps'] },
  'Latzug (Untergriff)':                 { area: 'Unterer Rücken & Bizeps',               primary:['lats','biceps'],              secondary:['upper_back'] },
  'Seilzug Rudern (eng)':                { area: 'Mittlerer Rücken & Lats',               primary:['upper_back','lats'],          secondary:['biceps'] },
  'Seilzug Rudern (weit)':               { area: 'Oberer & mittlerer Rücken, hintere Schulter', primary:['upper_back'],          secondary:['lats','rear_shoulder'] },
  'Rudern mit Stange (Untergriff)':      { area: 'Mittlerer & unterer Rücken',            primary:['upper_back','lats'],          secondary:['biceps'] },
  'Rudern mit Stange (Übergriff)':       { area: 'Oberer Rücken & Trapez',                primary:['upper_back'],                 secondary:['lats','rear_shoulder'] },
  'Rudern mit Kurzhantel (einarmig)':    { area: 'Mittlerer Rücken & Lats',               primary:['lats','upper_back'],          secondary:['biceps'] },
  'T-Bar Rudern':                         { area: 'Mittlerer & oberer Rücken',             primary:['upper_back','lats'],          secondary:['biceps'] },
  'Rudern an Maschine':                   { area: 'Mittlerer Rücken',                      primary:['upper_back'],                 secondary:['lats','biceps'] },
  'Kreuzheben (konventionell)':           { area: 'Ganzer Rücken, Beine & Gesäß – Königsübung', primary:['lower_back','lats'],  secondary:['hamstrings','glutes','upper_back'] },
  'Kreuzheben (Sumo)':                    { area: 'Innere Oberschenkel, Rücken & Gesäß',  primary:['lower_back','hamstrings','glutes'], secondary:['lats','quads'] },
  'Rumänisches Kreuzheben':               { area: 'Hintere Oberschenkel & Gesäß',         primary:['hamstrings','glutes'],        secondary:['lower_back'] },
  'Rumänisches Kreuzheben (Stange)':      { area: 'Hintere Oberschenkel & Gesäß',         primary:['hamstrings','glutes'],        secondary:['lower_back'] },
  'Rumänisches Kreuzheben (Kurzhanteln)': { area: 'Hintere Oberschenkel & Gesäß',         primary:['hamstrings','glutes'],        secondary:['lower_back'] },
  'Hyperextension':                       { area: 'Unterer Rücken & Gesäß',               primary:['lower_back'],                 secondary:['glutes','hamstrings'] },
  'Good Mornings':                        { area: 'Unterer Rücken & Hamstrings',           primary:['lower_back','hamstrings'],    secondary:['glutes'] },
  'Straight-Arm Pulldown':               { area: 'Lats & langer Rückenmuskel',            primary:['lats'],                       secondary:['lower_back'] },
  'Face Pulls':                           { area: 'Hintere Schulter & mittlerer Rücken',   primary:['rear_shoulder','upper_back'], secondary:[] },
  'Face Pulls (Kabel)':                   { area: 'Hintere Schulter & oberer Rücken',      primary:['rear_shoulder','upper_back'], secondary:[] },
  'Shrugs mit Stange':                    { area: 'Oberer Trapezmuskel (Nacken/Schulter)', primary:['upper_back'],                 secondary:[] },
  'Shrugs mit Kurzhanteln':               { area: 'Oberer Trapezmuskel',                  primary:['upper_back'],                 secondary:[] },
  'Kabel Pullover (stehend)':            { area: 'Lats & Serratus',                       primary:['lats'],                       secondary:['upper_back'] },
  'Kabel Pullover (kniend)':             { area: 'Lats – voller Bewegungsradius',         primary:['lats'],                       secondary:['upper_back'] },
  'High-to-Low Kabelzug':               { area: 'Lats & unterer Rücken',                 primary:['lats'],                       secondary:['lower_back'] },
  'Low-to-High Kabelzug':               { area: 'Lats & Serratus (unterer Zug)',          primary:['lats'],                       secondary:['upper_back'] },
  'Kabel Reverse Fly':                  { area: 'Hintere Schulter & oberer Rücken',       primary:['rear_shoulder','upper_back'], secondary:[] },
  'Kabel Rudern (hoch, Übergriff)':     { area: 'Oberer Rücken & Trapez',                primary:['upper_back'],                 secondary:['rear_shoulder'] },
  'Inverted Row (Stange)':              { area: 'Oberer Rücken & Lats – Körpergewicht',   primary:['upper_back','lats'],          secondary:['biceps'] },
  'Inverted Row (Ringe)':               { area: 'Oberer Rücken – instabile Variante',     primary:['upper_back','lats'],          secondary:['biceps'] },
  'Inverted Row (schräg)':              { area: 'Oberer Rücken – angepasste Intensität',  primary:['upper_back'],                 secondary:['lats','biceps'] },
  'TRX Row':                            { area: 'Oberer Rücken & Schulter – Suspension',  primary:['upper_back'],                 secondary:['lats','rear_shoulder'] },
  'Latzug (Maschine)':                  { area: 'Breiter Rücken – Maschine',              primary:['lats'],                       secondary:['upper_back','biceps'] },
  'Rudern (Plate Loaded Maschine)':     { area: 'Mittlerer Rücken – schwerere Last',      primary:['upper_back','lats'],          secondary:['biceps'] },
  'Rudern (Selectorized Maschine)':     { area: 'Mittlerer Rücken – Maschine',            primary:['upper_back'],                 secondary:['lats','biceps'] },
  'Low Row Maschine':                   { area: 'Mittlerer & unterer Rücken',             primary:['lats','upper_back'],          secondary:['biceps'] },
  'High Row Maschine':                  { area: 'Oberer Rücken & Lats',                   primary:['upper_back','lats'],          secondary:['rear_shoulder'] },
  'Meadows Row':                        { area: 'Mittlerer & oberer Rücken – einarmig',   primary:['upper_back','lats'],          secondary:['biceps'] },
  'Kroc Row':                           { area: 'Mittlerer Rücken – maximales Gewicht',   primary:['upper_back','lats'],          secondary:['biceps'] },
  'Chest-Supported Row (Langhantel)':   { area: 'Mittlerer Rücken ohne Rückenbelastung',  primary:['upper_back'],                 secondary:['lats','biceps'] },
  'Chest-Supported Row (Kurzhantel)':   { area: 'Mittlerer Rücken – stützend',            primary:['upper_back'],                 secondary:['lats','biceps'] },
  'Seal Row':                           { area: 'Oberer Rücken – liegend, isoliert',      primary:['upper_back'],                 secondary:['lats','biceps'] },
  'Yates Row':                          { area: 'Mittlerer Rücken – Untergriff, breit',   primary:['upper_back','lats'],          secondary:['biceps'] },
  'Kreuzheben (Pause)':                 { area: 'Ganzer Rücken – Pause unten',            primary:['lower_back','lats'],          secondary:['hamstrings','glutes'] },
  'Kreuzheben (Rumänisch, einbeinig)':  { area: 'Hintere Kette & Balance',                primary:['hamstrings','glutes'],        secondary:['lower_back'] },
  'Morgengymnastik (Good Mornings, sitzend)': { area: 'Unterer Rücken sitzend',           primary:['lower_back'],                 secondary:['hamstrings'] },
  'Back Extension (45°)':               { area: 'Unterer Rücken – 45-Grad-Bank',          primary:['lower_back'],                 secondary:['glutes','hamstrings'] },
  'Back Extension (90°)':               { area: 'Unterer Rücken – senkrechte Bank',       primary:['lower_back'],                 secondary:['glutes'] },
  'Superman':                           { area: 'Unterer Rücken – Boden',                 primary:['lower_back'],                 secondary:['glutes'] },
  'Superman Hold':                      { area: 'Unterer Rücken – isometrisch',            primary:['lower_back'],                 secondary:['glutes'] },
  'Bird Dog':                           { area: 'Core & Rücken – Stabilität',             primary:['lower_back'],                 secondary:['abs','glutes'] },
  'Face Pulls (Band)':                  { area: 'Hintere Schulter & Trapez – Band',       primary:['rear_shoulder','upper_back'], secondary:[] },
  'Band Pull-Apart':                    { area: 'Hintere Schulter & Skapula',             primary:['rear_shoulder','upper_back'], secondary:[] },
  'Rear Delt Row (Kabel)':              { area: 'Hintere Schulter & Rücken',              primary:['rear_shoulder','upper_back'], secondary:[] },
  'Rear Delt Row (Kurzhantel)':         { area: 'Hintere Schulter – liegend oder gebeugt', primary:['rear_shoulder'],             secondary:['upper_back'] },
  'Neck Pull (Lat Pulldown hinter Kopf)': { area: 'Lats & Trapez',                        primary:['lats','upper_back'],          secondary:['rear_shoulder'] },
  'High Pull (Langhantel)':             { area: 'Oberer Rücken & Schulter – explosiv',    primary:['upper_back'],                 secondary:['front_shoulder','lats'] },
  'Snatch Grip Deadlift':               { area: 'Breiter Rücken & Oberschenkel',          primary:['lower_back','lats'],          secondary:['hamstrings','upper_back'] },
  'Trap Bar Shrugs':                    { area: 'Oberer Trapez – neutrale Hand',          primary:['upper_back'],                 secondary:[] },
  // Schultern
  'Schulterdrücken mit Stange (vor Kopf)':  { area: 'Vordere & mittlere Schulter',        primary:['front_shoulder'],             secondary:['triceps','upper_back'] },
  'Schulterdrücken mit Stange (hinter Kopf)': { area: 'Mittlere & hintere Schulter',     primary:['front_shoulder','rear_shoulder'], secondary:['triceps'] },
  'Schulterdrücken mit Kurzhanteln (sitzend)': { area: 'Vordere & mittlere Schulter',    primary:['front_shoulder'],             secondary:['triceps'] },
  'Schulterdrücken mit Kurzhanteln (stehend)': { area: 'Schulter & Core-Stabilität',     primary:['front_shoulder'],             secondary:['triceps','abs'] },
  'Arnold Press':                         { area: 'Alle 3 Schulterköpfe',                 primary:['front_shoulder','rear_shoulder'], secondary:['triceps'] },
  'Maschine Schulterdrücken':             { area: 'Vordere Schulter',                     primary:['front_shoulder'],             secondary:['triceps'] },
  'Seitheben (Kurzhanteln)':              { area: 'Mittlere Schulter (seitlicher Kopf)',   primary:['front_shoulder'],             secondary:[] },
  'Seitheben (Kabel)':                    { area: 'Mittlere Schulter – gleichmäßiger Zug', primary:['front_shoulder'],            secondary:[] },
  'Frontheben (Stange)':                  { area: 'Vordere Schulter',                     primary:['front_shoulder'],             secondary:[] },
  'Frontheben (Kurzhanteln)':             { area: 'Vordere Schulter',                     primary:['front_shoulder'],             secondary:[] },
  'Frontheben (Kabel)':                   { area: 'Vordere Schulter',                     primary:['front_shoulder'],             secondary:[] },
  'Upright Rows (Stange)':                { area: 'Mittlere Schulter & Trapez',           primary:['front_shoulder','upper_back'],secondary:['biceps'] },
  'Upright Rows (Kabel)':                 { area: 'Mittlere Schulter & Trapez',           primary:['front_shoulder','upper_back'],secondary:[] },
  'Reverse Fliegende (Kurzhantel)':       { area: 'Hintere Schulter',                     primary:['rear_shoulder'],              secondary:['upper_back'] },
  'Reverse Fliegende (Kabel)':            { area: 'Hintere Schulter',                     primary:['rear_shoulder'],              secondary:['upper_back'] },
  'Reverse Pec Deck':                     { area: 'Hintere Schulter isoliert',            primary:['rear_shoulder'],              secondary:['upper_back'] },
  // Bizeps
  'Bizepscurls (Stange)':                 { area: 'Biceps – volle Länge',                 primary:['biceps'],                     secondary:['forearms'] },
  'Bizepscurls (EZ-Stange)':              { area: 'Biceps außen & innen',                 primary:['biceps'],                     secondary:['forearms'] },
  'Bizepscurls (Kurzhanteln, alternierend)': { area: 'Biceps + Unterarmdrehung',         primary:['biceps'],                     secondary:['forearms'] },
  'Bizepscurls (Kurzhanteln, gleichzeitig)': { area: 'Biceps',                           primary:['biceps'],                     secondary:['forearms'] },
  'Hammercurls':                          { area: 'Brachialis & Unterarm (seitlicher Griff)', primary:['biceps'],                secondary:['forearms'] },
  'Hammercurls (Kabel)':                  { area: 'Brachialis & Bizeps',                  primary:['biceps'],                     secondary:['forearms'] },
  'Konzentrationscurls':                  { area: 'Bizeps-Gipfel (Spitze)',               primary:['biceps'],                     secondary:[] },
  'Preacher Curls (Stange)':              { area: 'Unterer Bizeps – kein Schwung möglich', primary:['biceps'],                    secondary:[] },
  'Preacher Curls (Kurzhanteln)':         { area: 'Unterer Bizeps',                       primary:['biceps'],                     secondary:[] },
  'Preacher Curls (Maschine)':            { area: 'Unterer Bizeps isoliert',              primary:['biceps'],                     secondary:[] },
  'Kabelcurls (tief)':                    { area: 'Bizeps – gleichmäßige Spannung',       primary:['biceps'],                     secondary:[] },
  'Kabelcurls (hoch, Spider Curl)':       { area: 'Bizeps-Spitze',                        primary:['biceps'],                     secondary:[] },
  'Incline Dumbbell Curls':               { area: 'Langer Bizepskopf (viel Dehnung)',     primary:['biceps'],                     secondary:[] },
  'Zottman Curls':                        { area: 'Bizeps hoch + Unterarm runter',        primary:['biceps','forearms'],          secondary:[] },
  'Reverse Curls':                        { area: 'Unterarm & Brachialis',                primary:['forearms'],                   secondary:['biceps'] },
  '21s (Bizeps)':                         { area: 'Bizeps komplett – untere, obere & volle Bewegung', primary:['biceps'],       secondary:[] },
  // Trizeps
  'Trizepsdrücken am Kabel (Seil)':       { area: 'Alle 3 Trizepsköpfe – weite Spreizung', primary:['triceps'],                  secondary:[] },
  'Trizepsdrücken am Kabel (Stange)':     { area: 'Lateraler & medialer Trizepskopf',    primary:['triceps'],                    secondary:[] },
  'Trizepsdrücken am Kabel (einarmig)':   { area: 'Trizeps einseitig',                   primary:['triceps'],                    secondary:[] },
  'Skull Crusher (Stange)':               { area: 'Langer Trizepskopf (Hauptmasse)',     primary:['triceps'],                    secondary:[] },
  'Skull Crusher (EZ-Stange)':            { area: 'Langer & medialer Trizepskopf',       primary:['triceps'],                    secondary:[] },
  'Skull Crusher (Kurzhanteln)':          { area: 'Langer Trizepskopf',                  primary:['triceps'],                    secondary:[] },
  'Trizeps Dips (Bank)':                  { area: 'Lateraler Trizepskopf',               primary:['triceps'],                    secondary:['front_shoulder'] },
  'Trizeps Dips (Stange)':                { area: 'Trizeps & Brust',                     primary:['triceps','chest'],            secondary:['front_shoulder'] },
  'Overhead Trizepsdrücken (Stange)':     { area: 'Langer Trizepskopf (Dehnung)',        primary:['triceps'],                    secondary:[] },
  'Overhead Trizepsdrücken (KH, einarmig)': { area: 'Langer Trizepskopf (viel Dehnung)', primary:['triceps'],                   secondary:[] },
  'Overhead Trizepsdrücken (Kabel)':      { area: 'Langer Trizepskopf',                  primary:['triceps'],                    secondary:[] },
  'Kickbacks (Kurzhantel)':               { area: 'Lateraler Trizepskopf',               primary:['triceps'],                    secondary:[] },
  'Kickbacks (Kabel)':                    { area: 'Lateraler Trizepskopf',               primary:['triceps'],                    secondary:[] },
  'Close-Grip Bankdrücken':               { area: 'Trizeps & innere Brust',              primary:['triceps'],                    secondary:['chest'] },
  // Beine
  'Kniebeugen (Freie Stange)':            { area: 'Oberschenkel vorne & Gesäß – Grundübung', primary:['quads','glutes'],         secondary:['hamstrings','lower_back'] },
  'Kniebeugen (Hack Squat Maschine)':     { area: 'Quadrizeps – viel Kniebeugung',       primary:['quads'],                      secondary:['glutes'] },
  'Kniebeugen (Goblet)':                  { area: 'Oberschenkel vorne, Gesäß & Core',    primary:['quads'],                      secondary:['glutes','abs'] },
  'Frontkniebeugen':                      { area: 'Quadrizeps-Betonung & Core',           primary:['quads'],                      secondary:['glutes','abs'] },
  'Beinpresse':                           { area: 'Oberschenkel & Gesäß (rückenfreundlich)', primary:['quads','glutes'],         secondary:['hamstrings'] },
  'Beinpresse (einbeinig)':               { area: 'Einseitiger Quadrizeps & Gesäß',      primary:['quads','glutes'],             secondary:['hamstrings'] },
  'Beinstrecker (Maschine)':              { area: 'Quadrizeps isoliert',                  primary:['quads'],                      secondary:[] },
  'Ausfallschritte (Stange)':             { area: 'Oberschenkel & Gesäß',                primary:['quads','glutes'],             secondary:['hamstrings'] },
  'Ausfallschritte (Kurzhanteln)':        { area: 'Oberschenkel & Gesäß',                primary:['quads','glutes'],             secondary:['hamstrings'] },
  'Ausfallschritte (Kabel)':              { area: 'Oberschenkel & Gesäß',                primary:['quads','glutes'],             secondary:['hamstrings'] },
  'Ausfallschritte (Reverse)':            { area: 'Gesäß-Betonung & Oberschenkel',       primary:['glutes','quads'],             secondary:['hamstrings'] },
  'Bulgarian Split Squats':               { area: 'Einseitiger Oberschenkel & Gesäß – sehr effektiv', primary:['quads','glutes'], secondary:['hamstrings'] },
  'Step-Ups':                             { area: 'Gesäß & Oberschenkel einseitig',      primary:['glutes','quads'],             secondary:[] },
  'Beinbeuger liegend (Maschine)':        { area: 'Hintere Oberschenkel isoliert',       primary:['hamstrings'],                 secondary:[] },
  'Beinbeuger sitzend (Maschine)':        { area: 'Hintere Oberschenkel',                primary:['hamstrings'],                 secondary:[] },
  'Nordic Hamstring Curls':               { area: 'Hintere Oberschenkel – exzentrisch',  primary:['hamstrings'],                 secondary:['glutes'] },
  'Glute Bridge':                         { area: 'Gesäß & hintere Oberschenkel',        primary:['glutes'],                     secondary:['hamstrings','lower_back'] },
  'Hip Thrust (Stange)':                  { area: 'Gesäß – beste Übung dafür',           primary:['glutes'],                     secondary:['hamstrings'] },
  'Hip Thrust (Maschine)':                { area: 'Gesäß isoliert',                       primary:['glutes'],                     secondary:['hamstrings'] },
  'Hip Abduktion (Maschine)':             { area: 'Äußeres Gesäß (Gluteus Medius)',      primary:['glutes'],                     secondary:[] },
  'Sumo Kreuzheben':                      { area: 'Innere Oberschenkel, Rücken & Gesäß', primary:['lower_back','hamstrings','glutes'], secondary:['lats','quads'] },
  'Wadenheben stehend (Maschine)':        { area: 'Wadenmuskel (Gastrocnemius – sichtbarer Teil)', primary:['calves'],          secondary:[] },
  'Wadenheben sitzend (Maschine)':        { area: 'Tiefer Wadenmuskel (Soleus)',         primary:['calves'],                     secondary:[] },
  'Wadenheben (freie Stange)':            { area: 'Wadenmuskel gesamt',                  primary:['calves'],                     secondary:[] },
  'Wadenheben (einbeinig)':               { area: 'Wadenmuskel einseitig – mehr Reiz',   primary:['calves'],                     secondary:[] },
  'Donkey Calf Raises':                   { area: 'Wadenmuskel – maximale Dehnung',      primary:['calves'],                     secondary:[] },
  // Bauch & Core
  'Crunches':                             { area: 'Obere Bauchmuskeln',                        primary:['abs'], secondary:[] },
  'Crunches (Kabel)':                     { area: 'Obere Bauchmuskeln mit Widerstand',          primary:['abs'], secondary:[] },
  'Crunches (Maschine)':                  { area: 'Obere Bauchmuskeln – Maschine',              primary:['abs'], secondary:[] },
  'Crunches (schräg)':                    { area: 'Schräge Bauchmuskeln & oberer Bauch',        primary:['abs'], secondary:[] },
  'Reverse Crunches':                     { area: 'Untere Bauchmuskeln',                        primary:['abs'], secondary:[] },
  'Decline Crunches':                     { area: 'Obere Bauchmuskeln – mehr Reiz',             primary:['abs'], secondary:[] },
  'Decline Crunches (mit Gewicht)':       { area: 'Obere Bauchmuskeln – gewichtet',             primary:['abs'], secondary:[] },
  'Bicycle Crunches':                     { area: 'Obliques & gerade Bauchmuskeln',             primary:['abs'], secondary:[] },
  'Crossbody Crunches':                   { area: 'Obliques – diagonal',                        primary:['abs'], secondary:[] },
  'Long Arm Crunches':                    { area: 'Obere Bauchmuskeln – langer Hebel',          primary:['abs'], secondary:[] },
  'Oblique Crunches':                     { area: 'Seitliche Bauchmuskeln',                     primary:['abs'], secondary:[] },
  'Oblique Crunches (Kabel)':             { area: 'Obliques mit Widerstand',                    primary:['abs'], secondary:[] },
  'Sit-Ups':                              { area: 'Bauch & Hüftbeuger',                         primary:['abs'], secondary:[] },
  'Decline Sit-Ups':                      { area: 'Gesamter Bauch – schräge Bank',              primary:['abs'], secondary:[] },
  'Sit-Ups (mit Gewicht)':                { area: 'Bauch gewichtet',                            primary:['abs'], secondary:[] },
  'V-Sit-Ups':                            { area: 'Gesamter Bauch – V-Form',                    primary:['abs'], secondary:[] },
  'Weighted Sit-Ups (Kabel)':             { area: 'Bauch mit Kabelwiderstand',                  primary:['abs'], secondary:[] },
  'Leg Raises (liegend)':                 { area: 'Untere Bauchmuskeln',                        primary:['abs'], secondary:[] },
  'Leg Raises (hängend)':                 { area: 'Untere Bauchmuskeln – anspruchsvoll',        primary:['abs'], secondary:['forearms'] },
  'Leg Raises (hängend, gerade)':         { area: 'Untere Bauchmuskeln – gestreckt',            primary:['abs'], secondary:['forearms'] },
  'Leg Raises (hängend, schräg)':         { area: 'Obliques & untere Bauchmuskeln',             primary:['abs'], secondary:['forearms'] },
  'Knee Raises (hängend)':                { area: 'Untere Bauchmuskeln',                        primary:['abs'], secondary:[] },
  'Knee Raises (hängend, schräg)':        { area: 'Obliques & untere Bauchmuskeln',             primary:['abs'], secondary:[] },
  'Hanging Knee Raises (einarmig)':       { area: 'Untere Bauchmuskeln & Rotation',             primary:['abs'], secondary:['forearms'] },
  'Hanging Leg Raises':                   { area: 'Untere Bauchmuskeln – anspruchsvoll',        primary:['abs'], secondary:['forearms'] },
  'Hanging Knee Raises':                  { area: 'Untere Bauchmuskeln',                        primary:['abs'], secondary:[] },
  'Toes to Bar':                          { area: 'Unterer Bauch & Griffkraft',                 primary:['abs'], secondary:['forearms','lats'] },
  'Toes to Bar (schräg)':                 { area: 'Obliques & unterer Bauch',                   primary:['abs'], secondary:['forearms'] },
  'L-Sit Hold':                           { area: 'Gesamter Bauch – isometrisch',               primary:['abs'], secondary:['triceps','front_shoulder'] },
  'L-Sit (Barren)':                       { area: 'Bauch & Trizeps – Barren',                   primary:['abs'], secondary:['triceps'] },
  'L-Sit (Boden)':                        { area: 'Bauch & Handgelenke',                        primary:['abs'], secondary:['triceps'] },
  'Windshield Wipers':                    { area: 'Obliques – hängend',                         primary:['abs'], secondary:['forearms','lats'] },
  'Windshield Wipers (liegend)':          { area: 'Obliques – liegend',                         primary:['abs'], secondary:[] },
  'Scissor Kicks':                        { area: 'Untere Bauchmuskeln – dynamisch',            primary:['abs'], secondary:[] },
  'Flutter Kicks':                        { area: 'Untere Bauchmuskeln – Ausdauer',             primary:['abs'], secondary:[] },
  'Heel Touches':                         { area: 'Obliques – seitlich',                        primary:['abs'], secondary:[] },
  'Toe Touches':                          { area: 'Obere Bauchmuskeln',                         primary:['abs'], secondary:[] },
  'V-Ups':                                { area: 'Gesamter Bauch',                             primary:['abs'], secondary:[] },
  'Jackknives':                           { area: 'Gesamter Bauch – V-Form',                    primary:['abs'], secondary:[] },
  'Plank':                                { area: 'Tiefer Bauch & gesamter Rumpf',              primary:['abs'], secondary:['lower_back'] },
  'Plank (Unterarmstütz)':               { area: 'Tiefer Bauch – Unterarm',                    primary:['abs'], secondary:['lower_back'] },
  'Plank (erhöhte Füße)':                { area: 'Bauch & Schultern – erhöht',                 primary:['abs'], secondary:['front_shoulder'] },
  'Plank Shoulder Taps':                  { area: 'Anti-Rotation & Rumpfstabilität',            primary:['abs'], secondary:['front_shoulder'] },
  'Plank Hip Dips':                       { area: 'Obliques & Rumpf',                           primary:['abs'], secondary:[] },
  'Plank Up-Downs':                       { area: 'Rumpf & Trizeps',                            primary:['abs'], secondary:['triceps'] },
  'Plank (einarmig)':                     { area: 'Anti-Rotation – sehr anspruchsvoll',         primary:['abs'], secondary:['front_shoulder'] },
  'Plank (einbeinig)':                    { area: 'Rumpf & Gesäß',                              primary:['abs'], secondary:['glutes'] },
  'Rocking Plank':                        { area: 'Tiefer Bauch – dynamisch',                   primary:['abs'], secondary:['lower_back'] },
  'Body Saw Plank':                       { area: 'Tiefer Bauch – Längsachse',                  primary:['abs'], secondary:['lower_back'] },
  'Seitstütz (Side Plank)':               { area: 'Seitliche Bauchmuskulatur',                  primary:['abs'], secondary:[] },
  'Seitstütz (mit Abduktion)':            { area: 'Obliques & Gesäß',                           primary:['abs'], secondary:['glutes'] },
  'Seitstütz (mit Rotation)':             { area: 'Obliques – Rotation',                        primary:['abs'], secondary:[] },
  'Seitstütz (erhöht)':                   { area: 'Obliques – erhöht, schwerer',                primary:['abs'], secondary:[] },
  'Copenhagen Plank':                     { area: 'Adduktoren & Obliques',                      primary:['abs'], secondary:['adductors'] },
  'Hollow Body Hold':                     { area: 'Tiefer Bauch – isometrisch',                 primary:['abs'], secondary:[] },
  'Hollow Body Rocks':                    { area: 'Tiefer Bauch – dynamisch',                   primary:['abs'], secondary:[] },
  'Arch Body Hold':                       { area: 'Rückenstrecker – Gegenpol zu Hollow',        primary:['lower_back'], secondary:['glutes'] },
  'Russian Twists':                       { area: 'Seitliche Bauchmuskeln (Obliques)',          primary:['abs'], secondary:[] },
  'Russian Twists (mit Gewicht)':         { area: 'Obliques gewichtet',                         primary:['abs'], secondary:[] },
  'Russian Twists (Kabel)':               { area: 'Obliques – Kabelwiderstand',                 primary:['abs'], secondary:[] },
  'Woodchoppers (Kabel, oben nach unten)':{ area: 'Obliques & Schulter – diagonal',             primary:['abs'], secondary:['front_shoulder'] },
  'Woodchoppers (Kabel, unten nach oben)':{ area: 'Obliques & Schulter – diagonal',             primary:['abs'], secondary:['front_shoulder'] },
  'Woodchoppers (Kurzhantel)':            { area: 'Obliques – mit Kurzhantel',                  primary:['abs'], secondary:['front_shoulder'] },
  'Pallof Press':                         { area: 'Rotationsstabilität des Rumpfes',            primary:['abs'], secondary:['front_shoulder'] },
  'Pallof Press (Rotation)':              { area: 'Anti-Rotation & Rotation',                   primary:['abs'], secondary:['front_shoulder'] },
  'Pallof Press (stehend)':               { area: 'Rumpfstabilität stehend',                    primary:['abs'], secondary:['front_shoulder'] },
  'Side Bends (Kurzhantel)':              { area: 'Seitliche Bauchmuskeln',                     primary:['abs'], secondary:[] },
  'Side Bends (Kabel)':                   { area: 'Obliques mit Widerstand',                    primary:['abs'], secondary:[] },
  'Ab Roller':                            { area: 'Gesamter Bauch & Schultern',                 primary:['abs'], secondary:['front_shoulder','lats'] },
  'Ab Roller (kniend)':                   { area: 'Bauch – kniend, leichter',                   primary:['abs'], secondary:['front_shoulder'] },
  'Ab Roller (stehend)':                  { area: 'Gesamter Bauch – maximal schwer',            primary:['abs'], secondary:['front_shoulder','lats'] },
  'Ab Wheel Rollout (stehend)':           { area: 'Gesamter Bauch – stehend',                   primary:['abs'], secondary:['front_shoulder','lats'] },
  'Dragon Flag':                          { area: 'Gesamter Bauch – sehr schwer',               primary:['abs'], secondary:['lats','lower_back'] },
  'Dragon Flag (negativ)':                { area: 'Exzentrisch – Bauch extrem',                 primary:['abs'], secondary:['lats'] },
  'Dead Bug':                             { area: 'Tiefer Bauch & Koordination',                primary:['abs'], secondary:[] },
  'Dead Bug (mit Gewicht)':               { area: 'Tiefer Bauch – gewichtet',                   primary:['abs'], secondary:[] },
  'Dead Bug (Kabel)':                     { area: 'Tiefer Bauch – Kabelwiderstand',             primary:['abs'], secondary:[] },
  'Stir the Pot':                         { area: 'Tiefer Bauch – Kreisbewegung',               primary:['abs'], secondary:['lower_back'] },
  'Pike (TRX)':                           { area: 'Bauch & Schultern – Suspension',             primary:['abs'], secondary:['front_shoulder'] },
  'Pike Rollout (Gymnastikball)':         { area: 'Bauch & Schultern – instabil',               primary:['abs'], secondary:['front_shoulder'] },
  'Jackknife (Gymnastikball)':            { area: 'Gesamter Bauch – Gymnastikball',             primary:['abs'], secondary:[] },
  'Crunch (Gymnastikball)':               { area: 'Obere Bauchmuskeln – instabil',              primary:['abs'], secondary:[] },
  'Kabel Crunch (kniend)':                { area: 'Obere Bauchmuskeln – Kabel kniend',          primary:['abs'], secondary:[] },
  'Kabel Crunch (stehend)':               { area: 'Bauch – stehend am Kabel',                   primary:['abs'], secondary:[] },
  'Kabel Reverse Crunch':                 { area: 'Untere Bauchmuskeln – Kabel',                primary:['abs'], secondary:[] },
  'Kabel Crunch (seitlich)':              { area: 'Obliques – Kabel seitlich',                  primary:['abs'], secondary:[] },
  'Kabel Woodchopper (diagonal)':         { area: 'Obliques & Schulter – Kabel diagonal',       primary:['abs'], secondary:['front_shoulder'] },
  'Mountain Climbers':                    { area: 'Bauch & Kondition',                          primary:['abs'], secondary:['quads'] },
  'Mountain Climbers (langsam)':          { area: 'Bauch – kontrolliert',                       primary:['abs'], secondary:[] },
  'Mountain Climbers (gekreuzt)':         { area: 'Obliques – gekreuzt',                        primary:['abs'], secondary:[] },
  'Bear Crawl':                           { area: 'Rumpf & Schultern – Koordination',           primary:['abs'], secondary:['front_shoulder','quads'] },
  'Inchworm':                             { area: 'Bauch, Schultern & Hamstrings',              primary:['abs'], secondary:['front_shoulder','hamstrings'] },
  'Sit-Up to Press':                      { area: 'Bauch & Schultern kombiniert',               primary:['abs'], secondary:['front_shoulder'] },
  'Woodchoppers (Kabel)':                 { area: 'Seitliche Bauchmuskeln & Core',              primary:['abs'], secondary:['front_shoulder'] },
  // Ganzkörper
  'Kettlebell Swing':                     { area: 'Gesäß, Rücken & Schultern – explosiv', primary:['glutes','hamstrings','lower_back'], secondary:['front_shoulder'] },
  'Burpees':                              { area: 'Ganzkörper & Kondition',              primary:['chest','quads','abs'],         secondary:['triceps','glutes'] },
  'Thrusters':                            { area: 'Beine, Schultern & Core',             primary:['quads','front_shoulder'],      secondary:['glutes','triceps','abs'] },
  'Farmers Walk':                         { area: 'Griffkraft, Schultern & Core',        primary:['forearms','upper_back'],       secondary:['quads','glutes','abs'] },
  'Turkish Get-Up':                       { area: 'Ganzkörper & Schulter-Stabilität',    primary:['front_shoulder','abs'],        secondary:['glutes','quads','triceps'] },
  // Aliases for DEFAULT_PLANS short names (same muscle activation as full-name entries)
  'Bankdrücken':                          { area: 'Brust',                               primary:['chest'],                      secondary:['front_shoulder','triceps'] },
  'Schrägbankdrücken (oben)':             { area: 'Obere Brust & vordere Schulter',      primary:['chest','front_shoulder'],     secondary:['triceps'] },
  'Kurzhantel Fliegende':                 { area: 'Innere & mittlere Brust',             primary:['chest'],                      secondary:['front_shoulder'] },
  'Dips':                                 { area: 'Untere Brust & Trizeps',              primary:['chest'],                      secondary:['triceps','front_shoulder'] },
  'Schulterdrücken Stange':               { area: 'Vordere & mittlere Schulter',         primary:['front_shoulder'],             secondary:['triceps','upper_back'] },
  'Schulterdrücken KH':                   { area: 'Vordere & mittlere Schulter',         primary:['front_shoulder'],             secondary:['triceps'] },
  'Seitheben':                            { area: 'Mittlere Schulter',                   primary:['front_shoulder'],             secondary:[] },
  'Trizepsdrücken Kabel':                 { area: 'Trizeps',                             primary:['triceps'],                    secondary:[] },
  'Skull Crusher':                        { area: 'Langer & medialer Trizepskopf',       primary:['triceps'],                    secondary:[] },
  'Trizeps Dips':                         { area: 'Lateraler Trizepskopf',               primary:['triceps'],                    secondary:['front_shoulder'] },
  'Overhead Extension':                   { area: 'Langer Trizepskopf',                  primary:['triceps'],                    secondary:[] },
  'Klimmzüge':                            { area: 'Breiter Rücken (Lats)',               primary:['lats'],                       secondary:['upper_back','biceps'] },
  'Rudern Stange':                        { area: 'Oberer Rücken & Trapez',              primary:['upper_back'],                 secondary:['lats','rear_shoulder'] },
  'Rudern Kabel':                         { area: 'Mittlerer Rücken & Lats',             primary:['upper_back','lats'],          secondary:['biceps'] },
  'Rudern Kurzhantel':                    { area: 'Mittlerer Rücken & Lats',             primary:['lats','upper_back'],          secondary:['biceps'] },
  'Latzug weit':                          { area: 'Breiter Rücken – V-Form',             primary:['lats'],                       secondary:['upper_back','biceps'] },
  'Latzug eng':                           { area: 'Lats & mittlerer Rücken',             primary:['lats'],                       secondary:['biceps','upper_back'] },
  'Kreuzheben':                           { area: 'Ganzer Rücken, Beine & Gesäß',        primary:['lower_back','lats'],          secondary:['hamstrings','glutes','upper_back'] },
  'Bizepscurls Stange':                   { area: 'Biceps – volle Länge',                primary:['biceps'],                     secondary:['forearms'] },
  'Bizepscurls KH':                       { area: 'Biceps + Unterarmdrehung',            primary:['biceps'],                     secondary:['forearms'] },
  'Preacher Curls':                       { area: 'Unterer Bizeps',                      primary:['biceps'],                     secondary:[] },
  'Kniebeugen':                           { area: 'Oberschenkel vorne & Gesäß',          primary:['quads','glutes'],             secondary:['hamstrings','lower_back'] },
  'Romanian Deadlift':                    { area: 'Hintere Oberschenkel & Gesäß',        primary:['hamstrings','glutes'],        secondary:['lower_back'] },
  'Beinstrecker':                         { area: 'Quadrizeps isoliert',                 primary:['quads'],                      secondary:[] },
  'Beinbeuger':                           { area: 'Hintere Oberschenkel isoliert',       primary:['hamstrings'],                 secondary:[] },
  'Wadenheben':                           { area: 'Wadenmuskel',                         primary:['calves'],                     secondary:[] },
  'Laufen (Laufband)':                    { area: 'Kondition & Ausdauer',               primary:['quads','hamstrings'],          secondary:['calves','glutes'] },
  'Rudergerät':                           { area: 'Ganzkörper Ausdauer',                 primary:['upper_back','lats'],          secondary:['quads','hamstrings'] },
  'Fahrradergometer':                     { area: 'Beine & Kondition',                   primary:['quads'],                      secondary:['hamstrings','calves'] },
  'Jumping Jacks':                        { area: 'Ganzkörper Kondition',               primary:['quads','calves'],             secondary:['front_shoulder'] },
  'Hip Thrust (Langhantel)':              { area: 'Gesäß – maximale Aktivierung',        primary:['glutes'],                     secondary:['hamstrings'] },
  'Hip Thrust (Kurzhantel)':              { area: 'Gesäß – Kurzhantel',                  primary:['glutes'],                     secondary:['hamstrings'] },
  'Hip Thrust (Maschine)':                { area: 'Gesäß – Maschine',                   primary:['glutes'],                     secondary:['hamstrings'] },
  'Ausfallschritte (Langhantel)':         { area: 'Quadrizeps & Gesäß',                 primary:['quads','glutes'],             secondary:['hamstrings'] },
  'Beinbeuger (Maschine)':                { area: 'Hintere Oberschenkel',               primary:['hamstrings'],                 secondary:[] },
  'Military Press':                       { area: 'Vordere & mittlere Schulter',        primary:['front_shoulder'],             secondary:['triceps','upper_back'] },
  'Upright Row (Langhantel)':             { area: 'Schulter & Trapez',                  primary:['front_shoulder','upper_back'],secondary:['biceps'] },
};

// Returns the info for an exercise (falls back to muscle group level)
function getExerciseInfo(name) {
  if (EXERCISE_INFO[name]) return EXERCISE_INFO[name];
  const group = EXERCISE_MUSCLE[name];
  const fallbacks = {
    'Brust':    { area: 'Brust', primary:['chest'], secondary:[] },
    'Rücken':   { area: 'Rücken', primary:['lats','upper_back'], secondary:[] },
    'Schultern':{ area: 'Schultern', primary:['front_shoulder'], secondary:[] },
    'Bizeps':   { area: 'Bizeps', primary:['biceps'], secondary:[] },
    'Trizeps':  { area: 'Trizeps', primary:['triceps'], secondary:[] },
    'Beine':    { area: 'Beine', primary:['quads'], secondary:['hamstrings'] },
    'Bauch':    { area: 'Bauch', primary:['abs'], secondary:[] },
    'Cardio':   { area: 'Kondition', primary:[], secondary:[] },
  };
  return fallbacks[group] || { area: group || '', primary:[], secondary:[] };
}

var MUSCLE_LABELS = {
  front_shoulder: 'Schulter (vorne)',
  chest: 'Brust',
  abs: 'Bauch',
  biceps: 'Bizeps',
  forearms: 'Unterarm',
  quads: 'Quadrizeps',
  calves: 'Waden',
  upper_back: 'Trapez',
  rear_shoulder: 'Schulter (hinten)',
  lats: 'Latissimus',
  lower_back: 'Untere Rücken',
  triceps: 'Trizeps',
  glutes: 'Gesäß',
  hamstrings: 'Beinbizeps'
};

// Detailed anatomical muscle-map SVG — layered silhouette + individual muscle shapes.
// Interactive: tap a muscle for its name, switch Vorne/Hinten tabs to zoom in, highlighted muscles pulse.
function muscleBodySVG(primary, secondary, maxWidth) {
  primary = primary || [];
  secondary = secondary || [];
  var uid = 'mm' + Math.floor(Math.random() * 1e9);

  // Anatomical muscle-tissue rendering: every muscle keeps a fleshy gradient look at all
  // times (like a real anatomy chart); worked muscles additionally get a glowing accent
  // overlay of the same shape so the target is unmistakable without hiding the anatomy.
  var restGrad = 'url(#grad-rest-'+uid+')';
  var oc = '#2a1410';
  var jc = '#ede0c8';
  var bd = restGrad;

  function P(d,f)        { return '<path d="'+d+'" fill="'+f+'" stroke="'+oc+'" stroke-width="0.5"/>'; }
  function C(x,y,r,f)   { return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+f+'" stroke="'+oc+'" stroke-width="0.5"/>'; }
  function E(x,y,rx,ry,f){ return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+f+'" stroke="'+oc+'" stroke-width="0.5"/>'; }
  function J(x,y,r)      { return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+jc+'" stroke="'+oc+'" stroke-width="0.5"/>'; }
  // Interactive, tappable muscle shape: fleshy base + (if worked) a pulsing accent overlay on top
  function M(d, m) {
    var isP = primary.includes(m), isS = !isP && secondary.includes(m);
    var cls = isP ? ' m-primary' : (isS ? ' m-secondary' : '');
    var base = '<path class="muscle-shape'+cls+'" data-m="'+m+'" tabindex="0" d="'+d+'" fill="'+restGrad+'" stroke="'+oc+'" stroke-width="0.5"/>';
    if (!isP && !isS) return base;
    var grad = 'url(#grad-'+(isP?'primary':'secondary')+'-'+uid+')';
    var pcls = isP ? 'pulse-primary' : 'pulse-secondary';
    return base + '<path class="muscle-overlay '+pcls+'" d="'+d+'" fill="'+grad+'" style="pointer-events:none"/>';
  }
  function EM(x,y,rx,ry,m) {
    var isP = primary.includes(m), isS = !isP && secondary.includes(m);
    var cls = isP ? ' m-primary' : (isS ? ' m-secondary' : '');
    var base = '<ellipse class="muscle-shape'+cls+'" data-m="'+m+'" tabindex="0" cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+restGrad+'" stroke="'+oc+'" stroke-width="0.5"/>';
    if (!isP && !isS) return base;
    var grad = 'url(#grad-'+(isP?'primary':'secondary')+'-'+uid+')';
    var pcls = isP ? 'pulse-primary' : 'pulse-secondary';
    return base + '<ellipse class="muscle-overlay '+pcls+'" cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+grad+'" style="pointer-events:none"/>';
  }
  // Muscle label with leader line — only rendered when muscle is highlighted
  // lx,ly = text position; mx,my = arrow tip on muscle; side = 'l' or 'r'
  function LA(m, lx, ly, mx, my, text, side) {
    if (!primary.includes(m) && !secondary.includes(m)) return '';
    var col = primary.includes(m) ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.55)';
    var lc  = primary.includes(m) ? 'rgba(255,255,255,0.4)'  : 'rgba(255,255,255,0.22)';
    var anc = side === 'l' ? 'end' : 'start';
    return '<line x1="'+lx+'" y1="'+ly+'" x2="'+mx+'" y2="'+my+'" stroke="'+lc+'" stroke-width="0.7"/>'
         + '<circle cx="'+mx+'" cy="'+my+'" r="1" fill="'+col+'"/>'
         + '<text x="'+lx+'" y="'+ly+'" text-anchor="'+anc+'" dominant-baseline="middle" fill="'+col+'"'
         + ' font-size="6" font-family="Inter,system-ui,sans-serif" font-weight="600" style="pointer-events:none">'+text+'</text>';
  }

  var mw = maxWidth || 380;
  var sv = '<svg class="muscle-body-svg" id="'+uid+'-svg" viewBox="0 0 300 205" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:'+mw+'px;display:block;margin:0 auto">';
  sv += '<defs>'
    + '<radialGradient id="grad-rest-'+uid+'" cx="35%" cy="30%" r="75%">'
    +   '<stop offset="0%" stop-color="#c17165"/>'
    +   '<stop offset="100%" stop-color="#7a4038"/>'
    + '</radialGradient>'
    + '<radialGradient id="grad-primary-'+uid+'" cx="35%" cy="30%" r="75%">'
    +   '<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.95"/>'
    +   '<stop offset="100%" stop-color="var(--accent)" stop-opacity="0.55"/>'
    + '</radialGradient>'
    + '<radialGradient id="grad-secondary-'+uid+'" cx="35%" cy="30%" r="75%">'
    +   '<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.6"/>'
    +   '<stop offset="100%" stop-color="var(--accent)" stop-opacity="0.25"/>'
    + '</radialGradient>'
    + '</defs>';
  sv += '<g transform="translate(50,0)">';

  // ══════════ FRONT VIEW ══════════
  sv += '<g class="body-view body-view-front">';
  sv += '<text x="50" y="9" text-anchor="middle" fill="#2e2e4a" font-size="6.5" font-family="Inter,sans-serif" font-weight="800" letter-spacing="1">VORNE</text>';

  // ── FRONT: body base — oval head + tapered neck blending into sloped shoulders ──
  sv += E(50,16,8.5,10,bd);
  sv += P('M42,24 Q41,27 42,30 L58,30 Q59,27 58,24 Q54,26.5 50,26.5 Q46,26.5 42,24 Z',bd);
  sv += P('M28,39 Q30,32 38,30 Q44,28.5 50,28.5 Q56,28.5 62,30 Q70,32 72,39 C76,51 76,65 72,76 C71,83 68,89 68,96 L32,96 C32,89 29,83 28,76 C24,65 24,51 28,39 Z',bd);
  sv += P('M18,40 C14,52 14,66 16,73 Q18,77 21,77 Q24,77 27,72 C29,65 29,51 27,40 Z',bd);
  sv += P('M82,40 C86,52 86,66 84,73 Q82,77 79,77 Q76,77 73,72 C71,65 71,51 73,40 Z',bd);
  sv += P('M17,74 C14,85 15,96 17,102 Q19,105 22,105 Q25,105 27,102 C29,96 29,85 27,75 Z',bd);
  sv += P('M83,74 C86,85 85,96 83,102 Q81,105 78,105 Q75,105 73,102 C71,96 71,85 73,75 Z',bd);
  // Hands: fist-shaped with a thumb bump
  sv += P('M18,105 Q15,107 15,111 Q16,115 21,115.5 Q26,116 28,113 Q29,110 27,107 Q24,104.5 18,105 Z',bd);
  sv += E(25,104,2,2.8,bd);
  sv += P('M82,105 Q85,107 85,111 Q84,115 79,115.5 Q74,116 72,113 Q71,110 73,107 Q76,104.5 82,105 Z',bd);
  sv += E(75,104,2,2.8,bd);
  sv += P('M29,96 C25,114 26,134 28,147 Q32,154 38,154 Q44,154 47,147 C49,134 50,114 46,96 Z',bd);
  sv += P('M54,96 C50,114 51,134 53,147 Q56,154 62,154 Q68,154 71,147 C74,134 75,114 71,96 Z',bd);
  sv += P('M31,153 C28,166 28,178 30,185 Q33,190 38,190 Q43,189 46,185 C48,178 48,166 45,153 Z',bd);
  sv += P('M55,153 C52,166 52,178 54,185 Q57,190 62,190 Q67,189 70,185 C72,178 72,166 69,153 Z',bd);
  // Feet: heel narrower, toe box wider, angled outward from centerline
  sv += P('M44,190 Q40,189 36,190 Q30,192 27,196 Q26,199 31,200.5 Q37,201.5 42,200.5 Q46,199.5 46,195.5 Q46,192 44,190 Z',bd);
  sv += P('M56,190 Q60,189 64,190 Q70,192 73,196 Q74,199 69,200.5 Q63,201.5 58,200.5 Q54,199.5 54,195.5 Q54,192 56,190 Z',bd);

  // ── FRONT: muscles ──
  // Serratus anterior fingers
  sv += M('M30,62 L34,57 L36,61 L32,65 Z','abs');
  sv += M('M31,68 L35,63 L36,67 L32,71 Z','abs');
  sv += M('M32,74 L36,69 L37,73 L33,77 Z','abs');
  sv += M('M70,62 L66,57 L64,61 L68,65 Z','abs');
  sv += M('M69,68 L65,63 L64,67 L68,71 Z','abs');
  sv += M('M68,74 L64,69 L63,73 L67,77 Z','abs');
  // Anterior deltoid
  sv += M('M28,37 C20,35 16,42 16,57 Q17,66 22,69 Q28,71 32,64 Q33,54 31,42 Z','front_shoulder');
  sv += M('M72,37 C80,35 84,42 84,57 Q83,66 78,69 Q72,71 68,64 Q67,54 69,42 Z','front_shoulder');
  // Pec — clavicular head
  sv += M('M48,40 C44,37 38,34 31,38 C28,42 27,50 28,56 C32,60 40,62 48,60 Z','chest');
  sv += M('M52,40 C56,37 62,34 69,38 C72,42 73,50 72,56 C68,60 60,62 52,60 Z','chest');
  // Pec — sternal head
  sv += M('M48,60 C41,60 32,62 28,64 C25,68 26,74 28,76 C32,79 41,77 48,74 Z','chest');
  sv += M('M52,60 C59,60 68,62 72,64 C75,68 74,74 72,76 C68,79 59,77 52,74 Z','chest');
  // Rectus abdominis 3×2
  sv += EM(46,73,3,3.5,'abs'); sv += EM(54,73,3,3.5,'abs');
  sv += EM(46,82,3,3.5,'abs'); sv += EM(54,82,3,3.5,'abs');
  sv += EM(46,91,3,3.5,'abs'); sv += EM(54,91,3,3.5,'abs');
  // External obliques
  sv += M('M32,66 C29,74 28,84 32,93 Q35,97 39,95 Q40,88 40,78 Q39,69 36,65 Z','abs');
  sv += M('M68,66 C71,74 72,84 68,93 Q65,97 61,95 Q60,88 60,78 Q61,69 64,65 Z','abs');
  // Biceps brachii
  sv += EM(21,57,4,10,'biceps'); sv += EM(79,57,4,10,'biceps');
  // Brachialis
  sv += M('M16,58 C14,63 14,70 16,74 Q17,76 19,75 Q20,72 20,67 C20,62 19,58 17,57 Z','biceps');
  sv += M('M84,58 C86,63 86,70 84,74 Q83,76 81,75 Q80,72 80,67 C80,62 81,58 83,57 Z','biceps');
  // Forearms
  sv += M('M17,75 C15,85 16,96 17,102 Q19,105 22,105 Q24,105 26,102 C28,96 28,85 27,76 Z','forearms');
  sv += M('M83,75 C85,85 84,96 83,102 Q81,105 78,105 Q76,105 74,102 C72,96 72,85 73,76 Z','forearms');
  // Tensor fasciae latae
  sv += M('M29,94 Q25,98 25,105 Q27,109 31,109 Q34,107 34,101 Q34,95 32,93 Z','quads');
  sv += M('M71,94 Q75,98 75,105 Q73,109 69,109 Q66,107 66,101 Q66,95 68,93 Z','quads');
  // Quads VL + RF + VM
  sv += M('M29,97 C24,116 24,136 28,147 Q31,153 36,153 Q39,149 39,140 C39,124 36,109 35,97 Z','quads');
  sv += M('M36,97 C36,114 36,133 38,144 Q40,151 43,151 Q46,149 47,143 C48,130 48,111 46,97 Z','quads');
  sv += M('M36,136 Q32,139 31,147 Q32,153 36,154 Q42,153 44,148 Q45,142 44,138 Z','quads');
  sv += M('M71,97 C76,116 76,136 72,147 Q69,153 64,153 Q61,149 61,140 C61,124 64,109 65,97 Z','quads');
  sv += M('M64,97 C64,114 64,133 62,144 Q60,151 57,151 Q54,149 53,143 C52,130 52,111 54,97 Z','quads');
  sv += M('M64,136 Q68,139 69,147 Q68,153 64,154 Q58,153 56,148 Q55,142 56,138 Z','quads');
  // Tibialis anterior
  sv += M('M32,153 C29,164 29,175 32,182 Q34,186 37,186 Q39,184 39,179 C39,169 38,160 37,153 Z','calves');
  sv += M('M56,153 C53,164 53,175 56,182 Q58,186 61,186 Q63,184 63,179 C63,169 62,160 61,153 Z','calves');
  // Joints
  sv += J(28,44,3.2); sv += J(72,44,3.2);
  sv += J(21,74,3.2); sv += J(79,74,3.2);
  sv += J(38,153,4); sv += J(62,153,4);
  sv += J(38,190,2.4); sv += J(62,190,2.4);

  // Front figure labels (text at x=-2, arrows point right to muscle)
  sv += LA('front_shoulder', -2, 52,  22, 55, 'Schulter',   'l');
  sv += LA('chest',          -2, 63,  38, 63, 'Brust',      'l');
  sv += LA('biceps',         -2, 73,  19, 73, 'Bizeps',     'l');
  sv += LA('abs',            -2, 87,  44, 87, 'Bauch',      'l');
  sv += LA('forearms',       -2,100,  19,100, 'Unterarm',   'l');
  sv += LA('quads',          -2,127,  36,130, 'Quadrizeps', 'l');
  sv += LA('calves',         -2,168,  36,170, 'Waden',      'l');
  sv += '</g>'; // end front

  // ══════════ BACK VIEW ══════════
  sv += '<g class="body-view body-view-back">';
  sv += '<text x="150" y="9" text-anchor="middle" fill="#2e2e4a" font-size="6.5" font-family="Inter,sans-serif" font-weight="800" letter-spacing="1">HINTEN</text>';

  // ── BACK: body base — oval head + tapered neck blending into sloped shoulders ──
  var D = 100;
  sv += E(D+50,16,8.5,10,bd);
  sv += P('M'+(D+42)+',24 Q'+(D+41)+',27 '+(D+42)+',30 L'+(D+58)+',30 Q'+(D+59)+',27 '+(D+58)+',24 Q'+(D+54)+',26.5 '+(D+50)+',26.5 Q'+(D+46)+',26.5 '+(D+42)+',24 Z',bd);
  sv += P('M'+(D+28)+',39 Q'+(D+30)+',32 '+(D+38)+',30 Q'+(D+44)+',28.5 '+(D+50)+',28.5 Q'+(D+56)+',28.5 '+(D+62)+',30 Q'+(D+70)+',32 '+(D+72)+',39 C'+(D+76)+',51 '+(D+76)+',65 '+(D+72)+',76 C'+(D+71)+',83 '+(D+68)+',89 '+(D+68)+',96 L'+(D+32)+',96 C'+(D+32)+',89 '+(D+29)+',83 '+(D+28)+',76 C'+(D+24)+',65 '+(D+24)+',51 '+(D+28)+',39 Z',bd);
  sv += P('M'+(D+18)+',40 C'+(D+14)+',52 '+(D+14)+',66 '+(D+16)+',73 Q'+(D+18)+',77 '+(D+21)+',77 Q'+(D+24)+',77 '+(D+27)+',72 C'+(D+29)+',65 '+(D+29)+',51 '+(D+27)+',40 Z',bd);
  sv += P('M'+(D+82)+',40 C'+(D+86)+',52 '+(D+86)+',66 '+(D+84)+',73 Q'+(D+82)+',77 '+(D+79)+',77 Q'+(D+76)+',77 '+(D+73)+',72 C'+(D+71)+',65 '+(D+71)+',51 '+(D+73)+',40 Z',bd);
  sv += P('M'+(D+17)+',74 C'+(D+14)+',85 '+(D+15)+',96 '+(D+17)+',102 Q'+(D+19)+',105 '+(D+22)+',105 Q'+(D+25)+',105 '+(D+27)+',102 C'+(D+29)+',96 '+(D+29)+',85 '+(D+27)+',75 Z',bd);
  sv += P('M'+(D+83)+',74 C'+(D+86)+',85 '+(D+85)+',96 '+(D+83)+',102 Q'+(D+81)+',105 '+(D+78)+',105 Q'+(D+75)+',105 '+(D+73)+',102 C'+(D+71)+',96 '+(D+71)+',85 '+(D+73)+',75 Z',bd);
  // Hands: fist-shaped with a thumb bump
  sv += P('M'+(D+18)+',105 Q'+(D+15)+',107 '+(D+15)+',111 Q'+(D+16)+',115 '+(D+21)+',115.5 Q'+(D+26)+',116 '+(D+28)+',113 Q'+(D+29)+',110 '+(D+27)+',107 Q'+(D+24)+',104.5 '+(D+18)+',105 Z',bd);
  sv += E(D+25,104,2,2.8,bd);
  sv += P('M'+(D+82)+',105 Q'+(D+85)+',107 '+(D+85)+',111 Q'+(D+84)+',115 '+(D+79)+',115.5 Q'+(D+74)+',116 '+(D+72)+',113 Q'+(D+71)+',110 '+(D+73)+',107 Q'+(D+76)+',104.5 '+(D+82)+',105 Z',bd);
  sv += E(D+75,104,2,2.8,bd);
  sv += P('M'+(D+29)+',96 C'+(D+25)+',114 '+(D+26)+',134 '+(D+28)+',147 Q'+(D+32)+',154 '+(D+38)+',154 Q'+(D+44)+',154 '+(D+47)+',147 C'+(D+49)+',134 '+(D+50)+',114 '+(D+46)+',96 Z',bd);
  sv += P('M'+(D+54)+',96 C'+(D+50)+',114 '+(D+51)+',134 '+(D+53)+',147 Q'+(D+56)+',154 '+(D+62)+',154 Q'+(D+68)+',154 '+(D+71)+',147 C'+(D+74)+',134 '+(D+75)+',114 '+(D+71)+',96 Z',bd);
  sv += P('M'+(D+31)+',153 C'+(D+28)+',166 '+(D+28)+',178 '+(D+30)+',185 Q'+(D+33)+',190 '+(D+38)+',190 Q'+(D+43)+',189 '+(D+46)+',185 C'+(D+48)+',178 '+(D+48)+',166 '+(D+45)+',153 Z',bd);
  sv += P('M'+(D+55)+',153 C'+(D+52)+',166 '+(D+52)+',178 '+(D+54)+',185 Q'+(D+57)+',190 '+(D+62)+',190 Q'+(D+67)+',189 '+(D+70)+',185 C'+(D+72)+',178 '+(D+72)+',166 '+(D+69)+',153 Z',bd);
  // Feet: heel narrower, toe box wider, angled outward from centerline
  sv += P('M'+(D+44)+',190 Q'+(D+40)+',189 '+(D+36)+',190 Q'+(D+30)+',192 '+(D+27)+',196 Q'+(D+26)+',199 '+(D+31)+',200.5 Q'+(D+37)+',201.5 '+(D+42)+',200.5 Q'+(D+46)+',199.5 '+(D+46)+',195.5 Q'+(D+46)+',192 '+(D+44)+',190 Z',bd);
  sv += P('M'+(D+56)+',190 Q'+(D+60)+',189 '+(D+64)+',190 Q'+(D+70)+',192 '+(D+73)+',196 Q'+(D+74)+',199 '+(D+69)+',200.5 Q'+(D+63)+',201.5 '+(D+58)+',200.5 Q'+(D+54)+',199.5 '+(D+54)+',195.5 Q'+(D+54)+',192 '+(D+56)+',190 Z',bd);

  // ── BACK: muscles ──
  // Rhomboids
  sv += M('M'+(D+38)+',46 Q'+(D+32)+',52 '+(D+32)+',60 Q'+(D+36)+',65 '+(D+45)+',65 Q'+(D+50)+',62 '+(D+50)+',55 Q'+(D+48)+',47 '+(D+42)+',44 Z','upper_back');
  sv += M('M'+(D+62)+',46 Q'+(D+68)+',52 '+(D+68)+',60 Q'+(D+64)+',65 '+(D+55)+',65 Q'+(D+50)+',62 '+(D+50)+',55 Q'+(D+52)+',47 '+(D+58)+',44 Z','upper_back');
  // Infraspinatus
  sv += M('M'+(D+28)+',48 C'+(D+26)+',56 '+(D+28)+',64 '+(D+31)+',70 Q'+(D+36)+',74 '+(D+42)+',72 Q'+(D+47)+',68 '+(D+47)+',60 Q'+(D+45)+',50 '+(D+39)+',46 Z','rear_shoulder');
  sv += M('M'+(D+72)+',48 C'+(D+74)+',56 '+(D+72)+',64 '+(D+69)+',70 Q'+(D+64)+',74 '+(D+58)+',72 Q'+(D+53)+',68 '+(D+53)+',60 Q'+(D+55)+',50 '+(D+61)+',46 Z','rear_shoulder');
  // Trapezius
  sv += M('M'+(D+50)+',36 C'+(D+40)+',37 '+(D+29)+',40 '+(D+28)+',53 C'+(D+26)+',64 '+(D+33)+',73 '+(D+50)+',76 C'+(D+67)+',73 '+(D+74)+',64 '+(D+72)+',53 C'+(D+71)+',40 '+(D+60)+',37 '+(D+50)+',36 Z','upper_back');
  // Lats
  sv += M('M'+(D+28)+',54 C'+(D+19)+',68 '+(D+17)+',85 '+(D+22)+',96 Q'+(D+27)+',100 '+(D+32)+',96 Q'+(D+34)+',80 '+(D+32)+',66 Z','lats');
  sv += M('M'+(D+72)+',54 C'+(D+81)+',68 '+(D+83)+',85 '+(D+78)+',96 Q'+(D+73)+',100 '+(D+68)+',96 Q'+(D+66)+',80 '+(D+68)+',66 Z','lats');
  // Teres major
  sv += M('M'+(D+27)+',66 C'+(D+24)+',71 '+(D+24)+',78 '+(D+26)+',83 Q'+(D+28)+',85 '+(D+32)+',83 Q'+(D+33)+',77 '+(D+32)+',70 Z','lats');
  sv += M('M'+(D+73)+',66 C'+(D+76)+',71 '+(D+76)+',78 '+(D+74)+',83 Q'+(D+72)+',85 '+(D+68)+',83 Q'+(D+67)+',77 '+(D+68)+',70 Z','lats');
  // Erector spinae
  sv += M('M'+(D+44)+',76 C'+(D+43)+',84 '+(D+43)+',90 '+(D+44)+',96 L'+(D+47)+',96 C'+(D+47)+',90 '+(D+47)+',84 '+(D+47)+',76 Z','lower_back');
  sv += M('M'+(D+53)+',76 C'+(D+53)+',84 '+(D+53)+',90 '+(D+53)+',96 L'+(D+56)+',96 C'+(D+56)+',90 '+(D+56)+',84 '+(D+56)+',76 Z','lower_back');
  // Posterior deltoid
  sv += M('M'+(D+28)+',37 C'+(D+20)+',35 '+(D+16)+',42 '+(D+16)+',57 Q'+(D+17)+',66 '+(D+22)+',69 Q'+(D+28)+',71 '+(D+32)+',64 Q'+(D+33)+',54 '+(D+31)+',42 Z','rear_shoulder');
  sv += M('M'+(D+72)+',37 C'+(D+80)+',35 '+(D+84)+',42 '+(D+84)+',57 Q'+(D+83)+',66 '+(D+78)+',69 Q'+(D+72)+',71 '+(D+68)+',64 Q'+(D+67)+',54 '+(D+69)+',42 Z','rear_shoulder');
  // Triceps
  sv += M('M'+(D+18)+',41 C'+(D+14)+',53 '+(D+14)+',66 '+(D+16)+',73 Q'+(D+19)+',76 '+(D+21)+',75 Q'+(D+24)+',74 '+(D+26)+',70 C'+(D+28)+',63 '+(D+28)+',50 '+(D+26)+',41 Z','triceps');
  sv += M('M'+(D+82)+',41 C'+(D+86)+',53 '+(D+86)+',66 '+(D+84)+',73 Q'+(D+81)+',76 '+(D+79)+',75 Q'+(D+76)+',74 '+(D+74)+',70 C'+(D+72)+',63 '+(D+72)+',50 '+(D+74)+',41 Z','triceps');
  // Forearms back
  sv += M('M'+(D+17)+',75 C'+(D+15)+',85 '+(D+16)+',96 '+(D+17)+',102 Q'+(D+19)+',105 '+(D+22)+',105 Q'+(D+24)+',105 '+(D+26)+',102 C'+(D+28)+',96 '+(D+28)+',85 '+(D+27)+',76 Z','forearms');
  sv += M('M'+(D+83)+',75 C'+(D+85)+',85 '+(D+84)+',96 '+(D+83)+',102 Q'+(D+81)+',105 '+(D+78)+',105 Q'+(D+76)+',105 '+(D+74)+',102 C'+(D+72)+',96 '+(D+72)+',85 '+(D+73)+',76 Z','forearms');
  // Gluteus medius
  sv += M('M'+(D+29)+',86 Q'+(D+24)+',90 '+(D+24)+',100 Q'+(D+25)+',108 '+(D+32)+',110 Q'+(D+39)+',108 '+(D+40)+',100 Q'+(D+40)+',90 '+(D+35)+',85 Z','glutes');
  sv += M('M'+(D+71)+',86 Q'+(D+76)+',90 '+(D+76)+',100 Q'+(D+75)+',108 '+(D+68)+',110 Q'+(D+61)+',108 '+(D+60)+',100 Q'+(D+60)+',90 '+(D+65)+',85 Z','glutes');
  // Gluteus maximus
  sv += M('M'+(D+32)+',91 Q'+(D+25)+',96 '+(D+25)+',110 Q'+(D+26)+',122 '+(D+36)+',126 Q'+(D+44)+',125 '+(D+48)+',117 Q'+(D+49)+',105 '+(D+45)+',97 Z','glutes');
  sv += M('M'+(D+68)+',91 Q'+(D+75)+',96 '+(D+75)+',110 Q'+(D+74)+',122 '+(D+64)+',126 Q'+(D+56)+',125 '+(D+52)+',117 Q'+(D+51)+',105 '+(D+55)+',97 Z','glutes');
  // Hamstrings BF + ST
  sv += M('M'+(D+29)+',98 C'+(D+24)+',116 '+(D+24)+',136 '+(D+28)+',147 Q'+(D+31)+',153 '+(D+36)+',153 Q'+(D+40)+',149 '+(D+40)+',140 C'+(D+40)+',124 '+(D+37)+',109 '+(D+35)+',98 Z','hamstrings');
  sv += M('M'+(D+37)+',98 C'+(D+40)+',112 '+(D+42)+',130 '+(D+42)+',143 Q'+(D+41)+',151 '+(D+39)+',153 Q'+(D+44)+',152 '+(D+48)+',146 C'+(D+50)+',134 '+(D+49)+',113 '+(D+47)+',98 Z','hamstrings');
  sv += M('M'+(D+71)+',98 C'+(D+76)+',116 '+(D+76)+',136 '+(D+72)+',147 Q'+(D+69)+',153 '+(D+64)+',153 Q'+(D+60)+',149 '+(D+60)+',140 C'+(D+60)+',124 '+(D+63)+',109 '+(D+65)+',98 Z','hamstrings');
  sv += M('M'+(D+63)+',98 C'+(D+60)+',112 '+(D+58)+',130 '+(D+58)+',143 Q'+(D+59)+',151 '+(D+61)+',153 Q'+(D+56)+',152 '+(D+52)+',146 C'+(D+50)+',134 '+(D+51)+',113 '+(D+53)+',98 Z','hamstrings');
  // Soleus
  sv += M('M'+(D+29)+',158 C'+(D+26)+',168 '+(D+26)+',179 '+(D+28)+',185 Q'+(D+32)+',190 '+(D+38)+',190 Q'+(D+44)+',190 '+(D+48)+',185 C'+(D+50)+',179 '+(D+49)+',168 '+(D+47)+',158 Z','calves');
  sv += M('M'+(D+53)+',158 C'+(D+50)+',168 '+(D+50)+',179 '+(D+52)+',185 Q'+(D+56)+',190 '+(D+62)+',190 Q'+(D+68)+',190 '+(D+72)+',185 C'+(D+74)+',179 '+(D+73)+',168 '+(D+71)+',158 Z','calves');
  // Gastrocnemius
  sv += M('M'+(D+31)+',154 C'+(D+27)+',164 '+(D+27)+',174 '+(D+29)+',182 Q'+(D+32)+',187 '+(D+38)+',187 Q'+(D+44)+',187 '+(D+47)+',182 C'+(D+49)+',174 '+(D+48)+',164 '+(D+45)+',154 Z','calves');
  sv += M('M'+(D+55)+',154 C'+(D+51)+',164 '+(D+51)+',174 '+(D+53)+',182 Q'+(D+56)+',187 '+(D+62)+',187 Q'+(D+68)+',187 '+(D+71)+',182 C'+(D+73)+',174 '+(D+72)+',164 '+(D+69)+',154 Z','calves');
  // Joints
  sv += J(D+28,44,3.2); sv += J(D+72,44,3.2);
  sv += J(D+21,74,3.2); sv += J(D+79,74,3.2);
  sv += J(D+38,153,4); sv += J(D+62,153,4);
  sv += J(D+38,190,2.4); sv += J(D+62,190,2.4);

  // Back figure labels (text at x=197, arrows point left to muscle)
  sv += LA('rear_shoulder',  197, 52, 178, 55, 'Schulter',  'r');
  sv += LA('triceps',        197, 62, 178, 62, 'Trizeps',   'r');
  sv += LA('upper_back',     197, 71, 165, 60, 'Trapez',    'r');
  sv += LA('lats',           197, 80, 171, 78, 'Lat',       'r');
  sv += LA('lower_back',     197, 90, 165, 90, 'Lende',     'r');
  sv += LA('glutes',         197,113, 162,113, 'Gesäß',    'r');
  sv += LA('hamstrings',     197,128, 164,130, 'Hamstring', 'r');
  sv += LA('calves',         197,168, 162,170, 'Wade',      'r');
  sv += '</g>'; // end back

  sv += '</g>';
  sv += '<line class="mm-divider" x1="150" y1="6" x2="150" y2="200" stroke="#0c0c18" stroke-width="2"/>';
  sv += '</svg>';

  var primArr = '[' + primary.map(function(m) { return "'" + m + "'"; }).join(',') + ']';
  var secArr = '[' + secondary.map(function(m) { return "'" + m + "'"; }).join(',') + ']';
  var tabsHtml = '<div class="mm-tabs">'
    + '<button type="button" class="mm-tab active" data-view="both" onclick="toggleBodyView(\''+uid+'\',\'both\',this)">Beide</button>'
    + '<button type="button" class="mm-tab" data-view="front" onclick="toggleBodyView(\''+uid+'\',\'front\',this)">Vorne</button>'
    + '<button type="button" class="mm-tab" data-view="back" onclick="toggleBodyView(\''+uid+'\',\'back\',this)">Hinten</button>'
    + '<button type="button" class="mm-tab mm-tab-3d" onclick="open3DMuscleView('+primArr+','+secArr+')">🔄 3D</button>'
    + '</div>';

  var legendHtml = '<div class="mm-legend">'
    + '<span class="mm-legend-item"><span class="mm-legend-swatch" style="background:var(--accent)"></span>Hauptmuskel</span>'
    + '<span class="mm-legend-item"><span class="mm-legend-swatch" style="background:var(--accent);opacity:0.5"></span>Hilfsmuskel</span>'
    + '<span class="mm-legend-item mm-legend-hint">Muskel antippen für Details</span>'
    + '</div>';

  return '<div class="mm-wrap" id="'+uid+'">' + tabsHtml + sv + legendHtml + '</div>';
}

function toggleBodyView(uid, view, btn) {
  var wrap = document.getElementById(uid);
  var svg = document.getElementById(uid + '-svg');
  if (!wrap || !svg) return;
  wrap.querySelectorAll('.mm-tab').forEach(function(b) { b.classList.toggle('active', b === btn); });
  var front = svg.querySelector('.body-view-front');
  var back = svg.querySelector('.body-view-back');
  if (view === 'both') {
    front.style.display = ''; back.style.display = '';
    svg.setAttribute('viewBox', '0 0 300 205');
    return;
  }
  var active = view === 'front' ? front : back;
  var other = view === 'front' ? back : front;
  active.style.display = ''; other.style.display = 'none';
  try {
    var bb = active.getBBox();
    var pad = 8;
    svg.setAttribute('viewBox', (bb.x - pad) + ' ' + (bb.y - pad) + ' ' + (bb.width + pad * 2) + ' ' + (bb.height + pad * 2));
  } catch (e) {}
}

// ── 3D rotatable/zoomable muscle mannequin (Three.js, lazy-loaded on demand) ──
var _threeModulePromise = null;
function loadThreeModules() {
  if (!_threeModulePromise) {
    _threeModulePromise = Promise.all([
      import('./vendor/three.module.js'),
      import('./vendor/OrbitControls.js')
    ]);
  }
  return _threeModulePromise;
}

// Procedurally draws a muscle-fiber striation pattern (original, code-generated — not traced from any
// reference) and returns it as a reusable grayscale bump map so lighting picks up fiber-like relief.
var _fiberBumpTexture = null;
function makeFiberBumpTexture(THREE) {
  if (_fiberBumpTexture) return _fiberBumpTexture;
  var size = 256;
  var canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (var i = 0; i < 240; i++) {
    var x = Math.random() * size;
    var wobble = (Math.random() - 0.5) * 16;
    var shade = 120 + Math.random() * 75;
    ctx.strokeStyle = 'rgba(' + shade + ',' + shade + ',' + shade + ',0.5)';
    ctx.lineWidth = 0.6 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, -4);
    ctx.bezierCurveTo(x + wobble, size * 0.33, x - wobble, size * 0.66, x + wobble * 0.5, size + 4);
    ctx.stroke();
  }
  for (var j = 0; j < 70; j++) {
    var gx = Math.random() * size;
    ctx.strokeStyle = 'rgba(35,35,35,0.22)';
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(gx, -4);
    ctx.lineTo(gx + (Math.random() - 0.5) * 12, size + 4);
    ctx.stroke();
  }
  var tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 4);
  _fiberBumpTexture = tex;
  return tex;
}

async function open3DMuscleView(primary, secondary) {
  primary = primary || [];
  secondary = secondary || [];

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal modal-3d">'
    + '<div class="modal-header"><span class="modal-title">3D-Muskelmodell</span>'
    + '<button class="modal-close" id="m3d-close">&#x2715;</button></div>'
    + '<div class="muscle3d-host" id="m3d-host"><div class="muscle3d-loading">Lade 3D-Modell…</div></div>'
    + '<div class="muscle3d-hint">Ziehen zum Drehen · Scrollen/Pinch zum Zoomen · Muskel antippen für Details</div>'
    + '</div>';
  document.body.appendChild(overlay);
  document.getElementById('m3d-close').addEventListener('click', closeThis);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeThis(); });

  var cleanup = null;
  function closeThis() {
    if (cleanup) cleanup();
    overlay.remove();
  }

  var mods;
  try {
    mods = await loadThreeModules();
  } catch (e) {
    document.getElementById('m3d-host').innerHTML = '<div class="muscle3d-loading">3D-Modell konnte nicht geladen werden.</div>';
    return;
  }
  if (!document.body.contains(overlay)) return; // closed while loading
  var THREE = mods[0];
  var OrbitControls = mods[1].OrbitControls;

  var host = document.getElementById('m3d-host');
  host.innerHTML = '';
  var w = host.clientWidth || 600, h = host.clientHeight || 500;

  var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4f7ef8';
  var surface2 = getComputedStyle(document.documentElement).getPropertyValue('--surface2').trim() || '#1f1f27';
  var restColor = 0x8a5548;
  var restColorDark = 0x6e4038;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(surface2);

  var camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
  camera.position.set(0, 1.15, 2.6);

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  host.appendChild(renderer.domElement);

  var controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.05, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.1;
  controls.maxDistance = 4.2;
  controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  var keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(2, 3.5, 3);
  scene.add(keyLight);
  var fillLight = new THREE.DirectionalLight(0xaac0ff, 0.3);
  fillLight.position.set(-3, 1, -2);
  scene.add(fillLight);
  var rakingLight = new THREE.DirectionalLight(0xffe8cc, 0.55);
  rakingLight.position.set(0.3, 1.35, 0.9);
  scene.add(rakingLight);

  var groundGeo = new THREE.CircleGeometry(0.55, 32);
  var groundMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 });
  var ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.01;
  scene.add(ground);

  var body = new THREE.Group();
  scene.add(body);

  var pulseMeshes = []; // { mesh, isPrimary }

  var fiberBump = makeFiberBumpTexture(THREE);
  var restToneVariants = [0x8a5548, 0x7e4a3f, 0x955c4c, 0x714236, 0x86503f];
  var toneCounter = 0;

  function restMaterial(dark, variantIdx) {
    var color = dark ? restColorDark : (variantIdx != null ? restToneVariants[variantIdx % restToneVariants.length] : restColor);
    return new THREE.MeshPhysicalMaterial({
      color: color, roughness: 0.58, metalness: 0.03,
      clearcoat: 0.08, clearcoatRoughness: 0.5,
      bumpMap: fiberBump, bumpScale: 0.014
    });
  }
  function accentMaterial() {
    return new THREE.MeshPhysicalMaterial({
      color: accent, emissive: accent, emissiveIntensity: 0.5,
      roughness: 0.42, metalness: 0.06, clearcoat: 0.12, clearcoatRoughness: 0.35,
      bumpMap: fiberBump, bumpScale: 0.01
    });
  }
  function tendonMaterial() {
    return new THREE.MeshPhysicalMaterial({ color: 0xb89a7a, roughness: 0.65 });
  }

  // Adds a mesh; if `key` is a tracked muscle, colors it by primary/secondary/rest and registers it for pulsing.
  function addPart(geometry, position, rotation, key, opts) {
    opts = opts || {};
    var isP = key && primary.includes(key);
    var isS = !isP && key && secondary.includes(key);
    var mat = (isP || isS) ? accentMaterial() : restMaterial(opts.dark, key ? toneCounter++ : null);
    var mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (opts.scale) mesh.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    if (key) mesh.userData.muscleKey = key;
    body.add(mesh);
    if (isP || isS) pulseMeshes.push({ mesh: mesh, isPrimary: isP });
    return mesh;
  }
  function addJoint(position, r) {
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), tendonMaterial());
    mesh.position.set(position[0], position[1], position[2]);
    body.add(mesh);
    return mesh;
  }

  // ── Head & neck ──
  addPart(new THREE.SphereGeometry(0.115, 20, 16), [0, 1.63, 0], null, null, { scale: [1, 1.15, 0.95] });
  addPart(new THREE.CapsuleGeometry(0.06, 0.06, 4, 12), [0, 1.52, 0], null, null);

  // ── Torso ──
  addPart(new THREE.CapsuleGeometry(0.175, 0.16, 4, 16), [0, 1.38, 0], null, null, { scale: [1, 1, 0.72] });
  addPart(new THREE.CapsuleGeometry(0.145, 0.14, 4, 16), [0, 1.19, 0], null, null, { scale: [1, 1, 0.68] });
  // Pecs (front) — flatter, closer together, less "balloon" protrusion
  addPart(new THREE.SphereGeometry(0.075, 16, 12), [-0.072, 1.41, 0.085], null, 'chest', { scale: [1.3, 0.78, 0.4] });
  addPart(new THREE.SphereGeometry(0.075, 16, 12), [0.072, 1.41, 0.085], null, 'chest', { scale: [1.3, 0.78, 0.4] });
  // Abs (front)
  [1.32, 1.25, 1.18].forEach(function(y) {
    addPart(new THREE.SphereGeometry(0.024, 10, 8), [-0.045, y, 0.135], null, 'abs');
    addPart(new THREE.SphereGeometry(0.024, 10, 8), [0.045, y, 0.135], null, 'abs');
  });
  // Obliques (sides of waist)
  addPart(new THREE.CapsuleGeometry(0.032, 0.11, 4, 8), [-0.165, 1.20, 0.02], [0, 0, 0.12], 'abs');
  addPart(new THREE.CapsuleGeometry(0.032, 0.11, 4, 8), [0.165, 1.20, 0.02], [0, 0, -0.12], 'abs');
  // Traps + lower back (back)
  addPart(new THREE.SphereGeometry(0.13, 16, 12), [0, 1.43, -0.085], null, 'upper_back', { scale: [0.95, 1.25, 0.35] });
  addPart(new THREE.CapsuleGeometry(0.03, 0.09, 4, 8), [-0.035, 1.15, -0.115], null, 'lower_back');
  addPart(new THREE.CapsuleGeometry(0.03, 0.09, 4, 8), [0.035, 1.15, -0.115], null, 'lower_back');
  // Lats (back sides)
  addPart(new THREE.CapsuleGeometry(0.05, 0.16, 4, 10), [-0.175, 1.22, -0.06], null, 'lats');
  addPart(new THREE.CapsuleGeometry(0.05, 0.16, 4, 10), [0.175, 1.22, -0.06], null, 'lats');

  // ── Shoulders & arms ──
  [-1, 1].forEach(function(side) {
    var sx = side * 0.245;
    addJoint([sx, 1.46, 0], 0.05);
    addPart(new THREE.SphereGeometry(0.045, 14, 12), [sx, 1.46, 0.04], null, 'front_shoulder');
    addPart(new THREE.SphereGeometry(0.045, 14, 12), [sx, 1.46, -0.04], null, 'rear_shoulder');

    var armTilt = side * 0.16;
    // Upper-arm shaft (rest-colored, shows through at the sides between biceps/triceps)
    addPart(new THREE.CapsuleGeometry(0.044, 0.16, 4, 10), [sx + side * 0.015, 1.28, 0], [0, 0, armTilt], null);
    addPart(new THREE.CapsuleGeometry(0.03, 0.12, 4, 10), [sx + side * 0.02, 1.28, 0.028], [0, 0, armTilt], 'biceps');
    addPart(new THREE.CapsuleGeometry(0.03, 0.12, 4, 10), [sx + side * 0.02, 1.28, -0.028], [0, 0, armTilt], 'triceps');

    addJoint([sx + side * 0.035, 1.155, 0], 0.032);

    addPart(new THREE.CapsuleGeometry(0.04, 0.18, 4, 10), [sx + side * 0.045, 1.01, 0], [0, 0, armTilt * 0.6], 'forearms');

    addPart(new THREE.SphereGeometry(0.04, 12, 10), [sx + side * 0.06, 0.865, 0], null, null, { scale: [0.85, 1.15, 0.55] });
    addPart(new THREE.SphereGeometry(0.02, 8, 8), [sx + side * 0.09, 0.885, 0.01], null, null);
  });

  // ── Hips, glutes, legs ──
  addPart(new THREE.SphereGeometry(0.07, 14, 12), [-0.10, 0.96, -0.045], null, 'glutes', { scale: [1.1, 1, 0.75] });
  addPart(new THREE.SphereGeometry(0.07, 14, 12), [0.10, 0.96, -0.045], null, 'glutes', { scale: [1.1, 1, 0.75] });

  [-1, 1].forEach(function(side) {
    var lx = side * 0.115;
    addJoint([lx, 0.965, 0], 0.036);
    // Thigh shaft (rest-colored, shows through at the sides between quads/hamstrings)
    addPart(new THREE.CapsuleGeometry(0.072, 0.20, 4, 10), [lx, 0.78, 0], null, null, { scale: [1, 1, 0.85] });
    addPart(new THREE.CapsuleGeometry(0.05, 0.17, 4, 10), [lx, 0.79, 0.045], null, 'quads');
    addPart(new THREE.CapsuleGeometry(0.05, 0.17, 4, 10), [lx, 0.79, -0.045], null, 'hamstrings');

    addJoint([lx, 0.60, 0], 0.04);

    addPart(new THREE.CapsuleGeometry(0.065, 0.20, 4, 10), [lx, 0.435, 0], null, 'calves');

    addJoint([lx, 0.275, 0], 0.03);

    var foot = addPart(new THREE.CapsuleGeometry(0.045, 0.13, 4, 8), [lx, 0.235, 0.06], null, null);
    foot.rotation.x = Math.PI / 2;
  });

  // ── Pulsing highlight animation + render loop ──
  var raf = null;
  var clock = new THREE.Clock();
  function animate() {
    raf = requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    pulseMeshes.forEach(function(p) {
      var speed = p.isPrimary ? 2.6 : 3.4;
      var base = p.isPrimary ? 0.55 : 0.32;
      var amp = p.isPrimary ? 0.45 : 0.25;
      p.mesh.material.emissiveIntensity = base + Math.sin(t * speed) * amp * 0.5 + amp * 0.5;
    });
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // ── Tap/click a muscle part for its name ──
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var tip = null;
  function hideTip() { if (tip) { tip.remove(); tip = null; } }
  function onPointerDown(e) {
    var rect = renderer.domElement.getBoundingClientRect();
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    var cy = e.touches ? e.touches[0].clientY : e.clientY;
    pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObjects(body.children, false);
    hideTip();
    if (!hits.length) return;
    var key = hits[0].object.userData.muscleKey;
    if (!key) return; // hit the plain body silhouette, not a named muscle
    var label = MUSCLE_LABELS[key] || key;
    var isP = primary.includes(key), isS = !isP && secondary.includes(key);
    var status = isP ? 'Hauptmuskel dieser Übung(en)' : isS ? 'Hilfsmuskel' : 'Nicht direkt beansprucht';
    tip = document.createElement('div');
    tip.className = 'mm-tooltip';
    tip.innerHTML = '<strong>' + label + '</strong><span>' + status + '</span>';
    document.body.appendChild(tip);
    tip.style.left = Math.max(8, Math.min(cx - tip.offsetWidth / 2, window.innerWidth - tip.offsetWidth - 8)) + 'px';
    tip.style.top = Math.max(8, cy - tip.offsetHeight - 14) + 'px';
    setTimeout(hideTip, 2600);
  }
  renderer.domElement.addEventListener('pointerup', onPointerDown);

  // ── Resize handling ──
  var resizeObserver = new ResizeObserver(function() {
    var nw = host.clientWidth, nh = host.clientHeight;
    if (!nw || !nh) return;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
  resizeObserver.observe(host);

  cleanup = function() {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    renderer.domElement.removeEventListener('pointerup', onPointerDown);
    hideTip();
    controls.dispose();
    renderer.dispose();
    body.traverse(function(o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  };
}

// Tap/click any muscle shape to see its name and role (delegated, works for every muscle map on the page)
(function() {
  var tip = null;
  function hideTip() { if (tip) { tip.remove(); tip = null; } }
  document.addEventListener('click', function(e) {
    var shape = e.target.closest && e.target.closest('.muscle-shape');
    if (!shape) { hideTip(); return; }
    e.stopPropagation();
    var key = shape.getAttribute('data-m');
    var label = MUSCLE_LABELS[key] || key;
    var status = shape.classList.contains('m-primary') ? 'Hauptmuskel dieser Übung(en)'
      : shape.classList.contains('m-secondary') ? 'Hilfsmuskel'
      : 'Nicht direkt beansprucht';
    hideTip();
    tip = document.createElement('div');
    tip.className = 'mm-tooltip';
    tip.innerHTML = '<strong>' + label + '</strong><span>' + status + '</span>';
    document.body.appendChild(tip);
    var rect = shape.getBoundingClientRect();
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = rect.left + rect.width / 2 - tw / 2;
    var y = rect.top - th - 10;
    if (y < 8) y = rect.bottom + 10;
    x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    setTimeout(hideTip, 2600);
  });
  document.addEventListener('keydown', function(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('muscle-shape')) {
      e.preventDefault();
      e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  document.addEventListener('scroll', hideTip, true);
})();

const DAYS = [
  { key: 'monday',    short: 'Mo', label: 'Montag'     },
  { key: 'tuesday',   short: 'Di', label: 'Dienstag'   },
  { key: 'wednesday', short: 'Mi', label: 'Mittwoch'   },
  { key: 'thursday',  short: 'Do', label: 'Donnerstag' },
  { key: 'friday',    short: 'Fr', label: 'Freitag'    },
  { key: 'saturday',  short: 'Sa', label: 'Samstag'    },
  { key: 'sunday',    short: 'So', label: 'Sonntag'    },
];

function getTodayKey() {
  const map = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return map[new Date().getDay()];
}

function getDayIndex(key) {
  return DAYS.findIndex(d => d.key === key);
}

// ── Global State ──────────────────────────────────────────────

let activePage = 'heute';
let activeWorkout = null;
let workoutStartTime = null;
let mainTimerInterval = null;
let restTimerInterval = null;
let restSecsRemaining = 0;
let restSecsTotal = parseInt(localStorage.getItem('restSecs') || '90');

// ── Default Templates ─────────────────────────────────────────

const DEFAULT_PLANS = [
  {
    name: 'Push Day',
    muscleGroup: 'Brust',
    exercises: [
      { name: 'Bankdrücken',                sets: 4, reps: 8,  weight: 60 },
      { name: 'Schrägbankdrücken (oben)',    sets: 3, reps: 10, weight: 50 },
      { name: 'Schulterdrücken Stange',      sets: 3, reps: 10, weight: 40 },
      { name: 'Seitheben',                   sets: 3, reps: 15, weight: 10 },
      { name: 'Trizepsdrücken Kabel',        sets: 3, reps: 12, weight: 25 },
      { name: 'Skull Crusher',               sets: 3, reps: 10, weight: 20 },
    ]
  },
  {
    name: 'Pull Day',
    muscleGroup: 'Rücken',
    exercises: [
      { name: 'Klimmzüge',                   sets: 4, reps: 8,  weight: 0  },
      { name: 'Rudern Stange',               sets: 4, reps: 8,  weight: 60 },
      { name: 'Latzug weit',                 sets: 3, reps: 10, weight: 55 },
      { name: 'Rudern Kabel',                sets: 3, reps: 12, weight: 40 },
      { name: 'Bizepscurls Stange',          sets: 3, reps: 10, weight: 30 },
      { name: 'Hammercurls',                 sets: 3, reps: 12, weight: 14 },
    ]
  },
  {
    name: 'Beine',
    muscleGroup: 'Beine',
    exercises: [
      { name: 'Kniebeugen',                  sets: 4, reps: 8,  weight: 80 },
      { name: 'Beinpresse',                  sets: 4, reps: 10, weight: 120},
      { name: 'Romanian Deadlift',           sets: 3, reps: 10, weight: 60 },
      { name: 'Beinstrecker',                sets: 3, reps: 12, weight: 50 },
      { name: 'Beinbeuger',                  sets: 3, reps: 12, weight: 40 },
      { name: 'Wadenheben',                  sets: 4, reps: 15, weight: 60 },
    ]
  },
  {
    name: 'Schultern & Arme',
    muscleGroup: 'Schultern',
    exercises: [
      { name: 'Schulterdrücken KH',          sets: 4, reps: 10, weight: 20 },
      { name: 'Seitheben',                   sets: 3, reps: 15, weight: 8  },
      { name: 'Face Pulls',                  sets: 3, reps: 15, weight: 20 },
      { name: 'Bizepscurls KH',              sets: 3, reps: 12, weight: 14 },
      { name: 'Konzentrationscurls',         sets: 3, reps: 12, weight: 12 },
      { name: 'Trizeps Dips',                sets: 3, reps: 12, weight: 0  },
      { name: 'Overhead Extension',          sets: 3, reps: 12, weight: 20 },
    ]
  },
  {
    name: 'Upper Body',
    muscleGroup: 'Brust',
    exercises: [
      { name: 'Bankdrücken',                 sets: 3, reps: 8,  weight: 60 },
      { name: 'Rudern Stange',               sets: 3, reps: 10, weight: 50 },
      { name: 'Schulterdrücken Stange',      sets: 3, reps: 10, weight: 40 },
      { name: 'Latzug eng',                  sets: 3, reps: 10, weight: 50 },
      { name: 'Bizepscurls Stange',          sets: 2, reps: 12, weight: 30 },
      { name: 'Trizepsdrücken Kabel',        sets: 2, reps: 12, weight: 22 },
    ]
  },
  {
    name: 'Ganzkörper',
    muscleGroup: 'Ganzkörper',
    exercises: [
      { name: 'Kniebeugen',                  sets: 3, reps: 8,  weight: 60 },
      { name: 'Bankdrücken',                 sets: 3, reps: 8,  weight: 60 },
      { name: 'Kreuzheben',                  sets: 3, reps: 6,  weight: 80 },
      { name: 'Schulterdrücken KH',          sets: 3, reps: 10, weight: 18 },
      { name: 'Klimmzüge',                   sets: 3, reps: 8,  weight: 0  },
      { name: 'Plank',                       sets: 3, reps: 60, weight: 0  },
    ]
  },
  {
    name: 'Brust & Trizeps',
    muscleGroup: 'Brust',
    exercises: [
      { name: 'Bankdrücken',                 sets: 4, reps: 8,  weight: 60 },
      { name: 'Schrägbankdrücken (oben)',    sets: 3, reps: 10, weight: 50 },
      { name: 'Kurzhantel Fliegende',        sets: 3, reps: 12, weight: 14 },
      { name: 'Dips',                        sets: 3, reps: 12, weight: 0  },
      { name: 'Skull Crusher',               sets: 3, reps: 10, weight: 20 },
      { name: 'Trizepsdrücken Kabel',        sets: 3, reps: 12, weight: 22 },
    ]
  },
  {
    name: 'Rücken & Bizeps',
    muscleGroup: 'Rücken',
    exercises: [
      { name: 'Kreuzheben',                  sets: 4, reps: 5,  weight: 100},
      { name: 'Latzug weit',                 sets: 3, reps: 10, weight: 55 },
      { name: 'Rudern Kurzhantel',           sets: 3, reps: 10, weight: 24 },
      { name: 'Hyperextension',              sets: 3, reps: 12, weight: 0  },
      { name: 'Bizepscurls Stange',          sets: 3, reps: 10, weight: 30 },
      { name: 'Preacher Curls',              sets: 3, reps: 12, weight: 20 },
    ]
  },
  {
    name: 'Bauch',
    muscleGroup: 'Bauch',
    exercises: [
      { name: 'Crunches',                    sets: 3, reps: 20, weight: 0  },
      { name: 'Leg Raises (hängend)',        sets: 3, reps: 12, weight: 0  },
      { name: 'Plank',                       sets: 3, reps: 60, weight: 0  },
    ]
  },
  {
    name: 'Bauch & Core',
    muscleGroup: 'Bauch',
    exercises: [
      { name: 'Crunches',                    sets: 4, reps: 20, weight: 0  },
      { name: 'Leg Raises (hängend)',        sets: 3, reps: 12, weight: 0  },
      { name: 'Plank',                       sets: 3, reps: 60, weight: 0  },
      { name: 'Russian Twists (mit Gewicht)',sets: 3, reps: 20, weight: 8  },
      { name: 'Bicycle Crunches',            sets: 3, reps: 20, weight: 0  },
      { name: 'Ab Roller (kniend)',          sets: 3, reps: 10, weight: 0  },
    ]
  },
  {
    name: 'Bauch Intensiv',
    muscleGroup: 'Bauch',
    exercises: [
      { name: 'Toes to Bar',                 sets: 4, reps: 10, weight: 0  },
      { name: 'Kabel Crunch (kniend)',       sets: 3, reps: 15, weight: 30 },
      { name: 'Decline Crunches',            sets: 3, reps: 15, weight: 0  },
      { name: 'Woodchoppers (Kabel, oben nach unten)', sets: 3, reps: 12, weight: 15 },
      { name: 'Hollow Body Hold',            sets: 3, reps: 30, weight: 0  },
      { name: 'Dragon Flag',                 sets: 3, reps: 6,  weight: 0  },
    ]
  },
  {
    name: 'Bauch & Beine',
    muscleGroup: 'Bauch & Beine',
    exercises: []
  },
  {
    name: 'Cardio',
    muscleGroup: 'Cardio',
    exercises: [
      { name: 'Laufen (Laufband)',           sets: 1, reps: 30, weight: 0  },
      { name: 'Rudergerät',                  sets: 4, reps: 5,  weight: 0  },
      { name: 'Fahrradergometer',            sets: 1, reps: 20, weight: 0  },
      { name: 'Jumping Jacks',               sets: 3, reps: 50, weight: 0  },
      { name: 'Burpees',                     sets: 4, reps: 10, weight: 0  },
    ]
  },
  {
    name: 'Beine & Gesäß',
    muscleGroup: 'Beine',
    exercises: [
      { name: 'Kniebeugen',                  sets: 4, reps: 8,  weight: 80 },
      { name: 'Ausfallschritte (Langhantel)',sets: 3, reps: 10, weight: 40 },
      { name: 'Rumänisches Kreuzheben',      sets: 3, reps: 10, weight: 60 },
      { name: 'Hip Thrust (Langhantel)',     sets: 4, reps: 12, weight: 80 },
      { name: 'Beinbeuger (Maschine)',       sets: 3, reps: 12, weight: 40 },
      { name: 'Wadenheben stehend (Maschine)', sets: 4, reps: 15, weight: 60 },
    ]
  },
  {
    name: 'Schultern',
    muscleGroup: 'Schultern',
    exercises: [
      { name: 'Military Press',              sets: 4, reps: 8,  weight: 50 },
      { name: 'Seitheben (Kurzhanteln)',     sets: 4, reps: 15, weight: 10 },
      { name: 'Frontheben (Kurzhanteln)',    sets: 3, reps: 12, weight: 10 },
      { name: 'Face Pulls',                  sets: 3, reps: 15, weight: 20 },
      { name: 'Upright Row (Langhantel)',    sets: 3, reps: 12, weight: 30 },
      { name: 'Shrugs mit Langhantel',       sets: 3, reps: 15, weight: 60 },
    ]
  },
  {
    name: 'Arme',
    muscleGroup: 'Arme',
    exercises: [
      { name: 'Bizepscurls Stange',          sets: 4, reps: 10, weight: 30 },
      { name: 'Hammercurls',                 sets: 3, reps: 12, weight: 14 },
      { name: 'Konzentrationscurls',         sets: 3, reps: 12, weight: 12 },
      { name: 'Trizepsdrücken Kabel',        sets: 4, reps: 12, weight: 25 },
      { name: 'Skull Crusher',               sets: 3, reps: 10, weight: 20 },
      { name: 'Overhead Extension',          sets: 3, reps: 12, weight: 20 },
    ]
  },
];

async function seedDefaultPlans() {
  const existing = await dbGetAll('plans');
  const existingNames = new Set(existing.map(p => p.name));
  for (const plan of DEFAULT_PLANS) {
    if (existingNames.has(plan.name)) continue;
    // Only create the plan template — no exercises pre-filled (user adds their own)
    await dbAdd('plans', { name: plan.name, muscleGroup: plan.muscleGroup, createdAt: Date.now() });
  }
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  var t = localStorage.getItem('fittracker_theme') || 'dark';
  if (t !== 'dark') document.documentElement.setAttribute('data-theme', t);
  showAuthOverlay();
  if (!_supabase) {
    document.getElementById('auth-error').textContent = 'Verbindungsfehler – bitte Seite neu laden.';
    return;
  }
  try {
    var sessionResult = await _supabase.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    if (session && session.user) {
      _currentUser = session.user;
      await onLogin();
    }
  } catch(e) {
    console.error('Auth error:', e);
  }
}

// Merges saved custom exercises into EXERCISE_LIBRARY and EXERCISE_MUSCLE
async function loadCustomExercisesIntoLibrary() {
  const customs = await dbGetAll('customExercises');
  for (const cx of customs) {
    if (!EXERCISE_LIBRARY[cx.muscleGroup]) EXERCISE_LIBRARY[cx.muscleGroup] = [];
    if (!EXERCISE_LIBRARY[cx.muscleGroup].includes(cx.name)) {
      EXERCISE_LIBRARY[cx.muscleGroup].push(cx.name);
    }
    EXERCISE_MUSCLE[cx.name] = cx.muscleGroup;
  }
}

function setupNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => go(btn.dataset.page));
  });
}

// ── Navigation ────────────────────────────────────────────────

function go(page) {
  activePage = page;

  if (page !== 'workout') {
    const navKey = (page.startsWith('template:') || page.startsWith('tag:')) ? 'heute' : page;
    updateNavActive(navKey);
  }

  const isWorkout = page === 'workout';
  document.getElementById('sidebar').style.display = isWorkout ? 'none' : '';
  document.getElementById('bottom-nav').style.display = isWorkout ? 'none' : '';

  const contentWrap = document.getElementById('content-wrap');

  if (isWorkout) {
    let wrap = document.getElementById('workout-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'workout-wrap';
      document.getElementById('app').appendChild(wrap);
    }
    contentWrap.style.display = 'none';
    wrap.style.display = 'flex';
    renderActiveWorkout(wrap);
    return;
  }

  const ww = document.getElementById('workout-wrap');
  if (ww) ww.style.display = 'none';
  contentWrap.style.display = 'flex';

  const inner = document.getElementById('content-inner');
  inner.innerHTML = '';
  inner.classList.add('fade-enter');
  setTimeout(() => inner.classList.remove('fade-enter'), 250);

  render(page, inner);
}

function updateNavActive(page) {
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}

function render(page, el) {
  if (page === 'heute') renderHeute(el);
  else if (page === 'wochenplan') renderWochenplan(el);
  else if (page.startsWith('tag:')) { var tp = page.split(':'); renderTagDetail(el, tp[1], parseInt(tp[2]) || 0); }
  else if (page.startsWith('template:')) renderTemplateDetail(el, parseInt(page.split(':')[1]));
  else if (page === 'verlauf') renderHistory(el);
  else if (page === 'suche') renderSearch(el);
  else if (page === 'uebungen') renderExercises(el);
  else if (page === 'coach') renderCoach(el);
  else if (page === 'profil') renderProfile(el);
}

// ── Icons ─────────────────────────────────────────────────────

function iconCheck() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
}
function iconPlus(size) {
  size = size || 16;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
}
function iconEdit() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
}
function iconTrash() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
}
function iconArrow() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
}
function iconPlay(size) {
  size = size || 14;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
}
function iconDumbbell() {
  return '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="9" width="4" height="6" rx="1"/><rect x="18" y="9" width="4" height="6" rx="1"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="7" y1="10" x2="7" y2="14"/><line x1="17" y1="10" x2="17" y2="14"/></svg>';
}
function iconHistory() {
  return '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
}
function iconSearch() {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
}

// ── Heute Page ────────────────────────────────────────────────

let _heuteWeekOffset = 0;
let _selectedDayKey = null;

function changeWeek(delta) {
  _heuteWeekOffset += delta;
  _selectedDayKey = null;
  go('heute');
}

function selectDay(dayKey) {
  _selectedDayKey = (_selectedDayKey === dayKey) ? null : dayKey;
  go('heute');
}

async function renderHeute(el) {
  const offset = _heuteWeekOffset;
  const todayKey = getTodayKey();
  const todayDay = DAYS.find(d => d.key === todayKey);

  const [weekPlanEntries, plans, sessions, allSets] = await Promise.all([
    dbGetAll('weekPlan'),
    dbGetAll('plans'),
    dbGetAll('workoutSessions'),
    dbGetAll('workoutSets')
  ]);

  // Build day → plan map (support old planIds[] format)
  const dayPlanMap = {};
  for (const e of weekPlanEntries) {
    const pid = e.planId != null ? e.planId : (e.planIds && e.planIds[0]) || null;
    if (pid != null) dayPlanMap[e.day] = plans.find(p => p.id === pid) || null;
  }

  // Week bounds for selected week
  const now = new Date();
  const dow = now.getDay();
  const diffToMon = (dow === 0 ? -6 : 1 - dow);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMon + offset * 7);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // Completed sessions in selected week (by day)
  const completedThisWeek = sessions.filter(s => s.completed && s.startedAt >= weekStart.getTime() && s.startedAt < weekEnd.getTime());
  const doneDayKeys = new Set();
  for (const s of completedThisWeek) {
    const d = new Date(s.startedAt);
    const map = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    doneDayKeys.add(map[d.getDay()]);
  }

  // Week label
  const fmtOpts = { day: 'numeric', month: 'short' };
  const weekEndDisplay = new Date(weekEnd); weekEndDisplay.setDate(weekEnd.getDate() - 1);
  const weekLabel = offset === 0 ? 'Diese Woche'
    : offset === -1 ? 'Letzte Woche'
    : weekStart.toLocaleDateString('de-DE', fmtOpts) + ' – ' + weekEndDisplay.toLocaleDateString('de-DE', fmtOpts);

  // Today plan only relevant when viewing current week
  const todayPlan = offset === 0 ? (dayPlanMap[todayKey] || null) : null;
  const todayExercises = todayPlan ? await dbGetAll('planExercises', 'planId', todayPlan.id) : [];

  // Weekly stats
  const [thisW, lastW] = await Promise.all([getWeekStats(0, sessions, allSets), getWeekStats(1, sessions, allSets)]);
  const volHistory = getWeeklyVolumeHistory(8, sessions, allSets);

  // Streak
  const streak = calcStreak(sessions.filter(function(s) { return s.completed; }));
  const streakMilestones = [3, 7, 14, 30, 60, 100];
  const nextMilestone = streakMilestones.find(function(m) { return m > streak; }) || null;

  // ── HTML ──
  let html = '<div class="page-header">'
    + '<h1 class="page-title">Heute <span class="today-sub">' + todayDay.label + '</span></h1>'
    + '</div>';

  // Streak card
  if (streak > 0) {
    const fire = streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '✨';
    const milestoneHtml = nextMilestone
      ? '<div class="streak-next">Noch ' + (nextMilestone - streak) + ' Tag' + (nextMilestone - streak !== 1 ? 'e' : '') + ' bis ' + nextMilestone + '-Tage-Serie</div>'
      : '<div class="streak-next">Unglaublich — halte die Serie!</div>';
    html += '<div class="streak-card">'
      + '<div class="streak-left"><div class="streak-fire">' + fire + '</div></div>'
      + '<div class="streak-center">'
      + '<div class="streak-count">' + streak + ' Tag' + (streak !== 1 ? 'e' : '') + '</div>'
      + '<div class="streak-label">Aktuelle Serie</div>'
      + milestoneHtml
      + '</div>'
      + '<div class="streak-right">' + streakMilestones.filter(function(m){ return m <= streak; }).map(function(m){
          return '<span class="streak-badge">🏅 ' + m + '</span>';
        }).join('') + '</div>'
      + '</div>';
  }

  // Week navigation + strip
  html += '<div class="week-nav">'
    + '<button class="week-nav-btn" onclick="changeWeek(-1)">&#8249;</button>'
    + '<span class="week-nav-label">' + weekLabel + '</span>'
    + '<button class="week-nav-btn" onclick="changeWeek(1)"' + (offset >= 0 ? ' disabled' : '') + '>&#8250;</button>'
    + '</div>';

  // Default selected day: today (current week) or null
  const selectedKey = _selectedDayKey || (offset === 0 ? todayKey : null);

  html += '<div class="week-strip">';
  for (const day of DAYS) {
    const isToday = offset === 0 && day.key === todayKey;
    const isSelected = day.key === selectedKey;
    const hasPlan = !!dayPlanMap[day.key];
    const isDone = doneDayKeys.has(day.key);
    html += '<div class="strip-day' + (isToday ? ' today' : '') + (isSelected ? ' selected' : '') + '" onclick="selectDay(\'' + day.key + '\')" title="' + day.label + '">'
      + '<span class="strip-lbl">' + day.short + '</span>'
      + (function() {
    if (isDone) return '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="var(--surface3)" stroke-width="2.5"/><circle cx="9" cy="9" r="7" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-dasharray="44" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 9 9)"/></svg>';
    if (hasPlan) return '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="var(--surface3)" stroke-width="2.5"/><circle cx="9" cy="9" r="7" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-dasharray="44" stroke-dashoffset="33" stroke-linecap="round" transform="rotate(-90 9 9)"/></svg>';
    return '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="var(--surface3)" stroke-width="2.5"/></svg>';
  })()
      + '</div>';
  }
  html += '</div>';

  // Selected day card
  const selectedDay = DAYS.find(d => d.key === selectedKey);
  const selectedEntry = weekPlanEntries.find(e => e.day === selectedKey);
  const selectedPlanIds = getEntryPlanIds(selectedEntry);
  const isSelectedToday = offset === 0 && selectedKey === todayKey;

  html += '<div style="margin-top:16px">';
  if (selectedDay) {
    const dayLabel = selectedDay.label + (isSelectedToday ? ' <span class="today-pill">Heute</span>' : '');
    html += '<div class="section-title" style="margin-bottom:8px">' + dayLabel + '</div>';

    if (selectedPlanIds.length === 0) {
      html += '<div class="today-empty" style="margin-bottom:0">'
        + '<span>Kein Training geplant</span>'
        + '<button class="btn btn-ghost" style="margin-top:8px" onclick="go(\'tag:' + selectedKey + ':' + offset + '\')">Tag einrichten</button>'
        + '</div>';
    } else {
      for (const pid of selectedPlanIds) {
        const plan = plans.find(p => p.id === pid);
        if (!plan) continue;
        const exercises = await dbGetAll('planExercises', 'planId', pid);
        const exPreview = exercises.slice(0, 3).map(e => esc(e.name)).join(' · ')
          + (exercises.length > 3 ? ' +' + (exercises.length - 3) + ' weitere' : '');
        html += '<div class="today-card" style="margin-bottom:8px;border-left:3px solid ' + muscleGroupColor(plan.muscleGroup) + '">'
          + '<div class="today-card-info">'
          + '<div class="today-card-name">' + esc(plan.name) + '</div>'
          + '<div class="today-card-ex">' + exPreview + '</div>'
          + '<div class="today-card-count">' + exercises.length + ' Übungen</div>'
          + '</div>'
          + '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">'
          + '<button class="today-start-btn" onclick="startWorkout(' + pid + ')">' + iconPlay(16) + ' Starten</button>'
          + '<button class="btn btn-ghost" style="font-size:12px;padding:4px 10px" onclick="go(\'tag:' + selectedKey + ':' + offset + '\')">Details →</button>'
          + '</div>'
          + '</div>';
      }
    }
  }
  html += '</div>';

  // Today's training card (kept as reference but now driven by selectedKey above — skip old block)
  // Per-plan progress — only for plans assigned to the selected day
  const selEntry = weekPlanEntries.find(e => e.day === selectedKey);
  const assignedPlans = plans.filter(p => getEntryPlanIds(selEntry).includes(p.id));

  if (assignedPlans.length > 0) {
    html += '<div class="section-title" style="margin-top:28px">Fortschritt pro Training</div>';
  }

  const allWeekExProgress = await dbGetAll('weekExercises');
  const fmtDateP = ts => new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

  // Build map: planExerciseId → sorted list of weekExercises entries (newest first)
  const weByExId = {};
  for (const we of allWeekExProgress) {
    if (!weByExId[we.planExerciseId]) weByExId[we.planExerciseId] = [];
    weByExId[we.planExerciseId].push(we);
  }
  for (const list of Object.values(weByExId)) {
    list.sort((a, b) => b.weekStart - a.weekStart);
  }

  let planProgressHtml = '';
  for (const plan of assignedPlans) {
    const planExercises = await dbGetAll('planExercises', 'planId', plan.id);
    if (!planExercises.length) continue;

    // Only include exercises that have at least one weekExercises entry
    const exWithData = planExercises.filter(ex => weByExId[ex.id] && weByExId[ex.id].length > 0);
    if (!exWithData.length) continue;

    // Find the two most recent distinct weekStart values across all exercises in this plan
    const weekStarts = new Set();
    for (const ex of exWithData) {
      for (const we of (weByExId[ex.id] || [])) weekStarts.add(we.weekStart);
    }
    const sortedWeeks = Array.from(weekStarts).sort((a, b) => b - a);
    const curWeek  = sortedWeeks[0];
    const prevWeek = sortedWeeks[1] || null;

    let exRows = '';
    for (const ex of planExercises) {
      const entries = weByExId[ex.id] || [];
      const curEntry  = entries.find(e => e.weekStart === curWeek);
      const prevEntry = prevWeek ? entries.find(e => e.weekStart === prevWeek) : null;
      if (!curEntry && !prevEntry) continue;

      const cur  = curEntry  || ex;
      const prev = prevEntry || null;

      var dW = prev ? (cur.weight || 0) - (prev.weight || 0) : null;
      var dR = prev ? (cur.reps   || 0) - (prev.reps   || 0) : null;

      var chips = '';
      if (dW !== null && dW !== 0) chips += '<span class="prog-chip ' + (dW > 0 ? 'prog-up">+' + dW : 'prog-down">' + dW) + ' kg</span>';
      if (dR !== null && dR !== 0) chips += '<span class="prog-chip ' + (dR > 0 ? 'prog-up">+' + dR : 'prog-down">' + dR) + ' Wdh.</span>';
      if (!chips && prev) chips = '<span class="prog-chip prog-eq">= gleich</span>';
      if (!prev)          chips = '<span class="prog-chip prog-new">Neu</span>';

      exRows += '<div class="prog-ex-row">'
        + '<div class="prog-ex-name">' + esc(ex.name) + '</div>'
        + '<div class="prog-ex-vals">'
        + cur.sets + '×' + cur.reps + (cur.weight > 0 ? ' · ' + cur.weight + ' kg' : '')
        + (prev ? '<span class="prog-vs"> vs. ' + prev.sets + '×' + prev.reps + (prev.weight > 0 ? ' · ' + prev.weight + ' kg' : '') + '</span>' : '')
        + '</div>'
        + '<div class="prog-chips">' + chips + '</div>'
        + '</div>';
    }

    if (!exRows) continue;

    planProgressHtml += '<details class="plan-progress-block" id="prog-plan-' + plan.id + '">'
      + '<summary class="plan-progress-summary">'
      + '<span class="plan-progress-name">' + esc(plan.name) + '</span>'
      + '<span class="plan-progress-dates">'
      + (curWeek ? fmtDateP(curWeek) : '') + (prevWeek ? ' vs. ' + fmtDateP(prevWeek) : ' — erste Woche')
      + '</span>'
      + '<svg class="plan-prog-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
      + '</summary>'
      + exRows
      + '</details>';
  }

  html += planProgressHtml;

  // Volume history chart
  const hasData = volHistory.some(v => v.volume > 0);
  if (hasData) {
    html += '<div class="section-title" style="margin-top:28px">Volumenentwicklung (8 Wochen)</div>';
    html += '<div class="card" style="padding:16px 16px 8px">'
      + '<canvas class="chart" id="vol-history-chart" height="130"></canvas>'
      + '</div>';
  }


  el.innerHTML = html;

  if (hasData) {
    const canvas = el.querySelector('#vol-history-chart');
    drawWeeklyBarChart(canvas, volHistory);
  }
}

function compareStat(label, cur, prev, diffStr, trend) {
  const cls = trend > 0 ? 'up' : trend < 0 ? 'down' : '';
  const diffHtml = diffStr != null
    ? '<div class="cstat-diff ' + cls + '">' + diffStr + '</div>'
    : '';
  return '<div class="cstat">'
    + '<div class="cstat-label">' + label + '</div>'
    + '<div class="cstat-cur">' + cur + '</div>'
    + '<div class="cstat-prev">vs. ' + prev + '</div>'
    + diffHtml
    + '</div>';
}

function fmtVol(kg) {
  if (!kg) return '0 kg';
  if (kg >= 1000) return (kg / 1000).toFixed(1) + ' t';
  return Math.round(kg) + ' kg';
}

// ── Weekly Stats ──────────────────────────────────────────────

function getWeekStart(weeksBack) {
  const now = new Date();
  const dow = now.getDay();
  const diffToMon = (dow === 0 ? -6 : 1 - dow);
  const d = new Date(now);
  d.setDate(now.getDate() + diffToMon - (weeksBack || 0) * 7);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getWeekBounds(weeksBack) {
  const now = new Date();
  const dow = now.getDay();
  const diffToMon = (dow === 0 ? -6 : 1 - dow);
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMon - weeksBack * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start: start.getTime(), end: end.getTime() };
}

function getWeekStats(weeksBack, sessions, allSets) {
  const { start, end } = getWeekBounds(weeksBack);
  const weekSessions = sessions.filter(s => s.completed && s.startedAt >= start && s.startedAt < end);
  const ids = new Set(weekSessions.map(s => s.id));
  const sets = allSets.filter(s => ids.has(s.sessionId));
  const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  return { volume, sessions: weekSessions.length, sets: sets.length };
}

function getWeeklyVolumeHistory(numWeeks, sessions, allSets) {
  const results = [];
  const now = new Date();
  const dow = now.getDay();
  const diffToMon = (dow === 0 ? -6 : 1 - dow);
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + diffToMon);
  thisMonday.setHours(0, 0, 0, 0);

  for (let w = numWeeks - 1; w >= 0; w--) {
    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - w * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const weekSessions = sessions.filter(s => s.completed && s.startedAt >= start.getTime() && s.startedAt < end.getTime());
    const ids = new Set(weekSessions.map(s => s.id));
    const volume = allSets.filter(s => ids.has(s.sessionId)).reduce((sum, s) => sum + s.weight * s.reps, 0);

    const isThisWeek = w === 0;
    let label;
    if (isThisWeek) label = 'Aktuell';
    else if (w === 1) label = 'Letzte';
    else label = start.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });

    results.push({ volume, label, isThisWeek });
  }
  return results;
}

// ── Weekly Bar Chart ──────────────────────────────────────────

function drawWeeklyBarChart(canvas, data) {
  if (!canvas) return;
  requestAnimationFrame(function() {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 300;
    const H = parseInt(canvas.getAttribute('height')) || 130;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const pad = { top: 20, right: 8, bottom: 30, left: 8 };
    const iW = W - pad.left - pad.right;
    const iH = H - pad.top - pad.bottom;
    const n = data.length;
    const maxV = Math.max(...data.map(d => d.volume), 1);
    const barW = (iW / n) * 0.55;
    const slot = iW / n;

    data.forEach(function(d, i) {
      const x = pad.left + i * slot + (slot - barW) / 2;
      const barH = Math.max((d.volume / maxV) * iH, d.volume > 0 ? 3 : 0);
      const y = pad.top + iH - barH;
      const r = Math.min(5, barW / 2);

      // Bar fill
      ctx.fillStyle = d.isThisWeek ? '#4f7dff' : 'rgba(79,125,255,0.28)';
      ctx.beginPath();
      if (barH > r * 2) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, pad.top + iH);
        ctx.lineTo(x, pad.top + iH);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
      } else if (barH > 0) {
        ctx.rect(x, y, barW, barH);
      }
      ctx.closePath();
      ctx.fill();

      // Volume label above bar (only for this week and bars with data)
      if (d.volume > 0 && d.isThisWeek) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 10px Inter,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(fmtVol(d.volume), x + barW / 2, y - 5);
      }

      // X label
      ctx.fillStyle = d.isThisWeek ? '#ffffff' : '#48484f';
      ctx.font = (d.isThisWeek ? '700' : '600') + ' 10px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barW / 2, H - 6);
    });
  });
}

// ── Wochenplan Page ───────────────────────────────────────────

let _wochenplanOffset = 0;

async function renderWochenplan(el, offset) {
  if (offset !== undefined) _wochenplanOffset = offset;
  const wo = _wochenplanOffset;

  const [weekPlanEntries, plans, allWeekEx, allPlanEx] = await Promise.all([
    dbGetAll('weekPlan'),
    dbGetAll('plans'),
    dbGetAll('weekExercises'),
    dbGetAll('planExercises')
  ]);

  const thisWeekStart = getWeekStart(wo);
  const prevWeekStart = getWeekStart(wo + 1);

  // week label
  const wDate = new Date(thisWeekStart);
  const wEnd = new Date(thisWeekStart + 6 * 86400000);
  const fmt = d => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const weekLabel = wo === 0 ? 'Diese Woche' : wo === 1 ? 'Letzte Woche' : 'KW ' + fmt(wDate);
  const weekRange = fmt(wDate) + ' – ' + fmt(wEnd);

  const dayPlanMap = {};
  for (const e of weekPlanEntries) {
    dayPlanMap[e.day] = getEntryPlanIds(e);
  }

  // weekEx map: planExerciseId → thisWeek entry
  const weMap = {};
  for (const we of allWeekEx) {
    if (we.weekStart === thisWeekStart) weMap[we.planExerciseId] = we;
  }
  const weMapPrev = {};
  for (const we of allWeekEx) {
    if (we.weekStart === prevWeekStart) weMapPrev[we.planExerciseId] = we;
  }

  const todayKey = getTodayKey();

  let html = '<div class="page-header">'
    + '<h1 class="page-title">Wochenplan</h1>'
    + '<button class="btn btn-ghost" onclick="showCreatePlanModal()">+ Plan</button>'
    + '</div>'
    + '<div class="wp-week-nav">'
    + '<button class="wp-nav-btn" onclick="renderWochenplan(document.getElementById(\'content-inner\'),' + (wo+1) + ')">‹</button>'
    + '<div class="wp-week-label"><div class="wp-week-name">' + weekLabel + '</div><div class="wp-week-range">' + weekRange + '</div></div>'
    + '<button class="wp-nav-btn" onclick="renderWochenplan(document.getElementById(\'content-inner\'),' + (wo-1) + ')" ' + (wo === 0 ? 'disabled' : '') + '>›</button>'
    + '</div>'
    + '<div class="wp-days">';

  for (const day of DAYS) {
    const planIds = dayPlanMap[day.key] || [];
    const dayPlans = planIds.map(id => plans.find(p => p.id === id)).filter(Boolean);
    const isToday = day.key === todayKey && wo === 0;

    html += '<div class="wp-day-block' + (isToday ? ' wp-today' : '') + '">'
      + '<div class="wp-day-header">'
      + '<span class="wp-day-label">' + day.label + (isToday ? ' <span class="today-pill">Heute</span>' : '') + '</span>'
      + '<button class="wp-day-edit btn btn-ghost" style="font-size:12px;padding:2px 8px" onclick="go(\'tag:' + day.key + ':' + wo + '\')">Bearbeiten</button>'
      + '</div>';

    if (dayPlans.length === 0) {
      html += '<div class="wp-rest">Ruhetag</div>';
    } else {
      for (const plan of dayPlans) {
        const exes = allPlanEx.filter(e => e.planId === plan.id);
        html += '<div class="wp-plan-name">' + esc(plan.name) + '</div>';
        if (exes.length > 0) {
          html += '<div class="wp-ex-list">';
          for (const ex of exes) {
            const we = weMap[ex.id] || weMapPrev[ex.id] || ex;
            html += '<div class="wp-ex-row">'
              + '<span class="wp-ex-name">' + esc(ex.name) + '</span>'
              + '<span class="wp-ex-vals">' + we.sets + '×' + we.reps + ' · ' + we.weight + ' kg</span>'
              + '</div>';
          }
          html += '</div>';
        }
      }
    }
    html += '</div>';
  }

  html += '</div>';
  el.innerHTML = html;
}

async function showDayPicker(dayKey) {
  const day = DAYS.find(d => d.key === dayKey);
  const [plans, weekPlanEntries] = await Promise.all([dbGetAll('plans'), dbGetAll('weekPlan')]);
  const entry = weekPlanEntries.find(e => e.day === dayKey);
  const currentPlanId = entry ? (entry.planId != null ? entry.planId : (entry.planIds && entry.planIds[0]) || null) : null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  let listHtml = '<div class="dpo' + (currentPlanId === null ? ' selected' : '') + '" data-pid="null">'
    + '<span class="dpo-name">Ruhetag</span>'
    + '<span class="dpo-sub">Kein Training</span>'
    + '</div>';

  for (const plan of plans) {
    const exs = await dbGetAll('planExercises', 'planId', plan.id);
    listHtml += '<div class="dpo' + (currentPlanId === plan.id ? ' selected' : '') + '" data-pid="' + plan.id + '">'
      + '<span class="dpo-name">' + esc(plan.name) + '</span>'
      + '<span class="dpo-sub">' + exs.length + ' Übungen</span>'
      + '</div>';
  }

  overlay.innerHTML = '<div class="modal">'
    + '<div class="modal-header"><span class="modal-title">' + day.label + '</span>'
    + '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&#x2715;</button></div>'
    + '<div class="modal-body" style="padding:8px 12px">' + listHtml + '</div>'
    + '</div>';

  document.body.appendChild(overlay);

  overlay.querySelectorAll('.dpo').forEach(function(opt) {
    opt.addEventListener('click', async function() {
      const pid = opt.dataset.pid === 'null' ? null : parseInt(opt.dataset.pid);
      await dbPut('weekPlan', { day: dayKey, planId: pid });
      overlay.remove();
      go('wochenplan');
    });
  });
}

// ── Tag Detail ────────────────────────────────────────────────

// Returns the array of active plan IDs for a weekPlan entry (handles old single-planId format)
function getEntryPlanIds(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.planIds)) return entry.planIds;
  if (entry.planId != null) return [entry.planId];
  return [];
}

async function renderTagDetail(el, dayKey, weekOffset) {
  weekOffset = weekOffset || 0;
  const day = DAYS.find(d => d.key === dayKey);
  if (!day) { go('heute'); return; }

  const thisWeekStart = getWeekStart(-weekOffset);
  const prevWeekStart = getWeekStart(-weekOffset + 1);

  const [weekPlanEntries, plans, allWeekEx] = await Promise.all([
    dbGetAll('weekPlan'),
    dbGetAll('plans'),
    dbGetAll('weekExercises')
  ]);

  // Build lookup: planExerciseId → { thisWeek, lastSession }
  // lastSession = most recent entry before thisWeekStart (regardless of calendar week)
  const weekExMap = {};
  for (const we of allWeekEx) {
    if (!weekExMap[we.planExerciseId]) weekExMap[we.planExerciseId] = {};
    if (we.weekStart === thisWeekStart) {
      weekExMap[we.planExerciseId].thisWeek = we;
    } else if (we.weekStart < thisWeekStart) {
      const cur = weekExMap[we.planExerciseId].lastSession;
      if (!cur || we.weekStart > cur.weekStart) weekExMap[we.planExerciseId].lastSession = we;
    }
  }

  const entry = weekPlanEntries.find(e => e.day === dayKey);
  const activePlanIds = getEntryPlanIds(entry);
  const todayKey = getTodayKey();

  // ── Mini day navigation bar ──
  const dayPlanKeys = new Set(weekPlanEntries
    .filter(e => getEntryPlanIds(e).length > 0)
    .map(e => e.day));

  // Compute the actual date of this day in the viewed week
  const DAYS_ORDER = ['montag','dienstag','mittwoch','donnerstag','freitag','samstag','sonntag'];
  const dayIndexInWeek = DAYS_ORDER.indexOf(dayKey);
  const dayDate = new Date(thisWeekStart);
  dayDate.setDate(dayDate.getDate() + (dayIndexInWeek >= 0 ? dayIndexInWeek : 0));
  const dayDateStr = dayDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

  let dayNavHtml = '<div class="tag-day-nav">';
  for (const d of DAYS) {
    dayNavHtml += '<button class="tdb'
      + (d.key === dayKey ? ' active' : '')
      + (d.key === todayKey && weekOffset === 0 ? ' today'  : '')
      + '" onclick="go(\'tag:' + d.key + ':' + weekOffset + '\')">'
      + '<span class="tdb-short">' + d.short + '</span>'
      + '<div class="tdb-dot' + (dayPlanKeys.has(d.key) ? ' has' : '') + '"></div>'
      + '</button>';
  }
  dayNavHtml += '</div>';

  // ── Plan selector pills (multi-select) ──
  let pillsHtml = '<button class="plan-pill' + (activePlanIds.length === 0 ? ' active' : '')
    + '" onclick="clearDayPlans(\'' + dayKey + '\')">Ruhetag</button>';
  for (const plan of plans) {
    const isActive = activePlanIds.includes(plan.id);
    pillsHtml += '<button class="plan-pill' + (isActive ? ' active' : '')
      + '" onclick="toggleDayPlan(\'' + dayKey + '\',' + plan.id + ')">' + esc(plan.name) + '</button>';
  }

  // Week label (same logic as Heute)
  const wkStart = new Date(thisWeekStart);
  const wkEnd = new Date(thisWeekStart); wkEnd.setDate(wkStart.getDate() + 6);
  const fmtOpts2 = { day: 'numeric', month: 'short' };
  const weekNavLabel = weekOffset === 0 ? 'Diese Woche'
    : weekOffset === -1 ? 'Letzte Woche'
    : wkStart.toLocaleDateString('de-DE', fmtOpts2) + ' – ' + wkEnd.toLocaleDateString('de-DE', fmtOpts2);

  const weekNavHtml = '<div class="week-nav" style="margin:12px 0 0">'
    + '<button class="week-nav-btn" onclick="go(\'tag:' + dayKey + ':' + (weekOffset - 1) + '\')">&#8249;</button>'
    + '<span class="week-nav-label">' + weekNavLabel + '</span>'
    + '<button class="week-nav-btn" onclick="go(\'tag:' + dayKey + ':' + (weekOffset + 1) + '\')"' + (weekOffset >= 0 ? ' disabled' : '') + '>&#8250;</button>'
    + '</div>';

  // ── Build HTML header ──
  let html = '<button class="back-btn" onclick="go(\'heute\')">'
    + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
    + ' Heute</button>'
    + dayNavHtml
    + weekNavHtml
    + '<h1 class="page-title" style="margin:16px 0 4px">' + day.label
    + (dayKey === todayKey && weekOffset === 0 ? ' <span class="today-pill" style="font-size:13px;vertical-align:middle">Heute</span>' : '')
    + '</h1>'
    + '<p style="font-size:13px;color:var(--muted);margin-bottom:24px">' + dayDateStr + '</p>'
    + '<div class="section-title">Trainingsplan</div>'
    + '<div class="plan-pill-row">' + pillsHtml + '</div>';

  if (activePlanIds.length > 0) {
    // Aggregate muscles from all active plans for the muscle map
    var dayPrimary = [], daySecondary = [];
    var planSections = '';

    for (const planId of activePlanIds) {
      const plan = plans.find(p => p.id === planId);
      if (!plan) continue;
      const exercises = await dbGetAll('planExercises', 'planId', planId);

      exercises.forEach(function(ex) {
        var info = getExerciseInfo(ex.name);
        info.primary.forEach(function(m) { if (!dayPrimary.includes(m)) dayPrimary.push(m); });
        info.secondary.forEach(function(m) {
          if (!dayPrimary.includes(m) && !daySecondary.includes(m)) daySecondary.push(m);
        });
      });

      // Exercise list for this plan
      let exHtml = '';
      if (exercises.length === 0) {
        exHtml = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Noch keine Übungen — suche unten nach einer.</div>';
      } else {
        exHtml = exercises.map(function(ex, i) {
          var isFirst = i === 0;
          var isLast  = i === exercises.length - 1;
          var we = weekExMap[ex.id] || {};
          var cur  = we.thisWeek || we.lastSession || ex;
          var last = we.lastSession;

          // Build delta vs last session
          var deltaHtml = '';
          if (last) {
            var dW = (cur.weight || 0) - (last.weight || 0);
            var dR = (cur.reps || 0) - (last.reps || 0);
            var parts = [];
            if (dW !== 0) {
              var cls = dW > 0 ? 'delta-pos' : 'delta-neg';
              parts.push('<span class="' + cls + '">' + (dW > 0 ? '+' : '') + dW + ' kg</span>');
            }
            if (dR !== 0) {
              var clsR = dR > 0 ? 'delta-pos' : 'delta-neg';
              parts.push('<span class="' + clsR + '">' + (dR > 0 ? '+' : '') + dR + ' Wdh.</span>');
            }
            if (parts.length === 0) parts.push('<span class="delta-neutral">= gleich</span>');
            var lastDate = new Date(last.weekStart).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
            deltaHtml = '<div class="tag-ex-delta">Letzte Einheit (' + lastDate + '): ' + parts.join(' · ') + '</div>';
          }

          return '<div class="tag-ex-row" onclick="editTagEx(' + ex.id + ',\'' + dayKey + '\',' + weekOffset + ')" style="cursor:pointer">'
            + '<div class="tag-ex-move">'
            + '<button class="tag-ex-move-btn" onclick="event.stopPropagation();moveTagEx(' + ex.id + ',-1,\'' + dayKey + '\',' + weekOffset + ')" title="Nach oben"'  + (isFirst ? ' disabled' : '') + '>'
            + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>'
            + '</button>'
            + '<button class="tag-ex-move-btn" onclick="event.stopPropagation();moveTagEx(' + ex.id + ',1,\'' + dayKey + '\',' + weekOffset + ')" title="Nach unten"' + (isLast  ? ' disabled' : '') + '>'
            + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
            + '</button>'
            + '</div>'
            + '<div class="tag-ex-num">' + (i + 1) + '</div>'
            + '<div class="tag-ex-info">'
            + '<div class="tag-ex-name">' + esc(ex.name) + '</div>'
            + '<div class="tag-ex-meta">'
            + cur.sets + ' Sätze · ' + cur.reps + ' Wdh.'
            + (cur.weight > 0 ? ' · ' + cur.weight + ' kg' : ' · Kein Gewicht')
            + '</div>'
            + deltaHtml
            + (ex.note ? '<div class="tag-ex-note">' + esc(ex.note) + '</div>' : '')
            + '</div>'
            + '<button class="btn-icon btn-icon-danger" onclick="event.stopPropagation();removeTagEx(' + ex.id + ',' + planId + ',\'' + dayKey + '\',' + weekOffset + ')" title="Entfernen">'
            + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
            + '</button>'
            + '</div>';
        }).join('');
      }

      // Section header — only show plan name when multiple plans are active
      var sectionHeader = '';
      if (activePlanIds.length > 1) {
        sectionHeader = '<div class="tag-plan-section-header">'
          + '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + muscleGroupColor(plan.muscleGroup) + ';margin-right:6px;flex-shrink:0"></span>'
          + '<span class="tag-plan-section-name">' + esc(plan.name) + '</span>'
          + (plan.muscleGroup ? '<span class="tag-plan-section-group">' + esc(plan.muscleGroup) + '</span>' : '')
          + '<button class="btn btn-xs btn-primary" onclick="startWorkout(' + planId + ')">'
          + iconPlay() + ' Starten</button>'
          + '</div>';
      }

      // Search input + results — filtered to this plan's muscleGroup
      var mg = plan.muscleGroup || '';
      var placeholder = mg ? 'Übung suchen (' + esc(mg) + ')…' : 'Übung suchen…';
      var searchSection = '<div class="tag-search-wrap" style="margin-top:12px">'
        + '<div class="search-bar" style="margin-bottom:0">'
        + iconSearch()
        + '<input type="text" id="tag-ex-search-' + planId + '" class="tag-ex-search-input" '
        + 'placeholder="' + placeholder + '" '
        + 'oninput="tagExFilter(this.value,' + planId + ',\'' + dayKey + '\',\'' + mg + '\',' + weekOffset + ')" '
        + 'onfocus="tagExFilter(this.value,' + planId + ',\'' + dayKey + '\',\'' + mg + '\',' + weekOffset + ')" '
        + 'onblur="setTimeout(function(){var r=document.getElementById(\'tag-ex-results-' + planId + '\');if(r&&!r.querySelector(\':focus\')&&document.activeElement!==r)r.innerHTML=\'\'},500)" '
        + 'autocomplete="off">'
        + '</div>'
        + '<div id="tag-ex-results-' + planId + '" tabindex="-1"></div>'
        + '</div>';

      planSections += sectionHeader
        + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:8px">' + exHtml + '</div>'
        + searchSection
        + '<div style="height:20px"></div>';
    }

    html += '<div class="section-title" style="margin-top:28px">Übungen</div>'
      // ── Muscle map (collapsible) ──
      + '<details class="day-muscle-details">'
      + '<summary class="day-muscle-summary">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'
      + 'Muskelkarte'
      + '<svg class="day-muscle-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
      + '</summary>'
      + '<div class="ex-body-map" style="padding:12px 0 4px">' + muscleBodySVG(dayPrimary, daySecondary) + '</div>'
      + '</details>'
      + planSections;

    // Single "Start" button when only one plan is active
    if (activePlanIds.length === 1) {
      html += '<div style="display:flex;gap:10px;margin-top:4px">'
        + '<button class="btn btn-primary" style="flex:1" onclick="startWorkout(' + activePlanIds[0] + ')">'
        + iconPlay() + ' Training starten</button>'
        + '</div>';
    }
  } else {
    html += '<div class="tag-rest-state">'
      + '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted)"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>'
      + '<span>Ruhetag — kein Training geplant</span>'
      + '</div>';
  }

  if (plans.length === 0) {
    html += '<button class="btn btn-ghost" style="width:100%;margin-top:16px" onclick="showCreatePlanModal()">'
      + iconPlus() + ' Erste Vorlage erstellen</button>';
  }

  el.innerHTML = html;
}

function buildRecommendedSuggestions(plan, existingExercises, dayKey) {
  if (!plan || !plan.muscleGroup) return '';
  const recs = RECOMMENDED_EXERCISES[plan.muscleGroup];
  if (!recs || !recs.length) return '';

  const existingNames = new Set(existingExercises.map(e => e.name));
  const missing = recs.filter(r => !existingNames.has(r.name));
  if (!missing.length) return '';

  let rows = missing.map(function(r) {
    const safe = r.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div class="tag-ex-result" onclick="addTagEx(\'' + safe + '\',' + plan.id + ',\'' + dayKey + '\')">'
      + '<span class="ter-name">' + esc(r.name) + '</span>'
      + '<span class="ter-meta">' + r.sets + '×' + r.reps + '</span>'
      + '<span class="ter-add">' + iconPlus(14) + '</span>'
      + '</div>';
  }).join('');

  return '<div class="section-title" style="margin-top:16px;font-size:11px">Empfohlen für ' + esc(plan.muscleGroup) + '</div>'
    + '<div class="tag-search-wrap">' + rows + '</div>';
}

// Maps a plan muscleGroup value to the matching EXERCISE_LIBRARY keys
function getMuscleLibraryGroups(muscleGroup) {
  var map = {
    // Push
    'Push Day':         ['Brust', 'Schultern', 'Trizeps'],
    'Push':             ['Brust', 'Schultern', 'Trizeps'],
    'Brust':            ['Brust', 'Schultern', 'Trizeps'],
    'Brust & Trizeps':  ['Brust', 'Trizeps', 'Schultern'],

    // Pull
    'Pull Day':         ['Rücken', 'Bizeps'],
    'Pull':             ['Rücken', 'Bizeps'],
    'Rücken':           ['Rücken', 'Bizeps'],
    'Rücken & Bizeps':  ['Rücken', 'Bizeps'],

    // Schultern & Arme
    'Schultern':        ['Schultern', 'Bizeps', 'Trizeps', 'Unterarme'],
    'Schultern & Arme': ['Schultern', 'Bizeps', 'Trizeps', 'Unterarme'],
    'Arme':             ['Bizeps', 'Trizeps', 'Unterarme'],
    'Bizeps':           ['Bizeps', 'Unterarme'],
    'Trizeps':          ['Trizeps', 'Unterarme'],

    // Beine
    'Beine':            ['Beine — Quadrizeps', 'Beine — Hamstrings & Gesäß', 'Waden'],
    'Beine & Gesäß':    ['Beine — Hamstrings & Gesäß', 'Beine — Quadrizeps', 'Waden'],

    // Bauch / Core
    'Bauch':            ['Bauch & Core'],
    'Bauch & Core':     ['Bauch & Core'],
    'Bauch Intensiv':   ['Bauch & Core'],
    'Bauch & Beine':    ['Bauch & Core', 'Bauch', 'Bauch & Beine',
                         'Beine — Quadrizeps', 'Beine — Hamstrings & Gesäß', 'Waden', 'Beine', 'Beine & Gesäß'],
    'Core':             ['Bauch & Core'],

    // Ganzkörper → alles außer Cardio/Dehnen
    'Ganzkörper':       ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps',
                         'Beine — Quadrizeps', 'Beine — Hamstrings & Gesäß', 'Waden',
                         'Bauch & Core', 'Ganzkörper & Compound'],

    // Upper Body
    'Upper Body':       ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Unterarme'],

    // Cardio
    'Cardio':           ['Cardio & Kondition'],

    // Dehnen
    'Dehnen':           ['Dehnen & Mobility'],
  };
  if (map[muscleGroup]) {
    var mapped = map[muscleGroup];
    // Also include any custom exercises stored directly under this key
    if (EXERCISE_LIBRARY[muscleGroup] && !mapped.includes(muscleGroup)) {
      mapped = mapped.concat([muscleGroup]);
    }
    return mapped;
  }
  if (EXERCISE_LIBRARY[muscleGroup]) return [muscleGroup];
  return null; // kein Match → alle Übungen durchsuchen
}

// muscleGroup: if provided, restricts search results to that group only
function tagExFilter(query, planId, dayKey, muscleGroup, weekOffset) {
  weekOffset = weekOffset || 0;
  const results = document.getElementById('tag-ex-results-' + planId);
  if (!results) return;
  const q = query.trim().toLowerCase();

  var mappedGroups = muscleGroup ? getMuscleLibraryGroups(muscleGroup) : null;

  // Without a query and no muscle group filter — hide results
  if (!q && !mappedGroups) { results.innerHTML = ''; return; }

  var groups = mappedGroups || Object.keys(EXERCISE_LIBRARY);

  var multiGroup = mappedGroups && mappedGroups.length > 1;
  let html = '';

  if (!q && multiGroup) {
    // Browse mode with multiple sub-groups: show all, grouped with headers
    for (const group of groups) {
      var exList = EXERCISE_LIBRARY[group] || [];
      if (!exList.length) continue;
      html += '<div class="ter-group-header">' + esc(group) + '</div>';
      for (const ex of exList) {
        const safe = ex.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const exInfo = getExerciseInfo(ex);
        html += '<div class="tag-ex-result" onpointerdown="event.preventDefault();addTagEx(\'' + safe + '\',' + planId + ',\'' + dayKey + '\',' + weekOffset + ')">'
          + '<div class="ter-info"><span class="ter-name">' + esc(ex) + '</span>'
          + (exInfo.area ? '<span class="ter-area">' + esc(exInfo.area) + '</span>' : '')
          + '</div>'
          + '<span class="ter-add">' + iconPlus(14) + '</span>'
          + '</div>';
      }
    }
  } else {
    // Search mode: flat list with group badge, limited to 25 results
    var limit = 25;
    var count = 0;
    for (const group of groups) {
      const matches = (EXERCISE_LIBRARY[group] || []).filter(function(e) {
        return !q || e.toLowerCase().includes(q);
      });
      for (const ex of matches) {
        const safe = ex.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const exInfo = getExerciseInfo(ex);
        html += '<div class="tag-ex-result" onpointerdown="event.preventDefault();addTagEx(\'' + safe + '\',' + planId + ',\'' + dayKey + '\',' + weekOffset + ')">'
          + '<div class="ter-info"><span class="ter-name">' + esc(ex) + '</span>'
          + (exInfo.area ? '<span class="ter-area">' + esc(exInfo.area) + '</span>' : '')
          + '</div>'
          + (multiGroup ? '<span class="ter-group">' + esc(group) + '</span>' : '')
          + '<span class="ter-add">' + iconPlus(14) + '</span>'
          + '</div>';
        count++;
        if (count >= limit) break;
      }
      if (count >= limit) break;
    }
  }

  if (!html && q) {
    html = '<div style="padding:12px 16px;font-size:13px;color:var(--muted)">Keine Treffer'
      + (muscleGroup ? ' für ' + esc(muscleGroup) : '')
      + ' — tippe anders.</div>';
  }
  results.innerHTML = html;
}

async function addTagEx(exName, planId, dayKey, weekOffset) {
  weekOffset = weekOffset || 0;
  await dbAdd('planExercises', { planId: planId, name: exName, sets: 3, reps: 10, weight: 0 });
  go('tag:' + dayKey + ':' + weekOffset);
}

async function removeTagEx(exId, planId, dayKey, weekOffset) {
  weekOffset = weekOffset || 0;
  await dbDelete('planExercises', exId);
  go('tag:' + dayKey + ':' + weekOffset);
}

async function moveTagEx(exId, direction, dayKey, weekOffset) {
  weekOffset = weekOffset || 0;
  const ex = await dbGet('planExercises', exId);
  if (!ex) return;
  const all = await dbGetAll('planExercises', 'planId', ex.planId);
  const idx = all.findIndex(function(e) { return e.id === exId; });
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= all.length) return;
  const other = all[swapIdx];
  const tmpName = ex.name, tmpSets = ex.sets, tmpReps = ex.reps, tmpWeight = ex.weight;
  ex.name = other.name; ex.sets = other.sets; ex.reps = other.reps; ex.weight = other.weight;
  other.name = tmpName; other.sets = tmpSets; other.reps = tmpReps; other.weight = tmpWeight;
  await dbPut('planExercises', ex);
  await dbPut('planExercises', other);
  go('tag:' + dayKey + ':' + weekOffset);
}

async function editTagEx(exId, dayKey, weekOffset) {
  weekOffset = weekOffset || 0;
  const ex = await dbGet('planExercises', exId);
  if (!ex) return;

  const thisWeekStart = getWeekStart(-weekOffset);
  const allWe = await dbGetAll('weekExercises', 'planExerciseId', exId);
  const existing = allWe.find(function(w) { return w.weekStart === thisWeekStart; });
  const lastSession = allWe.filter(function(w) { return w.weekStart < thisWeekStart; })
    .sort(function(a, b) { return b.weekStart - a.weekStart; })[0];
  const cur = existing || lastSession || ex;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal">'
    + '<div class="modal-header"><span class="modal-title">' + esc(ex.name) + '</span>'
    + '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&#x2715;</button></div>'
    + '<div class="modal-body"><div class="edit-ex-grid">'
    + '<div class="form-group" style="margin-bottom:0"><label class="form-label">Sätze</label>'
    + '<input class="form-input" id="tex-sets" type="number" min="1" value="' + cur.sets + '"></div>'
    + '<div class="form-group" style="margin-bottom:0"><label class="form-label">Wdh.</label>'
    + '<input class="form-input" id="tex-reps" type="number" min="1" value="' + cur.reps + '"></div>'
    + '<div class="form-group" style="margin-bottom:0"><label class="form-label">Gewicht (kg)</label>'
    + '<input class="form-input" id="tex-weight" type="number" min="0" step="0.5" value="' + cur.weight + '"></div>'
    + '</div>'
    + '<div class="form-group" style="margin-top:14px;margin-bottom:0"><label class="form-label">Notiz (z.B. Sitzhöhe, Griff, Einstellung)</label>'
    + '<textarea class="form-input" id="tex-note" rows="2" placeholder="z.B. Sitz auf Position 3, enger Griff…" style="resize:vertical;font-family:inherit;font-size:13px">' + esc(ex.note || '') + '</textarea>'
    + '</div>'
    + '</div>'
    + '<div class="modal-footer">'
    + '<button class="btn btn-ghost" onclick="this.closest(\'.modal-overlay\').remove()">Abbrechen</button>'
    + '<button class="btn btn-primary" id="tex-save-btn">Speichern</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#tex-sets').focus();

  overlay.querySelector('#tex-save-btn').addEventListener('click', async function() {
    const sets   = parseInt(overlay.querySelector('#tex-sets').value)     || 3;
    const reps   = parseInt(overlay.querySelector('#tex-reps').value)     || 10;
    const weight = parseFloat(overlay.querySelector('#tex-weight').value) || 0;
    const note   = overlay.querySelector('#tex-note').value.trim();
    if (existing) {
      await dbPut('weekExercises', Object.assign({}, existing, { sets: sets, reps: reps, weight: weight }));
    } else {
      await dbAdd('weekExercises', { planExerciseId: exId, weekStart: thisWeekStart, sets: sets, reps: reps, weight: weight });
    }
    await dbPut('planExercises', Object.assign({}, ex, { note: note }));
    overlay.remove();
    go('tag:' + dayKey + ':' + weekOffset);
  });
}

// Toggle a plan on/off for a day (multi-select)
async function toggleDayPlan(dayKey, planId) {
  const entries = await dbGetAll('weekPlan');
  const entry = entries.find(e => e.day === dayKey);
  const current = getEntryPlanIds(entry);

  let newIds;
  if (current.includes(planId)) {
    newIds = current.filter(id => id !== planId);
  } else {
    newIds = current.concat([planId]);
  }

  await dbPut('weekPlan', { day: dayKey, planIds: newIds });
  go('tag:' + dayKey);
}

// Set day to Ruhetag (no plans)
async function clearDayPlans(dayKey) {
  await dbPut('weekPlan', { day: dayKey, planIds: [] });
  go('tag:' + dayKey);
}

// Legacy single-select (kept for backward compat)
async function setDayPlan(dayKey, planId) {
  const newIds = planId != null ? [planId] : [];
  await dbPut('weekPlan', { day: dayKey, planIds: newIds });
  go('tag:' + dayKey);
}

// ── Template Detail ───────────────────────────────────────────

async function renderTemplateDetail(el, planId) {
  const plan = await dbGet('plans', planId);
  if (!plan) { go('heute'); return; }
  const exs = await dbGetAll('planExercises', 'planId', planId);

  let html = '<button class="back-btn" onclick="go(\'heute\')">'
    + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
    + ' Vorlagen</button>'
    + '<div class="page-header"><div>'
    + '<h1 class="page-title editable-title" id="plan-title-' + planId + '" onclick="startInlineEdit(this,' + planId + ')" title="Klicken zum Bearbeiten">' + esc(plan.name) + '</h1>'
    + '<div style="font-size:14px;color:var(--soft);margin-top:2px">' + exs.length + ' Übung' + (exs.length !== 1 ? 'en' : '') + '</div>'
    + '</div>'
    + '<button class="btn btn-primary" onclick="startWorkout(' + planId + ')">Workout starten</button>'
    + '</div>'
    + '<div class="card">';

  if (exs.length === 0) {
    html += emptyState('🏋️', 'Noch keine Übungen', 'Füge Übungen zu diesem Plan hinzu.');
  } else {
    html += '<div id="template-ex-list">';
    exs.forEach(function(ex, i) {
      html += '<div class="template-ex-row" id="tex-' + ex.id + '">'
        + '<div class="ex-index-badge">' + (i + 1) + '</div>'
        + '<div class="ex-info">'
        + '<div class="ex-name">' + esc(ex.name) + '</div>'
        + '<div class="ex-chips">'
        + '<span class="ex-chip">' + ex.sets + '×' + ex.reps + '</span>'
        + (ex.weight > 0 ? '<span class="ex-chip">' + ex.weight + ' kg</span>' : '')
        + '</div></div>'
        + '<div class="ex-actions">'
        + '<button class="btn-icon" onclick="editPlanExercise(' + ex.id + ',' + planId + ')" title="Bearbeiten">' + iconEdit() + '</button>'
        + '<button class="btn-icon btn-icon-danger" onclick="deletePlanExercise(' + ex.id + ',' + planId + ')" title="Löschen">' + iconTrash() + '</button>'
        + '</div></div>';
    });
    html += '</div>';
  }

  html += '</div>'
    + '<div style="margin-top:16px;display:flex;gap:10px">'
    + '<button class="btn btn-ghost" style="width:100%;flex:1" onclick="showAddExerciseModal(' + planId + ',null)">'
    + iconPlus() + ' Übung hinzufügen</button>'
    + '<button class="btn btn-danger-ghost" onclick="deletePlan(' + planId + ')">Löschen</button>'
    + '</div>';

  el.innerHTML = html;
}

async function startInlineEdit(el, planId) {
  const current = el.textContent.trim();
  const input = document.createElement('input');
  input.className = 'inline-edit-input page-title';
  input.value = current;
  el.replaceWith(input);
  input.focus();
  input.select();

  async function save() {
    const val = input.value.trim() || current;
    const plan = await dbGet('plans', planId);
    plan.name = val;
    await dbPut('plans', plan);
    go('template:' + planId);
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') go('template:' + planId);
  });
}

async function deletePlanExercise(exId, planId) {
  if (!confirm('Übung löschen?')) return;
  await dbDelete('planExercises', exId);
  go('template:' + planId);
}

async function deletePlan(planId) {
  if (!confirm('Diese Vorlage wirklich löschen?')) return;
  await dbDelete('plans', planId);
  const exs = await dbGetAll('planExercises', 'planId', planId);
  for (const ex of exs) await dbDelete('planExercises', ex.id);
  go('heute');
}

// ── Create Plan Modal ─────────────────────────────────────────

function showCreatePlanModal(existingPlan) {
  const isEdit = !!existingPlan;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const pillsHtml = MUSCLE_GROUPS.map(function(mg) {
    return '<button class="pill' + (isEdit && existingPlan.muscleGroup === mg ? ' selected' : '') + '" data-mg="' + mg + '">' + mg + '</button>';
  }).join('');

  overlay.innerHTML = '<div class="modal">'
    + '<div class="modal-header"><span class="modal-title">' + (isEdit ? 'Vorlage bearbeiten' : 'Neue Vorlage') + '</span>'
    + '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&#x2715;</button></div>'
    + '<div class="modal-body">'
    + '<div class="form-group"><label class="form-label">Name</label>'
    + '<input class="form-input" id="plan-name-input" placeholder="z.B. Push Day" value="' + (isEdit ? esc(existingPlan.name) : '') + '"></div>'
    + '<div class="form-group"><label class="form-label">Muskelgruppe (optional)</label>'
    + '<div class="pill-grid" id="mg-picker">' + pillsHtml + '</div></div>'
    + '</div>'
    + '<div class="modal-footer">'
    + '<button class="btn btn-ghost" onclick="this.closest(\'.modal-overlay\').remove()">Abbrechen</button>'
    + '<button class="btn btn-primary" id="plan-save-btn">' + (isEdit ? 'Speichern' : 'Erstellen') + '</button>'
    + '</div></div>';

  document.body.appendChild(overlay);

  let selectedMg = isEdit ? (existingPlan.muscleGroup || '') : '';

  overlay.querySelectorAll('#mg-picker .pill').forEach(function(p) {
    p.addEventListener('click', function() {
      overlay.querySelectorAll('#mg-picker .pill').forEach(function(x) { x.classList.remove('selected'); });
      if (selectedMg === p.dataset.mg) {
        selectedMg = '';
      } else {
        selectedMg = p.dataset.mg;
        p.classList.add('selected');
      }
    });
  });

  overlay.querySelector('#plan-save-btn').addEventListener('click', async function() {
    const name = overlay.querySelector('#plan-name-input').value.trim();
    if (!name) { overlay.querySelector('#plan-name-input').focus(); return; }
    if (isEdit) {
      existingPlan.name = name;
      existingPlan.muscleGroup = selectedMg;
      await dbPut('plans', existingPlan);
    } else {
      const id = await dbAdd('plans', { name: name, muscleGroup: selectedMg, createdAt: Date.now() });
      overlay.remove();
      go('template:' + id);
      return;
    }
    overlay.remove();
    go('heute');
  });

  overlay.querySelector('#plan-name-input').focus();
}

// ── Edit Plan Exercise ────────────────────────────────────────

async function editPlanExercise(exId, planId) {
  const ex = await dbGet('planExercises', exId);
  if (!ex) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal">'
    + '<div class="modal-header"><span class="modal-title">' + esc(ex.name) + '</span>'
    + '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&#x2715;</button></div>'
    + '<div class="modal-body"><div class="edit-ex-grid">'
    + '<div class="form-group" style="margin-bottom:0"><label class="form-label">Sätze</label>'
    + '<input class="form-input" id="ex-sets" type="number" min="1" value="' + ex.sets + '"></div>'
    + '<div class="form-group" style="margin-bottom:0"><label class="form-label">Wdh.</label>'
    + '<input class="form-input" id="ex-reps" type="number" min="1" value="' + ex.reps + '"></div>'
    + '<div class="form-group" style="margin-bottom:0"><label class="form-label">Gewicht (kg)</label>'
    + '<input class="form-input" id="ex-weight" type="number" min="0" step="0.5" value="' + ex.weight + '"></div>'
    + '</div></div>'
    + '<div class="modal-footer">'
    + '<button class="btn btn-ghost" onclick="this.closest(\'.modal-overlay\').remove()">Abbrechen</button>'
    + '<button class="btn btn-primary" id="ex-save-btn">Speichern</button>'
    + '</div></div>';
  document.body.appendChild(overlay);

  overlay.querySelector('#ex-save-btn').addEventListener('click', async function() {
    ex.sets = parseInt(overlay.querySelector('#ex-sets').value) || 3;
    ex.reps = parseInt(overlay.querySelector('#ex-reps').value) || 10;
    ex.weight = parseFloat(overlay.querySelector('#ex-weight').value) || 0;
    await dbPut('planExercises', ex);
    overlay.remove();
    go('template:' + planId);
  });
}

// ── Add Exercise Modal ────────────────────────────────────────

function showAddExerciseModal(targetPlanId, onSelect) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal" style="max-height:75vh">'
    + '<div class="modal-header"><span class="modal-title">Übung hinzufügen</span>'
    + '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&#x2715;</button></div>'
    + '<div class="modal-body" id="ex-picker-body">'
    + '<div class="search-bar">' + iconSearch() + '<input type="text" id="ex-search" placeholder="Übung suchen…" autocomplete="off"></div>'
    + '<div id="ex-picker-list"></div>'
    + '</div></div>';
  document.body.appendChild(overlay);

  function renderList(query) {
    const listEl = overlay.querySelector('#ex-picker-list');
    let html = '';
    const q = query.toLowerCase();
    for (const group of Object.keys(EXERCISE_LIBRARY)) {
      const exList = EXERCISE_LIBRARY[group];
      const filtered = q ? exList.filter(function(e) { return e.toLowerCase().includes(q); }) : exList;
      if (!filtered.length) continue;
      if (!q) html += '<div class="exercise-group-label">' + group + '</div>';
      for (const ex of filtered) {
        html += '<div class="exercise-pick-row" data-ex="' + esc(ex) + '">'
          + '<span class="ex-pick-name">' + esc(ex) + '</span>'
          + '<span class="muscle-chip">' + (EXERCISE_MUSCLE[ex] || group) + '</span>'
          + '</div>';
      }
    }
    if (!html) html = '<div style="text-align:center;padding:30px;color:var(--muted);font-size:14px">Keine Übungen gefunden</div>';
    listEl.innerHTML = html;

    listEl.querySelectorAll('.exercise-pick-row').forEach(function(row) {
      row.addEventListener('click', async function() {
        const exName = row.dataset.ex;
        overlay.remove();
        if (onSelect) {
          onSelect(exName);
        } else if (targetPlanId) {
          await addExerciseToPlan(targetPlanId, exName);
        }
      });
    });
  }

  renderList('');
  overlay.querySelector('#ex-search').addEventListener('input', function(e) { renderList(e.target.value); });
  overlay.querySelector('#ex-search').focus();
}

async function addExerciseToPlan(planId, exName) {
  await dbAdd('planExercises', { planId: planId, name: exName, sets: 3, reps: 10, weight: 0 });
  go('template:' + planId);
}

// ── Start Workout ─────────────────────────────────────────────

async function startWorkout(planId) {
  const plan = await dbGet('plans', planId);
  if (!plan) return;
  const planExs = await dbGetAll('planExercises', 'planId', planId);

  const exercises = [];
  for (const pe of planExs) {
    const prevSets = await getLastSetsForExercise(pe.name);
    const sets = [];
    for (let i = 0; i < pe.sets; i++) {
      sets.push({
        kg: prevSets[i] ? prevSets[i].kg : (pe.weight || 0),
        reps: prevSets[i] ? prevSets[i].reps : pe.reps,
        done: false,
        prev: prevSets[i] ? (prevSets[i].kg + '×' + prevSets[i].reps) : ''
      });
    }
    const prevMaxKg = prevSets.length > 0 ? Math.max(...prevSets.map(function(s) { return s.kg || 0; })) : 0;
    exercises.push({ name: pe.name, sets: sets, prevMaxKg: prevMaxKg, note: pe.note || '', planExerciseId: pe.id });
  }

  const sessionId = await dbAdd('workoutSessions', {
    planId: planId,
    planName: plan.name,
    startedAt: Date.now(),
    completedAt: null,
    duration: 0,
    completed: false
  });

  activeWorkout = { sessionId: sessionId, planId: planId, planName: plan.name, exercises: exercises };
  workoutStartTime = Date.now();
  startMainTimer();
  go('workout');
}

async function startEmptyWorkout() {
  const sessionId = await dbAdd('workoutSessions', {
    planId: null,
    planName: 'Workout',
    startedAt: Date.now(),
    completedAt: null,
    duration: 0,
    completed: false
  });

  activeWorkout = { sessionId: sessionId, planId: null, planName: 'Workout', exercises: [] };
  workoutStartTime = Date.now();
  startMainTimer();
  go('workout');
}

function startMainTimer() {
  if (mainTimerInterval) clearInterval(mainTimerInterval);
  mainTimerInterval = setInterval(function() {
    const el = document.getElementById('workout-clock');
    if (el) el.textContent = formatTimer(Date.now() - workoutStartTime);
  }, 1000);
}

// ── Render Active Workout ─────────────────────────────────────

function renderActiveWorkout(el) {
  if (!activeWorkout) { go('heute'); return; }
  const exercises = activeWorkout.exercises;
  const planName = activeWorkout.planName;

  const chipHtml = [60, 90, 120, 180].map(function(s) {
    return '<button class="pause-chip ' + (restSecsTotal === s ? 'active' : '') + '" onclick="setRestPreset(' + s + ')">' + s + 's</button>';
  }).join('');

  const bodyHtml = exercises.map(function(ex, ei) { return renderExerciseCard(ex, ei); }).join('');

  el.innerHTML = '<div class="workout-topbar">'
    + '<div class="workout-topbar-left">'
    + '<div class="workout-plan-name">' + esc(planName) + '</div>'
    + '<div class="workout-timer" id="workout-clock">' + formatTimer(Date.now() - workoutStartTime) + '</div>'
    + '</div>'
    + '<div class="workout-topbar-right">'
    + '<button class="btn btn-danger-ghost" onclick="cancelWorkout()">Abbrechen</button>'
    + '<button class="btn btn-green" onclick="finishWorkout()">Fertig</button>'
    + '</div></div>'
    + '<div class="pause-preset-bar"><span class="pause-label">Pause</span>' + chipHtml + '</div>'
    + '<div class="workout-body" id="workout-body">' + bodyHtml + '</div>'
    + '<div class="workout-bottom-bar">'
    + '<button class="btn btn-ghost" style="width:100%" onclick="addExerciseToWorkout()">' + iconPlus() + ' Übung hinzufügen</button>'
    + '</div>';
}

function renderExerciseCard(ex, ei) {
  const doneSets = ex.sets.filter(function(s) { return s.done; }).length;
  const allDone = doneSets === ex.sets.length && ex.sets.length > 0;
  const prevText = (ex.sets[0] && ex.sets[0].prev)
    ? ('Letztes Mal: ' + ex.sets[0].prev.replace('×', ' kg × ') + ' Wdh.')
    : 'Kein Eintrag';

  return '<div class="exercise-card' + (allDone ? ' all-done' : '') + '" id="ex-card-' + ei + '">'
    + '<div class="exercise-card-header">'
    + '<div class="exercise-name-heading">' + esc(ex.name) + '</div>'
    + '<div class="sets-badge' + (allDone ? ' complete' : '') + '">' + doneSets + '/' + ex.sets.length + ' Sätze</div>'
    + '</div>'
    + '<div class="prev-hint">' + prevText + '</div>'
    + (ex.prevMaxKg > 0 ? '<div class="overload-hint">💡 Ziel heute: <strong>' + (ex.prevMaxKg + 2.5) + ' kg</strong></div>' : '')
    + '<div class="ex-note-wrap">'
    + '<textarea class="ex-note-area" rows="1" placeholder="Notiz (z.B. Sitzhöhe, Griff, Einstellung…)" oninput="updateExNote(' + ei + ',this.value);this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\'" onblur="saveExNoteDb(' + ei + ')" onfocus="this.style.height=\'auto\';this.style.height=this.scrollHeight+\'px\'">' + esc(ex.note || '') + '</textarea>'
    + '</div>'
    + '<div class="sets-table">'
    + '<div class="sets-header"><div>Satz</div><div>Vorher</div><div>KG</div><div>Wdh.</div><div>&#10003;</div></div>'
    + ex.sets.map(function(set, si) { return renderSetRow(ei, si, set, ex.prevMaxKg); }).join('')
    + '</div>'
    + '<div class="add-set-row"><button class="btn-text" onclick="addSet(' + ei + ')">+ Satz</button></div>'
    + '</div>';
}

function renderSetRow(ei, si, set, prevMaxKg) {
  const isPr = set.done && prevMaxKg > 0 && set.kg > prevMaxKg;
  return '<div class="set-row' + (set.done ? ' done' : '') + (isPr ? ' pr-glow' : '') + '" id="set-row-' + ei + '-' + si + '">'
    + '<div class="set-num' + (set.done ? ' done' : '') + '">' + (si + 1) + '</div>'
    + '<div class="set-prev">' + (set.prev || '—') + '</div>'
    + '<input class="set-input" type="number" inputmode="decimal" min="0" step="0.5" value="' + set.kg + '"'
    + (set.done ? ' disabled' : '')
    + ' onchange="updateSetValue(' + ei + ',' + si + ',\'kg\',this.value)">'
    + '<input class="set-input" type="number" inputmode="numeric" min="0" value="' + set.reps + '"'
    + (set.done ? ' disabled' : '')
    + ' onchange="updateSetValue(' + ei + ',' + si + ',\'reps\',this.value)">'
    + '<button class="set-check' + (set.done ? ' done' : '') + '" onclick="toggleSet(' + ei + ',' + si + ')">'
    + iconCheck()
    + '</button></div>';
}

function updateSetValue(ei, si, field, val) {
  if (!activeWorkout) return;
  activeWorkout.exercises[ei].sets[si][field] = parseFloat(val) || 0;
}

function toggleSet(ei, si) {
  if (!activeWorkout) return;
  const set = activeWorkout.exercises[ei].sets[si];
  set.done = !set.done;
  refreshExerciseCard(ei);
  if (set.done) startRestTimer();
}

function refreshExerciseCard(ei) {
  const ex = activeWorkout.exercises[ei];
  const card = document.getElementById('ex-card-' + ei);
  if (!card) return;
  const temp = document.createElement('div');
  temp.innerHTML = renderExerciseCard(ex, ei);
  card.replaceWith(temp.firstElementChild);
}

function addSet(ei) {
  if (!activeWorkout) return;
  const ex = activeWorkout.exercises[ei];
  const last = ex.sets[ex.sets.length - 1];
  ex.sets.push({ kg: last ? last.kg : 0, reps: last ? last.reps : 10, done: false, prev: '' });
  refreshExerciseCard(ei);
}

function updateExNote(ei, val) {
  if (!activeWorkout) return;
  activeWorkout.exercises[ei].note = val;
}

async function saveExNoteDb(ei) {
  if (!activeWorkout) return;
  const ex = activeWorkout.exercises[ei];
  if (!ex.planExerciseId) return;
  const rec = await dbGet('planExercises', ex.planExerciseId);
  if (rec) { rec.note = ex.note; await dbPut('planExercises', rec); }
}

function addExerciseToWorkout() {
  showAddExerciseModal(null, async function(exName) {
    const prevSets = await getLastSetsForExercise(exName);
    const sets = [];
    for (let i = 0; i < 3; i++) {
      sets.push({
        kg: prevSets[i] ? prevSets[i].kg : 0,
        reps: prevSets[i] ? prevSets[i].reps : 10,
        done: false,
        prev: prevSets[i] ? (prevSets[i].kg + '×' + prevSets[i].reps) : ''
      });
    }
    const prevMaxKg = prevSets.length > 0 ? Math.max(...prevSets.map(function(s) { return s.kg || 0; })) : 0;
    activeWorkout.exercises.push({ name: exName, sets: sets, prevMaxKg: prevMaxKg });
    const body = document.getElementById('workout-body');
    if (body) {
      const ei = activeWorkout.exercises.length - 1;
      const temp = document.createElement('div');
      temp.innerHTML = renderExerciseCard(activeWorkout.exercises[ei], ei);
      body.appendChild(temp.firstElementChild);
      body.lastElementChild.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

function setRestPreset(secs) {
  restSecsTotal = secs;
  localStorage.setItem('restSecs', String(secs));
  document.querySelectorAll('.pause-chip').forEach(function(c) {
    c.classList.toggle('active', parseInt(c.textContent) === secs);
  });
}

async function cancelWorkout() {
  if (!confirm('Workout abbrechen? Alle Daten gehen verloren.')) return;
  if (activeWorkout) await dbDelete('workoutSessions', activeWorkout.sessionId);
  clearInterval(mainTimerInterval);
  dismissRest();
  activeWorkout = null;
  workoutStartTime = null;
  go('heute');
}

async function finishWorkout() {
  if (!activeWorkout) return;
  const sessionId = activeWorkout.sessionId;
  const exercises = activeWorkout.exercises;
  const duration = Math.round((Date.now() - workoutStartTime) / 1000);

  for (const ex of exercises) {
    for (let i = 0; i < ex.sets.length; i++) {
      const set = ex.sets[i];
      if (set.done || set.kg > 0 || set.reps > 0) {
        await dbAdd('workoutSets', {
          sessionId: sessionId, exerciseName: ex.name,
          setNumber: i + 1, reps: set.reps, weight: set.kg, done: set.done
        });
      }
    }
  }

  const session = await dbGet('workoutSessions', sessionId);
  session.completedAt = Date.now();
  session.duration = duration;
  session.completed = true;
  await dbPut('workoutSessions', session);
  scheduleSave();

  const prs = await checkPRs(exercises, sessionId);
  const allSessionsNow = await dbGetAll('workoutSessions');
  const streak = calcStreak(allSessionsNow.filter(function(s) { return s.completed; }));
  clearInterval(mainTimerInterval);
  dismissRest();
  activeWorkout = null;
  workoutStartTime = null;

  showSummaryModal(exercises, duration, prs, streak);
}

function showSummaryModal(exercises, duration, prs, streak) {
  const totalSets = exercises.reduce(function(n, ex) {
    return n + ex.sets.filter(function(s) { return s.done; }).length;
  }, 0);
  const totalVolume = exercises.reduce(function(n, ex) {
    return n + ex.sets.filter(function(s) { return s.done; }).reduce(function(v, s) { return v + s.kg * s.reps; }, 0);
  }, 0);
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  const durationStr = mins + ':' + String(secs).padStart(2, '0');

  const exRows = exercises.map(function(ex) {
    const done = ex.sets.filter(function(s) { return s.done; });
    if (!done.length) return '';
    const maxKg = Math.max.apply(null, done.map(function(s) { return s.kg; }));
    return '<div class="summary-ex-item">'
      + '<span class="summary-ex-name">' + esc(ex.name) + '</span>'
      + '<span class="summary-ex-detail">' + done.length + ' Sätze · ' + maxKg + ' kg</span>'
      + '</div>';
  }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal summary-modal">'
    + '<div class="modal-header"><span class="modal-title">Workout abgeschlossen</span>'
    + '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove();go(\'verlauf\')">&#x2715;</button></div>'
    + '<div class="modal-body">'
    + '<span class="summary-icon">💪</span>'
    + '<div class="summary-title">Gut gemacht!</div>'
    + '<div class="summary-subtitle">Hier ist deine Zusammenfassung</div>'
    + '<div class="summary-stats">'
    + '<div class="summary-stat"><div class="summary-stat-value">' + durationStr + '</div><div class="summary-stat-label">Dauer</div></div>'
    + '<div class="summary-stat"><div class="summary-stat-value">' + totalSets + '</div><div class="summary-stat-label">Sätze</div></div>'
    + '<div class="summary-stat"><div class="summary-stat-value">' + Math.round(totalVolume) + '</div><div class="summary-stat-label">Volumen kg</div></div>'
    + '</div>'
    + (streak > 0 ? (function() {
        const milestones = [3,7,14,30,60,100];
        const isMilestone = milestones.includes(streak);
        const fire = streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '✨';
        return '<div class="summary-streak' + (isMilestone ? ' milestone' : '') + '">'
          + '<span class="summary-streak-fire">' + fire + '</span>'
          + '<span class="summary-streak-text">' + streak + '-Tage-Serie' + (isMilestone ? ' — Meilenstein erreicht! 🏅' : '') + '</span>'
          + '</div>';
      })() : '')
    + '<div class="summary-ex-list">' + exRows + '</div>'
    + '</div>'
    + '<div class="modal-footer">'
    + (prs.length > 0
      ? '<button class="btn btn-primary" onclick="this.closest(\'.modal-overlay\').remove();showPRModal(' + JSON.stringify(prs) + ')">🏆 ' + prs.length + ' neuer PR!</button>'
      : '<button class="btn btn-primary" onclick="this.closest(\'.modal-overlay\').remove();go(\'verlauf\')">Fertig</button>')
    + '</div></div>';
  document.body.appendChild(overlay);
}

async function checkPRs(exercises, currentSessionId) {
  const prs = [];
  const allSets = await dbGetAll('workoutSets');
  for (const ex of exercises) {
    const doneWeights = ex.sets.filter(function(s) { return s.done; }).map(function(s) { return s.kg; });
    if (!doneWeights.length) continue;
    const currentMax = Math.max.apply(null, doneWeights);
    if (currentMax <= 0) continue;
    const prevMax = allSets
      .filter(function(s) { return s.exerciseName === ex.name && s.sessionId !== currentSessionId && s.done; })
      .reduce(function(m, s) { return Math.max(m, s.weight); }, 0);
    if (currentMax > prevMax) prs.push({ name: ex.name, oldMax: prevMax, newMax: currentMax });
  }
  return prs;
}

function showPRModal(prs) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const prRows = prs.map(function(pr) {
    return '<div class="pr-item"><span class="pr-item-name">' + esc(pr.name) + '</span>'
      + '<span class="pr-item-change">' + (pr.oldMax > 0 ? pr.oldMax + ' kg → ' : '') + pr.newMax + ' kg</span></div>';
  }).join('');

  overlay.innerHTML = '<div class="modal pr-modal">'
    + '<div class="modal-header"><span class="modal-title">Persönliche Rekorde</span>'
    + '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove();go(\'verlauf\')">&#x2715;</button></div>'
    + '<div class="modal-body"><span class="pr-trophy">&#127942;</span>'
    + '<div class="pr-title">Neue Bestleistungen!</div>'
    + '<div class="pr-subtitle">' + prs.length + ' persönlicher Rekord' + (prs.length !== 1 ? 'e' : '') + '</div>'
    + '<div class="pr-list">' + prRows + '</div>'
    + '</div>'
    + '<div class="modal-footer">'
    + '<button class="btn btn-primary" onclick="this.closest(\'.modal-overlay\').remove();go(\'verlauf\')">Weiter</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
}

// ── Rest Timer ────────────────────────────────────────────────

function startRestTimer(secs) {
  const total = secs || restSecsTotal;
  restSecsRemaining = total;
  restSecsTotal = total;
  updateRestUI();
  document.getElementById('rest-sheet').classList.add('open');
  if (restTimerInterval) clearInterval(restTimerInterval);
  restTimerInterval = setInterval(function() {
    restSecsRemaining--;
    if (restSecsRemaining <= 0) {
      restSecsRemaining = 0;
      clearInterval(restTimerInterval);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    updateRestUI();
  }, 1000);
}

function updateRestUI() {
  const el = document.getElementById('rest-countdown');
  const bar = document.getElementById('rest-progress-bar');
  if (el) el.textContent = restSecsRemaining;
  if (bar) bar.style.width = (restSecsTotal > 0 ? (restSecsRemaining / restSecsTotal) * 100 : 0) + '%';
}

function adjustRest(delta) {
  restSecsRemaining = Math.max(0, restSecsRemaining + delta);
  restSecsTotal = Math.max(1, restSecsTotal + delta);
  updateRestUI();
}

function dismissRest() {
  if (restTimerInterval) clearInterval(restTimerInterval);
  restSecsRemaining = 0;
  const sheet = document.getElementById('rest-sheet');
  if (sheet) sheet.classList.remove('open');
}

// ── Statistik ─────────────────────────────────────────────────

function makeSvgLineChart(entries, valueKey, color) {
  const W = 300, H = 90, padT = 18, padB = 8, padX = 8;
  const vals = entries.map(e => e[valueKey]);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  const range = maxV - minV || 1;
  const n = vals.length;
  const xs = vals.map((_, i) => padX + (i / (n - 1 || 1)) * (W - padX * 2));
  const ys = vals.map(v => padT + (H - padT - padB) - ((v - minV) / range) * (H - padT - padB));
  const pad = padX;

  const bottom = H - padB;
  // area fill path
  let area = 'M' + xs[0] + ',' + bottom;
  for (let i = 0; i < n; i++) area += ' L' + xs[i] + ',' + ys[i];
  area += ' L' + xs[n-1] + ',' + bottom + ' Z';

  // line path
  let line = 'M' + xs[0] + ',' + ys[0];
  for (let i = 1; i < n; i++) {
    const cx = (xs[i-1] + xs[i]) / 2;
    line += ' C' + cx + ',' + ys[i-1] + ' ' + cx + ',' + ys[i] + ' ' + xs[i] + ',' + ys[i];
  }

  // dots + labels
  let dots = '';
  for (let i = 0; i < n; i++) {
    dots += '<circle cx="' + xs[i] + '" cy="' + ys[i] + '" r="3" fill="' + color + '"/>';
    const anchor = i === 0 ? 'start' : i === n-1 ? 'end' : 'middle';
    dots += '<text x="' + xs[i] + '" y="' + (ys[i] - 6) + '" text-anchor="' + anchor + '" font-size="9" fill="#8e8e9a">' + vals[i] + '</text>';
  }

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:90px">'
    + '<defs><linearGradient id="g' + color.replace('#','') + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.25"/>'
    + '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>'
    + '</linearGradient></defs>'
    + '<path d="' + area + '" fill="url(#g' + color.replace('#','') + ')"/>'
    + '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round"/>'
    + dots
    + '</svg>';
}

function makeSvgBarChart(labels, values, color) {
  const W = 300, H = 80, pad = 8;
  const n = values.length;
  const maxV = Math.max(...values, 1);
  const barW = (W - pad * 2) / n - 4;

  let bars = '', texts = '';
  for (let i = 0; i < n; i++) {
    const x = pad + i * ((W - pad * 2) / n);
    const barH = Math.max(4, ((values[i] / maxV) * (H - pad * 2 - 14)));
    const y = H - pad - barH;
    bars += '<rect x="' + (x+1) + '" y="' + y + '" width="' + barW + '" height="' + barH + '" rx="3" fill="' + color + '" opacity="0.8"/>';
    if (values[i] > 0) texts += '<text x="' + (x + barW/2 + 1) + '" y="' + (y - 3) + '" text-anchor="middle" font-size="8" fill="#8e8e9a">' + values[i] + '</text>';
    texts += '<text x="' + (x + barW/2 + 1) + '" y="' + (H - 1) + '" text-anchor="middle" font-size="8" fill="#48484f">' + labels[i] + '</text>';
  }
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:80px">' + bars + texts + '</svg>';
}

let _statSelectedDay = null;
let _statWeekOffset = 0;

function selectStatDay(dayKey) {
  _statSelectedDay = (_statSelectedDay === dayKey) ? null : dayKey;
  renderHistory(document.getElementById('content-inner'));
}

function setWeekStreakThreshold(n) {
  localStorage.setItem('fittracker_wk_threshold', String(n));
  renderHistory(document.getElementById('content-inner'));
}

function changeStatWeek(delta) {
  _statWeekOffset = Math.min(0, _statWeekOffset + delta);
  renderHistory(document.getElementById('content-inner'));
}

function makeMonthCalendar(sessions) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

  const sessionDays = new Set();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      sessionDays.add(d.getDate());
    }
  }

  // start weekday (Mon=0)
  let startWd = firstDay.getDay() - 1;
  if (startWd < 0) startWd = 6;

  const dayLabels = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  let calHtml = '<div class="month-cal-header">' + dayLabels.map(function(d) {
    return '<div class="month-cal-wd">' + d + '</div>';
  }).join('') + '</div><div class="month-cal-grid">';

  for (let i = 0; i < startWd; i++) calHtml += '<div class="month-cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate();
    const trained = sessionDays.has(d);
    calHtml += '<div class="month-cal-day' + (isToday ? ' today' : '') + (trained ? ' trained' : '') + '">'
      + '<span>' + d + '</span>'
      + (trained ? '<div class="month-cal-dot"></div>' : '')
      + '</div>';
  }

  calHtml += '</div>';

  return '<div class="stat-card" style="margin-bottom:16px">'
    + '<div class="stat-card-title">' + monthNames[month] + ' ' + year + '</div>'
    + calHtml
    + '</div>';
}

function makeHeatmapSection(sessions, weekOffset, weekPlanEntries) {
  weekOffset = weekOffset || 0;
  const WEEKS = 16;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (today.getDay() || 7) + 1 - (WEEKS - 1) * 7);

  // selected week highlight bounds (Mon–Sun of chosen week)
  const selWeekMs = getWeekStart(-weekOffset);
  const selWeekEnd = selWeekMs + 6 * 86400000;

  const sessionDays = {};
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    d.setHours(0, 0, 0, 0);
    sessionDays[d.getTime()] = (sessionDays[d.getTime()] || 0) + 1;
  }

  const CELL = 14, GAP = 3, LABEL_W = 22;
  const totalW = LABEL_W + WEEKS * (CELL + GAP);
  const totalH = 7 * (CELL + GAP) + 20;
  const mNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  const DAY_LABELS = ['Mo', '', 'Mi', '', 'Fr', '', 'So'];
  let cells = '';
  for (let d = 0; d < 7; d++) {
    if (DAY_LABELS[d]) {
      cells += '<text x="0" y="' + (d * (CELL + GAP) + CELL - 2 + 16) + '" font-size="9" fill="var(--muted)" text-anchor="start">' + DAY_LABELS[d] + '</text>';
    }
  }

  // find which week column index corresponds to the selected week
  let selColX = -1;
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const wx = LABEL_W + w * (CELL + GAP);
    const weekMonday = new Date(startDate);
    weekMonday.setDate(startDate.getDate() + w * 7);
    weekMonday.setHours(0, 0, 0, 0);
    if (weekMonday.getTime() === selWeekMs) selColX = wx;

    // month label: show on first week of each month change
    const month = weekMonday.getMonth();
    if (month !== lastMonth) {
      // only label if this week's Monday is within our display range
      if (weekMonday <= today) {
        cells += '<text x="' + wx + '" y="12" font-size="9" fill="var(--muted)">' + mNames[month] + '</text>';
      }
      lastMonth = month;
    }

    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + w * 7 + d);
      if (date > today) continue;
      const ts = date.getTime();
      const hasSess = sessionDays[ts] || 0;
      const isInSelWeek = ts >= selWeekMs && ts <= selWeekEnd;
      const wy = 16 + d * (CELL + GAP);
      let fill, stroke = 'none', strokeW = '0';
      if (hasSess) {
        fill = 'var(--accent)';
      } else if (isInSelWeek) {
        fill = 'var(--surface3)';
      } else {
        fill = 'var(--surface2)';
      }
      cells += '<rect x="' + wx + '" y="' + wy + '" width="' + CELL + '" height="' + CELL + '" rx="3" fill="' + fill + '"/>';
    }
  }

  // selected week column border
  if (selColX >= 0) {
    const colW = CELL;
    const colH = 7 * (CELL + GAP) - GAP;
    cells += '<rect x="' + (selColX - 2) + '" y="14" width="' + (colW + 4) + '" height="' + (colH + 2) + '" rx="4" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0.5"/>';
  }

  const totalWorkouts = sessions.length;
  const wkThreshold = parseInt(localStorage.getItem('fittracker_wk_threshold') || '3');
  const weekStreak = calcWeekStreak(sessions, wkThreshold);
  const plannedStreak = weekPlanEntries ? calcPlannedDayStreak(sessions, weekPlanEntries) : 0;

  const thresholdBtns = [2,3,4,5].map(function(n) {
    return '<button class="streak-thresh-btn' + (n === wkThreshold ? ' active' : '') + '" onclick="setWeekStreakThreshold(' + n + ')" title="Mindest-Workouts pro Woche">' + n + '</button>';
  }).join('');

  return '<div class="stat-card" style="margin-bottom:16px">'
    + '<div class="stat-card-title">Trainingsfrequenz</div>'
    + '<div class="streak-stats-grid">'
    + '<div class="streak-stat-tile"><div class="streak-stat-val">' + totalWorkouts + '</div><div class="streak-stat-lbl">Gesamt</div></div>'
    + '<div class="streak-stat-tile accent"><div class="streak-stat-val">' + weekStreak + '</div><div class="streak-stat-lbl">Wochen-Serie</div><div class="streak-stat-sub">≥' + wkThreshold + '×/Woche <span class="streak-thresh-row">' + thresholdBtns + '</span></div></div>'
    + '<div class="streak-stat-tile accent"><div class="streak-stat-val">' + plannedStreak + '</div><div class="streak-stat-lbl">Plantage-Serie</div><div class="streak-stat-sub">Nur geplante Tage</div></div>'
    + '</div>'
    + '<div style="overflow-x:auto;margin-top:12px"><svg viewBox="0 0 ' + totalW + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;min-width:' + totalW + 'px;height:' + totalH + 'px">'
    + cells + '</svg></div>'
    + '</div>';
}

function calcStreak(sessions) {
  if (!sessions.length) return 0;
  const days = new Set(sessions.map(function(s) {
    const d = new Date(s.startedAt); d.setHours(0,0,0,0); return d.getTime();
  }));
  const today = new Date(); today.setHours(0,0,0,0);
  let streak = 0, cur = today.getTime();
  while (days.has(cur)) { streak++; cur -= 86400000; }
  return streak;
}

function weekTimestamp(date) {
  // Returns Monday 00:00 timestamp for the week containing `date`
  const d = new Date(date); d.setHours(0,0,0,0);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d.getTime();
}

function calcWeekStreak(sessions, threshold) {
  threshold = threshold || 3;
  // count sessions per week
  const weekCounts = {};
  for (const s of sessions) {
    const ws = weekTimestamp(new Date(s.startedAt));
    weekCounts[ws] = (weekCounts[ws] || 0) + 1;
  }
  const thisWeek = weekTimestamp(new Date());
  let streak = 0;
  let ws = thisWeek;
  // don't penalise the current (incomplete) week — start counting from last completed week
  ws -= 7 * 86400000;
  while (ws >= thisWeek - 52 * 7 * 86400000) {
    if ((weekCounts[ws] || 0) >= threshold) {
      streak++;
      ws -= 7 * 86400000;
    } else break;
  }
  // bonus: add current week if it already hit the threshold
  if ((weekCounts[thisWeek] || 0) >= threshold) streak++;
  return streak;
}

function calcPlannedDayStreak(sessions, weekPlanEntries) {
  const trainingDayKeys = new Set();
  for (const e of weekPlanEntries) {
    if (getEntryPlanIds(e).length > 0) trainingDayKeys.add(e.day);
  }
  if (trainingDayKeys.size === 0) return 0;

  const sessionDaySet = new Set();
  for (const s of sessions) {
    const d = new Date(s.startedAt); d.setHours(0,0,0,0);
    sessionDaySet.add(d.getTime());
  }

  const DOW_KEYS = ['so','mo','di','mi','do','fr','sa'];
  const today = new Date(); today.setHours(0,0,0,0);
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const dayKey = DOW_KEYS[d.getDay()];
    if (!trainingDayKeys.has(dayKey)) continue; // Ruhetag — überspringen
    if (sessionDaySet.has(d.getTime())) {
      streak++;
    } else if (i === 0) {
      continue; // heute noch kein Training — nicht werten
    } else {
      break;
    }
  }
  return streak;
}

function buildVolumeData(sessions, allSets) {
  const setsBySession = {};
  for (const s of allSets) {
    if (!setsBySession[s.sessionId]) setsBySession[s.sessionId] = [];
    setsBySession[s.sessionId].push(s);
  }
  return sessions
    .filter(function(s) { return s.completed && setsBySession[s.id]; })
    .sort(function(a, b) { return a.startedAt - b.startedAt; })
    .slice(-20)
    .map(function(s) {
      const vol = (setsBySession[s.id] || []).reduce(function(sum, set) {
        return sum + (set.weight || 0) * (set.reps || 0);
      }, 0);
      return { x: s.startedAt, y: Math.round(vol) };
    })
    .filter(function(d) { return d.y > 0; });
}

async function renderHistory(el) {
  const [allWeekEx, allPlanEx, plans, weekPlanEntries, allSessions, allSets] = await Promise.all([
    dbGetAll('weekExercises'),
    dbGetAll('planExercises'),
    dbGetAll('plans'),
    dbGetAll('weekPlan'),
    dbGetAll('workoutSessions'),
    dbGetAll('workoutSets')
  ]);

  const todayKey = getTodayKey();
  const selectedDay = _statSelectedDay || todayKey;

  // build dayPlanIds map
  const dayPlanIds = {};
  for (const e of weekPlanEntries) dayPlanIds[e.day] = getEntryPlanIds(e);

  let html = '<div class="page-header"><h1 class="page-title">Statistik</h1></div>';

  // ── Trainingsfrequenz-Heatmap ──
  const completedSessions = allSessions.filter(function(s) { return s.completed; });
  if (completedSessions.length > 0) {
    html += makeHeatmapSection(completedSessions, _statWeekOffset, weekPlanEntries);
  }

  // ── Inaktivitäts-Warnung ──
  if (completedSessions.length > 0) {
    const lastSession = completedSessions.slice().sort(function(a,b){ return b.startedAt - a.startedAt; })[0];
    const daysSince = Math.floor((Date.now() - lastSession.startedAt) / 86400000);
    if (daysSince >= 5) {
      const icon = daysSince >= 14 ? '🔴' : daysSince >= 7 ? '🟠' : '🟡';
      html += '<div class="inactivity-banner">'
        + '<span class="inactivity-icon">' + icon + '</span>'
        + '<div><div class="inactivity-title">Du hast seit ' + daysSince + ' Tagen nicht trainiert</div>'
        + '<div class="inactivity-sub">Letztes Workout: ' + formatDate(lastSession.startedAt) + ' — ' + esc(lastSession.planName || 'Workout') + '</div>'
        + '</div></div>';
    }
  }

  // ── Letzte 5 Sessions ──
  if (completedSessions.length > 0) {
    const setsBySession = {};
    for (const s of allSets) {
      if (!setsBySession[s.sessionId]) setsBySession[s.sessionId] = [];
      setsBySession[s.sessionId].push(s);
    }
    const lastFive = completedSessions.filter(function(s){ return s.planName !== 'Schnell-Log'; }).sort(function(a,b){ return b.startedAt - a.startedAt; }).slice(0, 5);
    html += '<div class="stat-card" style="margin-bottom:16px">'
      + '<div class="stat-card-title">Letzte Einheiten</div>'
      + lastFive.map(function(s) {
          const sets = setsBySession[s.id] || [];
          const vol = sets.reduce(function(sum, st) { return sum + (st.weight||0) * (st.reps||0); }, 0);
          const dur = s.duration ? Math.round(s.duration / 60) + ' min' : '—';
          return '<div class="last-session-row" onclick="showSessionDetail(' + s.id + ')">'
            + '<div class="last-session-left">'
            + '<div class="last-session-name">' + esc(s.planName || 'Workout') + '</div>'
            + '<div class="last-session-date">' + formatDate(s.startedAt) + ' · ' + dur + '</div>'
            + '</div>'
            + '<div class="last-session-vol">' + (vol > 0 ? Math.round(vol).toLocaleString('de-DE') + ' kg' : '—') + '</div>'
            + '</div>';
        }).join('')
      + '</div>';
  }

  // ── Volumen-Tracking ──
  const volumeData = buildVolumeData(completedSessions, allSets);
  if (volumeData.length > 1) {
    html += '<div class="stat-card" style="margin-bottom:16px">'
      + '<div class="stat-card-title">Volumen pro Einheit <span class="stat-subtitle">(kg × Wdh × Sätze)</span></div>'
      + makeSvgLineChart(volumeData, 'y', '#a78bfa')
      + '</div>';
  }

  // ── Wochennavigation + Tag-Selektor ──
  const selWeekStart = getWeekStart(-_statWeekOffset);
  const selWeekEnd = selWeekStart + 6 * 86400000;
  const fmtD = function(ts) { return new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }); };
  const weekLabel = _statWeekOffset === 0 ? 'Diese Woche' : _statWeekOffset === -1 ? 'Letzte Woche' : fmtD(selWeekStart) + ' – ' + fmtD(selWeekEnd);

  // days that had a completed session this displayed week
  const trainedDaysThisWeek = new Set();
  for (const s of completedSessions) {
    if (s.startedAt >= selWeekStart && s.startedAt <= selWeekEnd + 86399999) {
      const d = new Date(s.startedAt);
      const dow = d.getDay();
      const keys = ['so','mo','di','mi','do','fr','sa'];
      trainedDaysThisWeek.add(keys[dow]);
    }
  }

  html += '<div class="stat-week-nav">'
    + '<button class="stat-week-btn" onclick="changeStatWeek(-1)">&#8249;</button>'
    + '<span class="stat-week-label">' + weekLabel + '</span>'
    + '<button class="stat-week-btn" onclick="changeStatWeek(1)"' + (_statWeekOffset >= 0 ? ' disabled style="opacity:0.3;cursor:default"' : '') + '>&#8250;</button>'
    + '</div>';

  html += '<div class="week-strip" style="margin-bottom:20px">';
  for (const day of DAYS) {
    const isToday = _statWeekOffset === 0 && day.key === todayKey;
    const isSelected = day.key === selectedDay;
    const hasPlan = (dayPlanIds[day.key] || []).length > 0;
    const trained = trainedDaysThisWeek.has(day.key);
    html += '<div class="strip-day' + (isToday ? ' today' : '') + (isSelected ? ' selected' : '') + '" onclick="selectStatDay(\'' + day.key + '\')" title="' + day.label + '">'
      + '<span class="strip-lbl">' + day.short + '</span>'
      + (function() {
    if (trained) return '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="var(--surface3)" stroke-width="2.5"/><circle cx="9" cy="9" r="7" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="44" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 9 9)"/></svg>';
    if (hasPlan) return '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="var(--surface3)" stroke-width="2.5"/><circle cx="9" cy="9" r="7" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-dasharray="44" stroke-dashoffset="33" stroke-linecap="round" transform="rotate(-90 9 9)"/></svg>';
    return '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="var(--surface3)" stroke-width="2.5"/></svg>';
  })()
      + '</div>';
  }
  html += '</div>';

  const exMap = {};
  for (const ex of allPlanEx) exMap[ex.id] = ex;
  const planMap = {};
  for (const p of plans) planMap[p.id] = p;

  // filter plans for selected day
  const activePlanIds = new Set(dayPlanIds[selectedDay] || []);

  if (allWeekEx.length === 0 || activePlanIds.size === 0) {
    const dayLabel = DAYS.find(d => d.key === selectedDay);
    html += emptyState('📋', 'Kein Training geplant', 'Wähle einen Tag aus und weise einen Plan zu.');
    el.innerHTML = html;
    return;
  }

  // ── Wöchentliches Volumen für diesen Tag ──
  const volByWeek = {};
  for (const we of allWeekEx) {
    const ex = exMap[we.planExerciseId];
    if (!ex || !activePlanIds.has(ex.planId)) continue;
    if (!volByWeek[we.weekStart]) volByWeek[we.weekStart] = 0;
    volByWeek[we.weekStart] += (we.sets || 0);
  }
  const volWeeks = Object.keys(volByWeek).sort().slice(-8);
  if (volWeeks.length > 1) {
    const volLabels = volWeeks.map(w => {
      const d = new Date(parseInt(w));
      return 'KW' + Math.ceil((d - new Date(d.getFullYear(),0,1)) / 604800000);
    });
    html += '<div class="stat-card">'
      + '<div class="stat-card-title">Wöchentliches Volumen <span class="stat-subtitle">(Sätze gesamt)</span></div>'
      + makeSvgBarChart(volLabels, volWeeks.map(w => volByWeek[w]), '#4f7dff')
      + '</div>';
  }

  // ── Fortschritt pro Übung ──
  const byEx = {};
  for (const we of allWeekEx) {
    const ex = exMap[we.planExerciseId];
    if (!ex || !activePlanIds.has(ex.planId)) continue;
    if (!byEx[we.planExerciseId]) byEx[we.planExerciseId] = [];
    byEx[we.planExerciseId].push(we);
  }

  const byPlan = {};
  for (const [exId, entries] of Object.entries(byEx)) {
    if (entries.length < 2) continue;
    const ex = exMap[exId];
    if (!ex) continue;
    if (!byPlan[ex.planId]) byPlan[ex.planId] = [];
    byPlan[ex.planId].push({ ex, entries: entries.sort((a,b) => a.weekStart - b.weekStart) });
  }

  if (Object.keys(byPlan).length === 0) {
    html += emptyState('📊', 'Noch zu wenig Daten', 'Trage mindestens 2 Wochen ein um Graphen zu sehen.');
    el.innerHTML = html;
    return;
  }

  for (const [planId, exList] of Object.entries(byPlan)) {
    const plan = planMap[planId];
    html += '<div class="stat-section-title" style="border-left:3px solid ' + muscleGroupColor(plan ? plan.muscleGroup : '') + ';padding-left:8px">' + esc(plan ? plan.name : 'Unbekannt') + '</div>';

    for (const { ex, entries } of exList) {
      const first = entries[0];
      const last = entries[entries.length - 1];
      const deltaW = +(last.weight - first.weight).toFixed(1);
      const deltaR = last.reps - first.reps;

      html += '<div class="stat-card">'
        + '<div class="stat-card-title">' + esc(ex.name) + '</div>'
        + '<div class="stat-chips">'
        + '<span class="stat-chip">' + last.weight + ' kg aktuell</span>'
        + '<span class="stat-chip ' + (deltaW > 0 ? 'pos' : deltaW < 0 ? 'neg' : '') + '">'
        + (deltaW > 0 ? '▲ +' : deltaW < 0 ? '▼ ' : '') + deltaW + ' kg</span>'
        + '<span class="stat-chip ' + (deltaR > 0 ? 'pos' : deltaR < 0 ? 'neg' : '') + '">'
        + (deltaR > 0 ? '▲ +' : deltaR < 0 ? '▼ ' : '') + deltaR + ' Wdh</span>'
        + '</div>'
        + (function() {
            if (entries.length >= 3 && entries[entries.length-1].weight === entries[entries.length-2].weight && entries[entries.length-1].weight === entries[entries.length-3].weight) {
              return '<span class="progress-badge warn">➡️ Stagniert</span>';
            } else if (entries.length >= 2 && entries[entries.length-1].weight > entries[entries.length-2].weight) {
              return '<span class="progress-badge pos">📈 Steigert</span>';
            } else if (entries.length >= 2 && entries[entries.length-1].weight < entries[entries.length-2].weight) {
              return '<span class="progress-badge neg">📉 Rückgang</span>';
            }
            return '';
          })()
        + '<div class="stat-chart-label">Gewicht (kg)</div>'
        + makeSvgLineChart(entries, 'weight', '#4f7dff')
        + '<div class="stat-chart-label" style="margin-top:8px">Wiederholungen</div>'
        + makeSvgLineChart(entries, 'reps', '#30d158')
        + '</div>';
    }
  }

  el.innerHTML = html;
}

async function showSessionDetail(sessionId) {
  const session = await dbGet('workoutSessions', sessionId);
  if (!session) return;
  const sets = await dbGetAll('workoutSets', 'sessionId', sessionId);

  const byEx = {};
  const order = [];
  for (const s of sets) {
    if (!byEx[s.exerciseName]) { byEx[s.exerciseName] = []; order.push(s.exerciseName); }
    byEx[s.exerciseName].push(s);
  }

  let bodyHtml = '';
  for (const name of order) {
    const exSets = byEx[name];
    bodyHtml += '<div class="session-detail-ex">'
      + '<div class="session-detail-ex-name">' + esc(name) + '</div>'
      + '<div class="session-sets-grid">'
      + exSets.map(function(s) { return '<div class="session-set-chip">' + s.weight + ' kg × ' + s.reps + '</div>'; }).join('')
      + '</div></div>';
  }
  if (!bodyHtml) bodyHtml = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:14px">Keine Sätze aufgezeichnet</div>';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal">'
    + '<div class="modal-header"><div>'
    + '<div class="modal-title">' + esc(session.planName || 'Workout') + '</div>'
    + '<div style="font-size:12px;color:var(--soft);margin-top:2px">' + formatDate(session.startedAt) + ' · ' + formatDuration(session.duration) + '</div>'
    + '</div>'
    + '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&#x2715;</button>'
    + '</div><div class="modal-body">' + bodyHtml + '</div></div>';
  document.body.appendChild(overlay);
}

// ── Suche Page ────────────────────────────────────────────────

async function renderSearch(el) {
  let html = '<div class="page-header"><h1 class="page-title">Suche</h1></div>'
    + '<div class="search-bar-wrap">'
    + '<input class="search-global-input" id="global-search-input" type="text" placeholder="Übungen, Pläne, Einheiten …" oninput="runGlobalSearch(this.value)">'
    + '</div>'
    + '<div id="global-search-results"></div>';
  el.innerHTML = html;
  document.getElementById('global-search-input').focus();
}

async function runGlobalSearch(q) {
  const resultsEl = document.getElementById('global-search-results');
  if (!resultsEl) return;
  q = q.trim().toLowerCase();
  if (q.length < 2) { resultsEl.innerHTML = ''; return; }

  const [plans, sessions] = await Promise.all([dbGetAll('plans'), dbGetAll('workoutSessions')]);
  let html = '';

  // Exercises
  const allEx = Object.values(EXERCISE_LIBRARY).flat();
  const matchEx = allEx.filter(function(n) { return n.toLowerCase().includes(q); }).slice(0, 8);
  if (matchEx.length) {
    html += '<div class="search-section-title">Übungen</div>';
    html += matchEx.map(function(n) {
      return '<div class="search-result-item" onclick="go(\'uebungen\')">'
        + '<span class="search-result-icon">🏋️</span>'
        + '<span class="search-result-name">' + esc(n) + '</span>'
        + '</div>';
    }).join('');
  }

  // Plans
  const matchPlans = plans.filter(function(p) { return p.name.toLowerCase().includes(q); }).slice(0, 5);
  if (matchPlans.length) {
    html += '<div class="search-section-title">Trainingspläne</div>';
    html += matchPlans.map(function(p) {
      return '<div class="search-result-item" onclick="go(\'template:' + p.id + '\')">'
        + '<span class="search-result-icon">📋</span>'
        + '<span class="search-result-name">' + esc(p.name) + '</span>'
        + (p.muscleGroup ? '<span class="search-result-sub">' + esc(p.muscleGroup) + '</span>' : '')
        + '</div>';
    }).join('');
  }

  // Sessions
  const matchSessions = sessions.filter(function(s) {
    return s.completed && s.planName && s.planName.toLowerCase().includes(q);
  }).sort(function(a,b){ return b.startedAt - a.startedAt; }).slice(0, 5);
  if (matchSessions.length) {
    html += '<div class="search-section-title">Einheiten</div>';
    html += matchSessions.map(function(s) {
      return '<div class="search-result-item" onclick="showSessionDetail(' + s.id + ')">'
        + '<span class="search-result-icon">📅</span>'
        + '<span class="search-result-name">' + esc(s.planName) + '</span>'
        + '<span class="search-result-sub">' + formatDate(s.startedAt) + '</span>'
        + '</div>';
    }).join('');
  }

  if (!html) html = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:14px">Keine Ergebnisse für "' + esc(q) + '"</div>';
  resultsEl.innerHTML = html;
}

// ── Übungen Page ──────────────────────────────────────────────

async function renderExercises(el) {
  const [allSets, customExercises] = await Promise.all([
    dbGetAll('workoutSets'),
    dbGetAll('customExercises')
  ]);

  // Build name→group map including custom exercises
  const customMap = {};
  for (const cx of customExercises) customMap[cx.name] = { id: cx.id, muscleGroup: cx.muscleGroup, custom: true };

  // Group selector options — aligned with training plans
  var _exGroups = ['Push Day','Pull Day','Beine','Schultern & Arme','Upper Body','Ganzkörper',
    'Brust & Trizeps','Rücken & Bizeps','Bauch','Bauch & Core','Bauch Intensiv','Bauch & Beine','Cardio',
    'Beine & Gesäß','Schultern','Arme'];
  var groupOptions = _exGroups.map(function(g) {
    return '<option value="' + esc(g) + '">' + esc(g) + '</option>';
  }).join('');

  // Hidden library exercises (stored in localStorage)
  var hiddenLibEx = JSON.parse(localStorage.getItem('hiddenLibExercises') || '[]');
  var hiddenSet = new Set(hiddenLibEx);

  // All names that exist in the library (for dedup)
  var libraryNames = new Set();
  for (const exList of Object.values(EXERCISE_LIBRARY)) {
    for (const name of exList) libraryNames.add(name);
  }

  // Custom exercises always rendered first as their own section (with delete button)
  var customNames = new Set(customExercises.map(function(cx) { return cx.name; }));

  // Build group→exercises map (library only, custom handled separately)
  var groupMap = {};
  for (const [group, exList] of Object.entries(EXERCISE_LIBRARY)) {
    groupMap[group] = exList
      .filter(function(name) { return !hiddenSet.has(name) && !customNames.has(name); })
      .map(function(name) { return { name: name, custom: false }; });
  }
  // Also include exercises from workout history that have no group
  var ungrouped = [];
  for (const s of allSets) {
    if (!EXERCISE_MUSCLE[s.exerciseName] && !customMap[s.exerciseName]) {
      if (!ungrouped.find(function(e) { return e.name === s.exerciseName; })) {
        ungrouped.push({ name: s.exerciseName, custom: false });
      }
    }
  }

  function makeExRow(item) {
    var name = item.name;
    var info = getExerciseInfo(name);
    var safeName = name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var deleteBtn = item.custom
      ? '<button class="btn-icon btn-icon-danger" style="margin-left:4px" onclick="event.stopPropagation();deleteCustomExercise(' + item.customId + ',this)" title="Löschen">' + iconTrash() + '</button>'
      : '<button class="btn-icon btn-icon-danger" style="margin-left:4px" onclick="event.stopPropagation();hideLibraryExercise(\'' + safeName + '\')" title="Löschen">' + iconTrash() + '</button>';
    return '<div class="exercise-list-row" data-name="' + esc(name) + '" onclick="showExerciseDetail(\'' + safeName + '\')">'
      + '<div class="ex-row-info">'
      + '<span class="ex-row-name">' + esc(name) + '</span>'
      + (info.area ? '<span class="ex-row-area">' + esc(info.area) + '</span>' : '')
      + '</div>'
      + deleteBtn
      + '</div>';
  }

  let rows = '';
  function makeGroupSection(label, itemsHtml, open) {
    var id = 'exg-' + label.replace(/[^a-z0-9]/gi, '_');
    return '<div class="ex-group-header ex-group-toggle' + (open ? ' open' : '') + '" data-group="' + esc(label) + '" onclick="toggleExGroup(\'' + id + '\',this)">'
      + '<span>' + esc(label) + '</span>'
      + '<svg class="ex-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
      + '</div>'
      + '<div class="ex-group-body" id="' + id + '" style="' + (open ? '' : 'display:none') + '">'
      + itemsHtml
      + '</div>';
  }

  // Custom exercises at the top
  if (customExercises.length) {
    rows += makeGroupSection('Meine Übungen',
      customExercises.map(function(cx) {
        return makeExRow({ name: cx.name, custom: true, customId: cx.id });
      }).join(''), false);
  }
  for (const [group, items] of Object.entries(groupMap)) {
    if (!items.length) continue;
    rows += makeGroupSection(group, items.map(makeExRow).join(''), false);
  }
  if (ungrouped.length) {
    rows += makeGroupSection('Sonstige', ungrouped.map(makeExRow).join(''), false);
  }

  el.innerHTML = '<div class="page-header" style="display:flex;align-items:center;justify-content:space-between">'
    + '<h1 class="page-title">Übungen</h1>'
    + '<button class="btn btn-primary btn-sm" onclick="toggleAddExerciseForm()">' + iconPlus(14) + ' Neue Übung</button>'
    + '</div>'

    // ── Add exercise form (hidden by default) ──
    + '<div id="add-ex-form" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px">'
    + '<div class="section-title" style="margin-bottom:12px">Eigene Übung hinzufügen</div>'
    + '<input type="text" id="new-ex-name" class="form-input" placeholder="Übungsname" style="margin-bottom:10px" autocomplete="off">'
    + '<select id="new-ex-group" class="form-input" style="margin-bottom:14px">'
    + '<option value="">— Muskelgruppe wählen —</option>'
    + groupOptions
    + '</select>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="btn btn-primary" style="flex:1" onclick="saveCustomExercise()">Speichern</button>'
    + '<button class="btn btn-ghost" onclick="toggleAddExerciseForm()">Abbrechen</button>'
    + '</div>'
    + '</div>'

    + '<div class="search-bar" style="margin-bottom:12px">' + iconSearch()
    + '<input type="text" id="ex-page-search" placeholder="Übung suchen…" oninput="filterExerciseList(this.value)" autocomplete="off"></div>'
    + '<div id="ex-page-list">' + rows + '</div>';
}

function toggleAddExerciseForm() {
  var form = document.getElementById('add-ex-form');
  if (!form) return;
  var isHidden = form.style.display === 'none';
  form.style.display = isHidden ? '' : 'none';
  if (isHidden) document.getElementById('new-ex-name').focus();
}

async function saveCustomExercise() {
  var name = (document.getElementById('new-ex-name').value || '').trim();
  var group = document.getElementById('new-ex-group').value;
  if (!name) { document.getElementById('new-ex-name').focus(); return; }
  if (!group) { document.getElementById('new-ex-group').focus(); return; }
  await dbAdd('customExercises', { name: name, muscleGroup: group });
  await loadCustomExercisesIntoLibrary();
  go('uebungen');
}

async function deleteCustomExercise(id, btn) {
  await dbDelete('customExercises', id);
  // Remove the row directly without re-rendering the full page
  var row = btn ? btn.closest('.exercise-list-row') : null;
  if (row) {
    row.remove();
  } else {
    go('uebungen');
  }
}

function hideLibraryExercise(name) {
  var hidden = JSON.parse(localStorage.getItem('hiddenLibExercises') || '[]');
  if (!hidden.includes(name)) hidden.push(name);
  localStorage.setItem('hiddenLibExercises', JSON.stringify(hidden));
  go('uebungen');
}

function toggleExGroup(id, header) {
  var body = document.getElementById(id);
  if (!body) return;
  var open = body.style.display === 'none';
  body.style.display = open ? '' : 'none';
  header.classList.toggle('open', open);
}

function filterExerciseList(query) {
  const list = document.getElementById('ex-page-list');
  if (!list) return;
  const q = query.toLowerCase();
  list.querySelectorAll('.ex-group-body').forEach(function(body) {
    var header = body.previousElementSibling;
    var groupName = header ? header.textContent.toLowerCase() : '';
    var hasVisible = false;
    body.querySelectorAll('.exercise-list-row').forEach(function(row) {
      var name = row.querySelector('.ex-row-name').textContent.toLowerCase();
      var show = !q || name.includes(q) || groupName.includes(q);
      row.style.display = show ? '' : 'none';
      if (show) hasVisible = true;
    });
    if (header) header.style.display = hasVisible ? '' : 'none';
    // Auto-expand groups that have matches when searching
    if (hasVisible && q) body.style.display = '';
    else if (!q) {} // keep current toggle state
    else body.style.display = 'none';
  });
}

// ── wger.de image integration ─────────────────────────────────
// Free open-source exercise database — no API key required.
// Category IDs: 11=Chest, 12=Back, 13=Shoulders, 8=Arms, 9=Legs, 14=Calves, 10=Abs, 15=Cardio

const _WGER_CAT = {
  'Brust': 11, 'Rücken': 12, 'Schultern': 13,
  'Bizeps': 8, 'Trizeps': 8, 'Unterarme & Griffkraft': 8,
  'Beine — Quadrizeps': 9, 'Beine — Hamstrings & Gesäß': 9, 'Beine — Waden': 14,
  'Bauch & Core': 10, 'Cardio & Kondition': 15, 'Ganzkörper & Compound': 12
};

// German exercise base name → English keyword to match in wger translations
const _DE_EN = [
  ['Bankdrücken',         'bench press'],
  ['Kurzhantel Bankdrücken', 'dumbbell bench press'],
  ['Kniebeugen',          'squat'],
  ['Frontkniebeugen',     'front squat'],
  ['Klimmzüge',           'chin'],
  ['Latzug',              'lat pulldown'],
  ['Rudern mit Stange',   'barbell row'],
  ['Rudern mit Kurzhantel','dumbbell row'],
  ['T-Bar Rudern',        't-bar row'],
  ['Rudern an Maschine',  'machine row'],
  ['Seilzug Rudern',      'cable row'],
  ['Kreuzheben',          'deadlift'],
  ['Rumänisches Kreuzheben','romanian deadlift'],
  ['Schulterdrücken',     'shoulder press'],
  ['Arnold Press',        'arnold'],
  ['Seitheben',           'lateral raise'],
  ['Frontheben',          'front raise'],
  ['Upright Rows',        'upright row'],
  ['Face Pulls',          'face pull'],
  ['Reverse Fliegende',   'reverse fly'],
  ['Shrugs',              'shrug'],
  ['Bizepscurls',         'bicep curl'],
  ['Hammercurls',         'hammer curl'],
  ['Konzentrationscurls', 'concentration curl'],
  ['Preacher Curls',      'preacher curl'],
  ['Incline Dumbbell Curls','incline dumbbell curl'],
  ['Zottman Curls',       'zottman'],
  ['Reverse Curls',       'reverse curl'],
  ['Kabelcurls',          'cable curl'],
  ['Trizepsdrücken',      'triceps pushdown'],
  ['Skull Crusher',       'skull crusher'],
  ['Close-Grip Bankdrücken','close grip bench'],
  ['Overhead Trizepsdrücken','overhead triceps'],
  ['Kickbacks',           'kickback'],
  ['Beinpresse',          'leg press'],
  ['Beinstrecker',        'leg extension'],
  ['Beinbeuger',          'leg curl'],
  ['Ausfallschritte',     'lunge'],
  ['Bulgarian Split',     'bulgarian split'],
  ['Step-Ups',            'step up'],
  ['Hip Thrust',          'hip thrust'],
  ['Glute Bridge',        'glute bridge'],
  ['Nordic',              'nordic'],
  ['Wadenheben',          'calf raise'],
  ['Fliegende',           'fly'],
  ['Kabelcrossover',      'cable crossover'],
  ['Pec Deck',            'pec deck'],
  ['Dips',                'dip'],
  ['Push-Ups',            'push up'],
  ['Hyperextension',      'back extension'],
  ['Good Mornings',       'good morning'],
  ['Straight-Arm Pulldown','straight arm pulldown'],
  ['Crunches',            'crunch'],
  ['Sit-Ups',             'sit-up'],
  ['Plank',               'plank'],
  ['Hanging Leg Raises',  'hanging leg raise'],
  ['Leg Raises',          'leg raise'],
  ['Russian Twists',      'russian twist'],
  ['Ab Roller',           'ab roller'],
  ['Dragon Flag',         'dragon flag'],
  ['Woodchoppers',        'wood chop'],
  ['Pallof Press',        'pallof'],
  ['Kettlebell Swing',    'kettlebell swing'],
  ['Burpees',             'burpee'],
  ['Thrusters',           'thruster'],
  ['Farmers Walk',        'farmers walk'],
  ['Turkish Get-Up',      'turkish get-up'],
];

// Two-level cache: category exercises list + per-exercise image URL
const _wgerCatCache = {};
const _wgerImgCache = {};

async function _wgerFetchCategory(catId) {
  if (_wgerCatCache[catId]) return _wgerCatCache[catId];
  const url = 'https://wger.de/api/v2/exerciseinfo/?format=json&limit=200'
    + (catId ? '&category=' + catId : '&limit=100');
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json();
  _wgerCatCache[catId] = data.results || [];
  return _wgerCatCache[catId];
}

async function fetchWgerExerciseImage(name) {
  if (_wgerImgCache[name] !== undefined) return _wgerImgCache[name];
  try {
    const muscle = EXERCISE_MUSCLE[name] || '';
    const catId = _WGER_CAT[muscle] || null;

    // Find English keyword
    let enKw = null;
    const nameLower = name.toLowerCase();
    for (var i = 0; i < _DE_EN.length; i++) {
      if (nameLower.includes(_DE_EN[i][0].toLowerCase())) { enKw = _DE_EN[i][1]; break; }
    }
    if (!enKw) { _wgerImgCache[name] = null; return null; }

    const exercises = await _wgerFetchCategory(catId);
    const kwLower = enKw.toLowerCase();
    let best = null;
    for (var j = 0; j < exercises.length; j++) {
      const ex = exercises[j];
      if (!ex.images || !ex.images.length) continue;
      const hit = ex.translations && ex.translations.some(function(t) {
        return t.name && t.name.toLowerCase().includes(kwLower);
      });
      if (hit) { best = ex; break; }
    }

    const mainImg = best ? (best.images.find(function(i) { return i.is_main; }) || best.images[0]) : null;
    const imgUrl = mainImg ? mainImg.image : null;
    _wgerImgCache[name] = imgUrl;
    return imgUrl;
  } catch (e) { _wgerImgCache[name] = null; return null; }
}

async function showExerciseDetail(exName) {
  const history = await getExerciseHistory(exName);

  let tableHtml = '';
  if (history.length > 0) {
    tableHtml = '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">'
      + '<thead><tr style="color:var(--muted);text-transform:uppercase;font-size:11px;letter-spacing:0.06em">'
      + '<th style="text-align:left;padding:6px 0;font-weight:700">Datum</th>'
      + '<th style="text-align:center;padding:6px 0;font-weight:700">Sätze</th>'
      + '<th style="text-align:center;padding:6px 0;font-weight:700">Max kg</th>'
      + '<th style="text-align:right;padding:6px 0;font-weight:700">Volumen</th>'
      + '</tr></thead><tbody>'
      + history.map(function(h) {
        return '<tr style="border-top:1px solid var(--border)">'
          + '<td style="padding:8px 0">' + formatDate(h.date) + '</td>'
          + '<td style="text-align:center;padding:8px 0">' + h.sets + '</td>'
          + '<td style="text-align:center;padding:8px 0">' + h.maxKg + ' kg</td>'
          + '<td style="text-align:right;padding:8px 0">' + h.volume.toLocaleString('de') + ' kg</td>'
          + '</tr>';
      }).join('') + '</tbody></table>';
  }

  const info = getExerciseInfo(exName);
  const muscle = EXERCISE_MUSCLE[exName] || '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal">'
    + '<div class="modal-header"><span class="modal-title">' + esc(exName) + '</span>'
    + '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&#x2715;</button></div>'
    + '<div class="modal-body">'
    // Muscle info
    + '<div class="ex-detail-info">'
    + (muscle ? '<span class="muscle-chip">' + esc(muscle) + '</span>' : '')
    + (info.area ? '<div class="ex-detail-area">' + esc(info.area) + '</div>' : '')
    + '</div>'
    // Muscle body SVG
    + '<div class="ex-body-map">' + muscleBodySVG(info.primary, info.secondary, 520) + '</div>'
    // History
    + (history.length > 1 ? '<div class="chart-wrap" style="margin-top:20px"><canvas class="chart" id="ex-chart" height="160"></canvas></div>' : '')
    + (history.length === 0 ? emptyState('🗓️', 'Noch keine Einheiten', 'Starte dein erstes Workout.') : '')
    + tableHtml + '</div></div>';
  document.body.appendChild(overlay);

  if (history.length > 1) {
    const canvas = overlay.querySelector('#ex-chart');
    drawLineChart(canvas, history.map(function(h) { return { x: h.date, y: h.maxKg }; }), '#4f7dff');
  }

}

async function getExerciseHistory(name) {
  const allSets = await dbGetAll('workoutSets');
  const sessions = await dbGetAll('workoutSessions');
  const sessionMap = {};
  for (const s of sessions) sessionMap[s.id] = s;

  const bySession = {};
  for (const s of allSets) {
    if (s.exerciseName !== name) continue;
    const sess = sessionMap[s.sessionId];
    if (!sess || !sess.completed) continue;
    if (!bySession[s.sessionId]) bySession[s.sessionId] = { date: sess.startedAt, sets: 0, maxKg: 0, volume: 0 };
    bySession[s.sessionId].sets++;
    bySession[s.sessionId].maxKg = Math.max(bySession[s.sessionId].maxKg, s.weight);
    bySession[s.sessionId].volume += s.weight * s.reps;
  }
  return Object.values(bySession).sort(function(a, b) { return a.date - b.date; });
}

async function getLastSetsForExercise(name) {
  const allSets = await dbGetAll('workoutSets');
  const sessions = await dbGetAll('workoutSessions');
  const completed = sessions.filter(function(s) { return s.completed; })
    .sort(function(a, b) { return b.startedAt - a.startedAt; });
  for (const sess of completed) {
    const sets = allSets.filter(function(s) { return s.sessionId === sess.id && s.exerciseName === name; });
    if (sets.length > 0) {
      return sets.sort(function(a, b) { return a.setNumber - b.setNumber; })
        .map(function(s) { return { kg: s.weight, reps: s.reps }; });
    }
  }
  return [];
}

// ── Profil Page ───────────────────────────────────────────────

function getProfileData() {
  try { return JSON.parse(localStorage.getItem('fittracker_profile') || '{}'); } catch(e) { return {}; }
}
function saveProfileField(key, value) {
  var p = getProfileData();
  p[key] = value;
  localStorage.setItem('fittracker_profile', JSON.stringify(p));
  scheduleSave();
}
function calcBMI(weight, height) {
  if (!weight || !height) return null;
  return (weight / ((height/100) * (height/100))).toFixed(1);
}
function bmiLabel(bmi) {
  if (bmi < 18.5) return { text: 'Untergewicht', color: '#f87171' };
  if (bmi < 25)   return { text: 'Normalgewicht', color: '#4ade80' };
  if (bmi < 30)   return { text: 'Übergewicht',   color: '#facc15' };
  return                  { text: 'Adipositas',    color: '#f87171' };
}

async function renderProfile(el) {
  const [sessions, stats] = await Promise.all([dbGetAll('workoutSessions'), dbGetAll('bodyStats')]);
  const completed = sessions.filter(function(s) { return s.completed; });
  const statsSort = stats.slice().sort(function(a, b) { return b.date - a.date; });
  const profile = getProfileData();

  const now = new Date();
  const dow = now.getDay();
  const diffToMon = (dow === 0 ? -6 : 1 - dow);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMon);
  weekStart.setHours(0, 0, 0, 0);
  const thisWeek = completed.filter(function(s) { return s.startedAt >= weekStart.getTime(); }).length;
  const streak = calcStreak(completed);

  // BMI
  const latestWeight = statsSort.length > 0 ? statsSort[0].weight : (profile.weight || null);
  const bmi = calcBMI(latestWeight, profile.height);
  const bmiInfo = bmi ? bmiLabel(parseFloat(bmi)) : null;

  // age from birthday
  var age = '';
  if (profile.birthday) {
    var bd = new Date(profile.birthday);
    var ageDiff = Date.now() - bd.getTime();
    age = Math.floor(ageDiff / (365.25 * 24 * 3600 * 1000));
  }

  let html = '<div class="page-header"><h1 class="page-title">Profil</h1></div>';

  // ── Avatar + Name ──
  html += '<div class="profil-hero">'
    + '<div class="profil-avatar">' + (profile.name ? profile.name.charAt(0).toUpperCase() : '?') + '</div>'
    + '<div class="profil-hero-info">'
    + '<div class="profil-name">' + esc(profile.name || 'Dein Name') + '</div>'
    + '<div class="profil-meta">'
    + (age ? age + ' Jahre' : '') + (age && profile.height ? ' · ' : '') + (profile.height ? profile.height + ' cm' : '')
    + '</div>'
    + (bmi ? '<div class="profil-bmi" style="color:' + bmiInfo.color + '">BMI ' + bmi + ' · ' + bmiInfo.text + '</div>' : '')
    + '</div>'
    + '</div>';

  // ── Persönliche Daten ──
  var latestWeightDisplay = latestWeight ? latestWeight + ' kg' : '';
  html += '<div class="section-title">Persönliche Daten</div>'
    + '<div class="profil-form">'
    + profilField('Name', 'text', 'name', profile.name || '', 'Dein Name', '👤', 'icon-bg-blue')
    + profilField('Geburtstag', 'date', 'birthday', profile.birthday || '', '', '🎂', 'icon-bg-purple')
    + profilField('Größe (cm)', 'number', 'height', profile.height || '', '175', '📏', 'icon-bg-teal')
    + '<div class="profil-row profil-row-select" onclick="showAddWeightModal()">'
    + '<span class="profil-label"><span class="profil-label-icon icon-bg-green">⚖️</span>Körpergewicht</span>'
    + '<span class="profil-select-val' + (latestWeightDisplay ? '' : ' muted') + '">' + (latestWeightDisplay || '— eintragen —')
    + ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4"><polyline points="6 9 12 15 18 9"/></svg></span>'
    + '</div>'
    + profilField('Zielgewicht (kg)', 'number', 'goalWeight', profile.goalWeight || '', '75', '🎯', 'icon-bg-orange')
    + '</div>'
    + (statsSort.length > 1 ? '<div class="card" style="margin-bottom:16px;padding:14px 16px"><div style="font-size:12px;color:var(--soft);margin-bottom:8px">Gewichtsverlauf</div><div class="chart-wrap"><canvas class="chart" id="weight-chart" height="100"></canvas></div></div>' : '')
    + (function() {
        const measureEntries = statsSort.filter(function(s) { return s.chest || s.waist || s.arms || s.hips; });
        if (measureEntries.length < 2) return '';
        const mData = measureEntries.slice().reverse();
        return '<div class="card" style="margin-bottom:16px;padding:14px 16px">'
          + '<div style="font-size:12px;color:var(--soft);margin-bottom:8px">Körpermaße (cm)</div>'
          + '<div class="measures-legend">'
          + ['chest','waist','arms','hips'].map(function(k,i) {
              var label = {chest:'Brust',waist:'Taille',arms:'Arme',hips:'Hüfte'}[k];
              var color = ['#4f7ef8','#30d158','#ff9f0a','#a78bfa'][i];
              var latest = mData[mData.length-1][k];
              return latest ? '<span class="measure-legend-item"><span style="background:'+color+'"></span>'+label+' '+latest+'cm</span>' : '';
            }).join('')
          + '</div>'
          + (function() {
              var lines = '';
              var colors = ['#4f7ef8','#30d158','#ff9f0a','#a78bfa'];
              var keys = ['chest','waist','arms','hips'];
              keys.forEach(function(k, i) {
                var pts = mData.filter(function(d){ return d[k]; }).map(function(d){ return {x: d.date, y: d[k]}; });
                if (pts.length >= 2) lines += makeSvgLineChart(pts, 'y', colors[i]);
              });
              return lines || '';
            })()
          + '</div>';
      })();

  // ── Ziel & Erfahrung ──
  html += '<div class="section-title">Training</div>'
    + '<div class="profil-form">'
    + profilSelect('Ziel', 'goal', profile.goal || '', ['', 'Muskelaufbau', 'Gewicht verlieren', 'Kraft aufbauen', 'Fitness verbessern', 'Abnehmen & Muskelaufbau'], '🏆', 'icon-bg-orange')
    + profilSelect('Erfahrungslevel', 'level', profile.level || '', ['', 'Anfänger', 'Fortgeschritten', 'Profi'], '⚡', 'icon-bg-purple')
    + profilSelect('Trainingstage / Woche', 'daysPerWeek', profile.daysPerWeek || '', ['', '2', '3', '4', '5', '6'], '📅', 'icon-bg-blue')
    + profilSelect('Equipment', 'equipment', profile.equipment || '', ['', 'Fitnessstudio', 'Heimtraining', 'Outdoor', 'Beides'], '🏋️', 'icon-bg-green')
    + '</div>';

  // ── Trainingsstatistiken ──
  html += '<div class="section-title">Übersicht</div>'
    + '<div class="stats-row">'
    + '<div class="stat-card"><div class="stat-value">' + completed.length + '</div><div class="stat-label">Workouts</div></div>'
    + '<div class="stat-card"><div class="stat-value">' + thisWeek + '</div><div class="stat-label">Diese Woche</div></div>'
    + '<div class="stat-card"><div class="stat-value">' + streak + '</div><div class="stat-label">Streak (W)</div></div>'
    + '</div>';


  // ── Design ──
  var currentTheme = localStorage.getItem('fittracker_theme') || 'dark';
  var currentAccent = localStorage.getItem('fittracker_accent') || '#4f7ef8';
  var themes = [
    { id: 'dark',  label: 'Dark',  color: '#17171d' },
    { id: 'light', label: 'Light', color: '#ffffff' },
  ];
  html += '<div class="section-title">Design</div>'
    + '<div class="theme-picker">';
  for (var th of themes) {
    html += '<button class="theme-option' + (th.id === currentTheme ? ' active' : '') + '" onclick="applyTheme(\'' + th.id + '\');renderProfile(document.getElementById(\'content-inner\'))">'
      + '<div class="theme-preview" style="background:' + th.color + ';border-color:' + (th.id === currentTheme ? currentAccent : 'transparent') + '">'
      + '<div class="theme-preview-bar" style="background:' + currentAccent + '"></div>'
      + '<div class="theme-preview-lines"><div style="background:' + (th.id === 'light' ? '#e0e0e0' : '#ffffff22') + '"></div><div style="background:' + (th.id === 'light' ? '#e0e0e0' : '#ffffff22') + '"></div></div>'
      + '</div>'
      + '<span class="theme-label">' + th.label + '</span>'
      + (th.id === currentTheme ? '<span class="theme-check">✓</span>' : '')
      + '</button>';
  }
  html += '</div>';

  html += '<div class="accent-label">Akzentfarbe</div><div class="accent-picker">';
  for (var ac of ACCENT_COLORS) {
    var isActive = currentAccent === ac.hex;
    html += '<button class="accent-swatch' + (isActive ? ' active' : '') + '" onclick="applyAccent(\'' + ac.hex + '\')" title="' + ac.label + '" style="background:' + ac.hex + '">'
      + (isActive ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '')
      + '</button>';
  }
  html += '</div>';

  // ── PIN ändern ──
  html += '<div class="section-title">Sicherheit</div>'
    + '<div class="card" style="margin-bottom:16px">'
    + '<button class="btn btn-ghost" style="width:100%" onclick="resetPin()">PIN zurücksetzen</button>'
    + '</div>';

  // ── Account ──
  var userEmail = _currentUser ? _currentUser.email : '';
  html += '<div class="section-title">Account</div>'
    + '<div class="card" style="margin-bottom:16px">'
    + '<p style="font-size:0.85rem;color:var(--muted);margin:0 0 10px">Angemeldet als <strong style="color:var(--text)">' + escHtml(userEmail) + '</strong></p>'
    + '<p style="font-size:0.8rem;color:#4ade80;margin:0 0 10px">✅ Daten werden automatisch synchronisiert</p>'
    + '<button class="btn btn-ghost" style="width:100%;color:#f87171" onclick="authLogout()">Abmelden</button>'
    + '</div>';


  el.innerHTML = html;

  if (statsSort.length > 1) {
    const canvas = el.querySelector('#weight-chart');
    const data = statsSort.slice().reverse().map(function(e) { return { x: e.date, y: e.weight }; });
    drawLineChart(canvas, data, '#30d158');
  }
}

function profilField(label, type, key, value, placeholder, icon, iconBg) {
  var iconHtml = icon ? '<span class="profil-label-icon ' + (iconBg||'icon-bg-blue') + '">' + icon + '</span>' : '';
  var display = value ? esc(String(value)) : '';
  if (type === 'date' && value) {
    var parts = value.split('-');
    if (parts.length === 3) display = parts[2] + '.' + parts[1] + '.' + parts[0];
  }
  return '<div class="profil-row profil-row-select" onclick="showProfilFieldSheet(\'' + key + '\',\'' + label + '\',\'' + type + '\',\'' + esc(String(value || '')) + '\',\'' + placeholder + '\')">'
    + '<span class="profil-label">' + iconHtml + label + '</span>'
    + '<span class="profil-select-val' + (display ? '' : ' muted') + '">' + (display || placeholder || '— eingeben —')
    + ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4"><polyline points="6 9 12 15 18 9"/></svg>'
    + '</span>'
    + '</div>';
}

function showProfilFieldSheet(key, label, type, value, placeholder) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:flex-end;justify-content:center;padding:0';

  var bodyHtml = '';
  if (type === 'date') {
    var parts = value ? value.split('-') : ['', '', ''];
    var y = parts[0] || '', m = parts[1] || '', d = parts[2] || '';
    bodyHtml = '<div class="pfs-date-grid">'
      + '<div class="pfs-col"><div class="pfs-col-label">Tag</div><input class="pfs-input" id="pfs-d" type="number" min="1" max="31" placeholder="TT" value="' + d + '"></div>'
      + '<div class="pfs-col"><div class="pfs-col-label">Monat</div><input class="pfs-input" id="pfs-m" type="number" min="1" max="12" placeholder="MM" value="' + m + '"></div>'
      + '<div class="pfs-col"><div class="pfs-col-label">Jahr</div><input class="pfs-input pfs-input-wide" id="pfs-y" type="number" min="1900" max="2099" placeholder="JJJJ" value="' + y + '"></div>'
      + '</div>';
  } else if (type === 'number') {
    var num = parseFloat(value) || 0;
    var step = (key === 'height' || key === 'goalWeight') ? 0.5 : 1;
    var unit = key === 'height' ? 'cm' : key === 'goalWeight' ? 'kg' : '';
    bodyHtml = '<div class="pfs-number-wrap">'
      + '<button class="pfs-stepper" onclick="pfsStep(-' + step + ',' + step + ')">−</button>'
      + '<div class="pfs-number-display" onclick="pfsEditManual()">'
      + '<input id="pfs-num-val" class="pfs-num-input" type="number" inputmode="decimal" value="' + (num || '') + '" placeholder="' + (placeholder||'0') + '" step="' + step + '">'
      + '<span class="pfs-unit">' + unit + '</span>'
      + '</div>'
      + '<button class="pfs-stepper" onclick="pfsStep(' + step + ',' + step + ')">+</button>'
      + '</div>';
  } else {
    bodyHtml = '<input class="pfs-text-input" id="pfs-text" type="text" placeholder="' + esc(placeholder||label) + '" value="' + esc(value) + '" autofocus>';
  }

  var sheet = document.createElement('div');
  sheet.className = 'profil-sheet';
  sheet.innerHTML = '<div class="profil-sheet-handle"></div>'
    + '<div class="profil-sheet-title">' + esc(label) + '</div>'
    + '<div class="pfs-body">' + bodyHtml + '</div>'
    + '<div class="pfs-actions">'
    + '<button class="pfs-btn-cancel" onclick="this.closest(\'.modal-overlay\').remove()">Abbrechen</button>'
    + '<button class="pfs-btn-save" onclick="saveProfilField(\'' + key + '\',\'' + type + '\')">Speichern</button>'
    + '</div>';

  overlay.appendChild(sheet);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  // auto-focus text
  setTimeout(function() {
    var inp = sheet.querySelector('#pfs-text');
    if (inp) inp.focus();
  }, 100);
}

window.pfsStep = function(delta) {
  var inp = document.getElementById('pfs-num-val');
  var current = parseFloat(inp.value) || 0;
  var next = Math.round((current + delta) * 100) / 100;
  if (next < 0) next = 0;
  inp.value = next;
};

window.pfsEditManual = function() {
  var inp = document.getElementById('pfs-num-val');
  if (inp) { inp.focus(); inp.select(); }
};

window.saveProfilField = function(key, type) {
  var val = '';
  if (type === 'date') {
    var d = (document.getElementById('pfs-d').value || '').padStart(2,'0');
    var m = (document.getElementById('pfs-m').value || '').padStart(2,'0');
    var y = document.getElementById('pfs-y').value || '';
    if (y && m && d) val = y + '-' + m + '-' + d;
  } else if (type === 'number') {
    val = document.getElementById('pfs-num-val').value;
  } else {
    val = document.getElementById('pfs-text').value.trim();
  }
  saveProfileField(key, val);
  document.querySelector('.modal-overlay').remove();
  renderProfile(document.getElementById('content-inner'));
};

function profilSelect(label, key, value, options, icon, iconBg) {
  var iconHtml = icon ? '<span class="profil-label-icon ' + (iconBg||'icon-bg-blue') + '">' + icon + '</span>' : '';
  var displayVal = value || '';
  var displayText = displayVal || '— wählen —';
  var optsJson = JSON.stringify(options).replace(/'/g, '&#39;');
  return '<div class="profil-row profil-row-select" onclick="showProfilSelectSheet(\'' + key + '\',\'' + label + '\',' + optsJson.replace(/"/g, '&quot;') + ')">'
    + '<span class="profil-label">' + iconHtml + label + '</span>'
    + '<span class="profil-select-val' + (displayVal ? '' : ' muted') + '">' + esc(displayText)
    + ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4"><polyline points="6 9 12 15 18 9"/></svg>'
    + '</span>'
    + '</div>';
}

function showProfilSelectSheet(key, label, options) {
  var current = getProfileData()[key] || '';
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:flex-end;justify-content:center;padding:0';
  var sheet = document.createElement('div');
  sheet.className = 'profil-sheet';
  sheet.innerHTML = '<div class="profil-sheet-handle"></div>'
    + '<div class="profil-sheet-title">' + esc(label) + '</div>'
    + '<div class="profil-sheet-options">'
    + options.filter(function(o) { return o !== ''; }).map(function(o) {
        return '<button class="profil-sheet-opt' + (o === current ? ' selected' : '') + '" onclick="pickProfilOption(\'' + key + '\',\'' + o.replace(/'/g,"&#39;") + '\')">'
          + '<span>' + esc(o) + '</span>'
          + (o === current ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '')
          + '</button>';
      }).join('')
    + '</div>'
    + '<button class="profil-sheet-cancel" onclick="this.closest(\'.modal-overlay\').remove()">Abbrechen</button>';
  overlay.appendChild(sheet);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function pickProfilOption(key, value) {
  saveProfileField(key, value);
  document.querySelector('.modal-overlay').remove();
  renderProfile(document.getElementById('content-inner'));
}

function resetPin() {
  if (!confirm('PIN wirklich zurücksetzen? Du musst danach einen neuen einrichten.')) return;
  localStorage.removeItem('fittracker_pin');
  localStorage.removeItem('fittracker_pin_mode');
  localStorage.removeItem('fittracker_pin_tmp');
  location.reload();
}

function calcStreak(completed) {
  if (!completed.length) return 0;
  function isoWeekKey(ts) {
    const d = new Date(ts);
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const sw = new Date(jan4);
    sw.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    const diff = d - sw;
    const week = Math.ceil((diff / 86400000 + 1) / 7);
    return d.getFullYear() + '-' + week;
  }
  const weeks = {};
  for (const s of completed) weeks[isoWeekKey(s.startedAt)] = true;
  let streak = 0;
  let ts = Date.now();
  while (weeks[isoWeekKey(ts)]) { streak++; ts -= 7 * 86400000; }
  return streak;
}

function showAddWeightModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal">'
    + '<div class="modal-header"><span class="modal-title">Körperdaten eintragen</span>'
    + '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&#x2715;</button></div>'
    + '<div class="modal-body">'
    + '<div class="measure-tabs"><button class="measure-tab active" id="mtab-weight" onclick="switchMeasureTab(\'weight\')">Gewicht</button>'
    + '<button class="measure-tab" id="mtab-measures" onclick="switchMeasureTab(\'measures\')">Maße</button></div>'
    + '<div id="mtab-weight-body"><div class="form-group"><label class="form-label">Gewicht (kg)</label>'
    + '<input class="form-input" id="weight-input" type="number" min="0" step="0.1" placeholder="75.0"></div></div>'
    + '<div id="mtab-measures-body" style="display:none">'
    + '<div class="measures-grid">'
    + '<div class="form-group"><label class="form-label">Brust (cm)</label><input class="form-input" id="m-chest" type="number" min="0" step="0.5" placeholder="100"></div>'
    + '<div class="form-group"><label class="form-label">Taille (cm)</label><input class="form-input" id="m-waist" type="number" min="0" step="0.5" placeholder="80"></div>'
    + '<div class="form-group"><label class="form-label">Arme (cm)</label><input class="form-input" id="m-arms" type="number" min="0" step="0.5" placeholder="35"></div>'
    + '<div class="form-group"><label class="form-label">Hüfte (cm)</label><input class="form-input" id="m-hips" type="number" min="0" step="0.5" placeholder="95"></div>'
    + '</div></div>'
    + '</div>'
    + '<div class="modal-footer">'
    + '<button class="btn btn-ghost" onclick="this.closest(\'.modal-overlay\').remove()">Abbrechen</button>'
    + '<button class="btn btn-primary" id="weight-save">Speichern</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#weight-input').focus();
  overlay.querySelector('#weight-save').addEventListener('click', async function() {
    const activeTab = overlay.querySelector('.measure-tab.active').id;
    if (activeTab === 'mtab-weight') {
      const val = parseFloat(overlay.querySelector('#weight-input').value);
      if (!val || val <= 0) return;
      await dbAdd('bodyStats', { date: Date.now(), weight: val });
    } else {
      const chest = parseFloat(overlay.querySelector('#m-chest').value) || null;
      const waist = parseFloat(overlay.querySelector('#m-waist').value) || null;
      const arms  = parseFloat(overlay.querySelector('#m-arms').value)  || null;
      const hips  = parseFloat(overlay.querySelector('#m-hips').value)  || null;
      if (!chest && !waist && !arms && !hips) return;
      await dbAdd('bodyStats', { date: Date.now(), chest, waist, arms, hips });
    }
    overlay.remove();
    go('profil');
  });
}


function showToast(msg) {
  var t = document.createElement('div');
  t.className = 'app-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.classList.add('show'); }, 10);
  setTimeout(function() { t.classList.remove('show'); setTimeout(function(){ t.remove(); }, 300); }, 2500);
}

function switchMeasureTab(tab) {
  document.getElementById('mtab-weight').classList.toggle('active', tab === 'weight');
  document.getElementById('mtab-measures').classList.toggle('active', tab === 'measures');
  document.getElementById('mtab-weight-body').style.display = tab === 'weight' ? '' : 'none';
  document.getElementById('mtab-measures-body').style.display = tab === 'measures' ? '' : 'none';
}

async function deleteWeightEntry(id) {
  if (!confirm('Eintrag löschen?')) return;
  await dbDelete('bodyStats', id);
  go('profil');
}

// ── Line Chart ────────────────────────────────────────────────

function drawLineChart(canvas, data, color) {
  if (!canvas || data.length < 2) return;
  requestAnimationFrame(function() {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 300;
    const H = parseInt(canvas.getAttribute('height')) || 160;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const pad = { top: 16, right: 16, bottom: 28, left: 40 };
    const iW = W - pad.left - pad.right;
    const iH = H - pad.top - pad.bottom;
    const vals = data.map(function(d) { return d.y; });
    const minY = Math.min.apply(null, vals) * 0.97;
    const maxY = Math.max.apply(null, vals) * 1.03;
    const rangeY = maxY - minY || 1;

    function toX(i) { return pad.left + (i / (data.length - 1)) * iW; }
    function toY(v) { return pad.top + iH - ((v - minY) / rangeY) * iH; }

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (iH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + iW, y); ctx.stroke();
    }
    ctx.fillStyle = '#48484f';
    ctx.font = '600 10px Inter,sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 2; i++) {
      const v = minY + (rangeY / 2) * i;
      ctx.fillText(Math.round(v), pad.left - 6, toY(v) + 3);
    }

    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + iH);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0].y));
    for (let i = 1; i < data.length; i++) ctx.lineTo(toX(i), toY(data[i].y));
    ctx.lineTo(toX(data.length - 1), pad.top + iH);
    ctx.lineTo(toX(0), pad.top + iH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0].y));
    for (let i = 1; i < data.length; i++) ctx.lineTo(toX(i), toY(data[i].y));
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    ctx.fillStyle = color;
    for (let i = 0; i < data.length; i++) {
      ctx.beginPath(); ctx.arc(toX(i), toY(data[i].y), 3.5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#48484f';
    ctx.font = '600 10px Inter,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatDateShort(data[0].x), toX(0), H - 6);
    ctx.fillText(formatDateShort(data[data.length - 1].x), toX(data.length - 1), H - 6);
  });
}

// ── Utilities ─────────────────────────────────────────────────

function emptyState(icon, title, sub) {
  return '<div class="empty-state">'
    + '<div class="empty-state-icon">' + icon + '</div>'
    + '<div class="empty-state-title">' + title + '</div>'
    + (sub ? '<div class="empty-state-sub">' + sub + '</div>' : '')
    + '</div>';
}

function muscleGroupColor(mg) {
  if (!mg) return 'var(--accent)';
  const m = mg.toLowerCase();
  if (m.includes('brust') || m.includes('push') || m.includes('trizeps')) return '#4f7ef8';
  if (m.includes('rücken') || m.includes('pull') || m.includes('bizeps')) return '#a78bfa';
  if (m.includes('bein') || m.includes('gesäß') || m.includes('waden')) return '#30d158';
  if (m.includes('schulter')) return '#ff9f0a';
  if (m.includes('bauch') || m.includes('core')) return '#ff6b6b';
  if (m.includes('arm') || m.includes('unterarm')) return '#06b6d4';
  if (m.includes('cardio')) return '#f59e0b';
  if (m.includes('ganzkörper') || m.includes('upper')) return '#8b5cf6';
  return 'var(--accent)';
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatTimer(ms) {
  const total = Math.floor(ms / 1000);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
}

function formatDuration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? h + 'h ' + (m % 60) + 'min' : m + 'min';
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

function groupByWeek(sessions) {
  const groups = new Map();
  const now = new Date();
  const dow = now.getDay();
  const diffToMon = (dow === 0 ? -6 : 1 - dow);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() + diffToMon);
  startOfWeek.setHours(0, 0, 0, 0);

  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const dDow = d.getDay();
    const dDiff = (dDow === 0 ? -6 : 1 - dDow);
    const wStart = new Date(d);
    wStart.setDate(d.getDate() + dDiff);
    wStart.setHours(0, 0, 0, 0);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    const diffWeeks = Math.round((startOfWeek - wStart) / (7 * 86400000));
    let label;
    if (diffWeeks === 0) label = 'Diese Woche';
    else if (diffWeeks === 1) label = 'Letzte Woche';
    else label = wStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
      + ' – ' + wEnd.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(s);
  }
  return Array.from(groups.entries());
}


// ── KI Coach ──────────────────────────────────────────────────

var _coachHistory = [];

function renderCoach(el) {
  var msgsHtml = _coachHistory.map(function(m) {
    if (m.role === 'user') {
      return '<div class="coach-msg coach-msg-user"><div class="coach-bubble coach-bubble-user">' + escHtml(m.text) + '</div></div>';
    } else {
      return '<div class="coach-msg coach-msg-ai"><div class="coach-avatar">🤖</div><div class="coach-bubble coach-bubble-ai">' + m.text + '</div></div>';
    }
  }).join('');

  if (_coachHistory.length === 0) {
    msgsHtml = '<div class="coach-welcome">'
      + '<div class="coach-welcome-icon">💪</div>'
      + '<div class="coach-welcome-title">KI Fitness Coach</div>'
      + '<div class="coach-welcome-sub">Stell mir eine Frage zu Training, Ernährung oder Regeneration.</div>'
      + '<div class="coach-chips">'
      + '<button class="coach-chip" onclick="coachAsk(\'Wie oft sollte ich pro Woche trainieren?\')">Trainingsfrequenz</button>'
      + '<button class="coach-chip" onclick="coachAsk(\'Was soll ich nach dem Training essen?\')">Post-Workout Ernährung</button>'
      + '<button class="coach-chip" onclick="coachAsk(\'Wie vermeide ich Muskelkater?\')">Muskelkater vermeiden</button>'
      + '<button class="coach-chip" onclick="coachAsk(\'Erkläre mir die progressive Überlastung.\')">Progressive Überlastung</button>'
      + '</div>'
      + '</div>';
  }

  el.innerHTML = '<div class="coach-wrap">'
    + '<div class="coach-header"><div class="coach-header-title">KI Coach</div><button class="coach-clear-btn" onclick="coachClear()">Verlauf löschen</button></div>'
    + '<div class="coach-messages" id="coach-messages">' + msgsHtml + '</div>'
    + '<div class="coach-input-bar">'
    + '<textarea id="coach-input" class="coach-input" placeholder="Frage stellen…" rows="1" onkeydown="coachKeydown(event)"></textarea>'
    + '<button class="coach-send-btn" id="coach-send-btn" onclick="coachSend()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
    + '</div></div>';

  var msgs = document.getElementById('coach-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.coachKeydown = function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); coachSend(); }
};

window.coachAsk = function(question) {
  var input = document.getElementById('coach-input');
  if (input) input.value = question;
  coachSend();
};

window.showCoachKeySheet = function() {
  var current = localStorage.getItem('fittracker_gemini_key') || '';
  var ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = '<div class="profil-sheet" style="max-width:420px">'
    + '<div class="profil-sheet-handle"></div>'
    + '<div class="profil-sheet-title">Gemini API-Key</div>'
    + '<div class="pfs-body">'
    + '<p style="font-size:0.85rem;color:var(--muted);margin:0 0 12px">Kostenlosen Key erstellen auf <strong style="color:var(--text)">aistudio.google.com</strong> → "Get API Key"</p>'
    + '<input id="coach-key-input" type="text" class="coach-input" style="width:100%;border-radius:10px;padding:12px;font-size:0.9rem;margin-bottom:4px" placeholder="AIzaSy..." value="' + escHtml(current) + '">'
    + '</div>'
    + '<div class="pfs-actions">'
    + '<button class="pfs-cancel" onclick="this.closest(\'.modal-overlay\').remove()">Abbrechen</button>'
    + '<button class="pfs-save" onclick="saveCoachKey()">Speichern</button>'
    + '</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  setTimeout(function() { var inp = document.getElementById('coach-key-input'); if (inp) inp.focus(); }, 100);
};

window.saveCoachKey = function() {
  var val = (document.getElementById('coach-key-input') || {}).value || '';
  val = val.trim();
  if (val) localStorage.setItem('fittracker_gemini_key', val);
  else localStorage.removeItem('fittracker_gemini_key');
  document.querySelector('.modal-overlay').remove();
  renderCoach(document.getElementById('content-inner'));
};

window.coachClear = function() {
  _coachHistory = [];
  renderCoach(document.getElementById('content-inner'));
};

window.coachSend = async function() {
  var input = document.getElementById('coach-input');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;

  input.value = '';
  var sendBtn = document.getElementById('coach-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  _coachHistory.push({ role: 'user', text: text });
  renderCoach(document.getElementById('content-inner'));

  var msgs = document.getElementById('coach-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;

  var profileData = getProfileData();

  // Build personal context block
  var ctx = [];
  // Use latest logged weight if available
  var latestW = profileData.weight || null;
  try {
    var stats = await dbGetAll('bodyStats');
    if (stats.length) {
      stats.sort(function(a,b){return b.date-a.date;});
      if (stats[0].weight) latestW = stats[0].weight;
    }
  } catch(e) {}

  if (profileData.name)       ctx.push('Name: ' + profileData.name);
  if (profileData.height)     ctx.push('Größe: ' + profileData.height + ' cm');
  if (latestW)                ctx.push('Körpergewicht: ' + latestW + ' kg');
  if (profileData.goalWeight) ctx.push('Zielgewicht: ' + profileData.goalWeight + ' kg');
  if (profileData.goal)       ctx.push('Trainingsziel: ' + profileData.goal);
  if (profileData.level)      ctx.push('Erfahrungslevel: ' + profileData.level);
  if (profileData.daysPerWeek)ctx.push('Trainingstage pro Woche: ' + profileData.daysPerWeek);
  if (profileData.equipment)  ctx.push('Verfügbares Equipment: ' + profileData.equipment);

  // Add current training plans
  var allPlans = [];
  try { allPlans = await dbGetAll('plans'); } catch(e) {}
  if (allPlans.length) {
    var planNames = allPlans.map(function(p) { return p.name; }).join(', ');
    ctx.push('Trainingsplan enthält: ' + planNames);
  }

  var systemPrompt = 'Du bist ein professioneller, personalisierter Fitness-Coach. Antworte immer auf Deutsch. '
    + 'Gib konkrete, umsetzbare Ratschläge zu Training, Ernährung und Regeneration. '
    + 'Passe deine Empfehlungen IMMER an die persönlichen Daten des Nutzers an. '
    + 'Halte Antworten kurz und strukturiert (max. 3-4 Absätze). '
    + 'Verwende gelegentlich passende Emojis für bessere Lesbarkeit.';

  if (ctx.length) {
    systemPrompt += '\n\nNutzerprofil:\n' + ctx.join('\n');
  }

  var messages = [{ role: 'system', content: systemPrompt }];
  for (var i = 0; i < _coachHistory.length; i++) {
    var h = _coachHistory[i];
    if (h.role === 'user') messages.push({ role: 'user', content: h.text });
    else messages.push({ role: 'assistant', content: h.text.replace(/<[^>]+>/g, '') });
  }

  var _gk = ['gsk_alPRdI8vrzQU11Oou', 'L6cWGdyb3FYfkjyjOeGL', 'DHixnzmSF7MQfoB'].join('');
  try {
    var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _gk },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: messages, max_tokens: 1024 })
    });
    if (!resp.ok) {
      var errBody = await resp.text();
      throw new Error('HTTP ' + resp.status + ': ' + errBody);
    }
    var data = await resp.json();
    var answer = data.choices && data.choices[0] ? data.choices[0].message.content : 'Keine Antwort erhalten.';

    var formatted = answer
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    formatted = '<p>' + formatted + '</p>';

    _coachHistory.push({ role: 'ai', text: formatted });
  } catch (err) {
    _coachHistory.push({ role: 'ai', text: '<p>⚠️ Fehler: ' + escHtml(err.message || String(err)) + '</p>' });
  }

  renderCoach(document.getElementById('content-inner'));
  var msgsEl = document.getElementById('coach-messages');
  if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
};

// ── Cloud Sync ────────────────────────────────────────────────

var _SYNC_STORES = ['plans','planExercises','workoutSessions','workoutSets','bodyStats','weekPlan','customExercises','weekExercises'];

async function cloudSave() {
  if (!_currentUser || !_supabase) return;
  var data = { profile: localStorage.getItem('fittracker_profile') || '{}', theme: localStorage.getItem('fittracker_theme') || 'dark' };
  for (var s of _SYNC_STORES) { try { data[s] = await dbGetAll(s); } catch(e) { data[s] = []; } }
  await _supabase.from('profiles').upsert({ id: _currentUser.id, data: data, updated_at: new Date().toISOString() });
}

async function cloudLoad() {
  if (!_currentUser || !_supabase) return;
  var result = await _supabase.from('profiles').select('data').eq('id', _currentUser.id).single();
  if (!result.data) return;
  var backup = result.data.data;
  if (!backup) return;
  if (backup.profile) localStorage.setItem('fittracker_profile', backup.profile);
  if (backup.theme) { localStorage.setItem('fittracker_theme', backup.theme); applyTheme(backup.theme); }
  for (var storeName of _SYNC_STORES) {
    if (!Array.isArray(backup[storeName])) continue;
    await new Promise(function(resolve, reject) {
      var tx = _db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = resolve; tx.onerror = function() { reject(tx.error); };
    });
    for (var item of backup[storeName]) { await dbPut(storeName, item); }
  }
}

function scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(cloudSave, 5000);
}

function startAutoSave() {
  setInterval(cloudSave, 120000);
}

// ── Boot ──────────────────────────────────────────────────────

init();
