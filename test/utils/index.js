'use strict';

const mongoose = require('mongoose');

mongoose.Promise = Promise;

function array(mixed) {
  return Array.isArray(mixed) ? mixed : [mixed];
}

function setup() {
  before(done => {
    global.expect = require('chai').expect; // eslint-disable-line
    mongoose.connect(
      'mongodb://localhost/test',
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
      err => {
        if (err) {
          done(err);
        } else {
          done();
        }
      }
    );
  });

  beforeEach(() => {
    deleteMongooseModels();
  });

  after(done => {
    mongoose.disconnect(() => {
      done();
    });
  });
}

function deleteModelIndexes(models) {
  return Promise.all(
    array(models).map(model => {
      return new Promise(resolve => {
        const options = model.esOptions();
        const client = options.client;
        client.indices.delete({ index: options.index }, () => {
          resolve();
        });
      });
    })
  ).then(() => {
    // do nothing, just remove the results to allows to use .then(done)
  });
}

function deleteMongooseModels() {
  Object.keys(mongoose.models).forEach(name => {
    delete mongoose.models[name];
    delete mongoose.modelSchemas[name];
  });
}

module.exports = {
  Promise,
  setup,
  deleteModelIndexes,
  deleteMongooseModels,
};
