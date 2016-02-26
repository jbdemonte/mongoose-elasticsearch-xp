var bluebird = require('bluebird');
var utils = require('./utils');
var mongoose = require('mongoose');

var plugin = require('../');

describe("promise-bluebird", function () {

  utils.setup();

  it('should return bluebird promise', function () {

    var UserSchema = new mongoose.Schema({
      name: String
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);
    var promise = UserModel.esCreateMapping();
    expect(promise).to.be.an.instanceof(bluebird);

  });


});
