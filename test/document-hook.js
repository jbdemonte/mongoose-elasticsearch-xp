var utils = require('./utils');
var mongoose = require('mongoose');
var plugin = require('../');

describe("document-hook", function () {

  utils.setup();

  it('should be able to save without any previous call to ES', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var user;

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        return utils.deleteMongooseModels();
      })
      .then(function () {
        // recreate new model
        UserSchema = new mongoose.Schema({
          name: String
        });
        UserSchema.plugin(plugin);
        UserModel = mongoose.model('User', UserSchema);
        user = new UserModel({name: 'John', age: 35});
      })
      .then(function () {
        return new utils.Promise(function (resolve, reject) {
          user.on('es-indexed', function (err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.save();
        });
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should be indexed then removed', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var user = new UserModel({name: 'John', age: 35});

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        return new utils.Promise(function (resolve, reject) {
          user.on('es-indexed', function (err) {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          user.save();
        });
      })
      .then(function () {
        return new utils.Promise(function (resolve) {
          var options = UserModel.esOptions();
          var client = options.client;

          client.get({index: options.index, type: options.type, id: user._id.toString()}, function (err, resp) {
            expect(resp.found).to.eql(true);
            expect(resp._id).to.eql(user._id.toString());
            expect(resp._source).to.eql({name: 'John', age: 35});
            resolve();
          });
        });
      })
      .then(function () {
        return new utils.Promise(function (resolve, reject) {
          user.on('es-removed', function (err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.remove();
        });
      })
      .then(function () {
        return new utils.Promise(function (resolve) {
          var options = UserModel.esOptions();
          var client = options.client;

          client.get({index: options.index, type: options.type, id: user._id.toString()}, function (err, resp) {
            expect(resp.found).to.eql(false);
            expect(resp._id).to.eql(user._id.toString());
            resolve();
          });
        });
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should emit same event from model', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({name: 'John', age: 35});
    var jane = new UserModel({name: 'Jane', age: 34});
    var bob = new UserModel({name: 'Bob', age: 36});
    var users = [john, jane, bob];

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        var count = 0;
        return new utils.Promise(function (resolve, reject) {
          UserModel.on('es-indexed', function (err) {
            if (err) {
              return reject(err);
            }
            count++;
            if (count === 3) {
              setTimeout(function () { // delay to check if more than 3 are received
                resolve();
              }, 500);
            } else if (count > 3) {
              reject(new Error('more than 3 event were emitted'));
            }
          });
          users.forEach(function (user) {
            user.save();
          });
        });
      })
      .then(function () {
        var count = 0;
        return new utils.Promise(function (resolve, reject) {
          UserModel.on('es-removed', function (err) {
            if (err) {
              return reject(err);
            }
            count++;
            if (count === 3) {
              setTimeout(function () { // delay to check if more than 3 are received
                resolve();
              }, 500);
            } else if (count > 3) {
              reject(new Error('more than 3 event were emitted'));
            }
          });
          users.forEach(function (user) {
            user.remove();
          });
        });
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should use filter', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number
    });

    UserSchema.plugin(plugin, {filter: function (doc) {
      return doc.age >= 80;
    }});

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({name: 'John', age: 35});
    var henry = new UserModel({name: 'Henry', age: 85});

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        return new utils.Promise(function (resolve, reject) {
          john.on('es-removed', function (err) {
              if (err) {
                resolve();
              } else {
                reject(new Error('should not have been found'));
              }
            });
          john.save();
        });
      })
      .then(function () {
        return new utils.Promise(function (resolve, reject) {
          henry.on('es-indexed', function (err) {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          henry.save();
        });
      })
      .then(function () {
        return UserModel.esRefresh();
      })
      .then(function () {
        return new utils.Promise(function (resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.search({index: options.index, type: options.type, body: {query: {match_all: {}}}}, function (err, resp) {
            expect(resp.hits.total).to.eql(1);
            var hit = resp.hits.hits[0];
            expect(hit._id).to.eql(henry._id.toString());
            expect(hit._source).to.eql({name: 'Henry', age: 85});
            resolve();
          });
        });
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

});
