'use strict';

const mongoose = require('mongoose');
const utils = require('../utils');
const plugin = require('../../');

describe('countOnly', () => {
  utils.setup();
  let UserModel;

  beforeEach(() => {
    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);
    UserModel = mongoose.model('User', UserSchema);

    const john = new UserModel({ name: 'John', age: 35 });
    const jane = new UserModel({ name: 'Jane', age: 34 });
    const bob = new UserModel({ name: 'Bob', age: 36 });

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => UserModel.esCreateMapping())
      .then(() =>
        utils.Promise.all(
          [john, jane, bob].map(
            user =>
              new utils.Promise(resolve => {
                user.on('es-indexed', resolve);
                user.save();
              })
          )
        )
      )
      .then(() => UserModel.esRefresh());
  });

  it('should return count', () => {
    return UserModel.esCount(
      {
        bool: {
          must: { match_all: {} },
          filter: { range: { age: { gte: 35 } } },
        },
      },
      { countOnly: true }
    ).then(count => {
      expect(count).to.eql(2);
    });
  });

  it('should return 0', () => {
    return UserModel.esCount(
      {
        bool: {
          must: { match_all: {} },
          filter: { range: { age: { gte: 100 } } },
        },
      },
      { countOnly: true }
    ).then(count => {
      expect(count).to.eql(0);
    });
  });

  it('should return count when defined in plugin', () => {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { countOnly: true });

    const UserModelCountOnly = mongoose.model('User', UserSchema);

    return UserModelCountOnly.esCount({
      bool: {
        must: { match_all: {} },
        filter: { range: { age: { gte: 35 } } },
      },
    }).then(count => {
      expect(count).to.eql(2);
    });
  });

  it('should overwrite defined in plugin value', () => {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { countOnly: true });

    const UserModelCountOnly = mongoose.model('User', UserSchema);

    return UserModelCountOnly.esCount(
      {
        bool: {
          must: { match_all: {} },
          filter: { range: { age: { gte: 35 } } },
        },
      },
      { countOnly: false }
    ).then(result => {
      expect(result.count).to.eql(2);
    });
  });
});
