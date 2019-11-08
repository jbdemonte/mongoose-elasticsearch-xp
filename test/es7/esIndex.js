'use strict';

const mongoose = require('mongoose');
const utils = require('../utils');
const plugin = require('../../').v7;

describe('esIndex', () => {
  utils.setup();

  it('should be indexed', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
      pos: {
        type: [Number],
        index: '2dsphere',
        es_type: 'geo_point',
        es_boost: 1.5,
      },
      doNotIndexMe: Boolean,
    });

    UserSchema.plugin(plugin, {
      transform: document => {
        delete document.doNotIndexMe;
        return document;
      },
    });
    const UserModel = mongoose.model('User', UserSchema);

    const john = new UserModel({
      name: 'John',
      age: 35,
      pos: [5.7333, 43.5],
      doNotIndexMe: true,
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
      .then(({ body }) => {
        expect(body.hits.total.value).to.eql(1);
        const hit = body.hits.hits[0];
        expect(hit._id).to.eql(john._id.toString());
        expect(hit._source).to.eql({
          name: 'John',
          age: 35,
          pos: [5.7333, 43.5],
        });
      });
  });

  it('should index ObjectId from object populated or not', () => {
    const CountrySchema = new mongoose.Schema({
      name: String,
    });

    const CitySchema = new mongoose.Schema({
      name: String,
    });

    const UserSchema = new mongoose.Schema({
      name: String,
      city: { type: mongoose.Schema.Types.ObjectId, ref: 'City' },
      country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);
    const CityModel = mongoose.model('City', CitySchema);
    const CountryModel = mongoose.model('Country', CountrySchema);

    const country = new CountryModel({ name: 'France' });
    const city = new CityModel({ name: 'Paris' });
    const john = new UserModel({
      name: 'John',
      city,
      country: country._id,
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
      .then(({ body }) => {
        expect(body.hits.total.value).to.eql(1);
        const hit = body.hits.hits[0];
        expect(hit._id).to.eql(john._id.toString());
        expect(hit._source).to.eql({
          name: 'John',
          city: city.id,
          country: country.id,
        });
      });
  });
});
