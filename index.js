/**
 * entities/index.js
 * -----------------------------------------------------------------------------
 * POINT D'EXTENSION N°1 DU PROJET.
 *
 * Tous les types d'entités utilisables dans les données de niveau sont
 * enregistrés ici, et nulle part ailleurs. Pour ajouter un contenu :
 *
 *   1. Créer la classe dans src/entities/ (hériter de Entity).
 *   2. Ajouter une ligne `registerEntity('mon-type', MaClasse)` ci-dessous.
 *   3. L'utiliser dans un fichier de niveau : { type: 'mon-type', position: [...] }
 *
 * Aucun autre fichier n'est à modifier.
 */
import { registerEntity } from './EntityRegistry.js';
import { Star } from './Star.js';
import { Goal } from './Goal.js';

registerEntity('star', Star);
registerEntity('goal', Goal);

// --- À VENIR ---------------------------------------------------------------
// registerEntity('coin', Coin);            // objets à collectionner
// registerEntity('goomba', WalkerEnemy);   // ennemis
// registerEntity('chest', QuestChest);     // quêtes
// registerEntity('boss-king', KingBoss);   // boss
// registerEntity('moving-platform', MovingPlatform);
// ---------------------------------------------------------------------------

export { registerEntity, createEntity, hasEntity, listEntityTypes } from './EntityRegistry.js';
