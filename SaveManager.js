/**
 * SaveManager.js
 * -----------------------------------------------------------------------------
 * Progression persistante (localStorage).
 *
 * DEUX DECISIONS TECHNIQUES QUI PAIERONT PLUS TARD :
 *
 * 1) SAUVEGARDE VERSIONNÉE + MIGRATIONS.
 *    Le fichier de sauvegarde porte un numéro de version. Quand la structure
 *    changera (ajout des vies, des pièces, des quêtes…), on incrémente
 *    `GameConfig.save.version` et on ajoute une fonction de migration. Les
 *    enfants qui jouent déjà ne perdent JAMAIS leur progression — c'est le
 *    genre de détail qu'on ne peut plus rattraper une fois le jeu distribué.
 *
 * 2) ADAPTATEUR DE STOCKAGE AVEC REPLI EN MÉMOIRE.
 *    localStorage lève une exception en navigation privée, dans certaines
 *    iframes ou quand le quota est plein. On intercepte : le jeu reste
 *    parfaitement jouable, seule la persistance est perdue.
 */
import { GameConfig } from '../config/GameConfig.js';
import { Events } from '../core/EventBus.js';
import { getFirstLevelId, LevelOrder } from '../levels/registry.js';

/**
 * Migrations de schéma : `MIGRATIONS[n]` transforme une sauvegarde de version n
 * en version n+1. Appliquées en chaîne au chargement.
 *
 * Exemple pour plus tard :
 *   1: (data) => ({ ...data, inventory: {} }),   // v1 -> v2 : ajout de l'inventaire
 */
const MIGRATIONS = {};

/** Adaptateur de stockage tolérant aux pannes. */
class Storage {
  constructor(key) {
    this.key = key;
    this.available = Storage._probe();
    this._memory = null;
    if (!this.available) {
      console.warn('[SaveManager] Stockage local indisponible : progression non persistée.');
    }
  }

  static _probe() {
    try {
      const probe = '__ef_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  read() {
    if (!this.available) return this._memory;
    try {
      const raw = window.localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('[SaveManager] Sauvegarde illisible, réinitialisation.', error);
      return null;
    }
  }

  write(data) {
    this._memory = data;
    if (!this.available) return;
    try {
      window.localStorage.setItem(this.key, JSON.stringify(data));
    } catch (error) {
      console.warn('[SaveManager] Écriture impossible.', error);
    }
  }

  clear() {
    this._memory = null;
    if (!this.available) return;
    try {
      window.localStorage.removeItem(this.key);
    } catch { /* ignoré volontairement */ }
  }
}

export class SaveManager {
  /** @param {import('../core/EventBus.js').EventBus} bus */
  constructor(bus) {
    this.bus = bus;
    this.storage = new Storage(GameConfig.save.storageKey);
    this.data = this._loadOrCreate();
  }

  // ------------------------------------------------------------ Lecture ----

  /** Un niveau est-il accessible ? Le premier l'est toujours. */
  isUnlocked(levelId) {
    if (levelId === getFirstLevelId()) return true;
    return this.data.progress[levelId]?.unlocked === true;
  }

  /** Le niveau a-t-il déjà été terminé ? */
  isCompleted(levelId) {
    return this.data.progress[levelId]?.completed === true;
  }

  /** Meilleur nombre d'étoiles obtenu sur ce niveau. */
  getStars(levelId) {
    return this.data.progress[levelId]?.stars ?? 0;
  }

  /** Meilleur temps (secondes) ou null. */
  getBestTime(levelId) {
    return this.data.progress[levelId]?.bestTime ?? null;
  }

  /** Total d'étoiles récoltées dans tout le jeu (affiché au menu). */
  getTotalStars() {
    return Object.values(this.data.progress)
      .reduce((total, entry) => total + (entry.stars ?? 0), 0);
  }

  /** Dernier niveau joué : permet un bouton « Continuer » pertinent. */
  getLastLevelId() {
    const id = this.data.lastLevelId;
    return id && this.isUnlocked(id) ? id : getFirstLevelId();
  }

  // ------------------------------------------------------------ Écriture ---

  /** Mémorise le niveau en cours. */
  setLastLevel(levelId) {
    this.data.lastLevelId = levelId;
    this._persist();
  }

  /** Débloque un niveau (idempotent). */
  unlock(levelId) {
    if (!levelId) return;
    const entry = this._entry(levelId);
    if (entry.unlocked) return;
    entry.unlocked = true;
    this._persist();
  }

  /**
   * Enregistre la fin d'un niveau. Ne conserve que le MEILLEUR résultat :
   * rejouer un niveau ne peut jamais faire régresser la progression.
   * @param {string} levelId
   * @param {{stars:number, time:number}} result
   * @returns {{isNewBestTime:boolean, isFirstCompletion:boolean}}
   */
  recordCompletion(levelId, { stars, time }) {
    const entry = this._entry(levelId);
    const isFirstCompletion = !entry.completed;
    const isNewBestTime = entry.bestTime === null || time < entry.bestTime;

    entry.unlocked = true;
    entry.completed = true;
    entry.stars = Math.max(entry.stars ?? 0, stars);
    if (isNewBestTime) entry.bestTime = time;

    this._persist();
    return { isNewBestTime, isFirstCompletion };
  }

  /** Efface toute la progression. */
  reset() {
    this.storage.clear();
    this.data = this._createDefault();
    this._persist();
  }

  // ------------------------------------------------------------- Interne ---

  _createDefault() {
    /** @type {Record<string, object>} */
    const progress = {};
    for (const level of LevelOrder) {
      progress[level.id] = { unlocked: false, completed: false, stars: 0, bestTime: null };
    }
    const firstId = getFirstLevelId();
    if (firstId) progress[firstId].unlocked = true;

    return {
      version: GameConfig.save.version,
      progress,
      lastLevelId: firstId,
      settings: { sound: true },
    };
  }

  _loadOrCreate() {
    const stored = this.storage.read();
    if (!stored) return this._createDefault();

    let data = stored;
    // Application en chaîne des migrations manquantes.
    while ((data.version ?? 0) < GameConfig.save.version) {
      const migrate = MIGRATIONS[data.version];
      if (!migrate) {
        console.warn('[SaveManager] Migration absente, sauvegarde réinitialisée.');
        return this._createDefault();
      }
      data = migrate(data);
      data.version += 1;
    }

    // Fusion avec le schéma par défaut : les niveaux ajoutés depuis la dernière
    // partie apparaissent automatiquement, verrouillés.
    const fresh = this._createDefault();
    return {
      ...fresh,
      ...data,
      progress: { ...fresh.progress, ...data.progress },
      settings: { ...fresh.settings, ...data.settings },
    };
  }

  /** Récupère (ou crée) l'entrée de progression d'un niveau. */
  _entry(levelId) {
    if (!this.data.progress[levelId]) {
      this.data.progress[levelId] = { unlocked: false, completed: false, stars: 0, bestTime: null };
    }
    return this.data.progress[levelId];
  }

  _persist() {
    this.storage.write(this.data);
    this.bus?.emit(Events.SAVE_UPDATED, this.data);
  }
}
