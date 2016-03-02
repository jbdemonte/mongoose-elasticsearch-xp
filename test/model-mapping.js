var utils = require('./utils');
var mongoose = require('mongoose');
var plugin = require('../');

describe("model-mapping", function () {

  utils.setup();

  it('should handle plugin settings', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String
    });

    UserSchema.plugin(
      plugin,
      {
        mappingSettings: {
          "analysis": {
            "filter": {
              "elision": {
                "type": "elision",
                "articles": ["l", "m", "t", "qu", "n", "s", "j", "d"]
              }
            },
            "analyzer": {
              "custom_french_analyzer": {
                "tokenizer": "letter",
                "filter": ["asciifolding", "lowercase", "french_stem", "elision", "stop"]
              },
              "tag_analyzer": {
                "tokenizer": "keyword",
                "filter": ["asciifolding", "lowercase"]
              }
            }
          }
        }
      }
    );

    var UserModel = mongoose.model('User', UserSchema);

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        var options = UserModel.esOptions();
        return options.client.indices.getSettings({
          index: options.index
        });
      })
      .then(function (settings) {
        var analysis = settings.users.settings.index.analysis;
        expect(analysis.analyzer).to.eql({
          "custom_french_analyzer": {
            "tokenizer": "letter",
            "filter": ["asciifolding", "lowercase", "french_stem", "elision", "stop"]
          },
          "tag_analyzer": {
            "tokenizer": "keyword",
            "filter": ["asciifolding", "lowercase"]
          }
        });
        expect(analysis.filter).to.eql({
          "elision": {
            "type": "elision",
              "articles": ["l", "m", "t", "qu", "n", "s", "j", "d"]
          }
        });
      })
      .then(function () {
        var options = UserModel.esOptions();
        return options.client.indices.getMapping({
          index: options.index,
          type: options.type
        });
      })
      .then(function (mapping) {
        var properties = mapping.users.mappings.user.properties;
        expect(properties).to.have.all.keys('name');
        expect(properties.name.type).to.be.equal('string');
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should handle settings', function (done) {

    var UserSchema = new mongoose.Schema({
      name: String
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping({
          "analysis": {
            "filter": {
              "elision": {
                "type": "elision",
                "articles": ["l", "m", "t", "qu", "n", "s", "j", "d"]
              }
            },
            "analyzer": {
              "custom_french_analyzer": {
                "tokenizer": "letter",
                "filter": ["asciifolding", "lowercase", "french_stem", "elision", "stop"]
              },
              "tag_analyzer": {
                "tokenizer": "keyword",
                "filter": ["asciifolding", "lowercase"]
              }
            }
          }
        });
      })
      .then(function () {
        var options = UserModel.esOptions();
        return options.client.indices.getSettings({
          index: options.index
        });
      })
      .then(function (settings) {
        var analysis = settings.users.settings.index.analysis;
        expect(analysis.analyzer).to.eql({
          "custom_french_analyzer": {
            "tokenizer": "letter",
            "filter": ["asciifolding", "lowercase", "french_stem", "elision", "stop"]
          },
          "tag_analyzer": {
            "tokenizer": "keyword",
            "filter": ["asciifolding", "lowercase"]
          }
        });
        expect(analysis.filter).to.eql({
          "elision": {
            "type": "elision",
              "articles": ["l", "m", "t", "qu", "n", "s", "j", "d"]
          }
        });
      })
      .then(function () {
        var options = UserModel.esOptions();
        return options.client.indices.getMapping({
          index: options.index,
          type: options.type
        });
      })
      .then(function (mapping) {
        var properties = mapping.users.mappings.user.properties;
        expect(properties).to.have.all.keys('name');
        expect(properties.name.type).to.be.equal('string');
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should create an implicit mapping', function (done) {

    var deepEmbeddedSchema = new mongoose.Schema({
      _id: false,
      dn: Number
    });

    var embeddedSchema = new mongoose.Schema({
      _id: false,
      key: String,
      deep: [deepEmbeddedSchema]
    });

    var UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
      joined: Date,
      optin: {type: Boolean, default: true},
      tags: [String],
      plain: {
        x: String,
        y: Number,
        z: Boolean
      },
      embedded: embeddedSchema
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        var options = UserModel.esOptions();
        return options.client.indices.getMapping({
          index: options.index,
          type: options.type
        });
      })
      .then(function (mapping) {
        var properties = mapping.users.mappings.user.properties;
        expect(properties).to.have.all.keys('name', 'age', 'joined', 'tags', 'optin', 'plain', 'embedded');
        expect(properties.name.type).to.be.equal('string');
        expect(properties.age.type).to.be.equal('double');
        expect(properties.joined.type).to.be.equal('date');
        expect(properties.tags.type).to.be.equal('string');
        expect(properties.optin.type).to.be.equal('boolean');

        expect(properties.plain.properties).to.have.all.keys('x', 'y', 'z');
        expect(properties.plain.properties.x.type).to.be.equal('string');
        expect(properties.plain.properties.y.type).to.be.equal('double');
        expect(properties.plain.properties.z.type).to.be.equal('boolean');

        expect(properties.embedded.properties).to.have.all.keys('deep', 'key');
        expect(properties.embedded.properties.key.type).to.be.equal('string');

        expect(properties.embedded.properties.deep.properties).to.have.all.keys('dn');
        expect(properties.embedded.properties.deep.properties.dn.type).to.be.equal('double');

        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should create an explicit mapping', function (done) {

    var deepImplicitEmbeddedSchema = new mongoose.Schema({
      _id: false,
      dn: Number
    });

    var embeddedSchema = new mongoose.Schema({
      _id: false,
      key: String,
      deep1: {type: [deepImplicitEmbeddedSchema], es_indexed: true},
      deep2: {type: [deepImplicitEmbeddedSchema]}
    });

    var implicitEmbeddedSchema = new mongoose.Schema({
      _id: false,
      anyKey: String
    });

    var UserSchema = new mongoose.Schema({
      name: {type: String, es_indexed: true},
      age: Number,
      joined: {type: Date},
      optin: {type: Boolean, default: true, es_indexed: true},
      tags: {type: [String], es_indexed: true},
      plain: { // plain object so, without es_indexed would not be included
        x: String,
        y: Number,
        z: Boolean
      },
      embedded1: {type: embeddedSchema, es_indexed: false}, // needed, because of embedded1.deep1.es_indexed == true
      embedded2: {type: embeddedSchema, es_indexed: true},
      embedded3: implicitEmbeddedSchema // no explicit es_indexed, so, would not be included
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        var options = UserModel.esOptions();
        return options.client.indices.getMapping({
          index: options.index,
          type: options.type
        });
      })
      .then(function (mapping) {
        var properties = mapping.users.mappings.user.properties;
        expect(properties).to.have.all.keys('name', 'tags', 'optin', 'embedded2');
        expect(properties.name.type).to.be.equal('string');
        expect(properties.tags.type).to.be.equal('string');
        expect(properties.optin.type).to.be.equal('boolean');

        expect(properties.embedded2.properties).to.have.all.keys('deep1');

        expect(properties.embedded2.properties.deep1.properties).to.have.all.keys('dn');
        expect(properties.embedded2.properties.deep1.properties.dn.type).to.be.equal('double');
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  it('should propagate es options', function (done) {

    var UserSchema = new mongoose.Schema({
      name: {type: String, es_boost: 2},
      age: {type: Number, es_type: 'integer', es_boost: 1.5},
      joined: Date,
      optin: {type: Boolean, default: true},
      pos: {
        type: [Number],
        index: '2dsphere',
        es_type: 'geo_point'
      }
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        var options = UserModel.esOptions();
        return options.client.indices.getMapping({
          index: options.index,
          type: options.type
        });
      })
      .then(function (mapping) {
        var properties = mapping.users.mappings.user.properties;
        expect(properties).to.have.all.keys('name', 'age', 'joined', 'optin', 'pos');
        expect(properties.name.type).to.be.equal('string');
        expect(properties.name.boost).to.be.equal(2);
        expect(properties.age.type).to.be.equal('integer');
        expect(properties.age.boost).to.be.equal(1.5);
        expect(properties.joined.type).to.be.equal('date');
        expect(properties.optin.type).to.be.equal('boolean');
        expect(properties.pos.type).to.be.equal('geo_point');

        done();
      })
      .catch(function (err) {
        done(err);
      });
  });

  // https://www.elastic.co/guide/en/elasticsearch/reference/2.0/nested.html
  it('should handle nested datatype', function (done) {

    var UserSchema = new mongoose.Schema({
      _id: false,
      first: String,
      last: String
    });

    var GroupSchema = new mongoose.Schema({
      group: String,
      user: {type: [UserSchema], es_type: 'nested'}
    });

    GroupSchema.plugin(plugin);

    var GroupModel = mongoose.model('Group', GroupSchema);

    utils.deleteModelIndexes(GroupModel)
      .then(function () {
        return GroupModel.esCreateMapping();
      })
      .then(function () {
        var options = GroupModel.esOptions();
        return options.client.indices.getMapping({
          index: options.index,
          type: options.type
        });
      })
      .then(function (mapping) {
        var properties = mapping.groups.mappings.group.properties;
        expect(properties).to.have.all.keys('group', 'user');
        expect(properties.group.type).to.be.equal('string');
        expect(properties.user.type).to.be.equal('nested');
        expect(properties.user.properties).to.have.all.keys('first', 'last');
        expect(properties.user.properties.first.type).to.be.equal('string');
        expect(properties.user.properties.last.type).to.be.equal('string');
      })
      .then(function () {
        return new utils.Promise(function (resolve, reject) {
          var group = new GroupModel({
            "group": "fans",
            "user": [
              {
                "first": "John",
                "last": "Smith"
              },
              {
                "first": "Alice",
                "last": "White"
              }
            ]
          });
          group.on('es-indexed', function () {
            resolve();
          });
          return group.save();
        });
      })
      .then(function () {
        return GroupModel.esRefresh();
      })
      .then(function () {
        return GroupModel
          .esSearch({
            "query": {
              "nested": {
                "path": "user",
                "query": {
                  "bool": {
                    "must": [
                      { "match": { "user.first": "Alice" }},
                      { "match": { "user.last":  "Smith" }}
                    ]
                  }
                }
              }
            }
          })
          .then(function (result) {
            expect(result.hits.total).to.eql(0);
          });
      })
      .then(function () {
        return GroupModel
          .esSearch({
            "query": {
              "nested": {
                "path": "user",
                "query": {
                  "bool": {
                    "must": [
                      { "match": { "user.first": "Alice" }},
                      { "match": { "user.last":  "White" }}
                    ]
                  }
                }
              }
            }
          })
          .then(function (result) {
            expect(result.hits.total).to.eql(1);
            expect(result.hits.hits[0]._source).to.eql({
              "group": "fans",
              "user": [
                {
                  "first": "John",
                  "last": "Smith"
                },
                {
                  "first": "Alice",
                  "last": "White"
                }
              ]
            });
          });
      })
      .then(function () {
        done();
      })
      .catch(function (err) {
        done(err);
      });
  });
});
