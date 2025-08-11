const mongoose = require('mongoose');

const savedQuerySchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    query: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    createdBy: {
        type: String,
        default: 'anonymous'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
},
{
    collection: 'savedQuery',
    _id: false
});

// Update the updatedAt field before saving
savedQuerySchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('SavedQuery', savedQuerySchema);