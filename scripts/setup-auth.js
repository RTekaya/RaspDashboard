#!/usr/bin/env node
/**
 * Finalise la configuration de Firebase Auth pour la console d'admin RaspDash.
 *
 * Prérequis (une seule fois) : Firebase Auth doit être initialisé dans la
 * console web — https://console.firebase.google.com → Authentication → « Commencer ».
 * Google n'expose pas d'API publique gratuite pour cette étape.
 *
 * Ensuite ce script :
 *   1. active le provider Email/Mot de passe ;
 *   2. crée l'utilisateur admin ;
 *   3. désactive l'auto-inscription publique (personne d'autre ne peut créer de compte) ;
 *   4. vérifie que la clé API web autorise Identity Toolkit (les clés créées
 *      avant l'activation d'Auth le bloquent, d'où des connexions refusées).
 *
 * Usage : node scripts/setup-auth.js <email> <mot-de-passe>
 * (utilise la session `firebase login` du CLI Firebase)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// Client OAuth public du CLI firebase-tools (open source).
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function getProjectId() {
    const rc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.firebaserc'), 'utf8'));
    return rc.projects.default;
}

function getRefreshToken() {
    const p = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
    try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (data.tokens && data.tokens.refresh_token) return data.tokens.refresh_token;
    } catch { /* fallthrough */ }
    throw new Error("Session CLI Firebase introuvable. Lancez d'abord : firebase login");
}

async function getAccessToken() {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: getRefreshToken(),
            grant_type: 'refresh_token',
        }),
    });
    const json = await res.json();
    if (!json.access_token) throw new Error('Échec OAuth : ' + JSON.stringify(json));
    return json.access_token;
}

async function api(token, method, url, body) {
    const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json;
    try { json = await res.json(); } catch { json = {}; }
    return { status: res.status, json };
}

// La clé API web (admin/js/firebase-config.js) doit autoriser le service
// identitytoolkit.googleapis.com, sinon Google renvoie API_KEY_SERVICE_BLOCKED
// au moment de la connexion. Corrige la clé si besoin ; en cas d'échec, avertit
// sans faire échouer le reste de la configuration.
async function ensureApiKeyAllowsAuth(token) {
    const cfgSrc = fs.readFileSync(path.join(__dirname, '..', 'admin', 'js', 'firebase-config.js'), 'utf8');
    const apiKey = (cfgSrc.match(/apiKey:\s*"([^"]+)"/) || [])[1];
    const projectNumber = (cfgSrc.match(/messagingSenderId:\s*"(\d+)"/) || [])[1];
    if (!apiKey || !projectNumber) {
        console.warn('⚠ Clé API introuvable dans admin/js/firebase-config.js — vérification ignorée');
        return;
    }

    await api(token, 'POST',
        `https://serviceusage.googleapis.com/v1/projects/${projectNumber}/services/apikeys.googleapis.com:enable`, {});

    const list = await api(token, 'GET',
        `https://apikeys.googleapis.com/v2/projects/${projectNumber}/locations/global/keys`);
    if (list.status !== 200) {
        console.warn('⚠ Impossible de lister les clés API : ' + JSON.stringify(list.json));
        return;
    }

    for (const key of list.json.keys || []) {
        const ks = await api(token, 'GET', `https://apikeys.googleapis.com/v2/${key.name}/keyString`);
        if (ks.json.keyString !== apiKey) continue;

        const restrictions = key.restrictions || {};
        const targets = restrictions.apiTargets || [];
        // Sans restriction d'API, tout est déjà autorisé.
        if (!targets.length || targets.some((t) => t.service === 'identitytoolkit.googleapis.com')) {
            console.log('✓ La clé API web autorise Identity Toolkit');
            return;
        }
        targets.push({ service: 'identitytoolkit.googleapis.com' });
        const patch = await api(token, 'PATCH',
            `https://apikeys.googleapis.com/v2/${key.name}?updateMask=restrictions`,
            { restrictions: { ...restrictions, apiTargets: targets } });
        if (patch.status === 200) {
            console.log('✓ Identity Toolkit ajouté aux services autorisés de la clé API web');
        } else {
            console.warn('⚠ Correction de la clé API échouée : ' + JSON.stringify(patch.json));
        }
        return;
    }
    console.warn('⚠ Clé API web absente de la liste du projet — si la connexion est bloquée, ' +
        'ajoutez « Identity Toolkit API » à ses restrictions dans Google Cloud Console');
}

async function main() {
    const [email, password] = process.argv.slice(2);
    if (!email || !password) {
        console.error('Usage : node scripts/setup-auth.js <email> <mot-de-passe>');
        process.exit(1);
    }
    if (password.length < 6) {
        console.error('Le mot de passe doit faire au moins 6 caractères.');
        process.exit(1);
    }

    const project = getProjectId();
    console.log(`Projet : ${project}`);
    const token = await getAccessToken();

    // 1. Provider email/mot de passe
    const cfg = await api(token, 'PATCH',
        `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config?updateMask=signIn.email`,
        { signIn: { email: { enabled: true, passwordRequired: true } } });
    if (cfg.status === 404) {
        console.error(
            "\n❌ Firebase Auth n'est pas encore initialisé pour ce projet.\n" +
            `   Ouvrez https://console.firebase.google.com/project/${project}/authentication\n` +
            '   cliquez sur « Commencer » (Get started), puis relancez ce script.\n');
        process.exit(1);
    }
    if (cfg.status !== 200) throw new Error('Activation du provider échouée : ' + JSON.stringify(cfg.json));
    console.log('✓ Provider Email/Mot de passe activé');

    // 2. Utilisateur admin
    const user = await api(token, 'POST',
        `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts`,
        { email, password, emailVerified: true });
    if (user.status === 200) {
        console.log(`✓ Utilisateur admin créé : ${email}`);
    } else if (JSON.stringify(user.json).includes('EMAIL_EXISTS') || JSON.stringify(user.json).includes('DUPLICATE_EMAIL')) {
        console.log(`✓ L'utilisateur ${email} existe déjà (mot de passe inchangé)`);
    } else {
        throw new Error('Création utilisateur échouée : ' + JSON.stringify(user.json));
    }

    // 3. Fermer l'inscription publique
    const lock = await api(token, 'PATCH',
        `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config?updateMask=client.permissions.disabledUserSignup`,
        { client: { permissions: { disabledUserSignup: true } } });
    if (lock.status === 200) {
        console.log('✓ Auto-inscription publique désactivée');
    } else {
        console.warn('⚠ Impossible de désactiver l\'auto-inscription : ' + JSON.stringify(lock.json));
    }

    // 4. Restrictions de la clé API web
    await ensureApiKeyAllowsAuth(token);

    console.log(
        '\nTerminé ! Connectez-vous sur la console d\'admin :\n' +
        `  https://${project}.web.app\n` +
        `  (ou http://<ip-du-raspberry>:3000/admin sur le réseau local)\n`);
}

main().catch((err) => {
    console.error('❌ ' + err.message);
    process.exit(1);
});
