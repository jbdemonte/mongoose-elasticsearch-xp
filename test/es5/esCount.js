var utils = require('../utils');
var mongoose = require('mongoose');
var plugin = require('../../');

describe('esCount', function() {
  utils.setup();

  beforeEach(function() {
    var self = this;

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({ name: 'John', age: 35 });
    var jane = new UserModel({ name: 'Jane', age: 34 });
    var bob = new UserModel({ name: 'Bob', age: 36 });

    self.schema = UserSchema;
    self.model = UserModel;
    self.users = {
      john: john,
      jane: jane,
      bob: bob,
    };

    return utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        var options = UserModel.esOptions();
        var client = options.client;
        return client.bulk({
          refresh: true,
          body: [
            {
              index: {
                _index: options.index,
                _type: options.type,
                _id: john._id.toString(),
              },
            },
            { name: 'John', age: 35 },
            {
              index: {
                _index: options.index,
                _type: options.type,
                _id: jane._id.toString(),
              },
            },
            { name: 'Jane', age: 34 },
            {
              index: {
                _index: options.index,
                _type: options.type,
                _id: bob._id.toString(),
              },
            },
            { name: 'Bob', age: 36 },
          ],
        });
      });
  });

  it('should handle a lucene query', function() {
    var self = this;
    return self.model.esCount('name:jane').then(function(result) {
      expect(result.count).to.eql(1);
    });
  });

  it('should accept callback', function(done) {
    var self = this;
    var returned = self.model.esCount('name:jane', function(err, result) {
      if (err) {
        return done(err);
      }
      expect(result.count).to.eql(1);
      expect(returned).to.be.undefined;
      done();
    });
  });

  it('should handle a full query', function() {
    var self = this;
    return self.model
      .esCount({
        bool: {
          must: { match_all: {} },
          filter: { range: { age: { lt: 35 } } },
        },
      })
      .then(function(result) {
        expect(result.count).to.eql(1);
      });
  });

  it('should handle a short query', function() {
    var self = this;
    return self.model.esCount({ match: { age: 34 } }).then(function(result) {
      expect(result.count).to.eql(1);
    });
  });

  it('should handle 0 hit', function() {
    var self = this;
    return self.model.esCount({ match: { age: 100 } }).then(function(result) {
      expect(result.count).to.eql(0);
    });
  });
});
