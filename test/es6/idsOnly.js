'use strict';

const utils = require('../utils');
const mongoose = require('mongoose');
const plugin = require('../../').v5;;

describe('idsOnly', () => {
  utils.setup();
  let UserModel;
  let john;
  let jane;
  let bob;

  beforeEach(() => {
    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    UserModel = mongoose.model('User', UserSchema);

    john = new UserModel({ name: 'John', age: 35 });
    jane = new UserModel({ name: 'Jane', age: 34 });
    bob = new UserModel({ name: 'Bob', age: 36 });

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

  it('should return ids', () => {
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
      { idsOnly: true }
    ).then(ids => {
      expect(ids.length).to.eql(2);
      const idstrings = ids.map(id => {
        expect(id).to.be.an.instanceof(mongoose.Types.ObjectId);
        return id.toString();
      });
      expect(idstrings).to.eql([bob._id.toString(), john._id.toString()]);
    });
  });

  it('should an empty array', () => {
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
      { idsOnly: true }
    ).then(ids => {
      expect(ids).to.eql([]);
    });
  });

  it('should return ids when defined in plugin', () => {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { idsOnly: true });

    const UserModelIdsOnly = mongoose.model('User', UserSchema);

    return UserModelIdsOnly.esSearch({
      query: {
        bool: {
          must: { match_all: {} },
          filter: { range: { age: { gte: 35 } } },
        },
      },
      sort: [{ age: { order: 'desc' } }],
    }).then(ids => {
      expect(ids.length).to.eql(2);
      const idstrings = ids.map(id => {
        expect(id).to.be.an.instanceof(mongoose.Types.ObjectId);
        return id.toString();
      });
      expect(idstrings).to.eql([bob._id.toString(), john._id.toString()]);
    });
  });

  it('should overwrite defined in plugin value', () => {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { idsOnly: true });

    const UserModelIdsOnly = mongoose.model('User', UserSchema);

    return UserModelIdsOnly.esSearch(
      {
        query: {
          bool: {
            must: { match_all: {} },
            filter: { range: { age: { gte: 35 } } },
          },
        },
        sort: [{ age: { order: 'desc' } }],
      },
      { idsOnly: false }
    ).then(result => {
      expect(result.hits.total).to.eql(2);
      let hit = result.hits.hits[0];
      expect(hit._id).to.eql(bob._id.toString());
      expect(hit._source).to.eql({ name: 'Bob', age: 36 });

      hit = result.hits.hits[1];
      expect(hit._id).to.eql(john._id.toString());
      expect(hit._source).to.eql({ name: 'John', age: 35 });
    });
  });
});
