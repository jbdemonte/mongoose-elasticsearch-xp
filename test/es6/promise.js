'use strict';

const utils = require('../utils');
const mongoose = require('mongoose');

const plugin = require('../../').v5;;

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
