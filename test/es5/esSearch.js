const utils = require('../utils');
const mongoose = require('mongoose');
const plugin = require('../../');

describe('esSearch', () => {
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
    return UserModel.esSearch('name:jane').then(result => {
      expect(result.hits.total).to.eql(1);
      const hit = result.hits.hits[0];
      expect(hit._id).to.eql(jane._id.toString());
      expect(hit._source).to.eql({ name: 'Jane', age: 34 });
    });
  });

  it('should accept callback', done => {
    const returned = UserModel.esSearch('name:jane', {}, (err, result) => {
      if (err) {
        done(err);
        return;
      }
      expect(result.hits.total).to.eql(1);
      const hit = result.hits.hits[0];
      expect(hit._id).to.eql(jane._id.toString());
      expect(hit._source).to.eql({ name: 'Jane', age: 34 });
      expect(returned).to.be.undefined;
      done();
    });
  });

  it('should accept callback without options', done => {
    const returned = UserModel.esSearch('name:jane', (err, result) => {
      if (err) {
        done(err);
        return;
      }
      expect(result.hits.total).to.eql(1);
      const hit = result.hits.hits[0];
      expect(hit._id).to.eql(jane._id.toString());
      expect(hit._source).to.eql({ name: 'Jane', age: 34 });
      expect(returned).to.be.undefined;
      done();
    });
  });

  it('should handle a full query', () => {
    return UserModel.esSearch({
        bool: {
          must: { match_all: {} },
          filter: { range: { age: { lt: 35 } } },
        },
      })
      .then(result => {
        expect(result.hits.total).to.eql(1);
        const hit = result.hits.hits[0];
        expect(hit._id).to.eql(jane._id.toString());
        expect(hit._source).to.eql({ name: 'Jane', age: 34 });
      });
  });

  it('should handle a short query', () => {
    return UserModel.esSearch({ match: { age: 34 } }).then(result => {
      expect(result.hits.total).to.eql(1);
      const hit = result.hits.hits[0];
      expect(hit._id).to.eql(jane._id.toString());
      expect(hit._source).to.eql({ name: 'Jane', age: 34 });
    });
  });

  it('should handle 0 hit', () => {
    return UserModel.esSearch({ match: { age: 100 } }).then(result => {
      expect(result.hits.total).to.eql(0);
    });
  });
});
