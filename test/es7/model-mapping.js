'use strict';

const mongoose = require('mongoose');
const utils = require('../utils');
const plugin = require('../../').v7;

describe('model-mapping', () => {
  utils.setup();

  it('should handle plugin settings', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
    });

    UserSchema.plugin(plugin, {
      mappingSettings: {
        settings: {
          analysis: {
            filter: {
              elision: {
                type: 'elision',
                articles: ['l', 'm', 't', 'qu', 'n', 's', 'j', 'd'],
              },
            },
            analyzer: {
              custom_french_analyzer: {
                tokenizer: 'letter',
                filter: [
                  'asciifolding',
                  'lowercase',
                  'french_stem',
                  'elision',
                  'stop',
                ],
              },
              tag_analyzer: {
                tokenizer: 'keyword',
                filter: ['asciifolding', 'lowercase'],
              },
            },
          },
        },
      },
    });

    const UserModel = mongoose.model('User', UserSchema);

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        const options = UserModel.esOptions();
        return options.client.indices.getSettings({
          index: options.index,
        });
      })
      .then(({ body }) => {
        const analysis = body.users.settings.index.analysis;
        expect(analysis.analyzer).to.eql({
          custom_french_analyzer: {
            tokenizer: 'letter',
            filter: [
              'asciifolding',
              'lowercase',
              'french_stem',
              'elision',
              'stop',
            ],
          },
          tag_analyzer: {
            tokenizer: 'keyword',
            filter: ['asciifolding', 'lowercase'],
          },
        });
        expect(analysis.filter).to.eql({
          elision: {
            type: 'elision',
            articles: ['l', 'm', 't', 'qu', 'n', 's', 'j', 'd'],
          },
        });
      })
      .then(() => {
        const options = UserModel.esOptions();
        return options.client.indices.getMapping({
          include_type_name: true,
          index: options.index,
          type: options.type,
        });
      })
      .then(({ body }) => {
        const properties = body.users.mappings.user.properties;
        expect(properties).to.have.all.keys('name');
        expect(properties.name.type).to.be.equal('text');
      });
  });

  it('should handle settings', () => {
    const UserSchema = new mongoose.Schema({
      name: String,
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping({
          settings: {
            analysis: {
              filter: {
                elision: {
                  type: 'elision',
                  articles: ['l', 'm', 't', 'qu', 'n', 's', 'j', 'd'],
                },
              },
              analyzer: {
                custom_french_analyzer: {
                  tokenizer: 'letter',
                  filter: [
                    'asciifolding',
                    'lowercase',
                    'french_stem',
                    'elision',
                    'stop',
                  ],
                },
                tag_analyzer: {
                  tokenizer: 'keyword',
                  filter: ['asciifolding', 'lowercase'],
                },
              },
            },
          },
        });
      })
      .then(() => {
        const options = UserModel.esOptions();
        return options.client.indices.getSettings({
          index: options.index,
        });
      })
      .then(({ body }) => {
        const analysis = body.users.settings.index.analysis;
        expect(analysis.analyzer).to.eql({
          custom_french_analyzer: {
            tokenizer: 'letter',
            filter: [
              'asciifolding',
              'lowercase',
              'french_stem',
              'elision',
              'stop',
            ],
          },
          tag_analyzer: {
            tokenizer: 'keyword',
            filter: ['asciifolding', 'lowercase'],
          },
        });
        expect(analysis.filter).to.eql({
          elision: {
            type: 'elision',
            articles: ['l', 'm', 't', 'qu', 'n', 's', 'j', 'd'],
          },
        });
      })
      .then(() => {
        const options = UserModel.esOptions();
        return options.client.indices.getMapping({
          include_type_name: true,
          index: options.index,
          type: options.type,
        });
      })
      .then(({ body }) => {
        const properties = body.users.mappings.user.properties;
        expect(properties).to.have.all.keys('name');
        expect(properties.name.type).to.be.equal('text');
      });
  });

  it('should create an implicit mapping', () => {
    const deepEmbeddedSchema = new mongoose.Schema({
      _id: false,
      dn: Number,
    });

    const embeddedSchema = new mongoose.Schema({
      _id: false,
      key: String,
      deep: [deepEmbeddedSchema],
    });

    const UserSchema = new mongoose.Schema({
      name: String,
      age: Number,
      joined: Date,
      optin: { type: Boolean, default: true },
      tags: [String],
      plain: {
        x: String,
        y: Number,
        z: Boolean,
      },
      embedded: embeddedSchema,
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        const options = UserModel.esOptions();
        return options.client.indices.getMapping({
          include_type_name: true,
          index: options.index,
          type: options.type,
        });
      })
      .then(({ body }) => {
        const properties = body.users.mappings.user.properties;
        expect(properties).to.have.all.keys(
          'name',
          'age',
          'joined',
          'tags',
          'optin',
          'plain',
          'embedded'
        );
        expect(properties.name.type).to.be.equal('text');
        expect(properties.age.type).to.be.equal('long');
        expect(properties.joined.type).to.be.equal('date');
        expect(properties.tags.type).to.be.equal('text');
        expect(properties.optin.type).to.be.equal('boolean');

        expect(properties.plain.properties).to.have.all.keys('x', 'y', 'z');
        expect(properties.plain.properties.x.type).to.be.equal('text');
        expect(properties.plain.properties.y.type).to.be.equal('long');
        expect(properties.plain.properties.z.type).to.be.equal('boolean');

        expect(properties.embedded.properties).to.have.all.keys('deep', 'key');
        expect(properties.embedded.properties.key.type).to.be.equal('text');

        expect(properties.embedded.properties.deep.properties).to.have.all.keys(
          'dn'
        );
        expect(
          properties.embedded.properties.deep.properties.dn.type
        ).to.be.equal('long');
      });
  });

  it('should create an explicit mapping', () => {
    const deepImplicitEmbeddedSchema = new mongoose.Schema({
      _id: false,
      dn: Number,
    });

    const embeddedSchema = new mongoose.Schema({
      _id: false,
      key: String,
      deep1: { type: [deepImplicitEmbeddedSchema], es_indexed: true },
      deep2: { type: [deepImplicitEmbeddedSchema] },
    });

    const implicitEmbeddedSchema = new mongoose.Schema({
      _id: false,
      anyKey: String,
    });

    const UserSchema = new mongoose.Schema({
      name: { type: String, es_indexed: true },
      age: Number,
      joined: { type: Date },
      optin: { type: Boolean, default: true, es_indexed: true },
      tags: { type: [String], es_indexed: true },
      plain: {
        // plain object so, without es_indexed would not be included
        x: String,
        y: Number,
        z: Boolean,
      },
      embedded1: { type: embeddedSchema, es_indexed: false }, // needed, because of embedded1.deep1.es_indexed == true
      embedded2: { type: embeddedSchema, es_indexed: true },
      embedded3: implicitEmbeddedSchema, // no explicit es_indexed, so, would not be included
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        const options = UserModel.esOptions();
        return options.client.indices.getMapping({
          include_type_name: true,
          index: options.index,
          type: options.type,
        });
      })
      .then(({ body }) => {
        const properties = body.users.mappings.user.properties;
        expect(properties).to.have.all.keys(
          'name',
          'tags',
          'optin',
          'embedded2'
        );
        expect(properties.name.type).to.be.equal('text');
        expect(properties.tags.type).to.be.equal('text');
        expect(properties.optin.type).to.be.equal('boolean');

        expect(properties.embedded2.properties).to.have.all.keys('deep1');

        expect(
          properties.embedded2.properties.deep1.properties
        ).to.have.all.keys('dn');
        expect(
          properties.embedded2.properties.deep1.properties.dn.type
        ).to.be.equal('long');
      });
  });

  it('should propagate es options', () => {
    const UserSchema = new mongoose.Schema({
      name: { type: String, es_boost: 2 },
      age: { type: Number, es_type: 'integer', es_boost: 1.5 },
      joined: Date,
      optin: { type: Boolean, default: true },
      pos: {
        type: [Number],
        index: '2dsphere',
        es_type: 'geo_point',
      },
    });

    UserSchema.plugin(plugin);

    const UserModel = mongoose.model('User', UserSchema);

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        const options = UserModel.esOptions();
        return options.client.indices.getMapping({
          include_type_name: true,
          index: options.index,
          type: options.type,
        });
      })
      .then(({ body }) => {
        const properties = body.users.mappings.user.properties;
        expect(properties).to.have.all.keys(
          'name',
          'age',
          'joined',
          'optin',
          'pos'
        );
        expect(properties.name.type).to.be.equal('text');
        expect(properties.name.boost).to.be.equal(2);
        expect(properties.age.type).to.be.equal('integer');
        expect(properties.age.boost).to.be.equal(1.5);
        expect(properties.joined.type).to.be.equal('date');
        expect(properties.optin.type).to.be.equal('boolean');
        expect(properties.pos.type).to.be.equal('geo_point');
      });
  });

  // https://www.elastic.co/guide/en/elasticsearch/reference/5.4/nested.html
  it('should handle nested datatype', () => {
    const UserSchema = new mongoose.Schema({
      _id: false,
      first: String,
      last: String,
    });

    const GroupSchema = new mongoose.Schema({
      group: String,
      user: { type: [UserSchema], es_type: 'nested' },
    });

    GroupSchema.plugin(plugin);

    const GroupModel = mongoose.model('Group', GroupSchema);

    return utils
      .deleteModelIndexes(GroupModel)
      .then(() => {
        return GroupModel.esCreateMapping();
      })
      .then(() => {
        const options = GroupModel.esOptions();
        return options.client.indices.getMapping({
          include_type_name: true,
          index: options.index,
          type: options.type,
        });
      })
      .then(({ body }) => {
        const properties = body.groups.mappings.group.properties;
        expect(properties).to.have.all.keys('group', 'user');
        expect(properties.group.type).to.be.equal('text');
        expect(properties.user.type).to.be.equal('nested');
        expect(properties.user.properties).to.have.all.keys('first', 'last');
        expect(properties.user.properties.first.type).to.be.equal('text');
        expect(properties.user.properties.last.type).to.be.equal('text');
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const group = new GroupModel({
            group: 'fans',
            user: [
              {
                first: 'John',
                last: 'Smith',
              },
              {
                first: 'Alice',
                last: 'White',
              },
            ],
          });
          group.on('es-indexed', () => {
            resolve();
          });
          return group.save();
        });
      })
      .then(() => {
        return GroupModel.esRefresh();
      })
      .then(() => {
        return GroupModel.esSearch({
          query: {
            nested: {
              path: 'user',
              query: {
                bool: {
                  must: [
                    { match: { 'user.first': 'Alice' } },
                    { match: { 'user.last': 'Smith' } },
                  ],
                },
              },
            },
          },
        }).then(result => {
          expect(result.hits.total.value).to.eql(0);
        });
      })
      .then(() => {
        return GroupModel.esSearch({
          query: {
            nested: {
              path: 'user',
              query: {
                bool: {
                  must: [
                    { match: { 'user.first': 'Alice' } },
                    { match: { 'user.last': 'White' } },
                  ],
                },
              },
            },
          },
        }).then(result => {
          expect(result.hits.total.value).to.eql(1);
          expect(result.hits.hits[0]._source).to.eql({
            group: 'fans',
            user: [
              {
                first: 'John',
                last: 'Smith',
              },
              {
                first: 'Alice',
                last: 'White',
              },
            ],
          });
        });
      });
  });

  it('should handle es_type as "schema"', () => {
    let user;
    let city;
    let company;

    const TagSchema = new mongoose.Schema({
      value: String,
    });

    const CitySchema = new mongoose.Schema({
      name: String,
      tags: [TagSchema],
    });

    const CompanySchema = new mongoose.Schema({
      name: String,
      city: { type: mongoose.Schema.Types.ObjectId, ref: 'City' },
    });

    const UserSchema = new mongoose.Schema({
      first: String,
      last: String,
      company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        es_type: {
          _id: {
            es_type: 'text',
          },
          name: {
            es_type: 'text',
          },
          city: {
            es_type: {
              _id: {
                es_type: 'text',
              },
              name: {
                es_type: 'text',
              },
              tags: {
                es_type: {
                  value: {
                    es_type: 'text',
                  },
                },
              },
            },
          },
        },
      },
    });

    UserSchema.plugin(plugin);

    const TagModel = mongoose.model('Tag', TagSchema);
    const UserModel = mongoose.model('User', UserSchema);
    const CompanyModel = mongoose.model('Company', CompanySchema);
    const CityModel = mongoose.model('City', CitySchema);

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        const options = UserModel.esOptions();
        return options.client.indices.getMapping({
          include_type_name: true,
          index: options.index,
          type: options.type,
        });
      })
      .then(({ body }) => {
        const properties = body.users.mappings.user.properties;
        expect(properties).to.have.all.keys('first', 'last', 'company');
        expect(properties.first.type).to.be.equal('text');
        expect(properties.last.type).to.be.equal('text');
        expect(properties.company.properties).to.have.all.keys(
          '_id',
          'name',
          'city'
        );
        expect(properties.company.properties._id.type).to.be.equal('text');
        expect(properties.company.properties.name.type).to.be.equal('text');
        expect(properties.company.properties.city.properties).to.have.all.keys(
          '_id',
          'name',
          'tags'
        );
        expect(
          properties.company.properties.city.properties._id.type
        ).to.be.equal('text');
        expect(
          properties.company.properties.city.properties.name.type
        ).to.be.equal('text');
        expect(
          properties.company.properties.city.properties.tags.properties
        ).to.have.all.keys('value');
        expect(
          properties.company.properties.city.properties.tags.properties.value
            .type
        ).to.be.equal('text');
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const tag1 = new TagModel({
            value: 'nice',
          });
          const tag2 = new TagModel({
            value: 'cool',
          });

          city = new CityModel({
            name: 'Poitiers',
            tags: [tag1, tag2],
          });

          company = new CompanyModel({
            name: 'Futuroscope',
            city,
          });

          user = new UserModel({
            first: 'Maurice',
            last: 'Moss',
            company,
          });

          user.on('es-indexed', () => {
            resolve();
          });

          user.save();
        });
      })
      .then(() => {
        return UserModel.esRefresh();
      })
      .then(() => {
        return UserModel.esSearch({
          query: { match: { first: 'Maurice' } },
        });
      })
      .then(result => {
        expect(result.hits.total.value).to.eql(1);
        expect(result.hits.hits[0]._source).to.eql({
          first: 'Maurice',
          last: 'Moss',
          company: {
            _id: company._id.toString(),
            name: 'Futuroscope',
            city: {
              _id: city._id.toString(),
              name: 'Poitiers',
              tags: [{ value: 'nice' }, { value: 'cool' }],
            },
          },
        });
      });
  });

  it('should handle es_type as array of "schema"', () => {
    let user;
    let book1;
    let book2;

    const BookSchema = new mongoose.Schema({
      name: String,
    });

    const UserSchema = new mongoose.Schema({
      first: String,
      last: String,
      books: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Book',
          es_type: {
            _id: {
              es_type: 'text',
            },
            name: {
              es_type: 'text',
            },
          },
        },
      ],
    });

    UserSchema.plugin(plugin);

    const BookModel = mongoose.model('Book', BookSchema);
    const UserModel = mongoose.model('User', UserSchema);

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        const options = UserModel.esOptions();
        return options.client.indices.getMapping({
          include_type_name: true,
          index: options.index,
          type: options.type,
        });
      })
      .then(({ body }) => {
        const properties = body.users.mappings.user.properties;
        expect(properties).to.have.all.keys('first', 'last', 'books');
        expect(properties.first.type).to.be.equal('text');
        expect(properties.last.type).to.be.equal('text');
        expect(properties.books.properties).to.have.all.keys('_id', 'name');
        expect(properties.books.properties._id.type).to.be.equal('text');
        expect(properties.books.properties.name.type).to.be.equal('text');
      })
      .then(() => {
        return new utils.Promise(resolve => {
          book1 = new BookModel({
            name: 'The Jungle Book',
          });

          book2 = new BookModel({
            name: '1984',
          });

          user = new UserModel({
            first: 'Maurice',
            last: 'Moss',
            books: [book1, book2],
          });

          user.on('es-indexed', () => {
            resolve();
          });

          user.save();
        });
      })
      .then(() => {
        return UserModel.esRefresh();
      })
      .then(() => {
        return UserModel.esSearch({
          query: { query_string: { query: 'Jungle' } },
        });
      })
      .then(result => {
        expect(result.hits.total.value).to.eql(1);
        expect(result.hits.hits[0]._source).to.eql({
          first: 'Maurice',
          last: 'Moss',
          books: [
            {
              _id: book1._id.toString(),
              name: 'The Jungle Book',
            },
            {
              _id: book2._id.toString(),
              name: '1984',
            },
          ],
        });
      });
  });

  it('should not be blocked by a non populated "es_type schema"', () => {
    let user;
    let city;
    let company;

    const TagSchema = new mongoose.Schema({
      value: String,
    });

    const CitySchema = new mongoose.Schema({
      name: String,
      tags: [TagSchema],
    });

    const CompanySchema = new mongoose.Schema({
      name: String,
      city: { type: mongoose.Schema.Types.ObjectId, ref: 'City' },
    });

    const UserSchema = new mongoose.Schema({
      first: String,
      last: String,
      company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        es_type: {
          _id: {
            es_type: 'text',
          },
          name: {
            es_type: 'text',
          },
          city: {
            es_type: {
              _id: {
                es_type: 'text',
              },
              name: {
                es_type: 'text',
              },
              tags: {
                es_type: {
                  value: {
                    es_type: 'text',
                  },
                },
              },
            },
          },
        },
      },
    });

    UserSchema.plugin(plugin);

    const TagModel = mongoose.model('Tag', TagSchema);
    const UserModel = mongoose.model('User', UserSchema);
    const CompanyModel = mongoose.model('Company', CompanySchema);
    const CityModel = mongoose.model('City', CitySchema);

    return utils
      .deleteModelIndexes(UserModel)
      .then(() => {
        return UserModel.esCreateMapping();
      })
      .then(() => {
        return new utils.Promise(resolve => {
          const tag1 = new TagModel({
            value: 'nice',
          });
          const tag2 = new TagModel({
            value: 'cool',
          });

          city = new CityModel({
            name: 'Poitiers',
            tags: [tag1, tag2],
          });

          company = new CompanyModel({
            name: 'Futuroscope',
            city,
          });

          user = new UserModel({
            first: 'Maurice',
            last: 'Moss',
            company: company._id,
          });

          user.on('es-indexed', () => {
            resolve();
          });

          user.save();
        });
      })
      .then(() => {
        return UserModel.esRefresh();
      })
      .then(() => {
        return UserModel.esSearch({
          query: { match: { first: 'Maurice' } },
        });
      })
      .then(result => {
        expect(result.hits.total.value).to.eql(1);
        expect(result.hits.hits[0]._source).to.eql({
          first: 'Maurice',
          last: 'Moss',
          company: { _id: company.id },
        });
      });
  });
});
