const utils = require('../utils');
const mongoose = require('mongoose');
const plugin = require('../../');

describe('hydratation', () => {
  utils.setup();

  beforeEach(function() {
    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    const john = new UserModel({ name: 'John', age: 35 });
    const jane = new UserModel({ name: 'Jane', age: 34 });
    const bob = new UserModel({ name: 'Bob', age: 36 });

    this.model = UserModel;
    this.users = {
      john,
      jane,
      bob,
    };

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        return utils.Promise.all(
          [john, jane, bob].map(user => {
            return new utils.Promise(resolve => {
              user.on('es-indexed', resolve);
              user.save();
            });
          })
        );
      })
      .then(() => {
        return UserModel.esRefresh();
      });
  });

  it('should hydrate', function() {
    const UserModel = this.model;
    const john = this.users.john;
    const bob = this.users.bob;

    return UserModel.esSearch(
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
      .then(result => {
        let hit;
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
      });
  });

  it('should hydrate returning only models', function() {
    const UserModel = this.model;
    const john = this.users.john;
    const bob = this.users.bob;

    return UserModel.esSearch(
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
      .then(users => {
        let user;
        expect(users.length).to.eql(2);

        user = users[0];
        expect(user._id.toString()).to.eql(bob._id.toString());
        expect(user.name).to.eql(bob.name);
        expect(user.age).to.eql(bob.age);

        user = users[1];
        expect(user._id.toString()).to.eql(john._id.toString());
        expect(user.name).to.eql(john.name);
        expect(user.age).to.eql(john.age);
      });
  });

  it(
    'should return an empty array when hydrating only models on 0 hit',
    function() {
      const UserModel = this.model;

      return UserModel.esSearch(
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
        .then(users => {
          expect(users).to.eql([]);
        });
    }
  );

  it('should hydrate using projection', function() {
    const UserModel = this.model;
    const jane = this.users.jane;

    return UserModel.esSearch('name:jane', { hydrate: { select: 'name' } })
      .then(result => {
        expect(result.hits.total).to.eql(1);

        const hit = result.hits.hits[0];
        expect(hit._source).to.be.undefined;
        expect(hit.doc).to.be.an.instanceof(UserModel);
        expect(hit.doc._id.toString()).to.eql(jane._id.toString());
        expect(hit.doc.name).to.eql(jane.name);
        expect(hit.doc.age).to.be.undefined;
      });
  });

  it('should hydrate using options', function() {
    const UserModel = this.model;
    const jane = this.users.jane;

    return UserModel.esSearch('name:jane', {
        hydrate: { options: { lean: true } },
      })
      .then(result => {
        expect(result.hits.total).to.eql(1);

        const hit = result.hits.hits[0];
        expect(hit._source).to.be.undefined;
        expect(hit.doc).not.to.be.an.instanceof(UserModel);
        expect(hit.doc._id.toString()).to.eql(jane._id.toString());
        expect(hit.doc.name).to.eql(jane.name);
        expect(hit.doc.age).to.eql(jane.age);
      });
  });

  it('should hydrate when defined in plugin', function() {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: true });

    const UserModel = mongoose.model('User', UserSchema);

    const jane = this.users.jane;

    return UserModel.esSearch('name:jane').then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(jane._id.toString());
      expect(hit.doc.name).to.eql(jane.name);
      expect(hit.doc.age).to.eql(jane.age);
    });
  });

  it('should hydrate when defined in plugin returning only models', function() {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { docsOnly: true } });

    const UserModel = mongoose.model('User', UserSchema);

    const john = this.users.john;
    const bob = this.users.bob;

    return UserModel.esSearch({
        query: {
          bool: {
            must: { match_all: {} },
            filter: { range: { age: { gte: 35 } } },
          },
        },
        sort: [{ age: { order: 'desc' } }],
      })
      .then(users => {
        let user;
        expect(users.length).to.eql(2);

        user = users[0];
        expect(user._id.toString()).to.eql(bob._id.toString());
        expect(user.name).to.eql(bob.name);
        expect(user.age).to.eql(bob.age);

        user = users[1];
        expect(user._id.toString()).to.eql(john._id.toString());
        expect(user.name).to.eql(john.name);
        expect(user.age).to.eql(john.age);
      });
  });

  it('should hydrate when defined in plugin using projection', function() {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { select: 'name' } });

    const UserModel = mongoose.model('User', UserSchema);

    const jane = this.users.jane;

    return UserModel.esSearch('name:jane').then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(jane._id.toString());
      expect(hit.doc.name).to.eql(jane.name);
      expect(hit.doc.age).to.be.undefined;
    });
  });

  it('should hydrate when defined in plugin using options', function() {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { options: { lean: true } } });

    const UserModel = mongoose.model('User', UserSchema);

    const jane = this.users.jane;

    return UserModel.esSearch('name:jane').then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).not.to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(jane._id.toString());
      expect(hit.doc.name).to.eql(jane.name);
      expect(hit.doc.age).to.eql(jane.age);
    });
  });

  it('should hydrate overwriting defined in plugin using options', function() {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { options: { lean: true } } });

    const UserModel = mongoose.model('User', UserSchema);

    const jane = this.users.jane;

    return UserModel.esSearch(
      'name:jane',
      { hydrate: { select: 'name' } } // not lean
    ).then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(jane._id.toString());
      expect(hit.doc.name).to.eql(jane.name);
      expect(hit.doc.age).to.be.undefined;
    });
  });

  it('should not hydrate overwriting defined in plugin', function() {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { options: { lean: true } } });

    const UserModel = mongoose.model('User', UserSchema);

    const jane = this.users.jane;

    return UserModel.esSearch(
      'name:jane',
      { hydrate: false } // not lean
    ).then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit.doc).to.be.undefined;
      expect(hit._source).not.to.be.undefined;
      expect(hit._source.name).to.eql(jane.name);
      expect(hit._source.age).to.eql(34);
    });
  });
});
