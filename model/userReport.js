const mongoose = require('mongoose');
const { REPORT_TYPE } = require('../constants');

const { ObjectId } = mongoose.Types;

const userReportSchema = new mongoose.Schema(
  {
    time: Date,
    type: {
      type: String,
      enum: Object.values(REPORT_TYPE),
    },
    totalNewUsers: Number,
    totalSwitchUsers: Number,
    provider: {
      type: ObjectId,
      ref: 'Provider',
    },
    channel: {
      type: ObjectId,
      ref: 'Channel',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model('UserReport', userReportSchema);
