'use strict';

const mongoose = require('mongoose');
const utils = require('../utils');

const plugin = require('../../').v7;

describe('promise', () => {
  utils.setup();

  it('should return promise', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);
    const promise = UserModel.esCreateMapping();
    expect(promise).to.be.an.instanceof(Promise);
  });
});
