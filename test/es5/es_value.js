var utils = require('../utils');
var mongoose = require('mongoose');
var plugin = require('../../');

describe("es_value", function () {

  utils.setup();

  it('should handle es_value as a function', function (done) {

    var Sub2Schema = new mongoose.Schema({
      _id: false,
      value: {
        type: String,
        es_value: function (value, context) {
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
        es_value: function (age, context) {
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
        es_value: function (tags, context) {
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
          value: 'x2',
          nb: 7
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

  it('should handle es_value as a value', function (done) {

    var UserSchema = new mongoose.Schema({
      name: {type: String, es_type: 'keyword'},
      numberArray: {
        type: Number,
        es_value: [1, 2, 3]
      },
      falsy: {
        type: Number,
        es_value: 0
      },
      stringArray: {
        type: [String],
        es_value: ['az', 'er', 'ty']
      },
      obj: {
        type: String,
        es_type: {
          a: {es_type: 'string'},
          b: {es_type: 'integer'}
        },
        es_value: {
          a: 'azerty',
          b: 123
        }
      }
    });

    UserSchema.plugin(plugin);

    var UserModel = mongoose.model('User', UserSchema);

    var john = new UserModel({
      name: 'John',
      numberArray: 35,
      falsy: 98,
      stringArray: ['GHJ'],
      obj: 'obj'
    });

    var bob = new UserModel({name: 'Bob'});

    utils.deleteModelIndexes(UserModel)
      .then(function () {
        return UserModel.esCreateMapping();
      })
      .then(function () {
        return john.esIndex();
      })
      .then(function () {
        return bob.esIndex();
      })
      .then(function () {
        return UserModel.esRefresh();
      })
      .then(function () {
        var options = UserModel.esOptions();
        var client = options.client;
        client.search({index: options.index, type: options.type, body: {query: {match_all: {}}, sort: [{name: {order: "desc"}}]}}, function (err, resp) {
          expect(resp.hits.total).to.eql(2);
          var hit = resp.hits.hits[0];
          expect(hit._id).to.eql(john._id.toString());
          expect(hit._source).to.eql({
            name: 'John',
            numberArray: [1, 2, 3],
            falsy: 0,
            stringArray: ['az', 'er', 'ty'],
            obj: {
              a: 'azerty',
              b: 123
            }
          });
          hit = resp.hits.hits[1];
          expect(hit._id).to.eql(bob._id.toString());
          expect(hit._source).to.eql({
            name: 'Bob',
            numberArray: [1, 2, 3],
            falsy: 0,
            stringArray: ['az', 'er', 'ty'],
            obj: {
              a: 'azerty',
              b: 123
            }
          });
          done();
        });
      })
      .catch(function (err) {
        done(err);
      });
  });

});
