const express = require('express');
const bodyParser = require('body-parser');
const graphqlHttp = require('express-graphql');
const { buildSchema } = require('graphql');
const mongoose = require('mongoose');
const DataLoader = require('dataloader');

const Cosmonaut = require('./models/cosmonaut');
const Superpower = require('./models/superpower');

const app = express();

app.use(bodyParser.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const superpowerLoader = new DataLoader((superpowerIds) => {
    return Superpower.find({ _id: { $in: superpowerIds } });
});

const populateCosmonauts = async cosmonautIds => {
    try {
        const fetchedCosmonauts = await Cosmonaut.find({ _id: { $in: cosmonautIds } });
        return fetchedCosmonauts.map(cosmonaut => {
            return transformCosmonaut(cosmonaut);
        });
    }
    catch (err) {
        throw err;
    }
};

const populateSuperpower = async superpower => {
    if (superpower) {
        try {
            const fetchedSuperpower = await superpowerLoader.load(superpower._id.toString());
            return transformSuperpower(fetchedSuperpower);
        }
        catch (err) {
            throw err;
        }
    }
};

const transformCosmonaut = cosmonaut => {
    return {
        ...cosmonaut._doc, _id: cosmonaut.id,
        birthday: new Date(cosmonaut._doc.birthday).toISOString(),
        superpower: populateSuperpower.bind(this, cosmonaut.superpower)
    }

}

const transformSuperpower = superpower => {
    return {
        ...superpower._doc,
        _id: superpower.id,
        users: populateCosmonauts.bind(this, superpower.users)
    };
}

app.use(
    '/graphql',
    graphqlHttp({
        schema: buildSchema(`
        type Cosmonaut {
            _id: ID!
            firstname: String!
            lastname: String!
            birthday: String!
            superpower: Superpower
        }
        input InputCosmonaut {
            firstname: String!
            lastname: String!
            birthday: String!
            superpower: ID
        }
        type Superpower {
            _id: ID!
            name: String!
            users: [Cosmonaut!]
        }
        input InputSuperpower {
            name: String!
        }
        type RootQuery {
            cosmonauts: [Cosmonaut!]!
            superpowers: [Superpower!]!
        }
        type RootMutation {
            createCosmonaut(inputCosmonaut: InputCosmonaut): Cosmonaut
            modifyCosmonaut(cosmonautId: ID!, inputCosmonaut: InputCosmonaut): Cosmonaut
            removeCosmonaut(cosmonautId: ID!): Cosmonaut
            createSuperpower(inputSuperpower: InputSuperpower): Superpower
            modifySuperpower(superpowerId: ID!, inputSuperpower: InputSuperpower): Superpower
            removeSuperpower(superpowerId: ID!): Superpower
        }
        schema {
            query: RootQuery
            mutation: RootMutation
        }
    `),
        rootValue: {
            cosmonauts: async () => {
                try {
                    const cosmonauts = await Cosmonaut.find();
                    return cosmonauts.map(cosmonaut => {
                        return transformCosmonaut(cosmonaut);
                    });
                }
                catch (err) {
                    throw err;
                }
            },
            createCosmonaut: async (args) => {
                try {
                    let superpower = null;
                    if (args.inputCosmonaut.superpower)
                        superpower = await superpowerLoader.load(args.inputCosmonaut.superpower);
                    const cosmonaut = new Cosmonaut({
                        firstname: args.inputCosmonaut.firstname,
                        lastname: args.inputCosmonaut.lastname,
                        birthday: new Date(args.inputCosmonaut.birthday),
                        superpower: superpower
                    });
                    const res = await cosmonaut.save();
                    if (superpower) {
                        superpower.users.push(res);
                        await superpower.save();
                    }
                    return transformCosmonaut(res);
                }
                catch (err) {
                    throw err;
                }
            },
            modifyCosmonaut: async (args) => {
                try {
                    const cosmonaut = await Cosmonaut.findOne({ _id: args.cosmonautId });
                    let superpower = null;
                    if (!cosmonaut.superpower || (cosmonaut.superpower._id !== args.inputCosmonaut.superpower)) {
                        if (cosmonaut.superpower)
                            await Superpower.findOneAndUpdate({ _id: cosmonaut.superpower }, { $pull: { users: args.cosmonautId } });
                        if (args.inputCosmonaut.superpower) {
                            superpower = await superpowerLoader.load(args.inputCosmonaut.superpower);
                            superpower.users.push(cosmonaut);
                            await superpower.save();
                        }
                    }
                    else
                        superpower = cosmonaut.superpower;
                    cosmonaut.firstname = args.inputCosmonaut.firstname;
                    cosmonaut.lastname = args.inputCosmonaut.lastname;
                    cosmonaut.birthday = new Date(args.inputCosmonaut.birthday);
                    cosmonaut.superpower = superpower;
                    await cosmonaut.save();
                    return transformCosmonaut(cosmonaut);
                }
                catch (err) {
                    throw err;
                }
            },
            removeCosmonaut: async (args) => {
                try {
                    await Superpower.updateMany({}, { $pull: { users: args.cosmonautId } });
                    const removedCosmonaut = await Cosmonaut.findOneAndDelete({ _id: args.cosmonautId });
                    return await transformCosmonaut(removedCosmonaut);
                }
                catch (err) {
                    throw err;
                }
            },
            superpowers: async () => {
                try {
                    const superpowers = await Superpower.find();
                    return superpowers.map(superpower => {
                        return transformSuperpower(superpower);
                    });
                }
                catch (err) {
                    throw err;
                }
            },
            createSuperpower: async (args) => {
                const superpower = new Superpower({
                    name: args.inputSuperpower.name
                });
                try {
                    const res = await superpower.save();
                    return transformSuperpower(res);
                }
                catch (err) {
                    throw err;
                }
            },
            modifySuperpower: async (args) => {
                try {
                    const superpower = transformSuperpower(await Superpower.findOneAndUpdate({ _id: args.superpowerId }, {
                        $set: { name: args.inputSuperpower.name }
                    }, { new: true }));
                    superpowerLoader.clear(args.superpowerId);
                    return superpower;
                }
                catch (err) {
                    throw err;
                }
            },
            removeSuperpower: async (args) => {
                try {
                    await Cosmonaut.updateMany({ superpower: args.superpowerId }, { superpower: null })
                    const removedSuperpower = await Superpower.findOneAndDelete({ _id: args.superpowerId });
                    return await transformSuperpower(removedSuperpower);
                }
                catch (err) {
                    throw err;
                }
            }
        },
        graphiql: true
    })
);


mongoose
    .connect(
        `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@asuba-cluster-b3ayd.mongodb.net/${process.env.MONGO_DB}?retryWrites=true`
    )
    .then(() => {
        app.listen(8000);
    })
    .catch(err => {
        console.log(err);
    });