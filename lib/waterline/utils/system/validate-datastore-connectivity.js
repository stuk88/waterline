var _ = require('@sailshq/lodash');

/**
 * validateDatastoreConnectivity()
 *
 * Validates connectivity to a datastore by trying to acquire and release
 * connection.
 *
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 * @param {Ref} datastore
 *
 * @param {Function} done
 *         @param {Error?} err   [if an error occured]
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 */

module.exports = function validateDatastoreConnectivity(datastore, done) {
  var adapterDSEntry = _.get(datastore, 'adapter.datastores.' + datastore.config.identity);

  // Skip validation if the adapter doesn't track datastores, the entry doesn't
  // exist, or the required driver methods are not available.
  if (!adapterDSEntry || !adapterDSEntry.driver) {
    return done();
  }

  if (!_.has(adapterDSEntry.driver, 'getConnection') || !_.has(adapterDSEntry.driver, 'releaseConnection')) {
    return done();
  }

  // try to acquire connection.
  adapterDSEntry.driver.getConnection({
    manager: adapterDSEntry.manager
  }, function(err, report) {
    if (err) {
      return done(err);
    }

    // release connection.
    adapterDSEntry.driver.releaseConnection({
      connection: report.connection
    }, function(err) {
      if (err) {
        return done(err);
      }

      return done();
    });//</ releaseConnection() >
  });//</ getConnection() >
};
