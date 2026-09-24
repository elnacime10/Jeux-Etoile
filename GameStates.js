/**
 * GameStates.js
 * -----------------------------------------------------------------------------
 * Les états du jeu, déclarés en un seul endroit.
 *
 * Lire ce fichier suffit à comprendre TOUT le déroulé du jeu : c'est
 * exactement l'objectif. La règle d'équipe est simple — aucune logique de
 * "mode de jeu" ne doit exister ailleurs. Un futur état (cinématique
 * d'introduction, combat de boss, transition entre mondes) s'ajoute ici sans
 * modifier une ligne des systèmes.
 *
 * Seul l'état `playing` fait tourner la simulation : en pause ou dans les
 * menus, la physique ne consomme aucun cycle.
 */

/**
 * Enregistre tous les états dans la machine à états du jeu.
 * @param {import('./StateMachine.js').StateMachine} states
 */
export function registerGameStates(states) {
  // --- Menu principal ------------------------------------------------------
  states.add('menu', {
    enter(ctx) {
      ctx.levels.unload();          // libère la mémoire GPU du niveau précédent
      ctx.ui.setHudVisible(false);
      ctx.ui.showScreen('menu');
    },
  });

  // --- Carte des niveaux ---------------------------------------------------
  states.add('levelSelect', {
    enter(ctx) {
      ctx.levels.unload();
      ctx.ui.setHudVisible(false);
      ctx.ui.showScreen('levels');
    },
  });

  // --- Partie en cours -----------------------------------------------------
  states.add('playing', {
    enter(ctx) {
      ctx.ui.showScreen(null);
      ctx.ui.setHudVisible(true);
    },
    update(ctx, dt) {
      if (ctx.input.wasPressed('pause')) {
        ctx.game.pause();
        return;
      }

      // ORDRE CRITIQUE — ne pas modifier sans raison :
      // 1. intention  2. simulation  3. réaction  4. monde  5. contacts  6. caméra
      ctx.player.update(dt, ctx);
      ctx.physics.step(ctx.player.body, dt);
      ctx.player.postPhysics(dt, ctx);
      ctx.levels.update(dt);
      ctx.triggers.update(ctx.player, ctx.levels.entities, ctx);
      ctx.camera.update(dt, ctx.input.getCameraTurn());
    },
  });

  // --- Pause ---------------------------------------------------------------
  states.add('paused', {
    enter(ctx) {
      ctx.ui.showScreen('pause');
    },
    update(ctx) {
      // La même touche met en pause et reprend : une seule chose à retenir.
      if (ctx.input.wasPressed('pause')) ctx.game.resume();
    },
    exit(ctx) {
      ctx.ui.showScreen(null);
    },
  });

  // --- Niveau terminé ------------------------------------------------------
  states.add('complete', {
    enter(ctx, data) {
      ctx.ui.setHudVisible(false);
      ctx.ui.showScreen('complete', data);
    },
    update(ctx, dt) {
      // Le décor reste vivant derrière l'écran de victoire (étoiles qui
      // tournent, portail qui pulse) : le jeu ne paraît jamais "figé".
      ctx.levels.update(dt);
      ctx.camera.update(dt, 0.25);
    },
  });
}
