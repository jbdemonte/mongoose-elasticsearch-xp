var utils = require('../utils');
var mongoose = require('mongoose');
var plugin = require('../../').v2;

describe("esSynchronise", function () {

  utils.setup();

  it('should index the database', function (done) {
    this.timeout(5000);

    var users = [];

    // beware: indexing a document require two entry in the buffer
    // 10 doc in buffer = buffer.length = 20
    var bulkSize = 20;

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number
    });

    var UserModel = mongoose.model('User', UserSchema);

    UserModel.remove({}).exec()
      .then(function () {
        for (var i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: 'Bob' + i,
            age: i
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(function () {
        var UserPluginSchema = new mongoose.Schema({
          name: String,
          age: Number
        });

        UserPluginSchema.plugin(plugin, {index: 'users', type: 'user', bulk: {size: bulkSize}});

        var UserPluginModel = mongoose.model('UserPlugin', UserPluginSchema, 'users');

        return utils.deleteModelIndexes(UserPluginModel)
          .then(function () {
            return UserPluginModel.esCreateMapping();
          })
          .then(function () {
            return UserPluginModel;
          });
      })

      .then(function (UserPluginModel) {
        var docSent = 0;
        var sent = 0;
        var error = 0;

        UserPluginModel.on('es-bulk-error', function () {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', function () {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', function (doc) {
          docSent++;
        });

        return UserPluginModel
          .esSynchronize()
          .then(function () {
            expect(error).to.be.equal(0);
            expect(docSent).to.be.equal(users.length);
            expect(sent).to.be.equal(Math.ceil(2 * users.length / bulkSize));
            return UserPluginModel;
          });
      })
      .then(function (UserPluginModel) {
        return utils.Promise.all(
          users.map(function (user) {
            return new utils.Promise(function (resolve, reject) {
              UserPluginModel
                .esSearch({match: {_id: user._id.toString()}})
                .then(function (result) {
                  expect(result.hits.total).to.eql(1);
                  var hit = result.hits.hits[0];
                  expect(hit._source.name).to.be.equal(user.name);
                  expect(hit._source.age).to.be.equal(user.age);
                  resolve();
                })
                .catch(function (err) {
                  reject(err);
                });
            });
          })
        );
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should index a subset', function (done) {
    this.timeout(5000);

    var users = [];

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number
    });

    var UserModel = mongoose.model('User', UserSchema);

    UserModel.remove({}).exec()
      .then(function () {
        for (var i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: 'Bob' + i,
            age: i
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(function () {
        var UserPluginSchema = new mongoose.Schema({
          name: String,
          age: Number
        });

        UserPluginSchema.plugin(plugin, {index: 'users', type: 'user'});

        var UserPluginModel = mongoose.model('UserPlugin', UserPluginSchema, 'users');

        return utils.deleteModelIndexes(UserPluginModel)
          .then(function () {
            return UserPluginModel.esCreateMapping();
          })
          .then(function () {
            return UserPluginModel;
          });
      })

      .then(function (UserPluginModel) {
        var docSent = 0;
        var sent = 0;
        var error = 0;

        UserPluginModel.on('es-bulk-error', function () {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', function () {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', function () {
          docSent++;
        });

        return UserPluginModel
          .esSynchronize({age: {$gte: 90}})
          .then(function () {
            expect(error).to.be.equal(0);
            expect(docSent).to.be.equal(10);
            expect(sent).to.be.equal(1);
            return UserPluginModel;
          });
      })
      .then(function (UserPluginModel) {
        return UserPluginModel
          .esSearch({match_all: {}})
          .then(function (result) {
            expect(result.hits.total).to.eql(10);
            var ids = result.hits.hits.map(function (hit) {
              return hit._id;
            });
            var expected = users.slice(-10).map(function (user) {
              return user._id.toString();
            });
            ids.sort();
            expected.sort();
            expect(ids).to.eql(expected);
          });
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should index the database using projection', function (done) {
    this.timeout(5000);

    var users = [];

    // beware: indexing a document require two entry in the buffer
    // 10 doc in buffer = buffer.length = 20
    var bulkSize = 20;

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number
    });

    var UserModel = mongoose.model('User', UserSchema);

    UserModel.remove({}).exec()
      .then(function () {
        for (var i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: 'Bob' + i,
            age: i
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(function () {
        var UserPluginSchema = new mongoose.Schema({
          name: String,
          age: {type: Number, select: false}
        });

        UserPluginSchema.plugin(plugin, {index: 'users', type: 'user', bulk: {size: bulkSize}});

        var UserPluginModel = mongoose.model('UserPlugin', UserPluginSchema, 'users');

        return utils.deleteModelIndexes(UserPluginModel)
          .then(function () {
            return UserPluginModel.esCreateMapping();
          })
          .then(function () {
            return UserPluginModel;
          });
      })

      .then(function (UserPluginModel) {
        var docSent = 0;
        var sent = 0;
        var error = 0;

        UserPluginModel.on('es-bulk-error', function () {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', function () {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', function (doc) {
          docSent++;
        });

        return UserPluginModel
          .esSynchronize({}, '+age')
          .then(function () {
            expect(error).to.be.equal(0);
            expect(docSent).to.be.equal(users.length);
            expect(sent).to.be.equal(Math.ceil(2 * users.length / bulkSize));
            return UserPluginModel;
          });
      })
      .then(function (UserPluginModel) {
        return utils.Promise.all(
          users.map(function (user) {
            return new utils.Promise(function (resolve, reject) {
              UserPluginModel
                .esSearch({match: {_id: user._id.toString()}})
                .then(function (result) {
                  expect(result.hits.total).to.eql(1);
                  var hit = result.hits.hits[0];
                  expect(hit._source.name).to.be.equal(user.name);
                  expect(hit._source.age).to.be.equal(user.age);
                  resolve();
                })
                .catch(function (err) {
                  reject(err);
                });
            });
          })
        );
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should index the database in callback mode', function (done) {
    this.timeout(5000);

    var users = [];

    // beware: indexing a document require two entry in the buffer
    // 10 doc in buffer = buffer.length = 20
    var bulkSize = 20;

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number
    });

    var UserModel = mongoose.model('User', UserSchema);

    UserModel.remove({}).exec()
      .then(function () {
        for (var i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: 'Bob' + i,
            age: i
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(function () {
        var UserPluginSchema = new mongoose.Schema({
          name: String,
          age: Number
        });

        UserPluginSchema.plugin(plugin, {index: 'users', type: 'user', bulk: {size: bulkSize}});

        var UserPluginModel = mongoose.model('UserPlugin', UserPluginSchema, 'users');

        return utils.deleteModelIndexes(UserPluginModel)
          .then(function () {
            return UserPluginModel.esCreateMapping();
          })
          .then(function () {
            return UserPluginModel;
          });
      })

      .then(function (UserPluginModel) {
        var docSent = 0;
        var sent = 0;
        var error = 0;

        UserPluginModel.on('es-bulk-error', function () {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', function () {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', function (doc) {
          docSent++;
        });

        return new utils.Promise(function(resolve, reject) {
          UserPluginModel.esSynchronize(function (err) {
            if (err) {
              return reject(err);
            }
            expect(error).to.be.equal(0);
            expect(docSent).to.be.equal(users.length);
            expect(sent).to.be.equal(Math.ceil(2 * users.length / bulkSize));
            resolve(UserPluginModel);
          });
        });
      })
      .then(function (UserPluginModel) {
        return utils.Promise.all(
          users.map(function (user) {
            return new utils.Promise(function (resolve, reject) {
              UserPluginModel
                .esSearch({match: {_id: user._id.toString()}})
                .then(function (result) {
                  expect(result.hits.total).to.eql(1);
                  var hit = result.hits.hits[0];
                  expect(hit._source.name).to.be.equal(user.name);
                  expect(hit._source.age).to.be.equal(user.age);
                  resolve();
                })
                .catch(function (err) {
                  reject(err);
                });
            });
          })
        );
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should index a subset in callback mode', function (done) {
    this.timeout(5000);

    var users = [];

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number
    });

    var UserModel = mongoose.model('User', UserSchema);

    UserModel.remove({}).exec()
      .then(function () {
        for (var i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: 'Bob' + i,
            age: i
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(function () {
        var UserPluginSchema = new mongoose.Schema({
          name: String,
          age: Number
        });

        UserPluginSchema.plugin(plugin, {index: 'users', type: 'user'});

        var UserPluginModel = mongoose.model('UserPlugin', UserPluginSchema, 'users');

        return utils.deleteModelIndexes(UserPluginModel)
          .then(function () {
            return UserPluginModel.esCreateMapping();
          })
          .then(function () {
            return UserPluginModel;
          });
      })

      .then(function (UserPluginModel) {
        var docSent = 0;
        var sent = 0;
        var error = 0;

        UserPluginModel.on('es-bulk-error', function () {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', function () {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', function () {
          docSent++;
        });

        return new utils.Promise(function(resolve, reject) {
          UserPluginModel.esSynchronize({age: {$gte: 90}}, function (err) {
            if (err) {
              return reject(err);
            }
            expect(error).to.be.equal(0);
            expect(docSent).to.be.equal(10);
            expect(sent).to.be.equal(1);
            resolve(UserPluginModel);
          });
        });
      })
      .then(function (UserPluginModel) {
        return UserPluginModel
          .esSearch({match_all: {}})
          .then(function (result) {
            expect(result.hits.total).to.eql(10);
            var ids = result.hits.hits.map(function (hit) {
              return hit._id;
            });
            var expected = users.slice(-10).map(function (user) {
              return user._id.toString();
            });
            ids.sort();
            expected.sort();
            expect(ids).to.eql(expected);
          });
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should index the database using projection in callback mode', function (done) {
    this.timeout(5000);

    var users = [];

    // beware: indexing a document require two entry in the buffer
    // 10 doc in buffer = buffer.length = 20
    var bulkSize = 20;

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number
    });

    var UserModel = mongoose.model('User', UserSchema);

    UserModel.remove({}).exec()
      .then(function () {
        for (var i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: 'Bob' + i,
            age: i
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(function () {
        var UserPluginSchema = new mongoose.Schema({
          name: String,
          age: {type: Number, select: false}
        });

        UserPluginSchema.plugin(plugin, {index: 'users', type: 'user', bulk: {size: bulkSize}});

        var UserPluginModel = mongoose.model('UserPlugin', UserPluginSchema, 'users');

        return utils.deleteModelIndexes(UserPluginModel)
          .then(function () {
            return UserPluginModel.esCreateMapping();
          })
          .then(function () {
            return UserPluginModel;
          });
      })

      .then(function (UserPluginModel) {
        var docSent = 0;
        var sent = 0;
        var error = 0;

        UserPluginModel.on('es-bulk-error', function () {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', function () {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', function (doc) {
          docSent++;
        });

        return new utils.Promise(function(resolve, reject) {
          UserPluginModel.esSynchronize({}, '+age', function (err) {
            if (err) {
              return reject(err);
            }
            expect(error).to.be.equal(0);
            expect(docSent).to.be.equal(users.length);
            expect(sent).to.be.equal(Math.ceil(2 * users.length / bulkSize));
            resolve(UserPluginModel);
          });
        });
      })
      .then(function (UserPluginModel) {
        return utils.Promise.all(
          users.map(function (user) {
            return new utils.Promise(function (resolve, reject) {
              UserPluginModel
                .esSearch({match: {_id: user._id.toString()}})
                .then(function (result) {
                  expect(result.hits.total).to.eql(1);
                  var hit = result.hits.hits[0];
                  expect(hit._source.name).to.be.equal(user.name);
                  expect(hit._source.age).to.be.equal(user.age);
                  resolve();
                })
                .catch(function (err) {
                  reject(err);
                });
            });
          })
        );
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should index filtering', function (done) {
    this.timeout(5000);

    var users = [];

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number
    });

    var UserModel = mongoose.model('User', UserSchema);

    UserModel.remove({}).exec()
      .then(function () {
        for (var i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: 'Bob' + i,
            age: i
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(function () {
        var UserPluginSchema = new mongoose.Schema({
          name: String,
          age: Number
        });

        UserPluginSchema.plugin(plugin, {index: 'users', type: 'user', filter: function (doc) {
          return doc.age >= 80;
        }});

        var UserPluginModel = mongoose.model('UserPlugin', UserPluginSchema, 'users');

        return utils.deleteModelIndexes(UserPluginModel)
          .then(function () {
            return UserPluginModel.esCreateMapping();
          })
          .then(function () {
            return UserPluginModel;
          });
      })

      .then(function (UserPluginModel) {
        var error = 0;
        var docSent = 0;
        var docFiltered = 0;

        UserPluginModel.on('es-bulk-error', function () {
          error++;
        });

        UserPluginModel.on('es-bulk-data', function () {
          docSent++;
        });

        UserPluginModel.on('es-bulk-filtered', function () {
          docFiltered++;
        });

        return UserPluginModel
          .esSynchronize()
          .then(function () {
            expect(error).to.be.equal(0);
            expect(docSent).to.be.equal(20);
            expect(docFiltered).to.be.equal(80);
            return UserPluginModel;
          });
      })
      .then(function (UserPluginModel) {
        return utils.Promise.all(
          users.map(function (user) {
            return new utils.Promise(function (resolve, reject) {
              UserPluginModel
                .esSearch({match: {_id: user._id.toString()}})
                .then(function (result) {
                  if (user.age < 80) {
                    expect(result.hits.total).to.eql(0);
                  } else {
                    expect(result.hits.total).to.eql(1);
                    var hit = result.hits.hits[0];
                    expect(hit._source.name).to.be.equal(user.name);
                    expect(hit._source.age).to.be.equal(user.age);
                  }
                  resolve();
                })
                .catch(function (err) {
                  reject(err);
                });
            });
          })
        );
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

});
