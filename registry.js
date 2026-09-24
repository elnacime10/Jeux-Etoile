/**
 * levels/registry.js
 * -----------------------------------------------------------------------------
 * POINT D'EXTENSION N°2 DU PROJET : le catalogue des mondes et des niveaux.
 *
 * Pour ajouter un niveau :
 *   1. Créer src/levels/data/<monde>/level-XX.js (export default d'un objet).
 *   2. L'importer ici.
 *   3. L'ajouter dans le tableau `levels` du monde concerné.
 *
 * Pour ajouter un MONDE : créer un dossier, puis une entrée dans `Worlds`.
 * L'ordre du tableau définit l'ordre de déblocage — le déblocage traverse
 * naturellement les mondes, sans code supplémentaire.
 */
import world1Level1 from './data/world-01/level-01.js';
import world1Level2 from './data/world-01/level-02.js';
import world1Level3 from './data/world-01/level-03.js';

/**
 * @typedef {object} World
 * @property {string} id
 * @property {string} name
 * @property {string} color  Couleur d'accent du monde dans l'interface.
 * @property {string} emoji  Pictogramme (les enfants naviguent aux icônes).
 * @property {import('./LevelBuilder.js').LevelDefinition[]} levels
 */

/** @type {World[]} */
export const Worlds = [
  {
    id: 'world-01',
    name: 'Prairie Rebondie',
    color: '#5fcf6a',
    emoji: '🌳',
    levels: [world1Level1, world1Level2, world1Level3],
  },
  // --- À VENIR -------------------------------------------------------------
  // { id: 'world-02', name: 'Plage Dorée',   color: '#f6d99a', emoji: '🏖️', levels: [...] },
  // { id: 'world-03', name: 'Pic Glacé',     color: '#a9e6ff', emoji: '❄️',  levels: [...] },
  // -------------------------------------------------------------------------
];

/** Liste à plat, dans l'ordre de progression. */
export const LevelOrder = Worlds.flatMap((world) => world.levels);

/** Index id -> définition, construit une seule fois. */
const levelIndex = new Map(LevelOrder.map((level) => [level.id, level]));

/** @returns {import('./LevelBuilder.js').LevelDefinition|null} */
export function getLevelById(id) {
  return levelIndex.get(id) ?? null;
}

/** @returns {string} Identifiant du tout premier niveau. */
export function getFirstLevelId() {
  return LevelOrder[0]?.id ?? null;
}

/** @returns {string|null} Niveau suivant, ou null si c'est le dernier du jeu. */
export function getNextLevelId(id) {
  const index = LevelOrder.findIndex((level) => level.id === id);
  if (index === -1 || index + 1 >= LevelOrder.length) return null;
  return LevelOrder[index + 1].id;
}

/** @returns {World|null} Monde contenant ce niveau. */
export function getWorldOfLevel(id) {
  return Worlds.find((world) => world.levels.some((level) => level.id === id)) ?? null;
}

/** @returns {number} Total d'étoiles collectables dans tout le jeu. */
export function getTotalStarsInGame() {
  return LevelOrder.reduce(
    (total, level) => total + (level.entities ?? []).filter((e) => e.type === 'star').length,
    0,
  );
}
