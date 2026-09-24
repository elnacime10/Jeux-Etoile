# Étoile Filante

Petit jeu de plateforme 3D (Three.js) conçu pour un enfant de 7 ans :
se déplacer, sauter, ramasser des étoiles, débloquer le niveau suivant.

Aucune dépendance à installer, aucun build. Three.js est chargé via une
*import map*.

---

## Lancer le jeu

Les modules ES sont bloqués par les navigateurs en `file://`. Il faut un
serveur local, même minimal :

```bash
cd etoile-filante
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Alternatives : `npx serve .`, l'extension « Live Server » de VS Code, ou
n'importe quel hébergement statique (GitHub Pages, Netlify…).

## Commandes

| Action | Clavier | Tactile |
| --- | --- | --- |
| Se déplacer | Z Q S D / W A S D / flèches | Joystick (bas-gauche) |
| Sauter | Espace | Bouton **Saut** |
| Tourner la caméra | J / L | Boutons ‹ › |
| Pause | Échap ou P | Bouton ❚❚ |

Le déplacement est **relatif à la caméra** : « haut » signifie toujours
« vers le fond de l'écran », quelle que soit l'orientation.

---

## Architecture

```
etoile-filante/
├── index.html                  Page + import map Three.js
├── styles/main.css             Interface (tokens → primitives → écrans)
└── src/
    ├── main.js                 Point d'entrée (12 lignes)
    ├── config/GameConfig.js    Toutes les constantes de réglage
    ├── core/
    │   ├── Game.js             Racine de composition + API haut niveau
    │   ├── GameStates.js       Menu / carte / jeu / pause / victoire
    │   ├── Engine.js           Renderer, scène, caméra, lumières
    │   ├── Loop.js             Boucle à pas de temps fixe
    │   ├── StateMachine.js     Machine à états générique
    │   ├── InputManager.js     Clavier + joystick virtuel → actions
    │   └── EventBus.js         Publish/subscribe + catalogue d'événements
    ├── systems/
    │   ├── PhysicsSystem.js    Gravité + collisions AABB
    │   ├── TriggerSystem.js    Contacts non solides (sphères)
    │   ├── CameraController.js Caméra 3e personne lissée
    │   └── AudioSystem.js      Sons synthétisés (zéro fichier)
    ├── entities/
    │   ├── Entity.js           Classe de base (build/update/onPlayerEnter)
    │   ├── EntityRegistry.js   Fabrique type → classe
    │   ├── index.js            ★ Enregistrement des types
    │   ├── Player.js           Le héros
    │   ├── Star.js             Collectible
    │   └── Goal.js             Portail de fin
    ├── world/
    │   ├── AssetLibrary.js     Cache de géométries/matériaux partagés
    │   └── Props.js            Décors sans collision
    ├── levels/
    │   ├── registry.js         ★ Catalogue des mondes et niveaux
    │   ├── LevelBuilder.js     Données → scène 3D
    │   ├── LevelManager.js     Charger / décharger / état de partie
    │   └── data/world-01/      Les niveaux (objets JS purs)
    ├── save/SaveManager.js     localStorage versionné + migrations
    └── ui/
        ├── UIManager.js        Écrans + table d'intentions
        ├── Screen.js           Classe de base
        └── screens/            MainMenu, LevelSelect, Hud, PauseMenu, LevelComplete
```

Les deux fichiers marqués ★ sont les points d'extension : dans 90 % des cas,
ajouter du contenu ne demande de toucher qu'à eux.

### Flux d'une frame

```
Loop ──> StateMachine ──> état « playing » :
   1. Player.update()      lit les entrées, décide d'une vitesse
   2. PhysicsSystem.step() intègre + résout les collisions solides
   3. Player.postPhysics() atterrissage, chute, animation
   4. LevelManager.update() met à jour les entités
   5. TriggerSystem.update() contacts étoiles / portail
   6. CameraController.update()
Loop ──> Engine.render() + InputManager.endFrame()
```

---

## Décisions techniques structurantes

Chaque choix ci-dessous a été pris pour réduire le coût des évolutions
prévues (ennemis, objets, quêtes, boss, mondes).

| Décision | Pourquoi |
| --- | --- |
| **Niveaux = données, pas code** | Un niveau est un objet JS sérialisable. Un futur éditeur visuel produira le même format sans modifier le moteur. Créer un niveau ne demande aucune connaissance de Three.js. |
| **Registre d'entités (factory)** | Ajouter un ennemi ou un coffre = 1 classe + 1 ligne d'enregistrement. Ni le chargeur de niveau, ni l'UI, ni la physique ne changent. |
| **Bus d'événements** | L'interface ne connaît aucun système et inversement. Le futur système de quêtes écoutera `ENEMY_DEFEATED` sans toucher au code des ennemis. Les événements à venir sont déjà déclarés dans `EventBus.js`. |
| **Pas de temps fixe** | Physique déterministe quel que soit le FPS. Indispensable dès qu'un boss aura des patterns scriptés. |
| **Machine à états** | Tout le déroulé du jeu se lit dans un seul fichier. Un état « cinématique » ou « combat de boss » s'ajoute sans toucher aux systèmes. |
| **Collisions AABB maison** | 60 lignes, 0 dépendance, comportement 100 % prévisible. Un moteur physique complet apporterait ici plus de bugs que de valeur. Le système est générique : les ennemis le réutiliseront tel quel. |
| **Géométrie procédurale, aucun asset** | Zéro temps de chargement, zéro question de licence, jeu utilisable hors ligne. |
| **AssetLibrary partagée** | 80 plateformes = 1 géométrie en mémoire. Les objets partagés sont marqués `userData.shared` pour ne jamais être détruits au déchargement d'un niveau. |
| **Sauvegarde versionnée + migrations** | Ajouter des champs plus tard ne cassera pas les parties en cours. |
| **Repli mémoire du stockage** | En navigation privée ou en iframe, `localStorage` lève une exception : le jeu reste jouable, seule la persistance est perdue. |
| **Interface HTML/CSS** | Texte net, responsive et accessible gratuitement ; modifier un menu ne recompile aucune géométrie. |

### Choix de game design (public 7 ans)

- Aucune mort, aucune vie : tomber coûte 2 secondes de réapparition.
- *Coyote time* et *jump buffer* : le saut « pardonne » les erreurs de timing.
- Contrôle aérien conservé : on peut se rattraper en l'air.
- Rayons de collecte généreux : pas besoin de viser.
- Caméra qui ne pivote jamais toute seule.
- Le portail est visible dès le départ mais grisé : voir la récompense
  verrouillée est le meilleur moteur de motivation à cet âge.

---

## Ajouter du contenu

### Un niveau

1. Créer `src/levels/data/world-01/level-04.js` :

```js
export default {
  id: 'w1-l4',
  name: 'Mon niveau',
  hint: 'Attrape les étoiles !',
  spawn: [0, 0, 6],
  platforms: [
    // position = CENTRE du bloc, size = [largeur, hauteur, profondeur]
    { position: [0, -0.5, 0], size: [20, 1, 20], color: 'grass' },
  ],
  entities: [
    { type: 'star', position: [3, 1.5, 0] },
    { type: 'goal', position: [-5, 0.5, -5] },
  ],
  decor: [{ type: 'tree', position: [8, 0, 4] }],
};
```

2. L'importer et l'ajouter au tableau `levels` dans `src/levels/registry.js`.

C'est tout : déblocage, carte des niveaux, sauvegarde et compteur d'étoiles
se mettent à jour automatiquement.

Repères d'équilibrage : le saut monte à **2,2 m** et porte à **5,5 m** en
course. Rester sous 1,5 m de dénivelé et 3,5 m de vide garde le niveau
confortable pour un enfant.

### Un monde

Créer `src/levels/data/world-02/`, puis ajouter une entrée dans `Worlds`
(`registry.js`) avec `id`, `name`, `color`, `emoji` et ses niveaux.
Le déblocage traverse les mondes sans code supplémentaire ; chaque niveau
peut définir son propre `sky` et son `fog` pour changer d'ambiance.

### Un collectible

```js
// src/entities/Coin.js
export class Coin extends Entity {
  constructor(def) { super(def); this.triggerRadius = 1; }
  build() { /* … renvoie un Object3D … */ }
  onPlayerEnter(ctx) {
    this.alive = false;
    ctx.bus.emit(Events.ITEM_COLLECTED, { kind: 'coin' });
  }
}
```

Puis `registerEntity('coin', Coin)` dans `src/entities/index.js`.

### Un ennemi

Même principe. Un ennemi qui marche et tombe réutilise directement le
`PhysicsSystem` : il lui suffit d'exposer un `body`
(`{ position, velocity, halfExtents, grounded, collider }`) comme le joueur,
et d'appeler `ctx.physics.step(this.body, dt)` dans son `update()`.
Sa logique de comportement peut utiliser la même `StateMachine`.

### Une quête

Créer `src/systems/QuestSystem.js`, l'abonner aux événements existants
(`STAR_COLLECTED`, `ENEMY_DEFEATED`…), lui donner une clé dans `ctx` depuis
`Game.js`, et un écran dédié dans `src/ui/screens/`. Aucun système existant
n'a besoin d'être modifié.

### Un boss

Une entité `Boss` avec sa propre `StateMachine` (intro → phase 1 → phase 2 →
vaincu), placée dans un niveau dédié. Ajouter un état `bossFight` dans
`GameStates.js` si le combat doit suspendre les règles normales
(caméra fixe, sortie bloquée).

---

## Pistes d'amélioration identifiées

- Plateformes mobiles (le `PhysicsSystem` devra reporter le delta du solide
  sur les corps posés dessus).
- Broad-phase de collision (grille uniforme) au-delà de ~500 blocs par niveau.
- Manette : remplir les mêmes ensembles d'actions dans `InputManager`.
- Musique de fond et export PWA pour une installation sur tablette.
