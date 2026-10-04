# Le Rift Expliqué

Riftbound en français : les 1333 cartes traduites à la main, et une extension
Chrome qui affiche la traduction au survol de la souris pendant la partie.

**[rift-explique.github.io](https://rift-explique.github.io)**

Riot ne publie pas encore Riftbound en français. Ce projet comble le manque en
attendant : une traduction complète, une terminologie tenue d'un bout à l'autre,
et le texte anglais d'origine conservé à côté de chaque carte.

## L'extension

Sur [Rift Atlas](https://riftatlas.com) et dans son simulateur de parties, un
panneau s'ouvre à côté de la carte survolée : son nom, son texte de règles, et
sur les cartes retorses une note qui explique le piège. Les pictogrammes de
Riot — Énergie, runes, Puissance, épuisement — sont affichés depuis les
serveurs officiels, tels qu'ils apparaissent sur la carte.

Tout se pilote avec une seule touche, `²` :

| Raccourci | Effet |
|---|---|
| `²` | affiche ou masque les traductions |
| `Maj + ²` | ne laisse que le texte de la carte, sans les rappels de règles |
| `Ctrl + ²` | fige le panneau et le rend cliquable |
| `Alt + ²` | rappelle ces raccourcis par-dessus la page |

Sur un clavier sans `²`, `F2` la remplace partout.

Par défaut, le panneau est transparent aux clics : il ne gêne jamais le plateau.

## Installation

L'extension n'est pas distribuée par le Chrome Web Store ; elle s'installe
depuis son dossier, une seule fois.

1. Télécharger l'archive du dépôt (bouton **Code → Download ZIP**) et la
   décompresser. Le dossier obtenu, `rift-explique.github.io-main`, contient un
   sous-dossier `extension`.
2. Ouvrir `chrome://extensions` dans Chrome.
3. Activer le **mode développeur**, en haut à droite.
4. Cliquer **Charger l'extension non empaquetée** et sélectionner le
   sous-dossier `extension` — pas le dossier parent.
5. Aller sur [riftatlas.com/cards](https://riftatlas.com/cards) et passer la
   souris sur une carte.

Chrome affiche un bandeau « Désactiver les extensions en mode développeur » à
chaque démarrage : c'est le comportement normal pour une extension installée
ainsi.

## Le site

| Onglet | Contenu |
|---|---|
| **Extension** | Ce que fait l'extension, son installation, ce qu'elle envoie |
| **Les règles** | Le vocabulaire du jeu, puis les vingt-huit mots-clés avec leur nom anglais et le numéro d'article officiel |
| **Démarrer** | Les questions de la première partie : affrontement, chaîne, score, pièges classiques |

## La traduction

Les 1333 cartes des six extensions — Origins, Proving Grounds, Spiritforged,
Unleashed, Vendetta et Radiance — sont traduites dans `rb-fr.js`, qui est la
source. `fr.json` en est l'index généré, servi au site et à l'extension.

Les mots-clés gardent leur nom anglais — Ambush, Deathknell, Deflect, Empower,
Buff, Stun — parce que c'est celui qui est imprimé sur la carte et employé dans
le simulateur, sur Rift Atlas et au Discord. Autour d'eux, la phrase est en
français, et la parenthèse explique le mot. Le reste du vocabulaire, lui, est
traduit et tenu d'un bout à l'autre : Essence runique, Puissance, Énergie.

La grammaire des pictogrammes de Riot est respectée à la lettre : `[C]` désigne
une rune du domaine de la carte, `[A]` une rune de n'importe quel domaine, et
la traduction rend cette distinction visible — c'est elle qui décide du
pictogramme affiché.

## Ce que l'extension envoie

Rien qui concerne l'utilisateur. Aucune mesure d'audience, aucun identifiant,
aucune donnée de navigation.

Deux requêtes sortantes, et seulement deux : le fichier de traductions, relu
une fois par jour depuis ce site, et les pictogrammes du jeu, chargés depuis
les serveurs de Riot. L'extension ne lit que les pages de Rift Atlas.

## Structure

```
index.html            coquille et navigation
style.css             thème sombre, composants
rb-app.js             navigation entre les onglets
rb-core.js            chargement, pictogrammes, lexique
rb-motscles.js        les mots-clés mis en couleur — source unique, embarquée dans fr.json
rb-fr.js              traduction des 1333 cartes — la source
fr.json               index généré depuis rb-fr.js, servi au site et à l'extension
cards-data.js         données officielles allégées, liens vers les images de Riot
rb-extension.js       onglet « Extension »
rb-regles.js          onglet « Les règles »
rb-regles-data.js     vocabulaire, mots-clés, articles officiels
rb-rules.js           onglet « Démarrer »
extension/            l'extension Chrome
```

`rb-chain.js`, `rb-sim.js`, `rb-explorer.js`, `rb-deck.js` et `rb-turn.js`
restent dans le dépôt : animation de la chaîne, simulateur d'affrontement,
explorateur de cartes et constructeur de deck sont écrits mais retirés de la
navigation, le temps d'être repris.

Aucun serveur n'est nécessaire : les données sont dans des fichiers
JavaScript, et `index.html` s'ouvre directement.

## Mise à jour des cartes

`cards-data.js` est un instantané de la galerie officielle. À la sortie d'une
extension, le projet communautaire
[riftbound-card-db](https://github.com/riccjohn/riftbound-card-db) aspire la
galerie et produit le même format ; il reste à réappliquer la simplification
des champs (`n`, `t`, `d`, `e`, `m`, `tx`…), puis à régénérer `fr.json` depuis
`rb-fr.js`.

Riot fournit par ailleurs une clé d'API sur son
[portail développeur](https://developer.riotgames.com/docs/riftbound), qui
donne accès aux visuels et aux traductions officielles là où elles existent.

## Licence

Traduction française, notes explicatives, choix de terminologie et code sont
l'œuvre de **Fisher**, sous licence
[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr).
Le détail figure dans [LICENSE.md](LICENSE.md).

Projet de fan non officiel, sans lien avec Riot Games ni avec Rift Atlas.
Riftbound et League of Legends sont des marques de Riot Games, Inc. Le texte
original des cartes, leurs illustrations et leurs pictogrammes appartiennent à
Riot Games et ne sont pas redistribués ici : ils sont affichés depuis les
serveurs de Riot.
