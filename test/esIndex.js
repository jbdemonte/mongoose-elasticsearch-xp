var utils = require('./utils');
var mongoose = require('mongoose');
var plugin = require('../');

describe("esIndex", function () {

  utils.setup();

  it('should be indexed', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
      pos: {
        type: [Number],
        index: '2dsphere',
        es_type: 'geo_point',
        es_boost: 1.5
      }
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({name: 'John', age: 35, pos: [5.7333, 43.5]});

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        return john.esIndex();
      })
      .then(function () {
        return UserModel.esRefresh();
      })
      .then(function () {
        var options = UserModel.esOptions();
        var client = options.client;
        client.search({index: options.index, type: options.type, body: {query: {match_all: {}}}}, function (err, resp) {
          expect(resp.hits.total).to.eql(1);
          var hit = resp.hits.hits[0];
          expect(hit._id).to.eql(john._id.toString());
          expect(hit._source).to.eql({name: 'John', age: 35, pos: [5.7333, 43.5]});
          done();
        });
      })
      .catch(function (err) {
        done(err);
      });
  });

});
