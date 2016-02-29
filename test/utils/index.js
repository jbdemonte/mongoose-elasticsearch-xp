var _Promise = require('bluebird');
var mongoose = require('mongoose');
mongoose.Promise = _Promise;

module.exports = {
  Promise: _Promise,
  setup: setup,
  deleteModelIndexes: deleteModelIndexes
};

function array(mixed) {
  return Array.isArray(mixed) ? mixed : [mixed];
}

function setup() {

  before(function () {
    global.expect = require('chai').expect;
    mongoose.connect('mongodb://localhost/test');
  });

  beforeEach(function () {
    Object.keys(mongoose.models).forEach(function (name) {
      delete mongoose.models[name];
      delete mongoose.modelSchemas[name];
    });
  });

  after(function (done) {
    mongoose.disconnect(function () {
      done();
    });
  });
}

function deleteModelIndexes(models) {
  return _Promise
    .all(
      array(models).map(function (model) {
        return new _Promise(function (resolve) {
          var options = model.esOptions();
          var client = options.client;
          client.indices.delete({index: options.index}, function (err) {
            resolve();
          });
        });
      })
    )
    .then(function () {
      // do nothing, just remove the results to allows to use .then(done)
    });
}