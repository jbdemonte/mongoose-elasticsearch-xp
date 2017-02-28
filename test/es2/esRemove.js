var utils = require('../utils');
var mongoose = require('mongoose');
var plugin = require('../../').v2;

describe('esRemove', function() {
  utils.setup();

  it('should be removed', function(done) {
    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({ name: 'John', age: 35 });
    var jane = new UserModel({ name: 'Jane', age: 34 });
    var bob = new UserModel({ name: 'Bob', age: 36 });

    utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.bulk(
            {
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
            },
            function(err) {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });
      })
      .then(function() {
        return jane.esRemove();
      })
      .then(function() {
        return UserModel.esRefresh();
      })
      .then(function() {
        var options = UserModel.esOptions();
        var client = options.client;
        client.search(
          {
            index: options.index,
            type: options.type,
            body: { query: { match_all: {} } },
          },
          function(err, resp) {
            var ids = resp.hits.hits.map(function(hit) {
              return hit._id;
            });
            ids.sort();

            var expectedIds = [john, bob].map(function(user) {
              return user._id.toString();
            });

            expect(ids).to.eql(expectedIds);
            done();
          }
        );
      })
      .catch(function(err) {
        done(err);
      });
  });
});
