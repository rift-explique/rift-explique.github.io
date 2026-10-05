/* ============================================================
   Riftbound en français — script de contenu
   ------------------------------------------------------------
   Deux surfaces :
   · riftatlas.com          base de cartes → panneau au curseur
   · play.riftatlas.com     simulateur     → panneau ancré à droite
   Les traductions viennent du site (mise à jour automatique),
   avec la copie embarquée en secours.
   ============================================================ */
(function () {
  "use strict";

  var REMOTE = "https://rift-explique.github.io/fr.json";
  var VERSION = "1.24.0";

  // Reprise après un rechargement de l'extension. Chrome laisse l'ancien
  // script tourner dans les onglets déjà ouverts : le service worker nous
  // réinjecte par-dessus, et on doit alors neutraliser ses restes.
  // Le garde-fou de version évite de s'installer deux fois pour rien.
  try { if (typeof window.__rbfrTeardown === "function") window.__rbfrTeardown(); } catch (e) {}
  window.__rbfrVersion = VERSION;

  // Tout ce qu'on installe est consigné ici : sans ça, une version plus
  // récente injectée par-dessus laisse l'ancienne écouter le clavier et la
  // souris en parallèle, et les deux panneaux se disputent l'écran.
  var ECOUTEURS = [], MINUTEURS = [];
  function ecoute(cible, type, fn, opts) {
    cible.addEventListener(type, fn, opts);
    ECOUTEURS.push([cible, type, fn, opts]);
  }
  function periodique(fn, ms) { var id = setInterval(fn, ms); MINUTEURS.push(id); return id; }

  var SITE = "https://rift-explique.github.io/";
  var LARGEUR = null;            // largeur du panneau, éventuellement imposée par fr.json
  var TTL = 24 * 60 * 60 * 1000;
  var INGAME_DELAY = 0;    // en jeu : affichage immédiat
  var GRID_DELAY = 110;    // sur la base de cartes : petite attente anti-clignotement

  var INGAME = /(^|\.)play\.riftatlas\.com$/.test(location.hostname);
  var DELAY = 110;
  // "auto" : le panneau se place à côté de la carte survolée.
  // "left"/"right" : il reste ancré à ce bord de l'écran. Réglable via fr.json.
  var SIDE = "auto";
  // Touche d'activation : « ² », au-dessus de Tab sur un clavier français.
  // Isolée, atteignable de la main gauche, et revendiquée par aucun site.
  // Modifiable via config.toggleKey dans fr.json (code clavier, ex. "KeyT").
  var TOUCHE = "Backquote";
  // Même chose sur F2. Backquote est un code de *position* : la touche existe
  // presque partout, mais elle ne porte « ² » que sur un clavier français, et
  // certains portables ne l'ont pas. F2 est lisible sur tous les claviers,
  // ne sert à rien dans le navigateur, et se trouve au même endroit partout.
  var TOUCHE_BIS = "F2";
  var ACTIF = true;
  // Deuxième touche : bascule entre le panneau complet (rappels de règles
  // entre parenthèses + note explicative) et le panneau sobre, qui ne montre
  // que ce qui est écrit sur la carte. « * » sur un clavier français, à droite
  // d'Entrée ; Maj + ² fait la même chose. Modifiable via config.modeKey.
  var MODE_TOUCHE = "Backslash";
  var SOBRE = false;
  // Troisième geste : « Ctrl + ² » fige le panneau sur place et le rend
  // cliquable, le temps d'aller chercher le lien vers le site. Volontairement
  // non retenu d'une session à l'autre : c'est un geste ponctuel, et un
  // panneau figé qu'on aurait oublié bloquerait le plateau.
  var FIGE = false;

  DELAY = INGAME ? INGAME_DELAY : GRID_DELAY;

  // Les réglages vivent dans fr.json : on peut les ajuster à distance,
  // sans réinstaller ni recharger l'extension.
  function applyConfig() {
    var c = DATA && DATA.config;
    if (!c) return;
    function borne(v, mini, maxi) {
      return (typeof v === "number" && isFinite(v)) ? Math.min(maxi, Math.max(mini, v)) : null;
    }
    var d = borne(INGAME ? c.ingameDelay : c.gridDelay, 0, 2000);
    if (d !== null) DELAY = d;
    var w = borne(c.panelWidth, 240, 720);
    if (w !== null) { LARGEUR = w; if (panel) panel.style.width = w + "px"; }
    // "auto" : le panneau suit la carte survolée. "left"/"right" : il reste
    // collé à ce bord de l'écran, comme avant.
    if (c.side === "auto" || c.side === "left" || c.side === "right") SIDE = c.side;
    // Le fichier de traductions est distant : il ne doit pas pouvoir confisquer
    // n'importe quelle touche du clavier. Seules ces positions sont acceptées.
    function toucheValide(v) {
      return typeof v === "string" &&
        /^(F([1-9]|1[0-2])|Backquote|Backslash|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Minus|Equal|Insert|Home|End|PageUp|PageDown)$/.test(v);
    }
    if (toucheValide(c.toggleKey)) TOUCHE = c.toggleKey;
    if (toucheValide(c.modeKey)) MODE_TOUCHE = c.modeKey;
    if (c.altKey === "") TOUCHE_BIS = null;
    else if (toucheValide(c.altKey)) TOUCHE_BIS = c.altKey;
    // deux fois la même touche rendrait l'un des gestes inatteignable
    if (TOUCHE_BIS === TOUCHE) TOUCHE_BIS = null;
    if (MODE_TOUCHE === TOUCHE || MODE_TOUCHE === TOUCHE_BIS) MODE_TOUCHE = null;
  }

  // la touche principale, dans l'une ou l'autre de ses deux positions
  function estPrincipale(code) {
    return code === TOUCHE || (TOUCHE_BIS && code === TOUCHE_BIS);
  }

  /* ---------------- interrupteur clavier ---------------- */

  // Le panneau se coupe et se rallume d'une touche, pour ne pas encombrer la
  // vue quand on n'en a pas besoin. L'état est retenu d'une partie à l'autre.
  function litEtat() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(["actif", "sobre"], function (r) {
          resolve({ actif: !(r && r.actif === false), sobre: !!(r && r.sobre) });
        });
      } catch (e) { resolve({ actif: true, sobre: false }); }
    });
  }

  // Le mode sobre se joue entièrement en CSS : les rappels de règles et la
  // note portent déjà leur propre classe, il suffit de les masquer. Rien
  // n'est recalculé, la bascule est donc instantanée même panneau ouvert.
  function appliqueMode() {
    document.documentElement.classList.toggle("rbfr-sobre", SOBRE);
  }

  function basculeMode() {
    SOBRE = !SOBRE;
    try { chrome.storage.local.set({ sobre: SOBRE }); } catch (e) {}
    appliqueMode();
    annonce(SOBRE ? "Texte de la carte seul" : "Explications affichées");
  }

  /* ---------------- épingler le panneau ---------------- */

  function libere() {
    if (!FIGE) return;
    FIGE = false;
    if (panel) panel.classList.remove("rbfr-fige");
    hide();
  }

  function basculeFige() {
    if (FIGE) { libere(); annonce("Panneau libéré"); return; }
    // rien à figer si aucun panneau n'est ouvert
    if (!panel || panel.style.display === "none") {
      annonce("Survole une carte d'abord", true);
      return;
    }
    FIGE = true;
    panel.classList.add("rbfr-fige");
    annonce("Panneau figé — tu peux cliquer dedans");
  }

  /* Un traducteur de page (celui de Chrome, par exemple) traduit tout ce qu'il
     trouve dans le document, y compris ce que nous venons d'y écrire. Il croit
     lire de l'anglais, et notre « Sort » ressort en « Tri ». Ces trois marques
     lui disent de laisser notre texte tranquille. */
  function francais(el) {
    el.lang = "fr";
    el.setAttribute("translate", "no");
    el.classList.add("notranslate");
    return el;
  }

  function annonce(texte, eteint) {
    var t = document.querySelector(".rbfr-toast");
    if (!t) {
      t = francais(document.createElement("div"));
      t.className = "rbfr-toast";
      document.documentElement.appendChild(t);
    }
    t.textContent = texte;
    t.classList.toggle("rbfr-toast-off", !!eteint);
    t.classList.remove("rbfr-toast-go");
    void t.offsetWidth;            // relance l'animation même en rafale
    t.classList.add("rbfr-toast-go");
  }

  function bascule() {
    // couper les traductions libère aussi un panneau resté figé
    if (FIGE) { FIGE = false; if (panel) panel.classList.remove("rbfr-fige"); }
    ACTIF = !ACTIF;
    try { chrome.storage.local.set({ actif: ACTIF }); } catch (e) {}
    if (!ACTIF) {
      hide();
      // on retire aussi les pastilles et liserés : « désactivé » veut dire
      // que rien de l'extension ne reste à l'écran
      document.querySelectorAll(".rbfr-has").forEach(function (n) { n.classList.remove("rbfr-has"); });
      document.querySelectorAll(".rbfr-img-has").forEach(function (n) { n.classList.remove("rbfr-img-has"); });
      var inl = document.querySelector(".rbfr-inline");
      if (inl) inl.style.display = "none";
    } else {
      refreshMarks();
      var inl2 = document.querySelector(".rbfr-inline");
      if (inl2) inl2.style.display = "";
    }
    annonce(ACTIF ? "Traductions activées" : "Traductions désactivées", !ACTIF);
  }

  function saisieEnCours(el) {
    if (!el) return false;
    var t = (el.tagName || "").toUpperCase();
    return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || el.isContentEditable;
  }

  /* ---------------- le rappel des raccourcis ---------------- */

  // « ? » plutôt qu'une touche de position : c'est un caractère, donc il
  // existe sur tous les claviers, et c'est ce qu'emploient déjà GitHub,
  // Gmail ou Slack pour la même chose. Tab était exclu d'office : c'est la
  // touche qui déplace le focus, et la voler casse la navigation au clavier.
  var NOMS = {
    Backquote: "²", Backslash: "*", Quote: "'", Semicolon: ";",
    BracketLeft: "^", BracketRight: "$", Comma: ",", Period: ".",
    Slash: "/", Minus: "-", Equal: "=", Insert: "Inser", Home: "Début",
    End: "Fin", PageUp: "Page ↑", PageDown: "Page ↓"
  };
  function nomTouche(code) { return NOMS[code] || code; }

  var aide = null;

  function fermeAide() {
    if (!aide) return;
    aide.remove();
    aide = null;
  }

  function basculeAide() {
    if (aide) { fermeAide(); return; }
    if (panel && panel.style.display !== "none") hide();

    // Une seule pastille par geste. La touche de secours existe pour les
    // claviers sans « ² », mais l'afficher partout doublait la liste : elle
    // tient en une ligne, en bas, là où on la cherche quand on en a besoin.
    var t = nomTouche(TOUCHE);
    var bis = TOUCHE_BIS ? nomTouche(TOUCHE_BIS) : null;

    function avec(mod) {
      return "<kbd>" + esc(mod ? mod + " + " + t : t) + "</kbd>";
    }

    aide = francais(document.createElement("div"));
    aide.className = "rbfr-aide";
    aide.innerHTML =
      '<div class="rbfr-aide-boite" role="dialog" aria-label="Raccourcis clavier">' +
        '<h2>Raccourcis</h2>' +
        '<dl>' +
          '<dt>' + avec(null) + '</dt>' +
          '<dd>Couper ou rallumer les traductions' +
            (ACTIF ? "" : " — elles sont coupées en ce moment") + '</dd>' +
          '<dt>' + avec("Maj") + '</dt>' +
          '<dd>Texte de la carte seul, sans les explications' +
            (SOBRE ? " — c'est le mode actuel" : "") + '</dd>' +
          '<dt>' + avec("Ctrl") + '</dt>' +
          '<dd>Figer le panneau sur place et le rendre cliquable</dd>' +
          '<dt>' + avec("Alt") + '</dt>' +
          '<dd>Ce rappel</dd>' +
          '<dt><kbd>Échap</kbd></dt>' +
          '<dd>Libérer le panneau figé, ou fermer ce rappel</dd>' +
        '</dl>' +
        '<p class="rbfr-aide-pied">' +
          (bis ? 'Sur un clavier sans <kbd>' + esc(t) + '</kbd>, <kbd>' + esc(bis) +
                 '</kbd> le remplace dans les quatre raccourcis.<br>' : '') +
          'Les réglages sont aussi dans la fenêtre de l\'extension, en cliquant sur son icône. ' +
          '<a class="rbfr-link" href="' + SITE + '" target="_blank" rel="noopener">Le Rift Expliqué ↗</a></p>' +
        '<p class="rbfr-aide-sortie">' + avec("Alt") + ' ou un clic pour fermer</p>' +
      '</div>';
    document.documentElement.appendChild(aide);
    // pas d'enregistrement global : retirer le nœud emporte son écouteur
    aide.addEventListener("click", fermeAide);
  }

  ecoute(document, "keydown", function (e) {
    // on ne vole pas les touches pendant qu'on écrit (le chat du simulateur)
    if (saisieEnCours(e.target) || saisieEnCours(document.activeElement)) return;

    if ((e.key === "Escape" || e.code === "Escape")) {
      if (aide) { e.preventDefault(); fermeAide(); return; }
      if (FIGE) { e.preventDefault(); libere(); return; }
    }

    // Le rappel des raccourcis s'ouvre de deux façons, parce que le caractère
    // « ? » ne remonte pas toujours tel quel selon la disposition et l'état
    // de Verr Maj : soit le caractère lui-même, soit la position physique de
    // la touche qui le porte — Comma sur un AZERTY, Slash sur un QWERTY. Le
    // garde-fou « e.key !== "<" » évite de voler le chevron aux QWERTY, où
    // Maj+Comma produit « < » et pas « ? ».
    var nu      = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
    var majSeul = e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
    var ctrlSeul= e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey;
    var altSeul = e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey;

    var principale = estPrincipale(e.code);

    // Le rappel se traite avant tout le reste : sinon la frappe qui doit le
    // refermer le referme puis le rouvre aussitôt.
    // « ? » a été essayé puis abandonné : il demande Maj sur un clavier
    // français, et le caractère ne remonte pas de façon fiable dans ce cas.
    // Alt + la touche principale ne dépend d'aucun caractère.
    if (principale && altSeul) { e.preventDefault(); basculeAide(); return; }

    // n'importe quelle autre touche referme le rappel — sauf les modificateurs
    // eux-mêmes, dont le keydown précède la touche et refermerait ce qu'on
    // vient tout juste d'ouvrir.
    if (aide && !/^(Shift|Control|Alt|Meta|CapsLock|AltGraph)$/.test(e.key)) fermeAide();

    var surToggle = (principale && nu);
    // Maj + la touche sert d'alias au changement de mode : une seule à retenir
    var surMode   = (MODE_TOUCHE && e.code === MODE_TOUCHE && nu) ||
                    (principale && majSeul);
    var surFige   = (principale && ctrlSeul);

    if (!surToggle && !surMode && !surFige) return;
    e.preventDefault();
    if (surFige) basculeFige();
    else if (surMode) basculeMode();
    else bascule();
  }, true);

  var DATA = null;
  var panel = null, panelCode = null, timer = null, recalc = null;

  /* ---------------- données ---------------- */

  function fromCache() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(["fr", "at"], function (r) {
          resolve(r && r.fr && r.at && Date.now() - r.at < TTL ? r.fr : null);
        });
      } catch (e) { resolve(null); }
    });
  }

  function store(data) {
    try { chrome.storage.local.set({ fr: data, at: Date.now() }); } catch (e) {}
  }

  // Structure de fr.json attendue par cette version du script.
  // 2 : chaque entrée porte son domaine (d), pour choisir la bonne rune.
  var SCHEMA = 2;
  function utilisable(d) {
    return !!d && typeof d === "object" &&
           d.byCode && typeof d.byCode === "object" &&
           d.byName && typeof d.byName === "object" &&
           (d.schema || 0) >= SCHEMA &&
           Object.keys(d.byCode).length > 100;
  }

  async function load() {
    // La copie embarquée suit forcément la structure de ce script : elle sert
    // de base tant qu'une copie distante plus récente n'a pas été validée.
    var cached = await fromCache();
    if (utilisable(cached)) {
      // le cache vaut 24 h : ni relecture de la copie embarquée (1 Mo à
      // analyser), ni retéléchargement à chaque page visitée
      DATA = cached;
      construitKW();
      return;
    }
    var locale = null;
    try { locale = await fetch(chrome.runtime.getURL("fr.json")).then(function (r) { return r.json(); }); }
    catch (e) {}
    DATA = locale || { byCode: {}, byName: {} };
    construitKW();
    fetch(REMOTE, { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (fresh) {
        // une copie distante d'une structure plus ancienne est ignorée
        if (utilisable(fresh)) {
          DATA = fresh; store(fresh);
          // les mots-clés arrivent avec les données : on refait la liste avant
          // de redessiner, sinon un mot-clé tout neuf resterait sans couleur
          construitKW(); applyConfig(); refreshMarks();
        }
      })
      .catch(function () {});
  }

  /* ---------------- identification d'une carte ---------------- */

  function codeFromHref(href) {
    var m = (href || "").match(/\/card\/([A-Za-z0-9-]+)/);
    return m ? m[1].toUpperCase() : null;
  }

  // le simulateur sert ses visuels sous /cards/original/OGN-004.webp
  function codeFromImg(img) {
    var s = img.currentSrc || img.src || (img.dataset && img.dataset.cardArtSource) || "";
    var m = s.match(/\/cards\/[^/]*\/([A-Z]{2,4}-[A-Za-z0-9]+)\.(webp|png|jpg|jpeg)/i);
    return m ? m[1].toUpperCase() : null;
  }

  function lookup(code, name) {
    if (!DATA) return null;
    if (code && DATA.byCode[code]) return DATA.byCode[code];
    if (code) {
      var base = code.replace(/[A-Za-z]$/, "").toUpperCase();   // OGN-004A → OGN-004
      if (DATA.byCode[base]) return DATA.byCode[base];
    }
    if (name && DATA.byName && DATA.byName[name.toLowerCase()]) return DATA.byName[name.toLowerCase()];
    return null;
  }

  // Ne renvoie une carte QUE si le curseur est réellement sur elle.
  // Le simulateur pose ses visuels en pointer-events:none : ils n'apparaissent
  // donc pas sous le curseur. On retombe alors sur une recherche géométrique,
  // bornée à l'image dont le rectangle contient vraiment le point.
  function inside(rect, x, y) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom && rect.width > 20;
  }

  // Le simulateur ne sert pas ses jetons comme les cartes : pas de numéro de
  // collection dans l'adresse, mais un dossier /tokens/<nom>/board.webp. On
  // reconstruit le nom anglais à partir de ce bout d'adresse — « sand-soldier »
  // comme « SandSoldier » donnent « sand soldier ».
  function nomJeton(img) {
    var s = img.currentSrc || img.src || (img.dataset && img.dataset.cardArtSource) || "";
    var m = s.match(/\/tokens\/([A-Za-z0-9_-]+)[/.]/);
    if (!m) return null;
    return m[1].replace(/([a-z0-9])([A-Z])/g, "$1 $2")
               .replace(/[-_]+/g, " ").toLowerCase().trim();
  }

  function cardFromImg(img) {
    var c = codeFromImg(img);
    // on garde l'élément : le panneau se cale sur la carte, pas sur le curseur
    if (c) return { code: c, name: img.alt, el: img };
    var j = nomJeton(img);
    return j ? { code: null, name: j, el: img } : null;
  }

  function cardAt(target, x, y) {
    if (!target || !target.closest) return null;

    var a = target.closest('a[href*="/card/"]');
    if (a) {
      var img0 = a.querySelector("img");
      return { code: codeFromHref(a.getAttribute("href")), name: img0 ? img0.alt : null, el: img0 || a };
    }

    var direct = target.closest("img");
    if (direct) {
      var c0 = cardFromImg(direct);
      if (c0) return c0;
    }

    if (typeof x !== "number") return null;

    if (document.elementsFromPoint) {
      var stack = document.elementsFromPoint(x, y);
      for (var i = 0; i < stack.length && i < 10; i++) {
        if (stack[i].tagName === "IMG") {
          var c1 = cardFromImg(stack[i]);
          if (c1) return c1;
        }
      }
    }

    // recherche géométrique : on remonte de quelques niveaux et on garde
    // la plus petite image de carte dont le rectangle contient le curseur
    var node = target, best = null, bestArea = Infinity;
    for (var lvl = 0; lvl < 6 && node && node !== document.body; lvl++) {
      var imgs = node.querySelectorAll
        ? node.querySelectorAll('img[src*="/cards/"], img[src*="/tokens/"]') : [];
      for (var k = 0; k < imgs.length; k++) {
        var r = imgs[k].getBoundingClientRect();
        if (inside(r, x, y)) {
          var area = r.width * r.height;
          if (area < bestArea) { bestArea = area; best = imgs[k]; }
        }
      }
      if (best) break;
      node = node.parentElement;
    }
    return best ? cardFromImg(best) : null;
  }

  /* ---------------- panneau ---------------- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------------- mise en forme du texte -------------------
     Trois niveaux de lecture :
       · le mot-clé, en pastille colorée selon sa famille ;
       · l'effet, en taille normale — c'est ce que fait la carte ;
       · le rappel de règles entre parenthèses, plus petit et en retrait. */

  // Familles de couleurs relevées sur les cartes officielles :
  //   t  vert sapin  #147864  Action, Réaction, Légion, Accélération, Dégainer, Équiper
  //   e  vert olive  #96B432  Agonie, Caché, Amplifié, Protection, Chasse, Niveau, Temporaire
  //   c  magenta     #C8326E  Assaut, Bouclier, Tank
  //   n  gris        #787878  Vision, Amplification
  // La liste voyage avec les traductions (champ « motsCles » de fr.json) : une
  // extension qui sort ajoute ses mots-clés à tout le monde par la mise à jour
  // quotidienne, sans réinstallation. Ce qui suit n'est qu'un filet de secours,
  // pour une copie de données trop ancienne ou un premier chargement hors ligne.
  var KW_SECOURS = {
    fam: {
      t: ["Accelerate", "Quick-Draw", "Reaction", "Ambush", "Repeat", "Deploy", "Action", "Legion", "Hidden", "Flow"],
      e: ["Empowered", "Temporary", "Deathknell", "Deflect", "Ganking", "Hunt", "Level", "Vision"],
      c: ["Backline", "Disarm", "Shield", "Assault", "Stunned", "Stun", "Tank"],
      n: ["Weaponmaster", "Show Off", "Empower", "Predict", "Mighty", "Buffed", "Equip", "Buff", "Burn", "Unique"]
    },
    val: ["Assault", "Shield", "Deflect", "Hunt", "Level", "Burn", "Predict", "Disarm"]
  };

  var KW = null;

  function construitKW() {
    var src = (DATA && DATA.motsCles && DATA.motsCles.fam) ? DATA.motsCles : KW_SECOURS;
    var all = [];
    Object.keys(src.fam).forEach(function (f) {
      (src.fam[f] || []).forEach(function (w) { if (w) all.push([String(w), f]); });
    });
    if (!all.length) { KW = null; return; }
    // le plus long d'abord : « Expert en armes » avant « Expert »
    all.sort(function (a, b) { return b[0].length - a[0].length; });
    var q = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
    var fam = {};
    all.forEach(function (x) { fam[x[0]] = x[1]; });
    KW = {
      re: new RegExp("(^|[^A-Za-zÀ-ÿ])(" + all.map(function (x) { return q(x[0]); }).join("|") + ")(?![A-Za-zÀ-ÿ])", "g"),
      fam: fam,
      val: new RegExp("^(" + (src.val || []).map(q).join("|") + ")$")
    };
  }
  construitKW();

  function markKeywords(s) {
    if (!KW) return s;
    return s.replace(KW.re, function (_, pre, word, off, whole) {
      var label = word;
      if (KW.val.test(word)) {
        var m = whole.slice(off + pre.length + word.length).match(/^ (\d+)/);
        if (m) label = word + " " + m[1];
      }
      return pre + '<b class="rbfr-k rbfr-k-' + KW.fam[word] + '">' + label + "</b>" +
        (label !== word ? "\u0000" : "");
    }).replace(/\u0000 \d+/g, "");
  }

  /* ---------- symboles de ressources ----------
     Les cartes officielles écrivent les coûts en pictogrammes, pas en mots.
     On fait de même : l'œil saute le coût et va droit à l'effet. */
  // Les pictogrammes officiels de Riot, servis depuis leurs serveurs : mêmes
  // formes et mêmes couleurs que sur les cartes imprimées, rien n'est recopié.
  var GLYPH = 'https://assetcdn.rgpub.io/public/live/riot-shared/' +
              'player-experiences/riot-glyphs/rb/latest/';
  var RUNE_FILE = {
    Fury: 'rune_fury.svg', Body: 'rune_body.svg', Mind: 'rune_mind.svg',
    Calm: 'rune_calm.svg', Chaos: 'rune_chaos.svg', Order: 'rune_order.svg'
  };
  var DOM_FR = {
    Fury: 'Furie', Body: 'Corps', Mind: 'Esprit', Calm: 'Calme',
    Chaos: 'Chaos', Order: 'Ordre', Colorless: 'Incolore'
  };
  function glyph(file, alt, cls) {
    return '<img class="rbfr-g ' + cls + '" src="' + GLYPH + file + '" ' +
      'alt="' + esc(alt) + '" title="' + esc(alt) + '" loading="lazy" decoding="async">';
  }
  function gEnergie(n) {
    var v = parseInt(n, 10);
    // Riot dessine le chiffre dans la pastille, de 0 à 12 ; au-delà on écrit le mot.
    if (isNaN(v) || v < 0 || v > 12) return '<b class="rbfr-r">' + n + '&nbsp;Énergie</b>';
    return glyph('energy_' + v + '.svg', v + ' Énergie', 'rbfr-g-e');
  }
  function gRune(n, partout, doms) {
    doms = doms || [];
    var file, quoi;
    if (partout) {
      file = 'rune_rainbow.svg'; quoi = "de n'importe quel domaine";
    } else if (doms.length === 1 && RUNE_FILE[doms[0]]) {
      file = RUNE_FILE[doms[0]];
      quoi = 'du domaine ' + (DOM_FR[doms[0]] || doms[0]);
    } else {
      // carte bi-domaine : le coût se paie dans l'un ou l'autre, on reste neutre
      file = 'card_type_rune.svg';
      quoi = doms.length
        ? 'du domaine de la carte (' + doms.map(function (d) { return DOM_FR[d] || d; }).join(' ou ') + ')'
        : 'du domaine de la carte';
    }
    // un pictogramme = une essence runique, comme sur les cartes
    if (n > 4) return glyph(file, n + ' essences runiques, ' + quoi, 'rbfr-g-p') +
      '<b class="rbfr-r">×' + n + '</b>';
    var out = '';
    for (var i = 0; i < n; i++) out += glyph(file, '1 essence runique, ' + quoi, 'rbfr-g-p');
    return out;
  }
  function gPuissance() { return glyph('might.svg', 'Puissance', 'rbfr-g-m'); }
  function gEpuiser() { return glyph('exhaust.svg', 'Épuiser', 'rbfr-g-x'); }

  // Un coût en essence runique peut être « de n'importe quel domaine », et la
  // précision est parfois détachée du chiffre (« 1 Essence runique de plus, de
  // n'importe quel domaine »), voire rejetée dans un rappel entre parenthèses.
  // On repère donc la portée sur la ligne entière, avant tout découpage.
  var RUNE_RE = /(\d+) Essences? runiques?/g;
  function scanRunes(line) {
    var hits = [], m;
    RUNE_RE.lastIndex = 0;
    while ((m = RUNE_RE.exec(line))) hits.push({ start: m.index, end: RUNE_RE.lastIndex });
    return hits.map(function (h, i) {
      var stop = i + 1 < hits.length ? hits[i + 1].start : line.length;
      var suite = line.slice(h.end, Math.min(stop, h.end + 48));
      return /^[^.;!?]*n'importe quel domaine/.test(suite);
    });
  }

  function markResources(s, doms, etat) {
    return s
      // le coût d'activation est un pictogramme sur les cartes, pas un mot
      .replace(/Épuiser\s*:/g, function () { return gEpuiser() + ' :'; })
      .replace(/(\d+) Énergie/g, function (_, n) { return gEnergie(n); })
      // « de plus / de moins » se garde, la mention du domaine est absorbée
      .replace(/(\d+) Essences? runiques?( de (?:plus|moins))?(,? \(?de n'importe quel domaine\)?,?)?/g,
        function (_, n, suite, partout) {
          var libre = !!partout;
          if (etat && etat.runes) { libre = etat.runes[etat.i] || libre; etat.i++; }
          return gRune(parseInt(n, 10), libre, doms) + (suite || '');
        })
      .replace(/([+\-−]?\d+) Puissance/g,
        function (_, n) { return '<b class="rbfr-r">' + n + '</b>' + gPuissance(); })
      .replace(/(\d+) XP/g, '<b class="rbfr-r">$1&nbsp;XP</b>');
  }

  // Trouve la parenthèse fermante qui correspond à celle ouverte en `open`,
  // et non la première venue : « (… (de n'importe quel domaine) …) » doit
  // être pris d'un bloc.
  function fermanteDe(line, open) {
    var profondeur = 0;
    for (var k = open; k < line.length; k++) {
      if (line[k] === "(") profondeur++;
      else if (line[k] === ")" && --profondeur === 0) return k;
    }
    return -1;
  }

  // n'habille que le texte hors parenthèses ; le rappel passe en retrait
  function lineHTML(line, doms) {
    // les fragments sont traités de gauche à droite : le compteur suit les
    // coûts en essence runique dans le même ordre que le repérage ci-dessus
    var etat = { runes: scanRunes(line), i: 0 };
    // une ligne entièrement entre parenthèses est le texte de la carte, pas
    // un commentaire : elle doit rester lisible même en mode sobre
    var seul = /^\s*\(.*\)\s*$/.test(line) && fermanteDe(line, line.indexOf("(")) === line.lastIndexOf(")");
    var out = "", i = 0, n = line.length;
    while (i < n) {
      var open = line.indexOf("(", i);
      if (open === -1) { out += markResources(markKeywords(esc(line.slice(i))), doms, etat); break; }
      var close = fermanteDe(line, open);
      if (close === -1) { out += markResources(markKeywords(esc(line.slice(i))), doms, etat); break; }
      var avant = line.slice(i, open);
      // l'espace qui précède le rappel part avec lui : sans cela, le masquer
      // laisserait un trou au milieu de la phrase
      var espace = /\s$/.test(avant) ? " " : "";
      out += markResources(markKeywords(esc(avant.replace(/\s+$/, ""))), doms, etat);
      var terminal = line.slice(close + 1).trim() === "";
      // le rappel garde ses mots, mais reçoit les mêmes pictogrammes
      out += '<span class="rbfr-rem' + (terminal ? " rbfr-rem-b" : "") +
        (seul ? " rbfr-rem-seul" : "") + '">' + espace +
        markResources(esc(line.slice(open + 1, close)), doms, etat) + "</span>";
      i = close + 1;
    }
    // Le point qui précède un rappel est de trop quand le rappel s'affiche…
    // mais indispensable quand il est masqué en mode sobre. On le garde donc
    // dans le balisage, caché par défaut, rendu visible par le mode sobre.
    out = out.replace(/\.(\s*)(<span class="rbfr-rem)/g, '<span class="rbfr-dot">.</span>$1$2');
    return out;
  }

  function frTextHTML(tx, doms) {
    if (!tx) return "";
    return tx.split("\n").map(function (line) {
      var t = line.trim();
      if (!t) return "";
      return '<span class="rbfr-line' + (/^[—-]\s/.test(t) ? " rbfr-bullet" : "") + '">' +
        lineHTML(t, doms) + "</span>";
    }).join("");
  }

  function panelHTML(t, code, name) {
    if (!t) {
      return '<div class="rbfr-head">Riftbound en français</div>' +
        '<div class="rbfr-name rbfr-vo">' + esc(name || code || "") + '</div>' +
        '<p class="rbfr-missing">Cette carte n\'est pas encore traduite.</p>' +
        '<a class="rbfr-link" href="' + SITE + '" target="_blank" rel="noopener">Le Rift Expliqué ↗</a>' +
      '<span class="rbfr-credit">traduction française par Fisher</span>';
    }
    return '<div class="rbfr-head">Traduction française' +
        (code ? '<span class="rbfr-code">' + esc(code) + '</span>' : '') + '</div>' +
      (t.n ? '<div class="rbfr-name">' + esc(t.n) + '</div>'
           : '<div class="rbfr-name rbfr-vo">' + esc(t.en || name || code) + '<span> · nom non traduit</span></div>') +
      '<div class="rbfr-text">' + frTextHTML(t.tx, t.d) + '</div>' +
      // le bonus donné à l'unité équipée est un champ de la carte, pas du
      // texte de règles : aucune traduction ne pouvait le reprendre
      ((t.mb != null || t.ef) ?
        '<div class="rbfr-equip">' +
        (t.mb != null ? '<div class="rbfr-equip-h"><b class="rbfr-r">' + esc(t.mb) + '</b>' +
          gPuissance() + ' <span>à l\'unité équipée</span></div>' : '') +
        (t.ef ? '<div class="rbfr-text">' + frTextHTML(t.ef, t.d) + '</div>' : '') +
        '</div>' : '') +
      (t.note ? '<p class="rbfr-note">' + esc(t.note) + '</p>' : '') +
      '<a class="rbfr-link" href="' + SITE + '" target="_blank" rel="noopener">Le Rift Expliqué ↗</a>' +
      '<span class="rbfr-credit">traduction française par Fisher</span>';
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = francais(document.createElement("div"));
    // en jeu, le panneau est plus grand et plus lisible, où qu'il se place
    panel.className = "rbfr-panel" + (INGAME ? " rbfr-ingame" : "");
    panel.style.display = "none";
    if (LARGEUR) panel.style.width = LARGEUR + "px";
    document.documentElement.appendChild(panel);
    return panel;
  }

  function place(x, y, el) {
    var p = ensurePanel();

    // Mode ancré : le panneau reste collé à un bord de l'écran. Pratique sur
    // un petit écran, pénible sur un grand — l'œil traverse toute la largeur.
    if (INGAME && (SIDE === "left" || SIDE === "right")) {
      p.classList.add("rbfr-docked");
      p.classList.toggle("rbfr-left", SIDE === "left");
      return;
    }
    p.classList.remove("rbfr-docked", "rbfr-left");

    var w = p.offsetWidth || 380, h = p.offsetHeight || 220;
    var m = 18, b = 12;
    var VW = window.innerWidth, VH = window.innerHeight;

    // On s'ancre sur la carte et non sur le curseur : le panneau ne tremble
    // pas quand la souris bouge à l'intérieur de la carte. À défaut de carte
    // mesurable, on retombe sur le curseur.
    var r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (r && (!r.width || !r.height)) r = null;
    if (!r) r = { left: x, right: x, top: y, bottom: y, width: 0, height: 0 };

    // Toujours la même position : collé au bord GAUCHE de la carte, aligné sur
    // son haut. Le côté gauche parce que Rift Atlas pose systématiquement son
    // propre agrandissement à droite de la carte, à une vingtaine de pixels :
    // en se partageant les côtés, les deux restent lisibles côte à côte au
    // lieu de se disputer la même place.
    // Seule exception : pas la place à gauche, on passe à droite.
    var left = r.left - w - m;
    if (left < b) left = r.right + m;
    left = Math.min(Math.max(left, b), Math.max(b, VW - w - b));

    // aligné sur le haut de la carte : le titre apparaît toujours à la même
    // hauteur qu'elle, seule la longueur du texte varie vers le bas
    var top = Math.min(Math.max(r.top, b), Math.max(b, VH - h - b));

    p.style.left = left + "px";
    p.style.top = top + "px";
  }

  function show(card, x, y) {
    var p = ensurePanel();
    if (panelCode !== card.code) {
      p.innerHTML = panelHTML(lookup(card.code, card.name), card.code, card.name);
      panelCode = card.code;
    }
    p.style.display = "block";
    place(x, y, card.el);
    // Les pictogrammes se chargent après coup et rallongent le panneau. Sa
    // hauteur ne compte que pour le recadrage en bas d'écran : on repasse une
    // fois, brièvement, au cas où il dépasserait.
    if (recalc) clearTimeout(recalc);
    recalc = setTimeout(function () {
      // la carte a pu disparaître du plateau entre-temps
      if (card.el && card.el.isConnected === false) { hide(); return; }
      if (panel && panel.style.display !== "none" && panelCode === card.code) place(x, y, card.el);
    }, 150);
  }

  function hide() {
    // un panneau figé ne se referme que sur demande explicite
    if (FIGE) return;
    if (timer) { clearTimeout(timer); timer = null; }
    if (recalc) { clearTimeout(recalc); recalc = null; }
    if (panel) panel.style.display = "none";
    panelCode = null;
  }

  /* ---------------- pastille FR ---------------- */

  // Témoin de détection. Rift Atlas peut changer son HTML du jour au
  // lendemain : sans ça, l'extension se tairait et personne ne saurait si
  // c'est « pas de carte ici » ou « je ne sais plus lire ce site ».
  var candidatsVus = 0, resolusVus = 0, temoinDit = false;
  function temoin() {
    if (temoinDit || !ACTIF) return;
    if (candidatsVus >= 5 && resolusVus === 0) {
      temoinDit = true;
      annonce("Les cartes ne sont plus reconnues — l'extension a besoin d'une mise à jour", true);
      try { console.warn("[Riftbound FR] " + candidatsVus + " cartes vues, aucune reconnue. " +
        "La structure du site a probablement changé : " + SITE); } catch (e) {}
    }
  }

  function refreshMarks() {
    if (!DATA || !ACTIF) return;
    if (document.hidden) return;   // onglet en arrière-plan : rien à marquer
    var candidats = 0, resolus = 0;
    document.querySelectorAll('a[href*="/card/"]').forEach(function (a) {
      candidats++;
      var has = !!lookup(codeFromHref(a.getAttribute("href")), (a.querySelector("img") || {}).alt);
      if (has) resolus++;
      a.classList.toggle("rbfr-has", has);
    });
    if (INGAME) {
      document.querySelectorAll('img[src*="/cards/"]').forEach(function (img) {
        candidats++;
        var has = !!lookup(codeFromImg(img), img.alt);
        if (has) resolus++;
        img.classList.toggle("rbfr-img-has", has);
      });
    }
    candidatsVus = Math.max(candidatsVus, candidats);
    resolusVus = Math.max(resolusVus, resolus);
  }

  /* ---------------- fiche détaillée (base de cartes) ---------------- */

  // Rift Atlas dessine deux fois son titre : une version pour le téléphone,
  // une pour l'écran large, et masque celle qui ne sert pas. Prendre le
  // premier h1 venu, c'est une chance sur deux de se greffer sur la branche
  // masquée — le panneau existe alors, correct, mais invisible.
  function titreVisible() {
    var h1s = document.querySelectorAll("h1");
    for (var i = 0; i < h1s.length; i++) {
      if (h1s[i].offsetParent !== null || h1s[i].getBoundingClientRect().width > 0) return h1s[i];
    }
    return h1s[0] || null;
  }

  function injectDetail() {
    if (!ACTIF || INGAME || !/^\/card\//.test(location.pathname)) return;
    var h1 = titreVisible();
    if (!h1) return;
    var code = codeFromHref(location.pathname);
    var old = document.querySelector(".rbfr-inline");
    // idempotent : déjà en place pour cette carte, il n'y a rien à refaire.
    // C'est ce qui permet de le rappeler en boucle pour rattraper une page
    // lente, sans reconstruire le panneau à chaque passage. Une exception :
    // s'il a fini dans une branche masquée — page réorganisée après coup —
    // il faut le replacer, sinon il reste invisible pour toujours.
    if (old && old.dataset.code === code) {
      if (old.offsetParent !== null || old.getBoundingClientRect().height > 0) return;
      if (old.parentElement === h1.parentElement) return;  // rien de mieux à proposer
    }
    if (old) old.remove();
    var box = francais(document.createElement("section"));
    box.dataset.code = code || "";
    box.className = "rbfr-inline";
    box.innerHTML = panelHTML(lookup(code, h1.innerText), code, h1.innerText);
    h1.parentElement.insertBefore(box, h1.nextSibling);
  }

  /* ---------------- événements ---------------- */

  // Le simulateur est une application temps réel : on ne travaille qu'une
  // fois par image, et pas du tout tant que le curseur n'a pas vraiment bougé.
  var posCourante = null, imageDemandee = false;
  var derniereCible = null, dernierBloc = "", derniereCarte = null;

  function surMouvement(e) {
    if (!ACTIF || FIGE) return;
    posCourante = { x: e.clientX, y: e.clientY, cible: e.target };
    if (imageDemandee) return;
    imageDemandee = true;
    requestAnimationFrame(traiteMouvement);
  }

  function traiteMouvement() {
    imageDemandee = false;
    var p = posCourante;
    if (!p || !ACTIF || FIGE) return;

    // Court-circuit : tant que le curseur reste sur le même élément et dans
    // le même carré de 8 px, la réponse ne peut pas avoir changé. C'est ce
    // qui évite elementsFromPoint, et donc le recalcul de mise en page.
    var bloc = ((p.x / 8) | 0) + ":" + ((p.y / 8) | 0);
    var card;
    if (p.cible === derniereCible && bloc === dernierBloc) {
      card = derniereCarte;
    } else {
      card = cardAt(p.cible, p.x, p.y);
      derniereCible = p.cible; dernierBloc = bloc; derniereCarte = card;
    }

    if (!card || !card.code) {
      // sans ça, un panneau demandé puis quitté s'ouvre quand même, tout seul
      if (timer) { clearTimeout(timer); timer = null; }
      if (panel && panel.style.display !== "none") hide();
      return;
    }
    var x = p.x, y = p.y;
    if (panel && panel.style.display !== "none" && panelCode === card.code) { place(x, y, card.el); return; }
    if (timer) clearTimeout(timer);
    if (!DELAY) { show(card, x, y); return; }
    timer = setTimeout(function () { show(card, x, y); }, DELAY);
  }

  ecoute(document, "mousemove", surMouvement, { capture: true, passive: true });

  // La fenêtre de réglages écrit dans le stockage : on s'aligne aussitôt,
  // sans faire recharger la page à l'utilisateur.
  try {
    chrome.storage.onChanged.addListener(function (ch, zone) {
      if (zone !== "local") return;
      if (ch.actif && ch.actif.newValue !== undefined) {
        var veut = ch.actif.newValue !== false;
        if (veut !== ACTIF) bascule();
      }
      if (ch.sobre && ch.sobre.newValue !== undefined) {
        var veutSobre = !!ch.sobre.newValue;
        if (veutSobre !== SOBRE) { SOBRE = veutSobre; appliqueMode(); }
      }
    });
  } catch (e) {}

  ecoute(document, "scroll", hide, { capture: true, passive: true });
  ecoute(document, "mouseleave", hide);
  ecoute(window, "blur", hide);

  // Un clic hors du panneau le libère : on ne peut pas rester bloqué avec un
  // panneau qui mange les clics du plateau. Un clic dedans (le lien) le libère
  // aussi, mais après coup, pour laisser la navigation se faire.
  ecoute(document, "click", function (e) {
    if (!FIGE) return;
    if (panel && panel.contains(e.target)) { setTimeout(libere, 0); return; }
    libere();
  }, true);

  // Un observateur de mutations posé sur tout le document pour surveiller
  // une simple URL revenait à être réveillé à chaque frame du simulateur.
  // Une comparaison toutes les demi-secondes suffit et ne coûte rien.
  var cheminCourant = location.pathname, tic = 0;
  periodique(function () {
    if (document.hidden) return;
    if (location.pathname !== cheminCourant) {
      cheminCourant = location.pathname;
      hide();
      setTimeout(function () { injectDetail(); refreshMarks(); }, 400);
      return;
    }
    if (++tic % 4 === 0) refreshMarks();   // balayage complet, toutes les 2 s
    else injectDetail();                   // idempotent : rattrape une page lente
  }, 500);

  load().then(async function () {
    var etat = await litEtat();
    ACTIF = etat.actif;
    SOBRE = etat.sobre;
    applyConfig();
    appliqueMode();
    refreshMarks();
    injectDetail();
    // le témoin se prononce une fois la page vraiment posée
    setTimeout(temoin, 6000);
    // repère de version : permet de voir d'un coup d'œil, dans la console,
    // si Chrome tourne bien sur les fichiers du dossier et non sur une copie
    // gardée en mémoire depuis le dernier chargement.
    try {
      console.log("[Riftbound FR] " + VERSION +
        " · placement : " + (SIDE === "auto" ? "à gauche de la carte" : "ancré à " + SIDE) +
        " · " + Object.keys((DATA && DATA.byCode) || {}).length + " entrées" +
        " · " + TOUCHE + (TOUCHE_BIS ? " ou " + TOUCHE_BIS : "") + " : afficher/masquer" +
        (ACTIF ? "" : " (éteint)") +
        " · " + (MODE_TOUCHE || "Maj+" + TOUCHE) + " : complet/sobre" + (SOBRE ? " (sobre)" : "") +
        " · Ctrl+" + TOUCHE + " : figer" +
        " · Alt+" + TOUCHE + " : rappel des raccourcis");
    } catch (e) {}
  });

  // Retirer tout ce que cette instance a installé. Appelé par la version
  // suivante quand le service worker la réinjecte par-dessus celle-ci.
  window.__rbfrTeardown = function () {
    try {
      ECOUTEURS.forEach(function (e) { e[0].removeEventListener(e[1], e[2], e[3]); });
      MINUTEURS.forEach(clearInterval);
      ECOUTEURS = []; MINUTEURS = [];
      if (timer) { clearTimeout(timer); timer = null; }
      if (recalc) { clearTimeout(recalc); recalc = null; }
      document.querySelectorAll(".rbfr-panel, .rbfr-toast, .rbfr-inline, .rbfr-aide")
        .forEach(function (n) { n.remove(); });
      document.querySelectorAll(".rbfr-has, .rbfr-img-has")
        .forEach(function (n) { n.classList.remove("rbfr-has", "rbfr-img-has"); });
      document.documentElement.classList.remove("rbfr-sobre");
      panel = null; panelCode = null;
    } catch (e) {}
  };
})();
