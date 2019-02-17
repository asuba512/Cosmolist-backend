const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const superpowerSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    users: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Cosmonaut'
        }
    ]
});

module.exports = mongoose.model('Superpower', superpowerSchema);