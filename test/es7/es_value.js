'use strict';

const mongoose = require('mongoose');
const utils = require('../utils');
const plugin = require('../../');

describe('es_value', () => {
  utils.setup();

  it('should handle es_value as a function', () => {
    let john;

    const Sub2Schema = new mongoose.Schema({
      _id: false,
      value: {
        type: String,
        es_value(value, context) {
          expect(value).to.equal('x2');
          expect(context.document === john).to.be.true;
          expect(context.container === john.sub.sub2).to.be.true;
          expect(context.field).to.eql('value');
          return 'xyz';
        },
      },
    });

    const SubSchema = new mongoose.Schema({
      _id: false,
      sub1: String,
      sub2: Sub2Schema,
    });

    const TagSchema = new mongoose.Schema({
      _id: false,
      value: String,
    });

    const UserSchema = new mongoose.Schema({
      name: String,
      sub: SubSchema,
      age: {
        type: Number,
        es_value(age, context) {
          expect(age).to.equal(35);
          expect(context.document === john).to.be.true;
          expect(context.container === john).to.be.true;
          expect(context.field).to.eql('age');
          return age - (age % 10);
        },
      },
      tags: {
        type: [TagSchema],
        es_type: 'text',
        es_value(tags, context) {
          expect(tags === john.tags).to.be.true;
          expect(context.document === john).to.be.true;
          expect(context.container === john).to.be.true;
          expect(context.field).to.eql('tags');
          return tags.map(tag => {
            return tag.value;
          });
        },
      },
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    john = new UserModel({
      name: 'John',
      age: 35,
      sub: {
        sub1: 'x1',
        sub2: {
          value: 'x2',
          nb: 7,
        },
      },
      tags: [{ value: 'cool' }, { value: 'green' }],
    });

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        return john.esIndex();
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
        expect(resp.hits.total.value).to.eql(1);
        const hit = resp.hits.hits[0];
        expect(hit._id).to.eql(john._id.toString());
        expect(hit._source).to.eql({
          name: 'John',
          age: 30,
          tags: ['cool', 'green'],
          sub: { sub1: 'x1', sub2: { value: 'xyz' } },
        });
      });
  });

  it('should handle es_value as a value', () => {
    const UserSchema = new mongoose.Schema({
      name: { type: String, es_type: 'keyword' },
      numberArray: {
        type: Number,
        es_value: [1, 2, 3],
      },
      falsy: {
        type: Number,
        es_value: 0,
      },
      stringArray: {
        type: [String],
        es_value: ['az', 'er', 'ty'],
      },
      obj: {
        type: String,
        es_type: {
          a: { es_type: 'text' },
          b: { es_type: 'integer' },
        },
        es_value: {
          a: 'azerty',
          b: 123,
        },
      },
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    const john = new UserModel({
      name: 'John',
      numberArray: 35,
      falsy: 98,
      stringArray: ['GHJ'],
      obj: 'obj',
    });

    const bob = new UserModel({ name: 'Bob' });

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        return john.esIndex();
      })
      .then(() => {
        return bob.esIndex();
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
          body: {
            query: { match_all: {} },
            sort: [{ name: { order: 'desc' } }],
          },
        });
      })
      .then(resp => {
        expect(resp.hits.total.value).to.eql(2);
        let hit = resp.hits.hits[0];
        expect(hit._id).to.eql(john._id.toString());
        expect(hit._source).to.eql({
          name: 'John',
          numberArray: [1, 2, 3],
          falsy: 0,
          stringArray: ['az', 'er', 'ty'],
          obj: {
            a: 'azerty',
            b: 123,
          },
        });
        hit = resp.hits.hits[1];
        expect(hit._id).to.eql(bob._id.toString());
        expect(hit._source).to.eql({
          name: 'Bob',
          numberArray: [1, 2, 3],
          falsy: 0,
          stringArray: ['az', 'er', 'ty'],
          obj: {
            a: 'azerty',
            b: 123,
          },
        });
      });
  });
});
