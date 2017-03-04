'use strict';

const utils = require('../utils');
const mongoose = require('mongoose');
const plugin = require('../../').v2;

describe('esCount', () => {
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
      });
  });

  it('should handle a lucene query', () => {
    return UserModel.esCount('name:jane').then(result => {
      expect(result.count).to.eql(1);
    });
  });

  it('should accept callback', done => {
    const returned = UserModel.esCount('name:jane', (err, result) => {
      if (err) {
        done(err);
        return;
      }
      expect(result.count).to.eql(1);
      expect(returned).to.be.undefined;
      done();
    });
  });

  it('should handle a full query', () => {
    return UserModel.esCount({
        query: { match_all: {} },
        filter: { range: { age: { lt: 35 } } },
      })
      .then(result => {
        expect(result.count).to.eql(1);
      });
  });

  it('should handle a short query', () => {
    return UserModel.esCount({ match: { age: 34 } }).then(result => {
      expect(result.count).to.eql(1);
    });
  });

  it('should handle 0 hit', () => {
    return UserModel.esCount({ match: { age: 100 } }).then(result => {
      expect(result.count).to.eql(0);
    });
  });
});
