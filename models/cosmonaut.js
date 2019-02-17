const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const cosmonautSchema = new Schema({
    firstname: {
        type: String,
        required: true
    },
    lastname: {
        type: String,
        required: true
    },
    birthday: {
        type: Date,
        required: true
    },
    superpower: {
        type: Schema.Types.ObjectId,
        ref: 'Superpower'
    }
});

module.exports = mongoose.model('Cosmonaut', cosmonautSchema);