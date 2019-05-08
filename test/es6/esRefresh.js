'use strict';

const utils = require('../utils');
const mongoose = require('mongoose');
const plugin = require('../../').v5;;

describe('esRefresh', () => {
  utils.setup();

  it('should handle callback', done => {
    const UserSchema = new mongoose.Schema({
      name: String,
    });

    UserSchema.plugin(plugin);
    const UserModel = mongoose.model('User', UserSchema);

    let start;

    utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        start = Date.now();
        UserModel.esRefresh(err => {
          if (err) {
            done(err);
            return;
          }
          expect(Date.now() - start).to.be.lt(500);
          done();
        });
      })
      .catch(err => {
        done(err);
      });
  });

  it('should handle callback and options', done => {
    const UserSchema = new mongoose.Schema({
      name: String,
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    let start;

    utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        start = Date.now();
        UserModel.esRefresh({ refreshDelay: 1000 }, err => {
          if (err) {
            done(err);
            return;
          }
          expect(Date.now() - start).to.be.gte(1000);
          done();
        });
      })
      .catch(err => {
        done(err);
      });
  });

  it('should not be delayed', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    let start;

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        start = Date.now();
        return UserModel.esRefresh();
      })
      .then(() => {
        expect(Date.now() - start).to.be.lt(500);
      });
  });

  it('should be delayed', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    let start;

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        start = Date.now();
        return UserModel.esRefresh({ refreshDelay: 1000 });
      })
      .then(() => {
        expect(Date.now() - start).to.be.gte(1000);
      });
  });

  it('should be delayed when defined in plugin', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
    });

    UserSchema.plugin(plugin, { refreshDelay: 1000 });

    const UserModel = mongoose.model('User', UserSchema);

    let start;

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        start = Date.now();
        return UserModel.esRefresh();
      })
      .then(() => {
        expect(Date.now() - start).to.be.gte(1000);
      });
  });

  it('should overwrite defined in plugin value', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
    });

    UserSchema.plugin(plugin, { refreshDelay: 1000 });

    const UserModel = mongoose.model('User', UserSchema);

    let start;

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        start = Date.now();
        return UserModel.esRefresh({ refreshDelay: false });
      })
      .then(() => {
        expect(Date.now() - start).to.be.lt(500);
      });
  });
});
