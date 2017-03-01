'use strict';

const utils = require('../utils');
const mongoose = require('mongoose');
const plugin = require('../../').v2;

describe('document-hook', () => {
  utils.setup();

  it('should be able to save without any previous call to ES', () => {
    let UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    let UserModel = mongoose.model('User', UserSchema);

    let user;

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        return utils.deleteMongooseModels();
      })
      .then(() => {
        // recreate new model
        UserSchema = new mongoose.Schema({
          name: String,
          age: Number,
        });
        UserSchema.plugin(plugin);
        UserModel = mongoose.model('User', UserSchema);
        user = new UserModel({ name: 'John', age: 35 });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          user.on('es-indexed', err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.save();
        });
      });
  });

  it('should be indexed then removed', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    const user = new UserModel({ name: 'John', age: 35 });

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          user.on('es-indexed', err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.save();
        });
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;

          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            (err, resp) => {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(user._id.toString());
              expect(resp._source).to.eql({ name: 'John', age: 35 });
              resolve();
            }
          );
        });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          user.on('es-removed', err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.remove();
        });
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;

          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            (err, resp) => {
              expect(resp.found).to.eql(false);
              expect(resp._id).to.eql(user._id.toString());
              resolve();
            }
          );
        });
      });
  });

  it('should emit same event from model', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    const john = new UserModel({ name: 'John', age: 35 });
    const jane = new UserModel({ name: 'Jane', age: 34 });
    const bob = new UserModel({ name: 'Bob', age: 36 });
    const users = [john, jane, bob];

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        let count = 0;
        return new utils.Promise((resolve, reject) => {
          UserModel.on('es-indexed', err => {
            if (err) {
              reject(err);
              return;
            }
            count++;
            if (count === 3) {
              setTimeout(
                () => {
                  // delay to check if more than 3 are received
                  resolve();
                },
                500
              );
            } else if (count > 3) {
              reject(new Error('more than 3 event were emitted'));
            }
          });
          users.forEach(user => {
            user.save();
          });
        });
      })
      .then(() => {
        let count = 0;
        return new utils.Promise((resolve, reject) => {
          UserModel.on('es-removed', err => {
            if (err) {
              reject(err);
              return;
            }
            count++;
            if (count === 3) {
              setTimeout(
                () => {
                  // delay to check if more than 3 are received
                  resolve();
                },
                500
              );
            } else if (count > 3) {
              reject(new Error('more than 3 event were emitted'));
            }
          });
          users.forEach(user => {
            user.remove();
          });
        });
      });
  });

  it('should use filter', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, {
      filter(doc) {
        return doc.age >= 80;
      },
    });

    const UserModel = mongoose.model('User', UserSchema);

    const john = new UserModel({ name: 'John', age: 35 });
    const henry = new UserModel({ name: 'Henry', age: 85 });

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        return new utils.Promise(resolve => {
          john.on('es-filtered', () => {
            resolve();
          });
          john.save();
        });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          henry.on('es-indexed', err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          henry.save();
        });
      })
      .then(() => {
        return UserModel.esRefresh();
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.search(
            {
              index: options.index,
              type: options.type,
              body: { query: { match_all: {} } },
            },
            (err, resp) => {
              expect(resp.hits.total).to.eql(1);
              const hit = resp.hits.hits[0];
              expect(hit._id).to.eql(henry._id.toString());
              expect(hit._source).to.eql({ name: 'Henry', age: 85 });
              resolve();
            }
          );
        });
      });
  });

  it('should handle partial save', () => {
    const CitySchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
      city: {
        type: CitySchema,
        select: false,
      },
    });

    UserSchema.plugin(plugin);

    let UserModel = mongoose.model('User', UserSchema);

    let user;

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        UserModel = mongoose.model('User', UserSchema);
        user = new UserModel({
          name: 'John',
          age: 35,
          city: { name: 'Paris' },
        });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          user.on('es-indexed', err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.save();
        });
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            (err, resp) => {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(user._id.toString());
              expect(resp._source).to.eql({
                name: 'John',
                age: 35,
                city: { name: 'Paris' },
              });
              resolve();
            }
          );
        });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          UserModel.findById(user._id).then(dbUser => {
            dbUser.age = 36;
            expect(dbUser.city).to.be.undefined; // because of select false

            dbUser.on('es-indexed', err => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
            dbUser.save();
          });
        });
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            (err, resp) => {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(user._id.toString());
              expect(resp._source).to.eql({
                name: 'John',
                age: 36,
                city: { name: 'Paris' },
              });
              resolve();
            }
          );
        });
      });
  });

  it('should remove some fields', () => {
    const JobSchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    const CitySchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    const SkillSchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
      city: {
        type: CitySchema,
        select: false,
      },
      job: {
        type: JobSchema,
        select: false,
      },
      skill: {
        type: SkillSchema,
        select: false,
      },
    });

    UserSchema.plugin(plugin, { script: true });

    let UserModel = mongoose.model('User', UserSchema);

    let user;
    let witness;

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        UserModel = mongoose.model('User', UserSchema);
        witness = new UserModel({
          name: 'John',
          age: 35,
          city: { name: 'Paris' },
          job: { name: 'developer' },
          skill: { name: 'math' },
        });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          witness.on('es-indexed', err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          witness.save();
        });
      })
      .then(() => {
        UserModel = mongoose.model('User', UserSchema);
        user = new UserModel({
          name: 'John',
          age: 35,
          city: { name: 'Paris' },
          job: { name: 'developer' },
          skill: { name: 'math' },
        });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          user.on('es-indexed', err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.save();
        });
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            (err, resp) => {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(user._id.toString());
              expect(resp._source).to.eql({
                name: 'John',
                age: 35,
                city: { name: 'Paris' },
                job: { name: 'developer' },
                skill: { name: 'math' },
              });
              resolve();
            }
          );
        });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          UserModel.findById(user._id, '+city +job +skill').then(dbUser => {
            expect(dbUser.city).not.to.be.undefined; // because of select false
            dbUser.city = undefined; // remove some fields
            dbUser.job = undefined;
            dbUser.age = 36;

            dbUser.on('es-indexed', err => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
            dbUser.save();
          });
        });
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: witness._id.toString(),
            },
            (err, resp) => {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(witness._id.toString());
              expect(resp._source).to.eql({
                name: 'John',
                age: 35,
                city: { name: 'Paris' },
                job: { name: 'developer' },
                skill: { name: 'math' },
              });
              resolve();
            }
          );
        });
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            (err, resp) => {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(user._id.toString());
              expect(resp._source).to.eql({
                name: 'John',
                age: 36,
                skill: { name: 'math' },
              });
              resolve();
            }
          );
        });
      });
  });

  it('should nullify some fields', () => {
    const JobSchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    const CitySchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    const SkillSchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
      city: {
        type: CitySchema,
        select: false,
      },
      job: {
        type: JobSchema,
        select: false,
      },
      skill: {
        type: SkillSchema,
        select: false,
      },
    });

    UserSchema.plugin(plugin);

    let UserModel = mongoose.model('User', UserSchema);

    let user;
    let witness;

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        UserModel = mongoose.model('User', UserSchema);
        witness = new UserModel({
          name: 'John',
          age: 35,
          city: { name: 'Paris' },
          job: { name: 'developer' },
          skill: { name: 'math' },
        });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          witness.on('es-indexed', err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          witness.save();
        });
      })
      .then(() => {
        UserModel = mongoose.model('User', UserSchema);
        user = new UserModel({
          name: 'John',
          age: 35,
          city: { name: 'Paris' },
          job: { name: 'developer' },
          skill: { name: 'math' },
        });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          user.on('es-indexed', err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.save();
        });
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            (err, resp) => {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(user._id.toString());
              expect(resp._source).to.eql({
                name: 'John',
                age: 35,
                city: { name: 'Paris' },
                job: { name: 'developer' },
                skill: { name: 'math' },
              });
              resolve();
            }
          );
        });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          UserModel.findById(user._id, '+city +job +skill').then(dbUser => {
            expect(dbUser.city).not.to.be.undefined; // because of select false
            dbUser.city = undefined; // remove some fields
            dbUser.job = undefined;
            dbUser.age = 36;

            dbUser.on('es-indexed', err => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
            dbUser.save();
          });
        });
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: witness._id.toString(),
            },
            (err, resp) => {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(witness._id.toString());
              expect(resp._source).to.eql({
                name: 'John',
                age: 35,
                city: { name: 'Paris' },
                job: { name: 'developer' },
                skill: { name: 'math' },
              });
              resolve();
            }
          );
        });
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            (err, resp) => {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(user._id.toString());
              expect(resp._source).to.eql({
                name: 'John',
                age: 36,
                skill: { name: 'math' },
                city: null,
                job: null,
              });
              resolve();
            }
          );
        });
      });
  });

  it('should handle FindOneAndUpdate', () => {
    let UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    let UserModel = mongoose.model('User', UserSchema);

    let user;

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        return utils.deleteMongooseModels();
      })
      .then(() => {
        // recreate new model
        UserSchema = new mongoose.Schema({
          name: String,
          age: Number,
        });
        UserSchema.plugin(plugin);
        UserModel = mongoose.model('User', UserSchema);
        user = new UserModel({ name: 'John', age: 35 });
        return user.save();
      })
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        return utils.deleteMongooseModels();
      })
      .then(() => {
        // recreate new model
        UserSchema = new mongoose.Schema({
          name: String,
          age: Number,
        });
        UserSchema.plugin(plugin);
        UserModel = mongoose.model('User', UserSchema);
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          UserModel.on('es-indexed', err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          UserModel.findOneAndUpdate(
            { _id: user._id },
            { $set: { age: 67 } },
            { new: true },
            (err, usr) => {
              if (err || !usr) {
                reject(err || new Error('no match'));
              }
            }
          );
        });
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            (err, resp) => {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(user._id.toString());
              expect(resp._source).to.eql({ name: 'John', age: 67 });
              resolve();
            }
          );
        });
      });
  });

  it('should save a previously filtered entry', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, {
      filter(doc) {
        return doc.age < 80;
      },
    });

    const UserModel = mongoose.model('User', UserSchema);

    const henry = new UserModel({ name: 'Henry', age: 85 });

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        return henry.save();
      })
      .then(() => {
        return UserModel.esRefresh();
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.search(
            {
              index: options.index,
              type: options.type,
              body: { query: { match_all: {} } },
            },
            (err, resp) => {
              expect(resp.hits.total).to.eql(0);
              resolve();
            }
          );
        });
      })
      .then(() => {
        return new utils.Promise((resolve, reject) => {
          henry.age = 35;
          henry.on('es-indexed', err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          henry.save();
        });
      })
      .then(() => {
        return UserModel.esRefresh();
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const options = UserModel.esOptions();
          const client = options.client;
          client.search(
            {
              index: options.index,
              type: options.type,
              body: { query: { match_all: {} } },
            },
            (err, resp) => {
              expect(resp.hits.total).to.eql(1);
              const hit = resp.hits.hits[0];
              expect(hit._id).to.eql(henry._id.toString());
              expect(hit._source).to.eql({ name: 'Henry', age: 35 });
              resolve();
            }
          );
        });
      });
  });
});
