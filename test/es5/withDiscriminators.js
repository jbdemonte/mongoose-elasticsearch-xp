'use strict';

const utils = require('../utils');
const mongoose = require('mongoose');
const plugin = require('../../');

describe('with discriminators', () => {
  utils.setup();

  it('type from discriminator key', () => {
    const BaseSchema = new mongoose.Schema(
      {
        name: String,
        kind: String,
      },
      {
        discriminatorKey: 'kind',
      }
    );

    const UserSchema = new mongoose.Schema({
      age: Number,
    });

    BaseSchema.plugin(plugin, {
      index: 'user',
      withDiscriminators: true,
    });

    const BaseModel = mongoose.model('Base', BaseSchema);
    const UserModel = BaseModel.discriminator('User', UserSchema);

    // discriminator key always should be like a model name
    return UserModel.create({ name: 'John', age: 20, kind: 'User' }).then(
      doc => {
        const options = doc.esOptions();
        expect(options.type).to.equal('user');
      }
    );
  });

  it('type from model name', () => {
    const BaseSchema = new mongoose.Schema({
      name: String,
    });

    const UserSchema = new mongoose.Schema({
      age: Number,
    });

    BaseSchema.plugin(plugin, {
      index: 'user',
      withDiscriminators: true,
    });

    const BaseModel = mongoose.model('Base', BaseSchema);
    const UserModel = BaseModel.discriminator('UserModel', UserSchema);
    const options = UserModel.esOptions();
    expect(options.type).to.equal('userModel');
  });

  it('type from fn() provided by user', () => {
    const BaseSchema = new mongoose.Schema({
      name: String,
    });

    const UserSchema = new mongoose.Schema({
      age: Number,
    });

    BaseSchema.plugin(plugin, {
      index: 'user',
      withDiscriminators: true,
      type: kind => {
        if (kind === 'User') return 'userType';
        return 'otherType';
      },
    });

    const BaseModel = mongoose.model('Base', BaseSchema);
    const UserModel = BaseModel.discriminator('User', UserSchema);
    const AdminModel = BaseModel.discriminator('Admin', UserSchema);

    const userOpts = UserModel.esOptions();
    expect(userOpts.type).to.equal('userType');

    const adminOpts = AdminModel.esOptions();
    expect(adminOpts.type).to.equal('otherType');
  });
});
