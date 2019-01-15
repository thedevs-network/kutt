/**
 * Abstract Class for RemoteConfiguration Implementations
 */
module.exports = class RemoteConfiguration {
  /**
   * This callback handles a new or updated configuration set
   * @callback allConfigChangedCallback
   * @param {object} config
   */

  /**
   * This callback handles a deleted configuration property
   * @callback configItemDeletedCallback
   * @param {string} configKey
   */

  /**
   * This callback handles a new or updated configuration property
   * @callback configItemChangedCallback
   * @param {string} configKey
   * @param {*} configValue
   */

  /**
   * constructor
   * ============================================================
   * Instantiates the class RemoteConfiguration
   * @param {configItemChangedCallback} [configItemChanged=()=>{}] callback to handle new or updated configuration properties
   * @param {configItemDeletedCallback} [configItemDeleted=()=>{}] callback to handle deleted config configuration properties
   * @param {allConfigChangedCallback} [allConfigChanged=()=>{}] callback to handle a new configuration set
   */
  constructor(
    configItemChanged = () => {},
    configItemDeleted = () => {},
    allConfigChanged = () => {}
  ) {
    this.configItemChanged = configItemChanged;
    this.configItemDeleted = configItemDeleted;
    this.allConfigChanged = allConfigChanged;
  }

  /**
   * connect
   * ============================================================
   * Placeholder method for connecting to remote configuration service,
   * should be overridden by implementation
   */
  connect() {
    this.connected = true;
  }

  /**
   * setConfigItemChangedHandler
   * ============================================================
   * Sets a handler for new or updated configuration properties
   * @param {configItemChangedCallback} configItemChanged callback to handle a new or updated configuration property
   */
  setConfigItemChangedHandler(configItemChanged) {
    this.configItemChanged = configItemChanged;
  }

  /**
   * setConfigItemDeletedHandler
   * ============================================================
   * Sets a handler for deleted configuration properties
   * @param {configItemDeletedCallback} configItemDeleted callback to handle a deleted configuration property
   */
  setConfigItemDeletedHandler(configItemDeleted) {
    this.configItemDeleted = configItemDeleted;
  }

  /**
   * setConfigItemChangedHandler
   * ============================================================
   * Sets a handler for a new or updated configuration set
   * @param {allConfigChangedCallback} allConfigChanged callback to handle a new or updated configuration set
   */
  setAllConfigChangedHandler(allConfigChanged) {
    this.allConfigChanged = allConfigChanged;
  }
};
