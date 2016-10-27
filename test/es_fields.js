var utils = require('./utils');
var mongoose = require('mongoose');
var plugin = require('../');

describe("es_fields", function () {

  utils.setup();

  it('should add some fields', function (done) {

    var UserSchema = new mongoose.Schema(
      {
        name: String
      },
      {
        es_fields: {
          num: {
            es_type: 'integer',
            es_value: 123
          },
          length: {
            es_type: 'integer',
            es_value: function (document) {
              expect(document === john).to.be.true;
              return document.name.length;
            }
          }
        }
      }
    );

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({
      name: 'John'
    });

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
        expect(properties).to.have.all.keys('name', 'num', 'length');
        expect(properties.name.type).to.be.equal('string');
        expect(properties.num.type).to.be.equal('integer');
        expect(properties.length.type).to.be.equal('integer');
      })
      .then(function () {
        return new utils.Promise(function (resolve, reject) {
          john.on('es-indexed', function () {
            resolve();
          });
          john.save();
        });
      })
      .then(function () {
        return UserModel.esRefresh();
      })
      .then(function () {
        return UserModel.esSearch({
          query: {match_all: {}}
        });
      })
      .then(function (result) {
        expect(result.hits.total).to.eql(1);
        expect(result.hits.hits[0]._source).to.eql({
          "name": "John",
          "num": 123,
          "length": 4
        });
        done();
      })
      .catch(function (err) {
        done(err);
      });

  });
});
