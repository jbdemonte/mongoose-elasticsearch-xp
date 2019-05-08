'use strict';

const mongoose = require('mongoose');
const shortid = require('shortid');
const utils = require('../utils');
const plugin = require('../../').v5;

describe('custom ids', () => {
  utils.setup();
  let UserModel;
  let john;
  let jane;
  let bob;

  beforeEach(() => {
    const UserSchema = new mongoose.Schema({
      _id: {
        type: String,
        default: shortid.generate,
      },
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
      expect(ids).to.eql([bob._id, john._id]);
    });
  });

  it('should return people', () => {
    return UserModel.esSearch({
      query: {
        bool: {
          must: { match_all: {} },
          filter: { range: { age: { gte: 35 } } },
        },
      },
      sort: [{ age: { order: 'desc' } }],
    }).then(result => {
      expect(result.hits.total).to.eql(2);
      expect(result.hits.hits[0]._source).to.eql({ name: 'Bob', age: 36 });
      expect(result.hits.hits[1]._source).to.eql({ name: 'John', age: 35 });
    });
  });
});
