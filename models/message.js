const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({

    from_channel_id:{
        type:String,
        required:true
    },
    from_message_id:{
        type:String,
        required:true
    },
    to_message_id:{
        type:String,
    }

})

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;