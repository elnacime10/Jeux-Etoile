/**
 * Game.js
 * -----------------------------------------------------------------------------
 * Racine de composition (« composition root ») du jeu.
 *
 * C'est le SEUL endroit où les modules sont assemblés. Chaque système reçoit
 * ses dépendances via le contexte `ctx` : aucun module n'importe un singleton
 * global, aucun ne va chercher `window.game`. Conséquence pratique : n'importe
 * quel système peut être remplacé, moqué ou testé isolément.
 *
 * Game expose aussi l'API de haut niveau utilisée par l'interface
 * (startLevel, pause, resume…), ce qui garde les écrans totalement ignorants
 * du fonctionnement interne.
 */
import { EventBus, Events } from './EventBus.js';
import { Engine } from './Engine.js';
import { InputManager } from './InputManager.js';
import { Loop } from './Loop.js';
import { StateMachine } from './StateMachine.js';
import { registerGameStates } from './GameStates.js';

import { GameConfig } from '../config/GameConfig.js';
import { PhysicsSystem } from '../systems/PhysicsSystem.js';
import { TriggerSystem } from '../systems/TriggerSystem.js';
import { CameraController } from '../systems/CameraController.js';
import { AudioSystem } from '../systems/AudioSystem.js';

import { Player } from '../entities/Player.js';
import { LevelManager } from '../levels/LevelManager.js';
import { getLevelById, getNextLevelId, getFirstLevelId } from '../levels/registry.js';
import { SaveManager } from '../save/SaveManager.js';
import { UIManager } from '../ui/UIManager.js';

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} uiRoot
   */
  constructor(canvas, uiRoot) {
    // --- Services de base --------------------------------------------------
    this.bus = new EventBus();
    this.save = new SaveManager(this.bus);
    this.engine = new Engine(canvas);
    this.input = new InputManager({ touchContainer: uiRoot });
    this.audio = new AudioSystem();

    // --- Systèmes ----------------------------------------------------------
    this.physics = new PhysicsSystem(GameConfig.player);
    this.triggers = new TriggerSystem();
    this.camera = new CameraController(this.engine.camera, GameConfig.camera);

    // --- Acteurs -----------------------------------------------------------
    this.player = new Player();
    this.engine.scene.add(this.player.object3D);
    this.camera.setTarget(this.player);

    /**
     * Contexte partagé : la seule "variable globale" du projet, explicitement
     * transmise. Ajouter un système = ajouter une clé ici.
     */
    this.ctx = {
      game: this,
      bus: this.bus,
      save: this.save,
      engine: this.engine,
      input: this.input,
      audio: this.audio,
      physics: this.physics,
      triggers: this.triggers,
      camera: this.camera,
      player: this.player,
    };

    this.levels = new LevelManager(this.ctx);
    this.ctx.levels = this.levels;

    this.ui = new UIManager(uiRoot, this.ctx);
    this.ctx.ui = this.ui;

    this.states = new StateMachine(this.ctx, 'Game');
    this.ctx.states = this.states;
    registerGameStates(this.states);

    this.loop = new Loop({
      update: (dt) => this.states.update(dt),
      render: () => this._render(),
      fixedStep: GameConfig.loop.fixedStep,
      maxSubSteps: GameConfig.loop.maxSubSteps,
    });

    this._bindEvents();
  }

  /** Démarre le jeu sur le menu principal. */
  start() {
    this.states.change('menu');
    this.loop.start();
  }

  // ------------------------------------------------------- API interface ---

  /**
   * Lance un niveau.
   * @param {string} levelId
   */
  startLevel(levelId) {
    const id = levelId ?? getFirstLevelId();
    if (!this.save.isUnlocked(id)) {
      this.ui.toast('Ce niveau est encore fermé !');
      return;
    }
    this.save.setLastLevel(id);
    this.levels.load(id);
    this.states.change('playing');
  }

  /** Passe au niveau suivant, ou revient à la carte si le jeu est fini. */
  startNextLevel() {
    const nextId = getNextLevelId(this.levels.currentId);
    if (!nextId) {
      this.openLevelSelect();
      return;
    }
    this.startLevel(nextId);
  }

  /** Recommence le niveau en cours. */
  restartLevel() {
    const id = this.levels.currentId ?? this.save.getLastLevelId();
    this.startLevel(id);
  }

  pause() {
    if (this.states.is('playing')) this.states.change('paused');
  }

  resume() {
    if (this.states.is('paused')) this.states.change('playing');
  }

  openMainMenu() {
    this.states.change('menu');
  }

  openLevelSelect() {
    this.states.change('levelSelect');
  }

  /** Efface la progression puis revient au menu. */
  resetProgress() {
    this.save.reset();
    // Pas de message ici : le HUD est masqué au menu. Le retour visuel est le
    // compteur d'étoiles qui repasse à zéro et les niveaux qui se reverrouillent.
    this.states.change('menu');
  }

  // ------------------------------------------------------------- Interne ---

  _bindEvents() {
    // Note : le comptage des étoiles est branché par le LevelManager lui-même
    // (question d'ordre d'abonnement, voir le commentaire dans LevelManager).

    // Fin de niveau : sauvegarde, déblocage du suivant, écran de victoire.
    this.bus.on(Events.LEVEL_COMPLETED, () => this._handleLevelCompleted());
  }

  _handleLevelCompleted() {
    // Garde-fou : le portail peut émettre l'événement deux frames de suite.
    if (this.states.is('complete')) return;

    const levelId = this.levels.currentId;
    const def = getLevelById(levelId);
    const stars = this.levels.starsCollected;
    const time = this.levels.elapsed;

    const { isNewBestTime } = this.save.recordCompletion(levelId, { stars, time });

    // Le déblocage est la seule règle de progression du jeu : terminer un
    // niveau ouvre le suivant dans l'ordre du registre, mondes compris.
    const nextLevelId = getNextLevelId(levelId);
    if (nextLevelId) this.save.unlock(nextLevelId);

    this.audio.play('complete');
    this.states.change('complete', {
      levelName: def?.name ?? '',
      stars,
      totalStars: this.levels.totalStars,
      time,
      isNewBestTime,
      nextLevelId,
    });
  }

  _render() {
    this.engine.render();
    // Une seule fois par frame de rendu : voir InputManager.endFrame().
    this.input.endFrame();
  }

  /** Libère toutes les ressources (utile si le jeu est intégré dans une SPA). */
  dispose() {
    this.loop.stop();
    this.levels.unload();
    this.input.destroy();
    this.engine.dispose();
    this.bus.clear();
  }
}
