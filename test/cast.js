var utils = require('./utils');
var mongoose = require('mongoose');
var plugin = require('../');

describe("esIndex", function () {

  utils.setup();

  it('should handle casted values', function (done) {

    var Sub2Schema = new mongoose.Schema({
      _id: false,
      value: {
        type: String,
        es_cast: function (value, context) {
          expect(value).to.equal('x2');
          expect(context.document === john).to.be.true;
          expect(context.container === john.sub.sub2).to.be.true;
          expect(context.field).to.eql('value');
          return 'xyz';
        }
      }
    });

    var SubSchema = new mongoose.Schema({
      _id: false,
      sub1: String,
      sub2: Sub2Schema
    });

    var TagSchema = new mongoose.Schema({
      _id: false,
      value: String
    });

    var UserSchema = new mongoose.Schema({
      name: String,
      sub: SubSchema,
      age: {
        type: Number,
        es_cast: function (age, context) {
          expect(age).to.equal(35);
          expect(context.document === john).to.be.true;
          expect(context.container === john).to.be.true;
          expect(context.field).to.eql('age');
          return age - age % 10;
        }
      },
      tags: {
        type: [TagSchema],
        es_type: 'string',
        es_cast: function (tags, context) {
          expect(tags === john.tags).to.be.true;
          expect(context.document === john).to.be.true;
          expect(context.container === john).to.be.true;
          expect(context.field).to.eql('tags');
          return tags.map(function (tag) {
            return tag.value;
          });
        }
      }
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({
      name: 'John',
      age: 35,
      sub: {
        sub1: 'x1',
        sub2: {
          value: 'x2'
        }
      },
      tags: [
        {value: 'cool'},
        {value: 'green'}
      ]
    });

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        return john.esIndex();
      })
      .then(function () {
        return UserModel.esRefresh();
      })
      .then(function () {
        var options = UserModel.esOptions();
        var client = options.client;
        client.search({index: options.index, type: options.type, body: {query: {match_all: {}}}}, function (err, resp) {
          expect(resp.hits.total).to.eql(1);
          var hit = resp.hits.hits[0];
          expect(hit._id).to.eql(john._id.toString());
          expect(hit._source).to.eql({name: 'John', age: 30, tags: ['cool', 'green'], sub: {sub1: 'x1', sub2: {value: 'xyz'}}});
          done();
        });
      })
      .catch(function (err) {
        done(err);
      });
  });

});
