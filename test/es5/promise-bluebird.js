const bluebird = require('bluebird');
const utils = require('../utils');
const mongoose = require('mongoose');

const plugin = require('../../');

describe('promise-bluebird', () => {
  utils.setup();

  it('should return bluebird promise', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);
    const promise = UserModel.esCreateMapping();
    expect(promise).to.be.an.instanceof(bluebird);
  });
});
