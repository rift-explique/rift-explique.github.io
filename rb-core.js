/* ============================================================
   data.js — chargement des cartes, symboles, lexique
   ============================================================ */
window.RB = (function(){
  "use strict";

  var cards = [], byId = {}, byName = {}, meta = {};

  /* ---------- traductions d'interface ---------- */
  var TYPE_FR = {
    "Unit":"Unité", "Spell":"Sort", "Rune":"Rune", "Gear":"Équipement",
    "Battlefield":"Champ de bataille", "Legend":"Légende"
  };
  var DOM_FR = {
    "Fury":"Furie", "Body":"Corps", "Mind":"Esprit", "Calm":"Calme",
    "Chaos":"Chaos", "Order":"Ordre", "Colorless":"Incolore"
  };
  var RAR_FR = {
    "Common":"Commun", "Uncommon":"Peu commun", "Rare":"Rare",
    "Epic":"Épique", "Showcase":"Showcase"
  };
  var SET_FR = {
    "Origins":"Origins", "Proving Grounds":"Proving Grounds",
    "Spiritforged":"Spiritforged", "Unleashed":"Unleashed", "Vendetta":"Vendetta",
    "Radiance":"Radiance", "Arcane Box Set":"Coffret Arcane", "Secret Garden":"Jardin secret"
  };

  /* ---------- lexique des mots-clés ----------
     Texte de rappel officiel (VO) traduit en français. */
  var KEYWORDS = {
    "Action":      {fr:"Action",        txt:"Se joue aussi dans un affrontement, sur le tour de n'importe qui, à condition que la chaîne soit vide."},
    "Reaction":    {fr:"Réaction",      txt:"Tout ce que permet Action, plus le droit de jouer chaîne non vide — donc en réponse à une carte adverse."},
    "Hidden":      {fr:"Caché",          txt:"Se cacher maintenant pour 1 Essence runique, de n'importe quel domaine ; à partir du tour suivant, tu peux la révéler pour 0, et elle gagne Réaction."},
    "Tank":        {fr:"Tank",          txt:"Les dégâts de combat doivent lui être assignés en premier."},
    "Backline":    {fr:"Arrière-ligne", txt:"Les dégâts de combat doivent lui être assignés en dernier."},
    "Deflect":     {fr:"Protection",    txt:"L'adversaire doit payer 1 Essence runique de plus, de n'importe quel domaine, pour la choisir avec un sort ou une capacité."},
    "Ganking":     {fr:"Gank",          txt:"Peut se déplacer d'un champ de bataille à un autre."},
    "Assault":     {fr:"Assaut",        txt:"+1 Puissance (ou plus) tant qu'elle est attaquante."},
    "Shield":      {fr:"Bouclier",      txt:"+1 Puissance (ou plus) tant qu'elle est défenseuse."},
    "Accelerate":  {fr:"Accélération",  txt:"Tu peux payer un coût additionnel pour qu'elle arrive prête au lieu d'épuisée."},
    "Empower":     {fr:"Amplification",  txt:"Paie le coût indiqué pour l'amplifier. Utilisable seulement si elle ne l'est pas déjà. Certaines cartes peuvent retirer l'amplification."},
    "Empowered":   {fr:"Amplifié",       txt:"Effet actif uniquement tant que l'unité est amplifiée."},
    "Equip":       {fr:"Équiper",       txt:"Coût à payer pour attacher un Équipement à une unité que tu contrôles."},
    "Weaponmaster":{fr:"Expert en armes",txt:"Quand tu la joues, tu peux lui attacher un de tes Équipements pour 1 Essence runique de moins, même s'il est déjà attaché ailleurs."},
    "Deathknell":  {fr:"Agonie",         txt:"Effet qui se déclenche quand la carte meurt. Présent sur les unités comme sur les équipements."},
    "Temporary":   {fr:"Temporaire",    txt:"Meurt au début de la phase initiale de son contrôleur, avant le score."},
    "Legion":      {fr:"Légion",        txt:"Effet obtenu si tu as déjà joué une autre carte ce tour-ci."},
    "Vision":      {fr:"Vision",        txt:"Regarde la première carte de ton deck principal. Tu peux la recycler."},
    "Predict":     {fr:"Prédiction",    txt:"Regarde la première carte de ton deck principal. Tu peux la recycler."},
    "Hunt":        {fr:"Chasse",        txt:"Quand elle conquiert ou tient un champ de bataille, gagne 1 XP (ou plus)."},
    "Repeat":      {fr:"Répétition",    txt:"Tu peux payer le coût additionnel pour répéter l'effet du sort. Les choix de la seconde exécution se font à la résolution et peuvent être différents."},
    "Ambush":      {fr:"Embuscade",     txt:"Peut être jouée en Réaction sur un champ de bataille où tu as des unités."},
    "Stun":        {fr:"Étourdissement",txt:"L'unité n'inflige pas de dégâts de combat ce tour-ci."},
    "Flow":        {fr:"Flux",          txt:"Tu peux la jouer depuis ta défausse pour son coût de Flux. Elle est ensuite bannie."},
    "Buff":        {fr:"Amélioration",  txt:"Donne un bonus de +1 Puissance si l'unité n'en a pas déjà un. Une seule à la fois."},
    "Mighty":      {fr:"Puissante",     txt:"Une unité est Puissante tant qu'elle a 5 Puissance ou plus."},
    "Quick-Draw":  {fr:"Dégainer",      txt:"L'Équipement a Réaction ; quand tu le joues, attache-le à une unité que tu contrôles."},
    "Level":       {fr:"Niveau",        txt:"Effet obtenu tant que tu as assez d'XP (le nombre indiqué)."},
    "Add":         {fr:"Ajouter",       txt:"Ajoute la ressource indiquée à ta réserve. Ces capacités ne peuvent pas être contrées par une réaction."},
    "Burn":        {fr:"Brûler",        txt:"Met le nombre indiqué de cartes du dessus de ton deck principal dans ta défausse."},
    "Unique":      {fr:"Unique",        txt:"Exception à la règle des 3 exemplaires : ton deck ne peut en contenir qu'un seul."},
    "Recycle":     {fr:"Recycler",      txt:"Remet la carte sous ton deck principal. Recycler une rune donne de l'Essence runique de son domaine."}
  };

  /* ---------- rendu des symboles ---------- */
  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // [1] énergie chiffrée · [A] énergie · [C] puissance · [S] might · [T] épuiser · [>] flèche
  function symbols(text){
    if(!text) return "";
    var out = esc(text);
    out = out.replace(/\[(\d+)\]/g, function(_, n){
      return '<span class="sym sym-e" title="' + n + ' Énergie">' + n + '</span>';
    });
    out = out.replace(/\[A\]/g, '<span class="sym sym-p" title="1 Essence runique, de n&#39;importe quel domaine"><b>P</b></span>');
    out = out.replace(/\[C\]/g, '<span class="sym sym-p" title="1 Essence runique, du domaine de la carte"><b>P</b></span>');
    out = out.replace(/\[S\]/g, '<span class="sym sym-m" title="Puissance (valeur de combat) de l\'unité">M</span>');
    out = out.replace(/\[T\]|\[E\]/g, '<span class="sym sym-t" title="Épuiser">↻</span>');
    out = out.replace(/\[&gt;\]/g, ' → ');
    out = out.replace(/\[([A-Za-zÀ-ÿ'\-]+)( \d+)?\]/g, function(whole, word, num){
      var k = KEYWORDS[word];
      if(!k) return whole;
      var cls = (word === "Reaction") ? "kw reaction" : "kw";
      var label = word + (num || "");
      return '<span class="' + cls + '" title="' + esc(k.fr + " — " + k.txt) + '">' + esc(label) + '</span>';
    });
    return out;
  }

  /* ---------- images ---------- */
  function img(card, width){
    if(!card.img) return "";
    var sep = card.img.indexOf("?") === -1 ? "?" : "&";
    return card.img + sep + "w=" + (width || 320) + "&q=80&auto=format";
  }

  // Certaines cartes sont connues avant que Riot n'en publie l'illustration :
  // les images viennent des serveurs de Riot et ne sont jamais recopiées ici,
  // alors on dessine un cadre sobre en attendant.
  function visuel(card, width, alt){
    if(card.img) return '<img' + (alt ? ' loading="lazy"' : '') + ' src="' + esc(img(card, width)) +
      '" alt="' + esc(card.n) + '" onerror="this.style.visibility=\'hidden\'">';
    return '<div class="sans-art" style="--dom:' + domColor(card) + '">' +
      '<b>' + esc(displayName(card)) + '</b><span>Illustration pas encore publiée par Riot</span></div>';
  }

  /* ---------- helpers ---------- */
  function domColor(card){
    var d = (card.d && card.d[0]) || "Colorless";
    return "var(--" + d + ")";
  }
  function typeFR(t){ return TYPE_FR[t] || t; }
  function domFR(d){ return DOM_FR[d] || d; }
  function setFR(s){ return SET_FR[s] || s; }
  function rarFR(r){ return RAR_FR[r] || r; }

  function costLine(c){
    var bits = [];
    if(c.e != null) bits.push(c.e + " Énergie");
    if(c.p != null) bits.push(c.p + " Essence runique");
    return bits.join(" + ") || "—";
  }

  function isReaction(c){ return /\[Reaction\]/.test(c.tx || ""); }
  function mightOf(c){ var m = parseInt(c.m, 10); return isNaN(m) ? 0 : m; }

  /* ---------- vignette ---------- */
  function cardHTML(c, opts){
    opts = opts || {};
    var land = c.o === "landscape";
    return '<article class="card' + (land ? " landscape" : "") + '" data-id="' + esc(c.id) + '" ' +
             'style="--dom:' + domColor(c) + '" tabindex="0" role="button" aria-label="' + esc(c.n) + '">' +
             visuel(c, opts.w || 320, true) +
             (opts.caption === false ? "" :
               '<div class="card-cap"><b>' + esc(displayName(c)) + '</b><i>' + esc(c.e == null ? typeFR(c.t) : c.e) + '</i></div>') +
           '</article>';
  }

  /* ---------- fiche détaillée ---------- */
  function detailHTML(c){
    var chips = [];
    chips.push('<span class="chip dom" style="--dom:' + domColor(c) + '">' +
      esc((c.d || []).map(domFR).join(" / ") || "Incolore") + '</span>');
    chips.push('<span class="chip">' + esc(typeFR(c.t)) + '</span>');
    chips.push('<span class="chip">' + esc(rarFR(c.r)) + '</span>');
    chips.push('<span class="chip">' + esc(setFR(metaSetName(c.set))) + '</span>');
    (c.tg || []).forEach(function(t){ chips.push('<span class="chip">' + esc(t) + '</span>'); });

    var stats = "";
    if(c.e != null) stats += '<div class="stat"><span>Énergie</span><b>' + esc(c.e) + '</b></div>';
    if(c.p != null) stats += '<div class="stat"><span>Essence runique</span><b>' + esc(c.p) + '</b></div>';
    if(c.m != null) stats += '<div class="stat"><span>Puissance</span><b>' + esc(c.m) + '</b></div>';
    stats += '<div class="stat"><span>Numéro</span><b>' + esc(c.code) + '</b></div>';

    return '<div class="detail">' +
      visuel(c, 640, false) +
      '<div class="detail-meta">' +
        '<h2>' + esc(displayName(c)) + '</h2>' +
        (hasFrenchName(c) ? '<div class="vo-name">' + esc(nameVO(c)) + '</div>' : '') +
        '<div class="chips">' + chips.join("") + '</div>' +
        '<div class="stat-row">' + stats + '</div>' +
        frBlockHTML(c) +
        '<details class="vo-box"><summary>Texte original anglais</summary>' +
          '<div class="rules-text">' + symbols(c.tx || "Pas de texte de règles.") + '</div>' +
        '</details>' +
        '<p class="hint">Illustration : ' + esc(c.a || "—") + '. Survole un mot-clé anglais pour sa traduction.</p>' +
      '</div></div>';
  }

  function fr(card){
    var t = window.RB_FR && window.RB_FR[card.code];
    return t || null;
  }

  /* ---------- mise en forme du texte français ----------
     Trois niveaux de lecture :
       · le mot-clé, en pastille colorée selon sa famille ;
       · l'effet, en taille normale — c'est ce que fait la carte ;
       · le rappel de règles entre parenthèses, plus petit et en retrait.  */

  // famille -> mots-clés. L'ordre compte : les formes longues d'abord.
  // Familles de couleurs relevées sur les cartes officielles :
  //   t  vert sapin  #147864  Action, Réaction, Légion, Accélération, Dégainer, Équiper
  //   e  vert olive  #96B432  Agonie, Caché, Amplifié, Protection, Chasse, Niveau, Temporaire
  //   c  magenta     #C8326E  Assaut, Bouclier, Tank
  //   n  gris        #787878  Vision, Amplification
  // La liste vient de rb-motscles.js, qui est aussi embarqué dans fr.json pour
  // l'extension : une seule source à tenir à jour pour les deux.
  var MOTS = window.RB_MOTS || { fam: {}, val: [] };
  var KW_VAL = new RegExp("^(" + (MOTS.val || []).map(function(s){
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")$");

  var KW_RE = (function(){
    var all = [];
    Object.keys(MOTS.fam || {}).forEach(function(f){
      (MOTS.fam[f] || []).forEach(function(w){ if(w) all.push([String(w), f]); });
    });
    all.sort(function(a, b){ return b[0].length - a[0].length; });
    var esc2 = function(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
    return {
      list: all,
      re: all.length ? new RegExp("(^|[^A-Za-zÀ-ÿ])(" + all.map(function(x){ return esc2(x[0]); }).join("|") + ")(?![A-Za-zÀ-ÿ])", "g") : null,
      fam: all.reduce(function(m, x){ m[x[0]] = x[1]; return m; }, {})
    };
  })();

  function markKeywords(s){
    if(!KW_RE.re) return s;
    return s.replace(KW_RE.re, function(_, pre, word, off, whole){
      var fam = KW_RE.fam[word];
      var label = word;
      if(KW_VAL.test(word)){
        var after = whole.slice(off + pre.length + word.length).match(/^ (\d+)/);
        if(after) label = word + " " + after[1];
      }
      return pre + '<b class="k k-' + fam + '">' + label + '</b>' +
             (label !== word ? "\u0000" : "");   // marque le nombre déjà consommé
    }).replace(/\u0000 \d+/g, "");
  }

  /* ---------- symboles de ressources ----------
     Les cartes officielles écrivent les coûts en pictogrammes, pas en mots.
     On fait de même : l'œil saute le coût et va droit à l'effet. */
  // Les pictogrammes officiels de Riot, servis depuis leurs serveurs : mêmes
  // formes et mêmes couleurs que sur les cartes imprimées, rien n'est recopié.
  var GLYPH = "https://assetcdn.rgpub.io/public/live/riot-shared/" +
              "player-experiences/riot-glyphs/rb/latest/";
  var RUNE_FILE = {
    "Fury":"rune_fury.svg", "Body":"rune_body.svg", "Mind":"rune_mind.svg",
    "Calm":"rune_calm.svg", "Chaos":"rune_chaos.svg", "Order":"rune_order.svg"
  };
  function glyph(file, alt, cls){
    return '<img class="g ' + cls + '" src="' + GLYPH + file + '" ' +
           'alt="' + esc(alt) + '" title="' + esc(alt) + '" loading="lazy" decoding="async">';
  }
  function gEnergie(n){
    var v = parseInt(n, 10);
    // Riot dessine le chiffre dans la pastille, de 0 à 12 ; au-delà on écrit le mot.
    if(isNaN(v) || v < 0 || v > 12) return '<b class="r">' + n + '&nbsp;Énergie</b>';
    return glyph("energy_" + v + ".svg", v + " Énergie", "g-e");
  }
  function gRune(n, partout, card){
    var doms = (card && card.d) || [];
    var file, quoi;
    if(partout){
      file = "rune_rainbow.svg"; quoi = "de n'importe quel domaine";
    } else if(doms.length === 1 && RUNE_FILE[doms[0]]){
      file = RUNE_FILE[doms[0]]; quoi = "du domaine " + domFR(doms[0]);
    } else {
      // carte bi-domaine : le coût se paie dans l'un ou l'autre, on reste neutre
      file = "card_type_rune.svg";
      quoi = doms.length ? "du domaine de la carte (" + doms.map(domFR).join(" ou ") + ")"
                         : "du domaine de la carte";
    }
    // un pictogramme = une essence runique, comme sur les cartes
    if(n > 4) return glyph(file, n + " essences runiques, " + quoi, "g-p") +
                     '<b class="r">×' + n + '</b>';
    var out = "";
    for(var i = 0; i < n; i++) out += glyph(file, "1 essence runique, " + quoi, "g-p");
    return out;
  }
  function gPuissance(){ return glyph("might.svg", "Puissance", "g-m"); }
  function gEpuiser(){ return glyph("exhaust.svg", "Épuiser", "g-x"); }

  // Un coût en essence runique peut être « de n'importe quel domaine », et la
  // précision est parfois détachée du chiffre (« 1 Essence runique de plus, de
  // n'importe quel domaine »), voire rejetée dans un rappel entre parenthèses.
  // On repère donc la portée sur la ligne entière, avant tout découpage.
  var RUNE_RE = /(\d+) Essences? runiques?/g;
  function scanRunes(line){
    var hits = [], m;
    RUNE_RE.lastIndex = 0;
    while((m = RUNE_RE.exec(line))) hits.push({ start: m.index, end: RUNE_RE.lastIndex });
    return hits.map(function(h, i){
      var stop = i + 1 < hits.length ? hits[i + 1].start : line.length;
      var suite = line.slice(h.end, Math.min(stop, h.end + 48));
      return /^[^.;!?]*n'importe quel domaine/.test(suite);
    });
  }

  function markResources(s, card, etat){
    return s
      // le coût d'activation est un pictogramme sur les cartes, pas un mot
      .replace(/Épuiser\s*:/g, function(){ return gEpuiser() + " :"; })
      .replace(/(\d+) Énergie/g, function(_, n){ return gEnergie(n); })
      // « de plus / de moins » se garde, la mention du domaine est absorbée
      .replace(/(\d+) Essences? runiques?( de (?:plus|moins))?(,? \(?de n'importe quel domaine\)?,?)?/g,
        function(_, n, suite, partout){
          var libre = !!partout;
          if(etat && etat.runes){ libre = etat.runes[etat.i] || libre; etat.i++; }
          return gRune(parseInt(n, 10), libre, card) + (suite || "");
        })
      .replace(/([+\-−]?\d+) Puissance/g,
        function(_, n){ return '<b class="r">' + n + '</b>' + gPuissance(); })
      .replace(/(\d+) XP/g, '<b class="r">$1&nbsp;XP</b>');
  }

  // Découpe une ligne en segments hors/dans parenthèses, n'habille que le hors-parenthèses.
  // Trouve la parenthèse fermante correspondante, et non la première venue :
  // « (… (de n'importe quel domaine) …) » doit être pris d'un bloc.
  function fermanteDe(line, open){
    var profondeur = 0;
    for(var k = open; k < line.length; k++){
      if(line[k] === "(") profondeur++;
      else if(line[k] === ")" && --profondeur === 0) return k;
    }
    return -1;
  }

  function frLineHTML(line, card){
    // les fragments sont traités de gauche à droite : le compteur suit les
    // coûts en essence runique dans le même ordre que le repérage ci-dessus
    var etat = { runes: scanRunes(line), i: 0 };
    var out = "", i = 0, n = line.length;
    while(i < n){
      var open = line.indexOf("(", i);
      if(open === -1){ out += markResources(markKeywords(esc(line.slice(i))), card, etat); break; }
      var close = fermanteDe(line, open);
      if(close === -1){ out += markResources(markKeywords(esc(line.slice(i))), card, etat); break; }
      out += markResources(markKeywords(esc(line.slice(i, open))), card, etat);
      var inner = line.slice(open + 1, close);
      var terminal = line.slice(close + 1).trim() === "";
      // le rappel garde ses mots, mais reçoit les mêmes pictogrammes
      out += '<span class="fr-rem' + (terminal ? " fr-rem-b" : "") + '">' +
             markResources(esc(inner), card, etat) + '</span>';
      i = close + 1;
    }
    // le point qui précède un rappel devient inutile, le retrait le remplace
    out = out.replace(/\.(\s*)(<span class="fr-rem)/g, "$1$2");
    // (pas de retrait du point final ici : il mangeait le point des lignes
    // qui se terminent par un mot-clé, « … ont Bouclier. » par exemple)
    return out;
  }

  function frTextHTML(tx, card){
    if(!tx) return "";
    return tx.split("\n").map(function(line){
      var t = line.trim();
      if(!t) return "";
      var cls = "fr-line";
      if(/^[—-]\s/.test(t)) cls += " fr-bullet";
      return '<span class="' + cls + '">' + frLineHTML(t, card) + '</span>';
    }).join("");
  }

  // Les équipements portent en bas de carte le bonus donné à l'unité équipée.
  // C'est un champ (mightBonus chez Riot), pas du texte de règles : aucune
  // traduction ne pouvait le reprendre, il faut donc l'afficher à part.
  function equipHTML(card){
    if(!card || (card.mb == null && !card.ef)) return "";
    var h = '<div class="fr-equip">';
    if(card.mb != null){
      h += '<div class="fr-equip-h"><b class="r">' + esc(card.mb) + '</b>' +
           gPuissance() + ' <span>à l\'unité équipée</span></div>';
    }
    // l'effet que l'unité gagne une fois équipée : second champ de la carte,
    // imprimé en bas, absent lui aussi du texte de règles
    if(card.ef) h += '<div class="fr-text">' + frTextHTML(card.ef, card) + '</div>';
    return h + '</div>';
  }

  function frBlockHTML(card){
    var t = fr(card);
    if(!t){
      return '<div class="fr-block fr-missing">' +
        '<div class="fr-head">Traduction française</div>' +
        '<p>Pas encore traduite. Le lexique de l\'onglet <b>Les règles</b> donne le sens de chaque mot-clé.</p>' +
      '</div>';
    }
    return '<div class="fr-block">' +
      '<div class="fr-head">Traduction française</div>' +
      (t.n ? '' : '<div class="fr-name fr-vo">nom non traduit</div>') +
      '<div class="fr-text">' + frTextHTML(t.tx, card) + '</div>' +
      equipHTML(card) +
      (t.note ? '<p class="fr-note">' + esc(t.note) + '</p>' : '') +
    '</div>';
  }

  // Nom anglais, avec le champion en préfixe pour les légendes.
  function nameVO(c){
    var base = c.fn || c.n;
    if(c.t === "Legend" && c.tg && c.tg.length && base.indexOf(c.tg[0]) === -1){
      return c.tg[0] + ", " + base;
    }
    return base;
  }

  // Nom affiché : le français dès qu'il existe, sinon la VO.
  function displayName(c){
    var t = fr(c);
    if(t && t.n){
      if(c.t === "Legend" && c.tg && c.tg.length && t.n.indexOf(c.tg[0]) === -1){
        return c.tg[0] + ", " + t.n;
      }
      return t.n;
    }
    return nameVO(c);
  }

  // Vrai quand le nom affiché diffère de la VO : on peut alors montrer les deux.
  function hasFrenchName(c){ return displayName(c) !== nameVO(c); }

  function metaSetName(setId){
    var map = {OGN:"Origins", OGS:"Proving Grounds", SFD:"Spiritforged", UNL:"Unleashed",
               VEN:"Vendetta", RAD:"Radiance", ARC:"Arcane Box Set", SGN:"Secret Garden"};
    return map[setId] || setId;
  }

  /* ---------- recherche ---------- */
  function find(name){
    var k = String(name).toLowerCase();
    return byName[k] || cards.filter(function(c){ return c.n.toLowerCase().indexOf(k) === 0; })[0] || null;
  }
  function byCode(code){
    for(var i=0;i<cards.length;i++) if(cards[i].code === code) return cards[i];
    return null;
  }

  function load(){
    // data/cards.js définit window.RB_DATA : l'application marche donc aussi
    // en ouvrant index.html directement, sans serveur. Le fetch reste en secours.
    var source = window.RB_DATA
      ? Promise.resolve(window.RB_DATA)
      : fetch("cards.json").then(function(r){
          if(!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });
    return source.then(function(d){
      cards = d.cards;
      meta = d;
      cards.forEach(function(c){
        byId[c.id] = c;
        var k = c.n.toLowerCase();
        if(!byName[k]) byName[k] = c;
      });
      RB.cards = cards;
      RB.meta = meta;
      return cards;
    });
  }

  return {
    load: load, cards: cards, meta: meta, byId: byId,
    find: find, byCode: byCode,
    cardHTML: cardHTML, detailHTML: detailHTML,
    symbols: symbols, img: img, esc: esc,
    domColor: domColor, typeFR: typeFR, domFR: domFR, setFR: setFR, rarFR: rarFR,
    costLine: costLine, isReaction: isReaction, mightOf: mightOf,
    fr: fr, frBlockHTML: frBlockHTML, frTextHTML: frTextHTML, displayName: displayName, nameVO: nameVO, hasFrenchName: hasFrenchName,
    KEYWORDS: KEYWORDS, metaSetName: metaSetName
  };
})();
