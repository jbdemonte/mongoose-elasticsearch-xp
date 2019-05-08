'use strict';

const mongoose = require('mongoose');
const utils = require('../utils');
const plugin = require('../../').v7;

describe('with discriminators', () => {
  utils.setup();

  it('check types and mappings', () => {
    const BaseSchema = new mongoose.Schema({
      name: String,
    });

    const UserSchema = new mongoose.Schema({
      age: Number,
    });

    const AdminSchema = new mongoose.Schema({
      access: Boolean,
    });

    BaseSchema.plugin(plugin, {
      index: 'user',
      type: kind => {
        if (kind === 'User') return 'userType';
        if (kind === 'Admin') return 'adminType';
        return 'otherType';
      },
    });

    const BaseModel = mongoose.model('Base', BaseSchema);
    const UserModel = BaseModel.discriminator('User', UserSchema);
    const AdminModel = BaseModel.discriminator('Admin', AdminSchema);

    // check types and mappings on models
    const userOpts = UserModel.esOptions();
    const adminOpts = AdminModel.esOptions();
    expect(userOpts.type).to.equal('userType');
    expect(adminOpts.type).to.equal('adminType');
    expect(userOpts.mapping).to.deep.equal({
      properties: {
        __t: {
          type: 'text',
        },
        age: {
          type: 'long',
        },
        name: {
          type: 'text',
        },
      },
    });
    expect(adminOpts.mapping).to.deep.equal({
      properties: {
        __t: {
          type: 'text',
        },
        access: {
          type: 'boolean',
        },
        name: {
          type: 'text',
        },
      },
    });

    // check types and mappings on docs
    UserModel.create({
      name: 'John',
      age: 34,
    }).then(doc => {
      /**
       * These pass but the Elastic7 log say:
       * {"type": "server", "timestamp": "2019-05-08T15:09:00,289+0000", "level": "DEBUG", "component": "o.e.a.b.TransportShardBulkAction", "cluster.name": "elasticsearch_xp", "node.name": "es01", "cluster.uuid": "_g29fS-XRXCCEnkZWlr66A", "node.id": "DhuxhmaORjq7rYNNCHh_fQ",  "message": "[user][0] failed to execute bulk item (index) index {[user][userType][5cd2f10ce12850a22363f951], source[{\"age\":34,\"name\":\"John\",\"__t\":\"User\"}]}" ,
       * "stacktrace": ["java.lang.IllegalArgumentException: Rejecting mapping update to [user] as the final mapping would have more than 1 type: [adminType, userType]",
       */
      const opts = doc.esOptions();
      expect(opts.type).to.equal('userType');
      expect(opts.mapping).to.deep.equal({
        properties: {
          __t: {
            type: 'text',
          },
          age: {
            type: 'long',
          },
          name: {
            type: 'text',
          },
        },
      });
    });

    AdminModel.create({
      name: 'Steve',
      access: true,
    }).then(doc => {
      const opts = doc.esOptions();
      expect(opts.type).to.equal('adminType');
      expect(opts.mapping).to.deep.equal({
        properties: {
          __t: {
            type: 'text',
          },
          access: {
            type: 'boolean',
          },
          name: {
            type: 'text',
          },
        },
      });
    });
  });
});
