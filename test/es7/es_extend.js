'use strict';

const mongoose = require('mongoose');
const utils = require('../utils');
const plugin = require('../../').v7;

describe('es_extend', () => {
  utils.setup();

  it('should add some fields', () => {
    let john;

    const UserSchema = new mongoose.Schema(
      {
        name: String,
      },
      {
        es_extend: {
          num: {
            es_type: 'integer',
            es_value: 123,
          },
          length: {
            es_type: 'integer',
            es_value(document) {
              expect(document === john).to.be.true;
              return document.name.length;
            },
          },
        },
      }
    );

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    john = new UserModel({
      name: 'John',
    });

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        const options = UserModel.esOptions();
        return options.client.indices.getMapping({
          include_type_name: true,
          index: options.index,
          type: options.type,
        });
      })
      .then(mapping => {
        const properties = mapping.users.mappings.user.properties;
        expect(properties).to.have.all.keys('name', 'num', 'length');
        expect(properties.name.type).to.be.equal('text');
        expect(properties.num.type).to.be.equal('integer');
        expect(properties.length.type).to.be.equal('integer');
      })
      .then(() => {
        return new utils.Promise(resolve => {
          john.on('es-indexed', () => {
            resolve();
          });
          john.save();
        });
      })
      .then(() => {
        return UserModel.esRefresh();
      })
      .then(() => {
        return UserModel.esSearch({
          query: { match_all: {} },
        });
      })
      .then(result => {
        expect(result.hits.total.value).to.eql(1);
        expect(result.hits.hits[0]._source).to.eql({
          name: 'John',
          num: 123,
          length: 4,
        });
      });
  });
});
