var assert = require('assert');
var _ = require('@sailshq/lodash');
var Waterline = require('../../lib/waterline');

describe('Migration Fixes ::', function() {

  // =========================================================================
  // Bug A: process-all-records.js — nonAttrKeys.length check
  // =========================================================================
  describe('process-all-records extraneous key detection', function() {

    it('should warn when schema:true model gets records with extra keys', function(done) {
      var warnings = [];
      var originalWarn = console.warn;
      console.warn = function() {
        warnings.push(Array.prototype.join.call(arguments, ' '));
      };

      var waterline = new Waterline();
      waterline.registerModel(Waterline.Model.extend({
        identity: 'user',
        datastore: 'default',
        primaryKey: 'id',
        schema: true,
        fetchRecordsOnFind: true,
        attributes: {
          id: { type: 'number', autoMigrations: { columnType: '_numberkey' } },
          name: { type: 'string', autoMigrations: { columnType: '_string' } }
        }
      }));

      var adapterDef = {
        find: function(datastoreName, query, cb) {
          // Adapter returns a record with an extra column not in the model
          return cb(null, [{ id: 1, name: 'test', stale_column: 'leftover' }]);
        }
      };

      waterline.initialize({
        adapters: { mem: adapterDef },
        datastores: { default: { adapter: 'mem' } }
      }, function(err, orm) {
        if (err) { console.warn = originalWarn; return done(err); }

        orm.collections.user.find({}).exec(function(err) {
          console.warn = originalWarn;
          if (err) { return done(err); }

          var found = _.any(warnings, function(w) {
            return w.indexOf('extraneous properties') > -1;
          });
          assert(found, 'Expected a warning about extraneous properties, but none was logged. Warnings: ' + JSON.stringify(warnings));
          done();
        });
      });
    });
  });

  // =========================================================================
  // Bug B: has-schema-check.js — adapter schema default fallback
  // =========================================================================
  describe('has-schema-check adapter defaults', function() {

    it('should respect adapter schema:false default for schemaless adapters', function(done) {
      var waterline = new Waterline();
      waterline.registerModel(Waterline.Model.extend({
        identity: 'doc',
        datastore: 'default',
        primaryKey: 'id',
        // Note: NOT setting schema explicitly — should fall back to adapter default
        attributes: {
          id: { type: 'string', autoMigrations: { columnType: '_stringkey' } },
          data: { type: 'json', autoMigrations: { columnType: '_json' } }
        }
      }));

      var adapterDef = {
        schema: false,
        find: function(datastoreName, query, cb) {
          return cb(null, []);
        }
      };

      waterline.initialize({
        adapters: { schemaless: adapterDef },
        datastores: { default: { adapter: 'schemaless', schema: false } }
      }, function(err, orm) {
        if (err) { return done(err); }

        // The model should have hasSchema = false based on the adapter default
        var WLModel = orm.collections.doc;
        assert.strictEqual(WLModel.hasSchema, false,
          'Expected hasSchema to be false (adapter default), but got: ' + WLModel.hasSchema);
        done();
      });
    });

    it('should default to schema:true when adapter has no schema setting', function(done) {
      var waterline = new Waterline();
      waterline.registerModel(Waterline.Model.extend({
        identity: 'item',
        datastore: 'default',
        primaryKey: 'id',
        attributes: {
          id: { type: 'number', autoMigrations: { columnType: '_numberkey' } }
        }
      }));

      var adapterDef = {
        find: function(datastoreName, query, cb) {
          return cb(null, []);
        }
      };

      waterline.initialize({
        adapters: { plain: adapterDef },
        datastores: { default: { adapter: 'plain' } }
      }, function(err, orm) {
        if (err) { return done(err); }

        var WLModel = orm.collections.item;
        assert.strictEqual(WLModel.hasSchema, true,
          'Expected hasSchema to be true (default), but got: ' + WLModel.hasSchema);
        done();
      });
    });
  });

  // =========================================================================
  // Bug C: validate-datastore-connectivity.js — null guard
  // =========================================================================
  describe('validate-datastore-connectivity null safety', function() {

    it('should not crash when adapter lacks .datastores property', function(done) {
      var waterline = new Waterline();
      waterline.registerModel(Waterline.Model.extend({
        identity: 'thing',
        datastore: 'default',
        primaryKey: 'id',
        attributes: {
          id: { type: 'number', autoMigrations: { columnType: '_numberkey' } }
        }
      }));

      // Adapter that implements registerDatastore but does NOT expose .datastores
      var adapterDef = {
        registerDatastore: function(config, schemas, cb) {
          // Intentionally NOT setting this.datastores
          return cb();
        },
        find: function(datastoreName, query, cb) {
          return cb(null, []);
        }
      };

      waterline.initialize({
        adapters: { nodatastores: adapterDef },
        datastores: { default: { adapter: 'nodatastores' } }
      }, function(err, orm) {
        // Should NOT crash with TypeError
        if (err) {
          assert.fail('ORM initialization should not crash, but got: ' + err.message);
        }
        assert(orm, 'ORM should have initialized successfully');
        done();
      });
    });
  });

  // =========================================================================
  // Alter strategy: non-destructive migration for schemaless adapters
  // =========================================================================
  describe('alter strategy for schemaless adapters (MongoDB-like)', function() {

    it('should not drop the collection when adapter lacks describe()', function(done) {
      var dropCalled = false;
      var defineCalled = false;
      var runAutoMigrations = require('../../node_modules/waterline-utils').autoMigrations;

      var waterline = new Waterline();
      waterline.registerModel(Waterline.Model.extend({
        identity: 'post',
        datastore: 'default',
        primaryKey: 'id',
        attributes: {
          id: { type: 'string', autoMigrations: { columnType: '_stringkey' } },
          title: { type: 'string', autoMigrations: { columnType: '_string' } }
        }
      }));

      var adapterDef = {
        schema: false,
        registerDatastore: function(config, schemas, cb) { return cb(); },
        // No describe() — simulating MongoDB
        define: function(datastoreName, tableName, spec, cb) {
          defineCalled = true;
          return cb();
        },
        drop: function(datastoreName, tableName, unused, cb) {
          dropCalled = true;
          return cb();
        },
        find: function(datastoreName, query, cb) {
          return cb(null, []);
        }
      };

      waterline.initialize({
        adapters: { mongo: adapterDef },
        datastores: { default: { adapter: 'mongo' } }
      }, function(err, orm) {
        if (err) { return done(err); }

        runAutoMigrations('alter', orm, function(err) {
          if (err) { return done(err); }

          assert.strictEqual(dropCalled, false, 'drop() should NOT have been called for schemaless adapter');
          assert.strictEqual(defineCalled, true, 'define() should have been called to ensure indexes');
          done();
        });
      });
    });
  });

  // =========================================================================
  // Alter strategy: schema-aware adapters with describe()
  // =========================================================================
  describe('alter strategy for schema-aware adapters (MySQL-like)', function() {

    it('should skip drop when schema has not changed', function(done) {
      var dropCalledForModel = false;
      var runAutoMigrations = require('../../node_modules/waterline-utils').autoMigrations;

      var waterline = new Waterline();
      waterline.registerModel(Waterline.Model.extend({
        identity: 'account',
        datastore: 'default',
        primaryKey: 'id',
        archiveModelIdentity: false,
        attributes: {
          id: { type: 'number', autoMigrations: { columnType: '_numberkey', autoIncrement: true } },
          email: { type: 'string', autoMigrations: { columnType: '_string' } }
        }
      }));

      var adapterDef = {
        registerDatastore: function(config, schemas, cb) { return cb(); },
        describe: function(datastoreName, tableName, cb) {
          return cb(null, {
            id: { type: 'integer', primaryKey: true, autoIncrement: true },
            email: { type: 'varchar(255)' }
          });
        },
        define: function(datastoreName, tableName, spec, cb) {
          return cb();
        },
        drop: function(datastoreName, tableName, unused, cb) {
          if (tableName === 'account') {
            dropCalledForModel = true;
          }
          return cb();
        },
        find: function(datastoreName, query, cb) {
          return cb(null, []);
        }
      };

      waterline.initialize({
        adapters: { mysql: adapterDef },
        datastores: { default: { adapter: 'mysql' } }
      }, function(err, orm) {
        if (err) { return done(err); }

        runAutoMigrations('alter', orm, function(err) {
          if (err) { return done(err); }

          assert.strictEqual(dropCalledForModel, false, 'drop() should NOT have been called for account when schema is unchanged');
          done();
        });
      });
    });

    it('should fall back to drop+reinsert when new columns are needed', function(done) {
      var dropCalledForModel = false;
      var createEachCalled = false;
      var runAutoMigrations = require('../../node_modules/waterline-utils').autoMigrations;

      var waterline = new Waterline();
      waterline.registerModel(Waterline.Model.extend({
        identity: 'profile',
        datastore: 'default',
        primaryKey: 'id',
        archiveModelIdentity: false,
        attributes: {
          id: { type: 'number', autoMigrations: { columnType: '_numberkey', autoIncrement: false } },
          name: { type: 'string', autoMigrations: { columnType: '_string' } },
          age: { type: 'number', autoMigrations: { columnType: '_number' } }
        }
      }));

      var adapterDef = {
        registerDatastore: function(config, schemas, cb) { return cb(); },
        describe: function(datastoreName, tableName, cb) {
          if (tableName === 'profile') {
            return cb(null, {
              id: { type: 'integer', primaryKey: true },
              name: { type: 'varchar(255)' }
            });
          }
          return cb(null, null);
        },
        define: function(datastoreName, tableName, spec, cb) {
          return cb();
        },
        drop: function(datastoreName, tableName, unused, cb) {
          if (tableName === 'profile') {
            dropCalledForModel = true;
          }
          return cb();
        },
        find: function(datastoreName, query, cb) {
          return cb(null, [{ id: 1, name: 'Alice' }]);
        },
        createEach: function(datastoreName, query, cb) {
          createEachCalled = true;
          return cb(null, query.newRecords);
        }
      };

      waterline.initialize({
        adapters: { mysql: adapterDef },
        datastores: { default: { adapter: 'mysql' } }
      }, function(err, orm) {
        if (err) { return done(err); }

        runAutoMigrations('alter', orm, function(err) {
          if (err) { return done(err); }

          assert.strictEqual(dropCalledForModel, true, 'drop() should have been called for profile with new columns');
          assert.strictEqual(createEachCalled, true, 'createEach() should have been called to reinsert data');
          done();
        });
      });
    });
  });

});
