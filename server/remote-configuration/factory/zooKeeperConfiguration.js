const zookeeper = require('node-zookeeper-client');
const RemoteConfiguration = require('./remoteConfigurationInterface');

/**
 * Declare private methods as symbols so that they can not be accessed outside of the class
 */

const zkClient = Symbol('zkClient');
const zooKeeperPath = Symbol('zooKeeperPath');

/**
 * checkPathExists - private
 * ============================================================
 * Checks to see if the configured path exists in the ZooKeeper node structure.
 * If the path exists it lists the children so that their data can be retreived.
 * Otherwise an error message is logged and the application stops watching ZooKeeper nodes.
 */
const checkPathExists = Symbol('checkPathExists');

/**
 * getChildNodes - private
 * ============================================================
 * Attempts to retreive all direct child nodes in the specified path in ZooKeeper.
 */
const getChildNodes = Symbol('getChildNodes');

/**
 * getNodeData - private
 * ============================================================
 * Attempts to retreive the value of a given node from ZooKeeper.
 * @param {string} node The name of the node whose data to retreive
 */
const getNodeData = Symbol('getNodeData');

/**
 * Class for implementing ZooKeeper Remote Configuration
 * @extends RemoteConfiguration
 */
module.exports = class ZooKeeperConfiguration extends RemoteConfiguration {
  /**
   * connect
   * ============================================================
   * Starts the ZooKeeper client and listens for changes to the configuration path.
   * @param {string} connectionString host and port of the ZooKeeper server.  (ex. 'localhost:2181')
   * @param {string} [path=/config/kutt] the path of the configuration nodes in ZooKeeper
   */
  connect(connectionString, path = '/config/kutt') {
    this[zooKeeperPath] = path;
    this[zkClient] = zookeeper.createClient(connectionString);

    this[zkClient].once('connected', () => {
      console.log('Connected to ZooKeeper.'); // eslint-disable-line no-console
      this[checkPathExists]();
    });

    console.log('Trying to connect to ZooKeeper.'); // eslint-disable-line no-console
    this[zkClient].connect();
  }

  /**
   * checkPathExists - private
   * ============================================================
   * Checks to see if the configured path exists in the ZooKeeper node structure.
   * If the path exists it lists the children so that their data can be retreived.
   * Otherwise an error message is logged and the application stops watching ZooKeeper nodes.
   */
  [checkPathExists]() {
    this[zkClient].exists(this[zooKeeperPath], (error, stat) => {
      if (error) {
        console.log('Failed to check for path due to to: %s.', error); // eslint-disable-line no-console
        return;
      }

      if (stat) {
        this[getChildNodes]();
      } else {
        console.log('No node exists at path: %s.', this[zooKeeperPath]); // eslint-disable-line no-console
        console.log('Disconnecting from ZooKeeper server'); // eslint-disable-line no-console
        this[zkClient].close();
      }
    });
  }

  /**
   * getChildNodes - private
   * ============================================================
   * Attempts to retreive all direct child nodes in the specified path in ZooKeeper.
   */
  [getChildNodes]() {
    this[zkClient].getChildren(
      this[zooKeeperPath],
      event => {
        console.log('Got watcher event: %s', event); // eslint-disable-line no-console
        this[getChildNodes]();
      },
      (error, children) => {
        if (error) {
          console.log('Failed to list children of %s due to: %s.', this[zooKeeperPath], error); // eslint-disable-line no-console
          return;
        }

        console.log('Children of %s are: %j.', this[zooKeeperPath], children); // eslint-disable-line no-console
        children.forEach(child => {
          this[getNodeData](child);
        });
      }
    );
  }

  /**
   * getNodeData
   * ============================================================
   * Attempts to retreive the value of a given node from ZooKeeper.
   * @param {string} node The name of the node whose data to retreive
   */
  [getNodeData](node) {
    this[zkClient].getData(
      `${this[zooKeeperPath]}/${node}`,
      event => {
        console.log('Got event: %s.', event); // eslint-disable-line no-console
        if (event.name === 'NODE_DELETED') {
          console.log('Deleting config property associated with deleted node.'); // eslint-disable-line no-console
          this.configItemDeleted(node);
        } else {
          this[getNodeData](node);
        }
      },
      (error, data) => {
        if (error) {
          console.log(error.stack); // eslint-disable-line no-console
          return;
        }
        console.log('Got data: %s', data.toString('utf8')); // eslint-disable-line no-console
        this.configItemChanged(node, data.toString('utf8'));
      }
    );
  }
};
