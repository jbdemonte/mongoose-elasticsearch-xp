'use strict';

const utils = require('../utils');
const mongoose = require('mongoose');
const plugin = require('../../');

describe('with discriminators', () => {
  utils.setup();

  it('type from fn() provided by user', () => {
    const BaseSchema = new mongoose.Schema({
      name: String,
    });

    const UserSchema = new mongoose.Schema({
      age: Number,
    });

    const AdminSchema = new mongoose.Schema({
      access: Boolean,
    });

    BaseSchema.plugin(plugin, {
      index: 'user',
      type: kind => {
        if (kind === 'User') return 'userType';
        if (kind === 'Admin') return 'adminType';
        return 'otherType';
      },
    });

    const BaseModel = mongoose.model('Base', BaseSchema);
    const UserModel = BaseModel.discriminator('User', UserSchema);
    const AdminModel = BaseModel.discriminator('Admin', AdminSchema);

    // check types on Models
    const userOpts = UserModel.esOptions();
    const adminOpts = AdminModel.esOptions();
    expect(userOpts.type).to.equal('userType');
    expect(adminOpts.type).to.equal('adminType');

    // check types on docs
    UserModel.create({
      name: 'John',
      age: 34,
    }).then(doc => {
      const opts = doc.esOptions();
      expect(opts.type).to.equal('userType');
    });

    AdminModel.create({
      name: 'Steve',
      access: true,
    }).then(doc => {
      const opts = doc.esOptions();
      expect(opts.type).to.equal('adminType');
    });
  });
});
