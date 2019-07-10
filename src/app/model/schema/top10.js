var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var top10Schema = new Schema({
    top10Idx : String,
    top10Category: String,
    top10Name : String,
    playlistIdx : String,
    top10Thumbnail: String,
    checkTime : Date
},{
    versionKey: false // You should be aware of the outcome after set to false
});

module.exports = mongoose.model('top10', top10Schema);