var utils = require('./utils');
var mongoose = require('mongoose');
var plugin = require('../');

describe("esRefresh", function () {

  utils.setup();

  it('should handle callback', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var start;

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        start = Date.now();
        UserModel.esRefresh(function (err) {
          if (err) {
            return done(err);
          }
          expect(Date.now() - start).to.be.lt(500);
          done();
        });
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should handle callback and options', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var start;

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        start = Date.now();
        UserModel.esRefresh({refreshDelay: 1000}, function (err) {
          if (err) {
            return done(err);
          }
          expect(Date.now() - start).to.be.gte(1000);
          done();
        });
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should not be delayed', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var start;

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        start = Date.now();
        return UserModel.esRefresh();
      })
      .then(function () {
        expect(Date.now() - start).to.be.lt(500);
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should be delayed', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var start;

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        start = Date.now();
        return UserModel.esRefresh({refreshDelay: 1000});
      })
      .then(function () {
        expect(Date.now() - start).to.be.gte(1000);
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should be delayed when defined in plugin', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String
    });

    UserSchema.plugin(plugin, {refreshDelay: 1000});

    var UserModel = mongoose.model('User', UserSchema);

    var start;

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        start = Date.now();
        return UserModel.esRefresh();
      })
      .then(function () {
        expect(Date.now() - start).to.be.gte(1000);
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should overwrite defined in plugin value', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String
    });

    UserSchema.plugin(plugin, {refreshDelay: 1000});

    var UserModel = mongoose.model('User', UserSchema);

    var start;

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        start = Date.now();
        return UserModel.esRefresh({refreshDelay: false});
      })
      .then(function () {
        expect(Date.now() - start).to.be.lt(500);
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

});
