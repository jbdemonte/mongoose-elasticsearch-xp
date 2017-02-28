var utils = require('../utils');
var mongoose = require('mongoose');
var plugin = require('../../');

describe('hydratation', function() {
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

  it('should hydrate', function(done) {
    var UserModel = this.model;
    var john = this.users.john;
    var bob = this.users.bob;

    UserModel.esSearch(
        {
          query: {
            bool: {
              must: { match_all: {} },
              filter: { range: { age: { gte: 35 } } },
            },
          },
          sort: [{ age: { order: 'desc' } }],
        },
        { hydrate: true }
      )
      .then(function(result) {
        var hit;
        expect(result.hits.total).to.eql(2);

        hit = result.hits.hits[0];
        expect(hit._source).to.be.undefined;
        expect(hit.doc).to.be.an.instanceof(UserModel);
        expect(hit.doc._id.toString()).to.eql(bob._id.toString());
        expect(hit.doc.name).to.eql(bob.name);
        expect(hit.doc.age).to.eql(bob.age);

        hit = result.hits.hits[1];
        expect(hit._source).to.be.undefined;
        expect(hit.doc).to.be.an.instanceof(UserModel);
        expect(hit.doc._id.toString()).to.eql(john._id.toString());
        expect(hit.doc.name).to.eql(john.name);
        expect(hit.doc.age).to.eql(john.age);

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should hydrate returning only models', function(done) {
    var UserModel = this.model;
    var john = this.users.john;
    var bob = this.users.bob;

    UserModel.esSearch(
        {
          query: {
            bool: {
              must: { match_all: {} },
              filter: { range: { age: { gte: 35 } } },
            },
          },
          sort: [{ age: { order: 'desc' } }],
        },
        { hydrate: { docsOnly: true } }
      )
      .then(function(users) {
        var user;
        expect(users.length).to.eql(2);

        user = users[0];
        expect(user._id.toString()).to.eql(bob._id.toString());
        expect(user.name).to.eql(bob.name);
        expect(user.age).to.eql(bob.age);

        user = users[1];
        expect(user._id.toString()).to.eql(john._id.toString());
        expect(user.name).to.eql(john.name);
        expect(user.age).to.eql(john.age);

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should return an empty array when hydrating only models on 0 hit', function(done) {
    var UserModel = this.model;

    UserModel.esSearch(
        {
          query: {
            bool: {
              must: { match_all: {} },
              filter: { range: { age: { gte: 100 } } },
            },
          },
          sort: [{ age: { order: 'desc' } }],
        },
        { hydrate: { docsOnly: true } }
      )
      .then(function(users) {
        var user;
        expect(users).to.eql([]);
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should hydrate using projection', function(done) {
    var UserModel = this.model;
    var jane = this.users.jane;

    return UserModel.esSearch('name:jane', { hydrate: { select: 'name' } })
      .then(function(result) {
        var hit;
        expect(result.hits.total).to.eql(1);

        hit = result.hits.hits[0];
        expect(hit._source).to.be.undefined;
        expect(hit.doc).to.be.an.instanceof(UserModel);
        expect(hit.doc._id.toString()).to.eql(jane._id.toString());
        expect(hit.doc.name).to.eql(jane.name);
        expect(hit.doc.age).to.be.undefined;

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should hydrate using options', function(done) {
    var UserModel = this.model;
    var jane = this.users.jane;

    return UserModel.esSearch('name:jane', { hydrate: { options: { lean: true } } })
      .then(function(result) {
        var hit;
        expect(result.hits.total).to.eql(1);

        hit = result.hits.hits[0];
        expect(hit._source).to.be.undefined;
        expect(hit.doc).not.to.be.an.instanceof(UserModel);
        expect(hit.doc._id.toString()).to.eql(jane._id.toString());
        expect(hit.doc.name).to.eql(jane.name);
        expect(hit.doc.age).to.eql(jane.age);

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should hydrate when defined in plugin', function(done) {
    utils.deleteMongooseModels();

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: true });

    var UserModel = mongoose.model('User', UserSchema);

    var jane = this.users.jane;

    return UserModel.esSearch('name:jane')
      .then(function(result) {
        var hit;
        expect(result.hits.total).to.eql(1);

        hit = result.hits.hits[0];
        expect(hit._source).to.be.undefined;
        expect(hit.doc).to.be.an.instanceof(UserModel);
        expect(hit.doc._id.toString()).to.eql(jane._id.toString());
        expect(hit.doc.name).to.eql(jane.name);
        expect(hit.doc.age).to.eql(jane.age);

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should hydrate when defined in plugin returning only models', function(done) {
    utils.deleteMongooseModels();

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { docsOnly: true } });

    var UserModel = mongoose.model('User', UserSchema);

    var john = this.users.john;
    var bob = this.users.bob;

    UserModel.esSearch({
        query: {
          bool: {
            must: { match_all: {} },
            filter: { range: { age: { gte: 35 } } },
          },
        },
        sort: [{ age: { order: 'desc' } }],
      })
      .then(function(users) {
        var user;
        expect(users.length).to.eql(2);

        user = users[0];
        expect(user._id.toString()).to.eql(bob._id.toString());
        expect(user.name).to.eql(bob.name);
        expect(user.age).to.eql(bob.age);

        user = users[1];
        expect(user._id.toString()).to.eql(john._id.toString());
        expect(user.name).to.eql(john.name);
        expect(user.age).to.eql(john.age);

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should hydrate when defined in plugin using projection', function(done) {
    utils.deleteMongooseModels();

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { select: 'name' } });

    var UserModel = mongoose.model('User', UserSchema);

    var jane = this.users.jane;

    return UserModel.esSearch('name:jane')
      .then(function(result) {
        var hit;
        expect(result.hits.total).to.eql(1);

        hit = result.hits.hits[0];
        expect(hit._source).to.be.undefined;
        expect(hit.doc).to.be.an.instanceof(UserModel);
        expect(hit.doc._id.toString()).to.eql(jane._id.toString());
        expect(hit.doc.name).to.eql(jane.name);
        expect(hit.doc.age).to.be.undefined;

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should hydrate when defined in plugin using options', function(done) {
    utils.deleteMongooseModels();

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { options: { lean: true } } });

    var UserModel = mongoose.model('User', UserSchema);

    var jane = this.users.jane;

    return UserModel.esSearch('name:jane')
      .then(function(result) {
        var hit;
        expect(result.hits.total).to.eql(1);

        hit = result.hits.hits[0];
        expect(hit._source).to.be.undefined;
        expect(hit.doc).not.to.be.an.instanceof(UserModel);
        expect(hit.doc._id.toString()).to.eql(jane._id.toString());
        expect(hit.doc.name).to.eql(jane.name);
        expect(hit.doc.age).to.eql(jane.age);

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should hydrate overwriting defined in plugin using options', function(done) {
    utils.deleteMongooseModels();

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { options: { lean: true } } });

    var UserModel = mongoose.model('User', UserSchema);

    var jane = this.users.jane;

    return UserModel.esSearch(
        'name:jane',
        { hydrate: { select: 'name' } } // not lean
      )
      .then(function(result) {
        var hit;
        expect(result.hits.total).to.eql(1);

        hit = result.hits.hits[0];
        expect(hit._source).to.be.undefined;
        expect(hit.doc).to.be.an.instanceof(UserModel);
        expect(hit.doc._id.toString()).to.eql(jane._id.toString());
        expect(hit.doc.name).to.eql(jane.name);
        expect(hit.doc.age).to.be.undefined;

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should not hydrate overwriting defined in plugin', function(done) {
    utils.deleteMongooseModels();

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { options: { lean: true } } });

    var UserModel = mongoose.model('User', UserSchema);

    var jane = this.users.jane;

    return UserModel.esSearch(
        'name:jane',
        { hydrate: false } // not lean
      )
      .then(function(result) {
        var hit;
        expect(result.hits.total).to.eql(1);

        hit = result.hits.hits[0];
        expect(hit.doc).to.be.undefined;
        expect(hit._source).not.to.be.undefined;
        expect(hit._source.name).to.eql(jane.name);
        expect(hit._source.age).to.eql(34);

        done();
      })
      .catch(function(err) {
        done(err);
      });
  });
});
