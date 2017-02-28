var utils = require('../utils');
var mongoose = require('mongoose');
var plugin = require('../../');

describe('countOnly', function() {
  utils.setup();

  beforeEach(function(done) {
    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({ name: 'John', age: 35 });
    var jane = new UserModel({ name: 'Jane', age: 34 });
    var bob = new UserModel({ name: 'Bob', age: 36 });

    this.model = UserModel;
    this.users = {
      john: john,
      jane: jane,
      bob: bob,
    };

    utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        return utils.Promise.all(
          [john, jane, bob].map(function(user) {
            return new utils.Promise(function(resolve) {
              user.on('es-indexed', resolve);
              user.save();
            });
          })
        );
      })
      .then(function() {
        return UserModel.esRefresh();
      })
      .then(function() {
        done();
      });
  });

  it('should return count', function(done) {
    this.model
      .esCount(
        {
          bool: {
            must: { match_all: {} },
            filter: { range: { age: { gte: 35 } } },
          },
        },
        { countOnly: true }
      )
      .then(function(count) {
        expect(count).to.eql(2);
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should return 0', function(done) {
    this.model
      .esCount(
        {
          bool: {
            must: { match_all: {} },
            filter: { range: { age: { gte: 100 } } },
          },
        },
        { countOnly: true }
      )
      .then(function(count) {
        expect(count).to.eql(0);
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should return count when defined in plugin', function(done) {
    utils.deleteMongooseModels();

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { countOnly: true });

    var UserModel = mongoose.model('User', UserSchema);

    UserModel.esCount({
        bool: {
          must: { match_all: {} },
          filter: { range: { age: { gte: 35 } } },
        },
      })
      .then(function(count) {
        expect(count).to.eql(2);
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should overwrite defined in plugin value', function(done) {
    utils.deleteMongooseModels();

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { countOnly: true });

    var UserModel = mongoose.model('User', UserSchema);

    UserModel.esCount(
        {
          bool: {
            must: { match_all: {} },
            filter: { range: { age: { gte: 35 } } },
          },
        },
        { countOnly: false }
      )
      .then(function(result) {
        expect(result.count).to.eql(2);
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });
});
