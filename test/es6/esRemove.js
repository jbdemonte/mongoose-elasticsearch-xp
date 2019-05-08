'use strict';

const utils = require('../utils');
const mongoose = require('mongoose');
const plugin = require('../../').v5;;

describe('esRemove', () => {
  utils.setup();

  it('should be removed', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    const john = new UserModel({ name: 'John', age: 35 });
    const jane = new UserModel({ name: 'Jane', age: 34 });
    const bob = new UserModel({ name: 'Bob', age: 36 });

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        const options = UserModel.esOptions();
        const client = options.client;
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
      })
      .then(() => {
        return jane.esRemove();
      })
      .then(() => {
        return UserModel.esRefresh();
      })
      .then(() => {
        const options = UserModel.esOptions();
        const client = options.client;
        return client.search({
          index: options.index,
          type: options.type,
          body: { query: { match_all: {} } },
        });
      })
      .then(resp => {
        const ids = resp.hits.hits.map(hit => {
          return hit._id;
        });
        ids.sort();

        const expectedIds = [john, bob].map(user => {
          return user._id.toString();
        });

        expect(ids).to.eql(expectedIds);
      });
  });
});
