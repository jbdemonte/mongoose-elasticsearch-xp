var utils = require('../utils');
var mongoose = require('mongoose');
var plugin = require('../../');

describe('document-hook', function() {
  utils.setup();

  it('should be able to save without any previous call to ES', function() {
    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var user;

    return utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        return utils.deleteMongooseModels();
      })
      .then(function() {
        // recreate new model
        UserSchema = new mongoose.Schema({
          name: String,
          age: Number,
        });
        UserSchema.plugin(plugin);
        UserModel = mongoose.model('User', UserSchema);
        user = new UserModel({ name: 'John', age: 35 });
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          user.on('es-indexed', function(err) {
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

  it('should be indexed then removed', function() {
    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var user = new UserModel({ name: 'John', age: 35 });

    return utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          user.on('es-indexed', function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.save();
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;

          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            function(err, resp) {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(user._id.toString());
              expect(resp._source).to.eql({ name: 'John', age: 35 });
              resolve();
            }
          );
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          user.on('es-removed', function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.remove();
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;

          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            function(err, resp) {
              expect(resp.found).to.eql(false);
              expect(resp._id).to.eql(user._id.toString());
              resolve();
            }
          );
        });
      });
  });

  it('should emit same event from model', function() {
    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({ name: 'John', age: 35 });
    var jane = new UserModel({ name: 'Jane', age: 34 });
    var bob = new UserModel({ name: 'Bob', age: 36 });
    var users = [john, jane, bob];

    return utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        var count = 0;
        return new utils.Promise(function(resolve, reject) {
          UserModel.on('es-indexed', function(err) {
            if (err) {
              return reject(err);
            }
            count++;
            if (count === 3) {
              setTimeout(
                function() {
                  // delay to check if more than 3 are received
                  resolve();
                },
                500
              );
            } else if (count > 3) {
              reject(new Error('more than 3 event were emitted'));
            }
          });
          users.forEach(function(user) {
            user.save();
          });
        });
      })
      .then(function() {
        var count = 0;
        return new utils.Promise(function(resolve, reject) {
          UserModel.on('es-removed', function(err) {
            if (err) {
              return reject(err);
            }
            count++;
            if (count === 3) {
              setTimeout(
                function() {
                  // delay to check if more than 3 are received
                  resolve();
                },
                500
              );
            } else if (count > 3) {
              reject(new Error('more than 3 event were emitted'));
            }
          });
          users.forEach(function(user) {
            user.remove();
          });
        });
      });
  });

  it('should use filter', function() {
    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, {
      filter: function(doc) {
        return doc.age >= 80;
      },
    });

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({ name: 'John', age: 35 });
    var henry = new UserModel({ name: 'Henry', age: 85 });

    return utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          john.on('es-filtered', function() {
            resolve();
          });
          john.save();
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          henry.on('es-indexed', function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          henry.save();
        });
      })
      .then(function() {
        return UserModel.esRefresh();
      })
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.search(
            {
              index: options.index,
              type: options.type,
              body: { query: { match_all: {} } },
            },
            function(err, resp) {
              expect(resp.hits.total).to.eql(1);
              var hit = resp.hits.hits[0];
              expect(hit._id).to.eql(henry._id.toString());
              expect(hit._source).to.eql({ name: 'Henry', age: 85 });
              resolve();
            }
          );
        });
      });
  });

  it('should handle partial save', function() {
    var CitySchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
      city: {
        type: CitySchema,
        select: false,
      },
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var user;

    return utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        UserModel = mongoose.model('User', UserSchema);
        user = new UserModel({
          name: 'John',
          age: 35,
          city: { name: 'Paris' },
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          user.on('es-indexed', function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.save();
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            function(err, resp) {
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
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          UserModel.findById(user._id).then(function(dbUser) {
            dbUser.age = 36;
            expect(dbUser.city).to.be.undefined; // because of select false

            dbUser.on('es-indexed', function(err) {
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
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            function(err, resp) {
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

  it('should remove some fields', function() {
    var JobSchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    var CitySchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    var SkillSchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    var UserSchema = new mongoose.Schema({
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

    var UserModel = mongoose.model('User', UserSchema);

    var user, witness;

    return utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        UserModel = mongoose.model('User', UserSchema);
        witness = new UserModel({
          name: 'John',
          age: 35,
          city: { name: 'Paris' },
          job: { name: 'developer' },
          skill: { name: 'math' },
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          witness.on('es-indexed', function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          witness.save();
        });
      })
      .then(function() {
        UserModel = mongoose.model('User', UserSchema);
        user = new UserModel({
          name: 'John',
          age: 35,
          city: { name: 'Paris' },
          job: { name: 'developer' },
          skill: { name: 'math' },
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          user.on('es-indexed', function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.save();
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            function(err, resp) {
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
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          UserModel.findById(user._id, '+city +job +skill')
            .then(function(dbUser) {
              expect(dbUser.city).not.to.be.undefined; // because of select false
              dbUser.city = undefined; // remove some fields
              dbUser.job = undefined;
              dbUser.age = 36;

              dbUser.on('es-indexed', function(err) {
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
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: witness._id.toString(),
            },
            function(err, resp) {
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
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            function(err, resp) {
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

  it('should nullify some fields', function() {
    var JobSchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    var CitySchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    var SkillSchema = new mongoose.Schema({
      _id: false,
      name: String,
    });

    var UserSchema = new mongoose.Schema({
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

    var UserModel = mongoose.model('User', UserSchema);

    var user, witness;

    return utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        UserModel = mongoose.model('User', UserSchema);
        witness = new UserModel({
          name: 'John',
          age: 35,
          city: { name: 'Paris' },
          job: { name: 'developer' },
          skill: { name: 'math' },
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          witness.on('es-indexed', function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          witness.save();
        });
      })
      .then(function() {
        UserModel = mongoose.model('User', UserSchema);
        user = new UserModel({
          name: 'John',
          age: 35,
          city: { name: 'Paris' },
          job: { name: 'developer' },
          skill: { name: 'math' },
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          user.on('es-indexed', function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          user.save();
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            function(err, resp) {
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
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          UserModel.findById(user._id, '+city +job +skill')
            .then(function(dbUser) {
              expect(dbUser.city).not.to.be.undefined; // because of select false
              dbUser.city = undefined; // remove some fields
              dbUser.job = undefined;
              dbUser.age = 36;

              dbUser.on('es-indexed', function(err) {
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
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: witness._id.toString(),
            },
            function(err, resp) {
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
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            function(err, resp) {
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

  it('should handle FindOneAndUpdate', function() {
    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var user;

    return utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        return utils.deleteMongooseModels();
      })
      .then(function() {
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
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        return utils.deleteMongooseModels();
      })
      .then(function() {
        // recreate new model
        UserSchema = new mongoose.Schema({
          name: String,
          age: Number,
        });
        UserSchema.plugin(plugin);
        UserModel = mongoose.model('User', UserSchema);
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          UserModel.on('es-indexed', function(err) {
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
            function(err, usr) {
              if (err || !usr) {
                reject(err || new Error('no match'));
              }
            }
          );
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.get(
            {
              index: options.index,
              type: options.type,
              id: user._id.toString(),
            },
            function(err, resp) {
              expect(resp.found).to.eql(true);
              expect(resp._id).to.eql(user._id.toString());
              expect(resp._source).to.eql({ name: 'John', age: 67 });
              resolve();
            }
          );
        });
      });
  });

  it('should save a previously filtered entry', function() {
    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, {
      filter: function(doc) {
        return doc.age < 80;
      },
    });

    var UserModel = mongoose.model('User', UserSchema);

    var henry = new UserModel({ name: 'Henry', age: 85 });

    return utils
      .deleteModelIndexes(UserModel)
      .then(function() {
        return UserModel.esCreateMapping();
      })
      .then(function() {
        return henry.save();
      })
      .then(function() {
        return UserModel.esRefresh();
      })
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.search(
            {
              index: options.index,
              type: options.type,
              body: { query: { match_all: {} } },
            },
            function(err, resp) {
              expect(resp.hits.total).to.eql(0);
              resolve();
            }
          );
        });
      })
      .then(function() {
        return new utils.Promise(function(resolve, reject) {
          henry.age = 35;
          henry.on('es-indexed', function(err) {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
          henry.save();
        });
      })
      .then(function() {
        return UserModel.esRefresh();
      })
      .then(function() {
        return new utils.Promise(function(resolve) {
          var options = UserModel.esOptions();
          var client = options.client;
          client.search(
            {
              index: options.index,
              type: options.type,
              body: { query: { match_all: {} } },
            },
            function(err, resp) {
              expect(resp.hits.total).to.eql(1);
              var hit = resp.hits.hits[0];
              expect(hit._id).to.eql(henry._id.toString());
              expect(hit._source).to.eql({ name: 'Henry', age: 35 });
              resolve();
            }
          );
        });
      });
  });
});
