//  ██╗  ██╗ █████╗ ███████╗    ███████╗ ██████╗██╗  ██╗███████╗███╗   ███╗ █████╗
//  ██║  ██║██╔══██╗██╔════╝    ██╔════╝██╔════╝██║  ██║██╔════╝████╗ ████║██╔══██╗
//  ███████║███████║███████╗    ███████╗██║     ███████║█████╗  ██╔████╔██║███████║
//  ██╔══██║██╔══██║╚════██║    ╚════██║██║     ██╔══██║██╔══╝  ██║╚██╔╝██║██╔══██║
//  ██║  ██║██║  ██║███████║    ███████║╚██████╗██║  ██║███████╗██║ ╚═╝ ██║██║  ██║
//  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝
//
//   ██████╗██╗  ██╗███████╗ ██████╗██╗  ██╗
//  ██╔════╝██║  ██║██╔════╝██╔════╝██║ ██╔╝
//  ██║     ███████║█████╗  ██║     █████╔╝
//  ██║     ██╔══██║██╔══╝  ██║     ██╔═██╗
//  ╚██████╗██║  ██║███████╗╚██████╗██║  ██╗
//   ╚═════╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝
//
// Returns TRUE/FALSE if a collection has it's `hasSchema` flag set.

var _ = require('@sailshq/lodash');

module.exports = function hasSchemaCheck(context) {
  // If hasSchema is defined on the collection, return the value
  if (_.has(Object.getPrototypeOf(context), 'hasSchema')) {
    var proto = Object.getPrototypeOf(context);
    if (!_.isUndefined(proto.hasSchema)) {
      return Object.getPrototypeOf(context).hasSchema;
    }
  }

  // Look up the datastore to check config and adapter defaults.
  var datastore = context._datastore;
  if (!datastore) {
    return true;
  }

  // Check the user defined config
  if (_.has(datastore, 'config') && _.has(datastore.config, 'schema')) {
    return datastore.config.schema;
  }

  // Check the defaults defined in the adapter
  if (!_.has(datastore, 'adapter')) {
    return true;
  }

  if (!_.has(datastore.adapter, 'schema')) {
    return true;
  }

  return datastore.adapter.schema;
};
