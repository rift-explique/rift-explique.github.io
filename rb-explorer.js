/* ============================================================
   explorer.js — recherche et filtres sur les 1383 cartes
   ============================================================ */
window.Explorer = (function(){
  "use strict";

  var PAGE = 60;
  var state = { q:"", set:"", type:"", dom:"", cost:"", kw:"", shown:PAGE };
  var root = null;

  function opts(list, labeller){
    return list.map(function(v){
      return '<option value="' + RB.esc(v) + '">' + RB.esc(labeller ? labeller(v) : v) + '</option>';
    }).join("");
  }

  function matches(c){
    if(state.set && c.set !== state.set) return false;
    if(state.type && c.t !== state.type) return false;
    if(state.dom && (c.d || []).indexOf(state.dom) === -1) return false;
    if(state.kw && (c.tx || "").indexOf("[" + state.kw) === -1) return false;
    if(state.cost !== ""){
      var e = parseInt(c.e, 10);
      if(state.cost === "6+"){ if(isNaN(e) || e < 6) return false; }
      else { if(String(isNaN(e) ? "" : e) !== state.cost) return false; }
    }
    if(state.q){
      var q = state.q.toLowerCase();
      var t = RB.fr(c);
      var hay = (c.n + " " + (c.fn || "") + " " + (c.tx || "") + " " + (c.tg || []).join(" ") + " " + c.code +
                 (t ? " " + (t.n || "") + " " + (t.tx || "") : "")).toLowerCase();
      if(hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function render(){
    var list = RB.cards.filter(matches);
    var slice = list.slice(0, state.shown);

    root.querySelector("#count").textContent =
      list.length + (list.length > 1 ? " cartes trouvées" : " carte trouvée");

    var grid = root.querySelector("#grid");
    if(!slice.length){
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Aucune carte ne correspond. Essaie d\'élargir les filtres.</div>';
    } else {
      grid.innerHTML = slice.map(function(c){ return RB.cardHTML(c, {w:300}); }).join("");
    }

    var more = root.querySelector("#more");
    more.innerHTML = (list.length > state.shown)
      ? '<button id="btnMore">Afficher 60 cartes de plus</button>'
      : "";
    var bm = root.querySelector("#btnMore");
    if(bm) bm.addEventListener("click", function(){ state.shown += PAGE; render(); });
  }

  function mount(el){
    root = el;
    var kws = Object.keys(RB.KEYWORDS).sort();

    el.innerHTML =
      '<div class="view-head">' +
        '<div class="eyebrow">Collection · ' + RB.cards.length + ' cartes</div>' +
        '<h1>Les cartes</h1>' +
        '<p class="lede">Toutes les cartes des six extensions, avec leurs illustrations officielles. ' +
        'Les 1383 cartes sont traduites en français. Clique sur une carte pour son texte complet et sa traduction ; survole un mot-clé pour son explication.</p>' +
      '</div>' +
      '<div class="panel" style="margin-bottom:16px">' +
        '<div class="filters">' +
          '<label class="field wide"><span>Recherche</span>' +
            '<input type="text" id="fq" placeholder="nom, texte, champion, numéro…"></label>' +
          '<label class="field"><span>Extension</span><select id="fset"><option value="">Toutes</option>' +
            opts(RB.meta.sets, RB.setFR) + '</select></label>' +
          '<label class="field"><span>Type</span><select id="ftype"><option value="">Tous</option>' +
            opts(RB.meta.types, RB.typeFR) + '</select></label>' +
          '<label class="field"><span>Domaine</span><select id="fdom"><option value="">Tous</option>' +
            opts(RB.meta.domains, RB.domFR) + '</select></label>' +
          '<label class="field"><span>Coût</span><select id="fcost"><option value="">Tous</option>' +
            opts(["0","1","2","3","4","5","6+"]) + '</select></label>' +
          '<label class="field"><span>Mot-clé</span><select id="fkw"><option value="">Tous</option>' +
            kws.map(function(k){
              return '<option value="' + RB.esc(k) + '">' + RB.esc(RB.KEYWORDS[k].fr) + '</option>';
            }).join("") + '</select></label>' +
        '</div>' +
        '<div class="count-line"><span id="count"></span>' +
          '<button id="freset" style="padding:5px 11px;font-size:13px">Réinitialiser</button></div>' +
      '</div>' +
      '<div class="grid" id="grid"></div>' +
      '<div class="more-wrap" id="more"></div>';

    var q = el.querySelector("#fq");
    var t = null;
    q.addEventListener("input", function(){
      clearTimeout(t);
      t = setTimeout(function(){ state.q = q.value.trim(); state.shown = PAGE; render(); }, 180);
    });
    [["#fset","set"],["#ftype","type"],["#fdom","dom"],["#fcost","cost"],["#fkw","kw"]].forEach(function(p){
      el.querySelector(p[0]).addEventListener("change", function(e){
        state[p[1]] = e.target.value; state.shown = PAGE; render();
      });
    });
    el.querySelector("#freset").addEventListener("click", function(){
      state = { q:"", set:"", type:"", dom:"", cost:"", kw:"", shown:PAGE };
      el.querySelectorAll("select").forEach(function(s){ s.value = ""; });
      q.value = "";
      render();
    });

    render();
  }

  return { mount: mount };
})();
