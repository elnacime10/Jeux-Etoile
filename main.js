/**
 * main.js
 * -----------------------------------------------------------------------------
 * Point d'entrée. Volontairement minuscule : il récupère les noeuds DOM,
 * instancie le jeu et le démarre. Toute la logique vit dans les modules.
 *
 * L'import de `entities/index.js` est indispensable et non "inutilisé" : c'est
 * lui qui enregistre les types d'entités dans le registre avant qu'un niveau
 * ne tente d'en fabriquer.
 */
import { Game } from './core/Game.js';
import './entities/index.js';

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');
const loader = document.getElementById('boot-loader');

try {
  const game = new Game(canvas, uiRoot);
  game.start();

  // Exposé uniquement pour le débogage en console (ex. game.startLevel('w1-l3')).
  // Aucun module du projet n'utilise cette référence.
  window.game = game;

  loader?.remove();
} catch (error) {
  console.error('[main] Démarrage impossible', error);
  if (loader) {
    loader.innerHTML = `
      <div class="boot-loader__error">
        <h1>Le jeu n'a pas pu démarrer</h1>
        <p>Ouvre le projet via un petit serveur local plutôt qu'en double-cliquant
           sur le fichier — les navigateurs bloquent les modules en <code>file://</code>.</p>
        <p><code>python3 -m http.server 8000</code> puis <code>http://localhost:8000</code></p>
      </div>`;
  }
}
