const RemoteConfiguration = require('./remoteConfigurationInterface');
const ZooKeeperConfiguration = require('./zooKeeperConfiguration');

/**
 * Factory Class for creating RemoteConfiguration Instances
 */
class RemoteConfigurationFactory {
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
   * GetConfiguration
   * ============================================================
   * Generates an implementation of RemoteConfiguration based on the passed configuration type.
   * @param {string} [configurationType=NONE] the type of RemoteConfiguration to generate
   * @param {configItemChangedCallback} [configItemChanged=()=>{}] callback to handle new or updated configuration properties
   * @param {configItemDeletedCallback} [configItemDeleted=()=>{}] callback to handle deleted config configuration properties
   * @param {allConfigChangedCallback} [allConfigChanged=()=>{}] callback to handle a new configuration set
   * @returns {RemoteConfiguration} the generated implementation of RemoteConfiguration
   */
  static GetConfiguration(
    configurationType = RemoteConfigurationFactory.NONE,
    configItemChanged = () => {},
    configItemDeleted = () => {},
    allConfigChanged = () => {}
  ) {
    switch (configurationType) {
      case RemoteConfigurationFactory.ZOOKEEPER:
        return new ZooKeeperConfiguration(configItemChanged, configItemDeleted, allConfigChanged);
      default:
        return new RemoteConfiguration();
    }
  }
}

/**
 * Static references to the different configuration types
 */
RemoteConfigurationFactory.NONE = 'NONE';
RemoteConfigurationFactory.ZOOKEEPER = 'ZOOKEEPER';

module.exports = RemoteConfigurationFactory;
