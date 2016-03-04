var utils = require('./utils');
var mongoose = require('mongoose');
var plugin = require('../');

describe("esRefresh", function () {

  utils.setup();

  it('should be delayed', function (done) {

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

});
