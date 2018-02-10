'use strict';

const utils = require('../utils');
const mongoose = require('mongoose');
const plugin = require('../../').v2;

describe('esSynchronise', () => {
  utils.setup();

  it('should index the database', () => {
    const users = [];

    // beware: indexing a document require two entry in the buffer
    // 10 doc in buffer = buffer.length = 20
    const bulkSize = 20;

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    const UserModel = mongoose.model('User', UserSchema);

    return UserModel.remove({})
      .exec()
      .then(() => {
        for (let i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: `Bob${i}`,
            age: i,
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(() => {
        const UserPluginSchema = new mongoose.Schema({
          name: String,
          age: Number,
        });

        UserPluginSchema.plugin(plugin, {
          index: 'users',
          type: 'user',
          bulk: { size: bulkSize },
        });

        const UserPluginModel = mongoose.model(
          'UserPlugin',
          UserPluginSchema,
          'users'
        );

        return utils
          .deleteModelIndexes(UserPluginModel)
          .then(() => {
            return UserPluginModel.esCreateMapping();
          })
          .then(() => {
            return UserPluginModel;
          });
      })
      .then(UserPluginModel => {
        let docSent = 0;
        let sent = 0;
        let error = 0;

        UserPluginModel.on('es-bulk-error', () => {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', () => {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', () => {
          docSent++;
        });

        return UserPluginModel.esSynchronize().then(() => {
          expect(error).to.be.equal(0);
          expect(docSent).to.be.equal(users.length);
          expect(sent).to.be.equal(Math.ceil(2 * users.length / bulkSize));
          return UserPluginModel;
        });
      })
      .then(UserPluginModel => {
        return utils.Promise.all(
          users.map(user => {
            return new utils.Promise((resolve, reject) => {
              UserPluginModel.esSearch({ match: { _id: user._id.toString() } })
                .then(result => {
                  expect(result.hits.total).to.eql(1);
                  const hit = result.hits.hits[0];
                  expect(hit._source.name).to.be.equal(user.name);
                  expect(hit._source.age).to.be.equal(user.age);
                  resolve();
                })
                .catch(err => {
                  reject(err);
                });
            });
          })
        );
      });
  });

  it('should index a subset', () => {
    const users = [];

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    const UserModel = mongoose.model('User', UserSchema);

    return UserModel.remove({})
      .exec()
      .then(() => {
        for (let i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: `Bob${i}`,
            age: i,
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(() => {
        const UserPluginSchema = new mongoose.Schema({
          name: String,
          age: Number,
        });

        UserPluginSchema.plugin(plugin, { index: 'users', type: 'user' });

        const UserPluginModel = mongoose.model(
          'UserPlugin',
          UserPluginSchema,
          'users'
        );

        return utils
          .deleteModelIndexes(UserPluginModel)
          .then(() => {
            return UserPluginModel.esCreateMapping();
          })
          .then(() => {
            return UserPluginModel;
          });
      })
      .then(UserPluginModel => {
        let docSent = 0;
        let sent = 0;
        let error = 0;

        UserPluginModel.on('es-bulk-error', () => {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', () => {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', () => {
          docSent++;
        });

        return UserPluginModel.esSynchronize({ age: { $gte: 90 } }).then(() => {
          expect(error).to.be.equal(0);
          expect(docSent).to.be.equal(10);
          expect(sent).to.be.equal(1);
          return UserPluginModel;
        });
      })
      .then(UserPluginModel => {
        return UserPluginModel.esSearch({ match_all: {} }).then(result => {
          expect(result.hits.total).to.eql(10);
          const ids = result.hits.hits.map(hit => {
            return hit._id;
          });
          const expected = users.slice(-10).map(user => {
            return user._id.toString();
          });
          ids.sort();
          expected.sort();
          expect(ids).to.eql(expected);
        });
      });
  });

  it('should index the database using projection', () => {
    const users = [];

    // beware: indexing a document require two entry in the buffer
    // 10 doc in buffer = buffer.length = 20
    const bulkSize = 20;

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    const UserModel = mongoose.model('User', UserSchema);

    return UserModel.remove({})
      .exec()
      .then(() => {
        for (let i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: `Bob${i}`,
            age: i,
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(() => {
        const UserPluginSchema = new mongoose.Schema({
          name: String,
          age: { type: Number, select: false },
        });

        UserPluginSchema.plugin(plugin, {
          index: 'users',
          type: 'user',
          bulk: { size: bulkSize },
        });

        const UserPluginModel = mongoose.model(
          'UserPlugin',
          UserPluginSchema,
          'users'
        );

        return utils
          .deleteModelIndexes(UserPluginModel)
          .then(() => {
            return UserPluginModel.esCreateMapping();
          })
          .then(() => {
            return UserPluginModel;
          });
      })
      .then(UserPluginModel => {
        let docSent = 0;
        let sent = 0;
        let error = 0;

        UserPluginModel.on('es-bulk-error', () => {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', () => {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', () => {
          docSent++;
        });

        return UserPluginModel.esSynchronize({}, '+age').then(() => {
          expect(error).to.be.equal(0);
          expect(docSent).to.be.equal(users.length);
          expect(sent).to.be.equal(Math.ceil(2 * users.length / bulkSize));
          return UserPluginModel;
        });
      })
      .then(UserPluginModel => {
        return utils.Promise.all(
          users.map(user => {
            return new utils.Promise((resolve, reject) => {
              UserPluginModel.esSearch({ match: { _id: user._id.toString() } })
                .then(result => {
                  expect(result.hits.total).to.eql(1);
                  const hit = result.hits.hits[0];
                  expect(hit._source.name).to.be.equal(user.name);
                  expect(hit._source.age).to.be.equal(user.age);
                  resolve();
                })
                .catch(err => {
                  reject(err);
                });
            });
          })
        );
      });
  });

  it('should index the database in callback mode', () => {
    const users = [];

    // beware: indexing a document require two entry in the buffer
    // 10 doc in buffer = buffer.length = 20
    const bulkSize = 20;

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    const UserModel = mongoose.model('User', UserSchema);

    return UserModel.remove({})
      .exec()
      .then(() => {
        for (let i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: `Bob${i}`,
            age: i,
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(() => {
        const UserPluginSchema = new mongoose.Schema({
          name: String,
          age: Number,
        });

        UserPluginSchema.plugin(plugin, {
          index: 'users',
          type: 'user',
          bulk: { size: bulkSize },
        });

        const UserPluginModel = mongoose.model(
          'UserPlugin',
          UserPluginSchema,
          'users'
        );

        return utils
          .deleteModelIndexes(UserPluginModel)
          .then(() => {
            return UserPluginModel.esCreateMapping();
          })
          .then(() => {
            return UserPluginModel;
          });
      })
      .then(UserPluginModel => {
        let docSent = 0;
        let sent = 0;
        let error = 0;

        UserPluginModel.on('es-bulk-error', () => {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', () => {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', () => {
          docSent++;
        });

        return new utils.Promise((resolve, reject) => {
          UserPluginModel.esSynchronize(err => {
            if (err) {
              reject(err);
              return;
            }
            expect(error).to.be.equal(0);
            expect(docSent).to.be.equal(users.length);
            expect(sent).to.be.equal(Math.ceil(2 * users.length / bulkSize));
            resolve(UserPluginModel);
          });
        });
      })
      .then(UserPluginModel => {
        return utils.Promise.all(
          users.map(user => {
            return new utils.Promise((resolve, reject) => {
              UserPluginModel.esSearch({ match: { _id: user._id.toString() } })
                .then(result => {
                  expect(result.hits.total).to.eql(1);
                  const hit = result.hits.hits[0];
                  expect(hit._source.name).to.be.equal(user.name);
                  expect(hit._source.age).to.be.equal(user.age);
                  resolve();
                })
                .catch(err => {
                  reject(err);
                });
            });
          })
        );
      });
  });

  it('should index a subset in callback mode', () => {
    const users = [];

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    const UserModel = mongoose.model('User', UserSchema);

    return UserModel.remove({})
      .exec()
      .then(() => {
        for (let i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: `Bob${i}`,
            age: i,
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(() => {
        const UserPluginSchema = new mongoose.Schema({
          name: String,
          age: Number,
        });

        UserPluginSchema.plugin(plugin, { index: 'users', type: 'user' });

        const UserPluginModel = mongoose.model(
          'UserPlugin',
          UserPluginSchema,
          'users'
        );

        return utils
          .deleteModelIndexes(UserPluginModel)
          .then(() => {
            return UserPluginModel.esCreateMapping();
          })
          .then(() => {
            return UserPluginModel;
          });
      })
      .then(UserPluginModel => {
        let docSent = 0;
        let sent = 0;
        let error = 0;

        UserPluginModel.on('es-bulk-error', () => {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', () => {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', () => {
          docSent++;
        });

        return new utils.Promise((resolve, reject) => {
          UserPluginModel.esSynchronize({ age: { $gte: 90 } }, err => {
            if (err) {
              reject(err);
              return;
            }
            expect(error).to.be.equal(0);
            expect(docSent).to.be.equal(10);
            expect(sent).to.be.equal(1);
            resolve(UserPluginModel);
          });
        });
      })
      .then(UserPluginModel => {
        return UserPluginModel.esSearch({ match_all: {} }).then(result => {
          expect(result.hits.total).to.eql(10);
          const ids = result.hits.hits.map(hit => {
            return hit._id;
          });
          const expected = users.slice(-10).map(user => {
            return user._id.toString();
          });
          ids.sort();
          expected.sort();
          expect(ids).to.eql(expected);
        });
      });
  });

  it('should index the database using projection in callback mode', () => {
    const users = [];

    // beware: indexing a document require two entry in the buffer
    // 10 doc in buffer = buffer.length = 20
    const bulkSize = 20;

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    const UserModel = mongoose.model('User', UserSchema);

    return UserModel.remove({})
      .exec()
      .then(() => {
        for (let i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: `Bob${i}`,
            age: i,
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(() => {
        const UserPluginSchema = new mongoose.Schema({
          name: String,
          age: { type: Number, select: false },
        });

        UserPluginSchema.plugin(plugin, {
          index: 'users',
          type: 'user',
          bulk: { size: bulkSize },
        });

        const UserPluginModel = mongoose.model(
          'UserPlugin',
          UserPluginSchema,
          'users'
        );

        return utils
          .deleteModelIndexes(UserPluginModel)
          .then(() => {
            return UserPluginModel.esCreateMapping();
          })
          .then(() => {
            return UserPluginModel;
          });
      })
      .then(UserPluginModel => {
        let docSent = 0;
        let sent = 0;
        let error = 0;

        UserPluginModel.on('es-bulk-error', () => {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', () => {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', () => {
          docSent++;
        });

        return new utils.Promise((resolve, reject) => {
          UserPluginModel.esSynchronize({}, '+age', err => {
            if (err) {
              reject(err);
              return;
            }
            expect(error).to.be.equal(0);
            expect(docSent).to.be.equal(users.length);
            expect(sent).to.be.equal(Math.ceil(2 * users.length / bulkSize));
            resolve(UserPluginModel);
          });
        });
      })
      .then(UserPluginModel => {
        return utils.Promise.all(
          users.map(user => {
            return new utils.Promise((resolve, reject) => {
              UserPluginModel.esSearch({ match: { _id: user._id.toString() } })
                .then(result => {
                  expect(result.hits.total).to.eql(1);
                  const hit = result.hits.hits[0];
                  expect(hit._source.name).to.be.equal(user.name);
                  expect(hit._source.age).to.be.equal(user.age);
                  resolve();
                })
                .catch(err => {
                  reject(err);
                });
            });
          })
        );
      });
  });

  it('should index the database using a mongoose query instance', () => {
    const users = [];

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    const UserModel = mongoose.model('User', UserSchema);

    return UserModel.remove({})
      .exec()
      .then(() => {
        for (let i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: `Bob${i}`,
            age: i,
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(() => {
        const UserPluginSchema = new mongoose.Schema({
          name: String,
          age: Number,
        });

        UserPluginSchema.plugin(plugin, { index: 'users', type: 'user' });

        const UserPluginModel = mongoose.model(
          'UserPlugin',
          UserPluginSchema,
          'users'
        );

        return utils
          .deleteModelIndexes(UserPluginModel)
          .then(() => {
            return UserPluginModel.esCreateMapping();
          })
          .then(() => {
            return UserPluginModel;
          });
      })
      .then(UserPluginModel => {
        let docSent = 0;
        let sent = 0;
        let error = 0;

        UserPluginModel.on('es-bulk-error', () => {
          error++;
        });

        UserPluginModel.on('es-bulk-sent', () => {
          sent++;
        });

        UserPluginModel.on('es-bulk-data', () => {
          docSent++;
        });

        const query = UserPluginModel.find({ age: { $gte: 90 } });
        return new utils.Promise((resolve, reject) => {
          UserPluginModel.esSynchronize(query, err => {
            if (err) {
              reject(err);
              return;
            }
            expect(error).to.be.equal(0);
            expect(docSent).to.be.equal(10);
            expect(sent).to.be.equal(1);
            resolve(UserPluginModel);
          });
        });
      })
      .then(UserPluginModel => {
        return UserPluginModel.esSearch({ match_all: {} }).then(result => {
          expect(result.hits.total).to.eql(10);
          const ids = result.hits.hits.map(hit => {
            return hit._id;
          });
          const expected = users.slice(-10).map(user => {
            return user._id.toString();
          });
          ids.sort();
          expected.sort();
          expect(ids).to.eql(expected);
        });
      });
  });

  it('should index filtering', () => {
    const users = [];

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    const UserModel = mongoose.model('User', UserSchema);

    return UserModel.remove({})
      .exec()
      .then(() => {
        for (let i = 0; i < 100; i++) {
          users.push({
            _id: mongoose.Types.ObjectId(),
            name: `Bob${i}`,
            age: i,
          });
        }
        return UserModel.collection.insertMany(users);
      })
      .then(() => {
        const UserPluginSchema = new mongoose.Schema({
          name: String,
          age: Number,
        });

        UserPluginSchema.plugin(plugin, {
          index: 'users',
          type: 'user',
          filter(doc) {
            return doc.age >= 80;
          },
        });

        const UserPluginModel = mongoose.model(
          'UserPlugin',
          UserPluginSchema,
          'users'
        );

        return utils
          .deleteModelIndexes(UserPluginModel)
          .then(() => {
            return UserPluginModel.esCreateMapping();
          })
          .then(() => {
            return UserPluginModel;
          });
      })
      .then(UserPluginModel => {
        let error = 0;
        let docSent = 0;
        let docFiltered = 0;

        UserPluginModel.on('es-bulk-error', () => {
          error++;
        });

        UserPluginModel.on('es-bulk-data', () => {
          docSent++;
        });

        UserPluginModel.on('es-bulk-filtered', () => {
          docFiltered++;
        });

        return UserPluginModel.esSynchronize().then(() => {
          expect(error).to.be.equal(0);
          expect(docSent).to.be.equal(20);
          expect(docFiltered).to.be.equal(80);
          return UserPluginModel;
        });
      })
      .then(UserPluginModel => {
        return utils.Promise.all(
          users.map(user => {
            return new utils.Promise((resolve, reject) => {
              UserPluginModel.esSearch({ match: { _id: user._id.toString() } })
                .then(result => {
                  if (user.age < 80) {
                    expect(result.hits.total).to.eql(0);
                  } else {
                    expect(result.hits.total).to.eql(1);
                    const hit = result.hits.hits[0];
                    expect(hit._source.name).to.be.equal(user.name);
                    expect(hit._source.age).to.be.equal(user.age);
                  }
                  resolve();
                })
                .catch(err => {
                  reject(err);
                });
            });
          })
        );
      });
  });
});
