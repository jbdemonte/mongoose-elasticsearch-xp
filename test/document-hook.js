var utils = require('./utils');
var mongoose = require('mongoose');
var plugin = require('../');

describe("document-hook", function () {

  utils.setup();

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

});
