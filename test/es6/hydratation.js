'use strict';

const utils = require('../utils');
const mongoose = require('mongoose');
const plugin = require('../../').v5;;

describe('hydratation', () => {
  utils.setup();

  let UserModel;
  let BookModel;
  let CityModel;
  let john;
  let jane;
  let bob;
  let city1;
  let city2;
  let book1;
  let book2;
  let author1;
  let author2;

  beforeEach(() => {
    const CitySchema = new mongoose.Schema({
      name: String,
    });

    const BookSchema = new mongoose.Schema({
      title: String,
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    });

    const UserSchema = new mongoose.Schema({
      name: { type: String, es_indexed: true },
      age: { type: Number, es_indexed: true },
      city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'City',
        es_indexed: false,
      },
      books: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
        es_indexed: false,
      },
    });

    UserSchema.plugin(plugin);

    UserModel = mongoose.model('User', UserSchema);
    BookModel = mongoose.model('Book', BookSchema);
    CityModel = mongoose.model('City', CitySchema);

    city1 = new CityModel({ name: 'New York' });
    city2 = new CityModel({ name: 'Los Angeles' });

    author1 = new UserModel({ name: 'Rudyard Kipling' });
    author2 = new UserModel({ name: 'George Orwell' });

    book1 = new BookModel({ title: 'The Jungle Book', author: author1 });
    book2 = new BookModel({ title: '1984', author: author2 });

    john = new UserModel({
      name: 'John',
      age: 35,
      city: city1,
      books: [book1, book2],
    });
    jane = new UserModel({
      name: 'Jane',
      age: 34,
      city: city1,
      books: [book1],
    });
    bob = new UserModel({ name: 'Bob', age: 36, city: city2, books: [book2] });

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return Promise.all([
          city1.save(),
          city2.save(),
          book1.save(),
          book2.save(),
        ]);
      })
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        return utils.Promise.all(
          [john, jane, bob, author1, author2].map(user => {
            return new utils.Promise(resolve => {
              user.on('es-indexed', resolve);
              user.save();
            });
          })
        );
      })
      .then(() => {
        return UserModel.esRefresh();
      });
  });

  it('should hydrate', () => {
    return UserModel.esSearch(
      {
        query: {
          bool: {
            must: { match_all: {} },
            filter: { range: { age: { gte: 35 } } },
          },
        },
        sort: [{ age: { order: 'desc' } }],
      },
      { hydrate: true }
    ).then(result => {
      let hit;
      expect(result.hits.total).to.eql(2);

      hit = result.hits.hits[0];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(bob._id.toString());
      expect(hit.doc.name).to.eql(bob.name);
      expect(hit.doc.age).to.eql(bob.age);

      hit = result.hits.hits[1];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(john._id.toString());
      expect(hit.doc.name).to.eql(john.name);
      expect(hit.doc.age).to.eql(john.age);
    });
  });

  it('should hydrate returning only models', () => {
    return UserModel.esSearch(
      {
        query: {
          bool: {
            must: { match_all: {} },
            filter: { range: { age: { gte: 35 } } },
          },
        },
        sort: [{ age: { order: 'desc' } }],
      },
      { hydrate: { docsOnly: true } }
    ).then(users => {
      let user;
      expect(users.length).to.eql(2);

      user = users[0];
      expect(user._id.toString()).to.eql(bob._id.toString());
      expect(user.name).to.eql(bob.name);
      expect(user.age).to.eql(bob.age);

      user = users[1];
      expect(user._id.toString()).to.eql(john._id.toString());
      expect(user.name).to.eql(john.name);
      expect(user.age).to.eql(john.age);
    });
  });

  it('should return an empty array when hydrating only models on 0 hit', () => {
    return UserModel.esSearch(
      {
        query: {
          bool: {
            must: { match_all: {} },
            filter: { range: { age: { gte: 100 } } },
          },
        },
        sort: [{ age: { order: 'desc' } }],
      },
      { hydrate: { docsOnly: true } }
    ).then(users => {
      expect(users).to.eql([]);
    });
  });

  it('should hydrate using projection', () => {
    return UserModel.esSearch('name:jane', {
      hydrate: { select: 'name' },
    }).then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(jane._id.toString());
      expect(hit.doc.name).to.eql(jane.name);
      expect(hit.doc.age).to.be.undefined;
    });
  });

  it('should hydrate using options', () => {
    return UserModel.esSearch('name:jane', {
      hydrate: { options: { lean: true } },
    }).then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).not.to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(jane._id.toString());
      expect(hit.doc.name).to.eql(jane.name);
      expect(hit.doc.age).to.eql(jane.age);
    });
  });

  it('should hydrate when defined in plugin', () => {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: true });

    const UserModelHydrate = mongoose.model('User', UserSchema);

    return UserModelHydrate.esSearch('name:jane').then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModelHydrate);
      expect(hit.doc._id.toString()).to.eql(jane._id.toString());
      expect(hit.doc.name).to.eql(jane.name);
      expect(hit.doc.age).to.eql(jane.age);
    });
  });

  it('should hydrate when defined in plugin returning only models', () => {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { docsOnly: true } });

    const UserModelHydrate = mongoose.model('User', UserSchema);

    return UserModelHydrate.esSearch({
      query: {
        bool: {
          must: { match_all: {} },
          filter: { range: { age: { gte: 35 } } },
        },
      },
      sort: [{ age: { order: 'desc' } }],
    }).then(users => {
      let user;
      expect(users.length).to.eql(2);

      user = users[0];
      expect(user._id.toString()).to.eql(bob._id.toString());
      expect(user.name).to.eql(bob.name);
      expect(user.age).to.eql(bob.age);

      user = users[1];
      expect(user._id.toString()).to.eql(john._id.toString());
      expect(user.name).to.eql(john.name);
      expect(user.age).to.eql(john.age);
    });
  });

  it('should hydrate when defined in plugin using projection', () => {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { select: 'name' } });

    const UserModelHydrate = mongoose.model('User', UserSchema);

    return UserModelHydrate.esSearch('name:jane').then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModelHydrate);
      expect(hit.doc._id.toString()).to.eql(jane._id.toString());
      expect(hit.doc.name).to.eql(jane.name);
      expect(hit.doc.age).to.be.undefined;
    });
  });

  it('should hydrate when defined in plugin using options', () => {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { options: { lean: true } } });

    const UserModelHydrate = mongoose.model('User', UserSchema);

    return UserModelHydrate.esSearch('name:jane').then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).not.to.be.an.instanceof(UserModelHydrate);
      expect(hit.doc._id.toString()).to.eql(jane._id.toString());
      expect(hit.doc.name).to.eql(jane.name);
      expect(hit.doc.age).to.eql(jane.age);
    });
  });

  it('should hydrate overwriting defined in plugin using options', () => {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { options: { lean: true } } });

    const UserModelHydrate = mongoose.model('User', UserSchema);

    return UserModelHydrate.esSearch(
      'name:jane',
      { hydrate: { select: 'name' } } // not lean
    ).then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModelHydrate);
      expect(hit.doc._id.toString()).to.eql(jane._id.toString());
      expect(hit.doc.name).to.eql(jane.name);
      expect(hit.doc.age).to.be.undefined;
    });
  });

  it('should not hydrate overwriting defined in plugin', () => {
    utils.deleteMongooseModels();

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
    });

    UserSchema.plugin(plugin, { hydrate: { options: { lean: true } } });

    const UserModelHydrate = mongoose.model('User', UserSchema);

    return UserModelHydrate.esSearch(
      'name:jane',
      { hydrate: false } // not lean
    ).then(result => {
      expect(result.hits.total).to.eql(1);

      const hit = result.hits.hits[0];
      expect(hit.doc).to.be.undefined;
      expect(hit._source).not.to.be.undefined;
      expect(hit._source.name).to.eql(jane.name);
      expect(hit._source.age).to.eql(34);
    });
  });

  it('should hydrate with a simple populate', () => {
    return UserModel.esSearch(
      {
        query: {
          bool: {
            must: { match_all: {} },
            filter: { range: { age: { gte: 35 } } },
          },
        },
        sort: [{ age: { order: 'desc' } }],
      },
      {
        hydrate: {
          populate: {
            path: 'city',
          },
        },
      }
    ).then(result => {
      let hit;
      expect(result.hits.total).to.eql(2);

      hit = result.hits.hits[0];

      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(bob._id.toString());
      expect(hit.doc.name).to.eql(bob.name);
      expect(hit.doc.age).to.eql(bob.age);
      expect(hit.doc.city._id.toString()).to.eql(city2._id.toString());
      expect(hit.doc.city.name).to.eql(city2.name);
      // book should not be populated
      expect(hit.doc.books.length).to.eql(1);
      expect(hit.doc.books[0].toJSON()).to.eql(book2._id.toString());

      hit = result.hits.hits[1];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(john._id.toString());
      expect(hit.doc.name).to.eql(john.name);
      expect(hit.doc.age).to.eql(john.age);
      expect(hit.doc.city._id.toString()).to.eql(city1._id.toString());
      expect(hit.doc.city.name).to.eql(city1.name);
      // book should not be populated
      expect(hit.doc.books.length).to.eql(2);
      expect(hit.doc.books[0].toJSON()).to.eql(book1._id.toString());
      expect(hit.doc.books[1].toJSON()).to.eql(book2._id.toString());
    });
  });

  it('should hydrate with an array of population including a complex one', () => {
    return UserModel.esSearch(
      {
        query: {
          bool: {
            must: { match_all: {} },
            filter: { range: { age: { gte: 35 } } },
          },
        },
        sort: [{ age: { order: 'desc' } }],
      },
      {
        hydrate: {
          populate: [
            {
              path: 'city',
            },
            {
              path: 'books',
              populate: {
                path: 'author',
              },
            },
          ],
        },
      }
    ).then(result => {
      let hit;
      expect(result.hits.total).to.eql(2);

      hit = result.hits.hits[0];

      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(bob._id.toString());
      expect(hit.doc.name).to.eql(bob.name);
      expect(hit.doc.age).to.eql(bob.age);

      expect(hit.doc.city._id.toString()).to.eql(city2._id.toString());
      expect(hit.doc.city.name).to.eql(city2.name);

      expect(hit.doc.books.length).to.eql(1);
      expect(hit.doc.books[0].toJSON()).to.eql(book2.toJSON());
      expect(hit.doc.books[0].author.toJSON()).to.eql(author2.toJSON());

      hit = result.hits.hits[1];
      expect(hit._source).to.be.undefined;
      expect(hit.doc).to.be.an.instanceof(UserModel);
      expect(hit.doc._id.toString()).to.eql(john._id.toString());
      expect(hit.doc.name).to.eql(john.name);
      expect(hit.doc.age).to.eql(john.age);

      expect(hit.doc.city._id.toString()).to.eql(city1._id.toString());
      expect(hit.doc.city.name).to.eql(city1.name);

      expect(hit.doc.books.length).to.eql(2);
      expect(hit.doc.books[0].toJSON()).to.eql(book1.toJSON());
      expect(hit.doc.books[0].author.toJSON()).to.eql(author1.toJSON());
      expect(hit.doc.books[1].toJSON()).to.eql(book2.toJSON());
      expect(hit.doc.books[1].author.toJSON()).to.eql(author2.toJSON());
    });
  });
});
