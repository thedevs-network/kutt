const config = require('../config');
const RemoteConfigurationFactory = require('./factory/remoteConfigurationFactory');

/**
 * Remote Configuration Loader
 * ============================================================
 * Determines, based on ./server/config.js, whether to use a remote configuration server.
 * If remote configuration is enabled, the loadConfiguration method will initate it.
 *
 * The only configuration that will be affected will be server configuration at './server/config.js'
 * and not all values are subject to remote configuration.  For example PORT and ZOOKEEPER settings
 * are utilized before this method is called, and they are not called again.
 */

/**
 * deleteConfigProperty
 * ============================================================
 * Delete an item from the configuration values
 * @param {string} prop The name of the configuration property to delete
 */
const deleteConfigProperty = prop => {
  delete config[prop];
};

/**
 * setConfigProperty
 * ============================================================
 * Update the application config with a new value, assuming the new value can be parsed
 * @param {string} prop The name of the configuration property to update
 * @param {*} val The name of the configuration property to update
 */
const setConfigProperty = (prop, val) => {
  if (val === undefined) {
    deleteConfigProperty(prop);
    return;
  }

  config[prop] = val;
};

/**
 * updateEntireConfig
 * ============================================================
 * Update the application config with a new set of values
 * @param {object} newConfig the new config object to read values from
 */
const updateEntireConfig = newConfig => {
  Object.keys(newConfig).forEach(prop => {
    setConfigProperty(prop, newConfig[prop]);
  });
};

/**
 * parseConfigValue
 * ============================================================
 * Attempt to parse a string value into it's appropriate type for configuration
 * @param {string} value The value to parse
 * @param {string} [type=undefined] The expected type of the returned value
 * @return {*} the value converted to it's proper type, or undefined
 */
const parseConfigValue = (value, type = 'undefined') => {
  if (value === null || value === '') {
    return undefined;
  }

  switch (type) {
    case 'string':
      return value;
    case 'number':
      return Number(value);
    case 'boolean':
      return value.toLowerCase().indexOf('true') > -1;
    case 'object':
      try {
        return JSON.parse(value);
      } catch (error) {
        console.log(`Error parsing object from value : ${value}`); // eslint-disable-line no-console
      }
      break;
    default:
      /* Undetermined type, attempt to parse and default to string */
      try {
        return JSON.parse(value);
      } catch (error) {
        console.log(`Can't parse value from : ${value}`); // eslint-disable-line no-console
        console.log('Defaulting to type string'); // eslint-disable-line no-console
        return value;
      }
  }

  return undefined;
};

/**
 * getRemoteConfigurationType
 * ============================================================
 * Determines and returns the appropriate RemoteConfiguration type
 * @return {string} RemoteConfiguration Type
 */
const getRemoteConfigurationType = () => {
  if (config.ZOOKEEPER_HOST && config.ZOOKEEPER_PORT && config.ZOOKEEPER_CONFIG_PATH)
    return RemoteConfigurationFactory.ZOOKEEPER;

  return RemoteConfigurationFactory.NONE;
};

/**
 * getConfigurationCallbacks
 * ============================================================
 * Generate the appropriate callbacks based on a passed configurationType
 * @param {string} configurationType the type of RemoteConfiguration to generate callbacks for
 * @return {Array} the list of callbacks to send to RemoteConfigurationFactory.GetConfiguration
 */
const getConfigurationCallbacks = configurationType => {
  switch (configurationType) {
    case RemoteConfigurationFactory.ZOOKEEPER:
      return [
        /* ZooKeeper returns all node values as strings, so we need to implement the parser */
        (prop, val) => {
          setConfigProperty(prop, parseConfigValue(val, typeof config[prop]));
        },
        deleteConfigProperty,
        updateEntireConfig,
      ];
    default:
      return [];
  }
};

/**
 * getConnectionArguments
 * ============================================================
 * Generate the appropriate connection arguments based on a passed configurationType
 * @param {string} configurationType the type of RemoteConfiguration to generate arguments for
 * @return {Array} the list of arguments to send to the RemoteConfiguration implementations connect method
 */
const getConnectionArguments = configurationType => {
  switch (configurationType) {
    case RemoteConfigurationFactory.ZOOKEEPER:
      return [`${config.ZOOKEEPER_HOST}:${config.ZOOKEEPER_PORT}`, config.ZOOKEEPER_CONFIG_PATH];
    default:
      return [];
  }
};

/**
 * loadConfiguration
 * ============================================================
 * Start listening for remote configuration, if there is any
 */
exports.loadConfiguration = () => {
  const configurationType = getRemoteConfigurationType();

  RemoteConfigurationFactory.GetConfiguration(
    configurationType,
    ...getConfigurationCallbacks(configurationType)
  ).connect(...getConnectionArguments(configurationType));
};
