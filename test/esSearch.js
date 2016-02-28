var utils = require('./utils');
var mongoose = require('mongoose');
var plugin = require('../');

describe("esSearch", function () {

  utils.setup();

  beforeEach(function (done) {
    var self = this;

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({name: 'John', age: 35});
    var jane = new UserModel({name: 'Jane', age: 34});
    var bob = new UserModel({name: 'Bob', age: 36});

    self.schema = UserSchema;
    self.model = UserModel;
    self.users = {
      john: john,
      jane: jane,
      bob: bob
    };

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        var options = UserModel.esOptions();
        var client = options.client;
        client.bulk(
          {
            refresh: true,
            body: [
              { index:  { _index: options.index, _type: options.type, _id: john._id.toString() } },
              {name: 'John', age: 35},
              { index:  { _index: options.index, _type: options.type, _id: jane._id.toString() } },
              {name: 'Jane', age: 34},
              { index:  { _index: options.index, _type: options.type, _id: bob._id.toString() } },
              {name: 'Bob', age: 36}
            ]
          },
          function (err) {
            done(err);
          }
        );
      });
  });

  it('should handle a lucene query', function (done) {
    var self = this;
    self.model
      .esSearch('name:jane')
      .then(function (result) {
        expect(result.hits.total).to.eql(1);
        var hit = result.hits.hits[0];
        expect(hit._id).to.eql(self.users.jane._id.toString());
        expect(hit._source).to.eql({name: 'Jane', age: 34});
        done();
      });
  });

  it('should accept callback', function (done) {
    var self = this;
    var returned = self.model.esSearch('name:jane', {}, function (err, result) {
      expect(result.hits.total).to.eql(1);
      var hit = result.hits.hits[0];
      expect(hit._id).to.eql(self.users.jane._id.toString());
      expect(hit._source).to.eql({name: 'Jane', age: 34});
      expect(returned).to.be.undefined;
      done();
    });
  });

  it('should accept callback without options', function (done) {
    var self = this;
    var returned = self.model.esSearch('name:jane', function (err, result) {
      expect(result.hits.total).to.eql(1);
      var hit = result.hits.hits[0];
      expect(hit._id).to.eql(self.users.jane._id.toString());
      expect(hit._source).to.eql({name: 'Jane', age: 34});
      expect(returned).to.be.undefined;
      done();
    });
  });

  it('should handle a full query', function (done) {
    var self = this;
    self.model
      .esSearch({query: {match_all: {}}, filter: {range: {age: {lt: 35}}}})
      .then(function (result) {
        expect(result.hits.total).to.eql(1);
        var hit = result.hits.hits[0];
        expect(hit._id).to.eql(self.users.jane._id.toString());
        expect(hit._source).to.eql({name: 'Jane', age: 34});
        done();
      });
  });

  it('should handle a short query', function (done) {
    var self = this;
    self.model
      .esSearch({match: {age: 34}})
      .then(function (result) {
        expect(result.hits.total).to.eql(1);
        var hit = result.hits.hits[0];
        expect(hit._id).to.eql(self.users.jane._id.toString());
        expect(hit._source).to.eql({name: 'Jane', age: 34});
        done();
      });
  });

  it('should handle callback only', function (done) {
    // useless but neede to code coverage
    var self = this;
    self.model
      .esSearch(function (err, result) {
        expect(result.hits.total).to.eql(0);
        done();
      });
  });

});
