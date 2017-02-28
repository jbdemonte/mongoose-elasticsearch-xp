var utils = require('../utils');
var mongoose = require('mongoose');
var plugin = require('../../').v2;

describe('idsOnly', function() {
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

  it('should return ids', function(done) {
    var UserModel = this.model;
    var john = this.users.john;
    var bob = this.users.bob;

    UserModel.esSearch(
        {
          query: { match_all: {} },
          sort: [{ age: { order: 'desc' } }],
          filter: { range: { age: { gte: 35 } } },
        },
        { idsOnly: true }
      )
      .then(function(ids) {
        expect(ids.length).to.eql(2);
        var idstrings = ids.map(function(id) {
          expect(id).to.be.an.instanceof(mongoose.Types.ObjectId);
          return id.toString();
        });
        expect(idstrings).to.eql([bob._id.toString(), john._id.toString()]);

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should an empty array', function(done) {
    var UserModel = this.model;
    var john = this.users.john;
    var bob = this.users.bob;

    UserModel.esSearch(
        {
          query: { match_all: {} },
          sort: [{ age: { order: 'desc' } }],
          filter: { range: { age: { gte: 100 } } },
        },
        { idsOnly: true }
      )
      .then(function(ids) {
        expect(ids).to.eql([]);
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should return ids when defined in plugin', function(done) {
    utils.deleteMongooseModels();

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { idsOnly: true });

    var UserModel = mongoose.model('User', UserSchema);
    var john = this.users.john;
    var bob = this.users.bob;

    UserModel.esSearch({
        query: { match_all: {} },
        sort: [{ age: { order: 'desc' } }],
        filter: { range: { age: { gte: 35 } } },
      })
      .then(function(ids) {
        expect(ids.length).to.eql(2);
        var idstrings = ids.map(function(id) {
          expect(id).to.be.an.instanceof(mongoose.Types.ObjectId);
          return id.toString();
        });
        expect(idstrings).to.eql([bob._id.toString(), john._id.toString()]);

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

    UserSchema.plugin(plugin, { idsOnly: true });

    var UserModel = mongoose.model('User', UserSchema);
    var john = this.users.john;
    var bob = this.users.bob;

    UserModel.esSearch(
        {
          query: { match_all: {} },
          sort: [{ age: { order: 'desc' } }],
          filter: { range: { age: { gte: 35 } } },
        },
        { idsOnly: false }
      )
      .then(function(result) {
        expect(result.hits.total).to.eql(2);
        var hit = result.hits.hits[0];
        expect(hit._id).to.eql(bob._id.toString());
        expect(hit._source).to.eql({ name: 'Bob', age: 36 });

        hit = result.hits.hits[1];
        expect(hit._id).to.eql(john._id.toString());
        expect(hit._source).to.eql({ name: 'John', age: 35 });

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });
});
