if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const { Api, TelegramClient } = require("telegram");
const { _parseMessageText } = require("telegram/client/messageParse");
const { StringSession } = require("telegram/sessions");
const input = require('input');
const stringSession = new StringSession(process.env.SESSION);
const api_Id = Number.parseInt(process.env.API_ID);
const { allowedChannels, fromAllToOneChannel } = require("./config")
const mongoose = require('mongoose');
const Message = require('./models/message');
const { deleteMessages } = require("telegram/client/messages");
const mongodb_url = process.env.MONGODB_URI;
const store = require("store2");

console.log("Loading interactive example...");
const client = new TelegramClient(stringSession, api_Id, process.env.API_HASH, {
    connectionRetries: 5,
});

(async () => {


    await client.start({
        phoneNumber: async () => await input.text("Please enter your number: "),
        password: async () => await input.text("Please enter your password: "),
        phoneCode: async () =>
            await input.text("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });
    console.log("You should now be connected.");
    // client.setParseMode("html");
    //console.log(client.session.save()); // Save this string to avoid logging in again



    client.addEventHandler(async (update) => {
        // if (update.className === "UpdateNewChannelMessage" || update.className === "UpdateEditChannelMessage") {
        //     console.log("\n----------\n", update);
        // }
        var d = new Date();
        var n = d.toLocaleTimeString();
        console.log("----------------------\nsomething recived! " + n);
        try {
            if (update.className === "UpdateNewChannelMessage") {
                const { message } = update;
                const from_channel_id = message.peerId.channelId;
                const from_message_id = message.id;
                console.log(`new message from ${from_channel_id}`)
                for (const channel of allowedChannels) {

                    if (channel.from_channel_id !== from_channel_id.toString()) {
                        continue;
                    }
                    const { canForward } = channel;
                    const { from_access_hash, to_channel_id, to_access_hash } = channel;
                    //const newMessage = new Message({ from_channel_id, from_message_id });
                    if (/*canForward*/ false) {
                        if (message.media?.className === "MessageMediaPhoto" && message.replyTo) {
                            let { media } = message;
                            const captionText = message.message;
                            let to_message_id;
                            if (message.replyTo) {
                                const { replyToMsgId } = message.replyTo;
                                const findedMessage = await Message.findOne({ $and: [{ from_channel_id }, { from_message_id: replyToMsgId }] });
                                if (findedMessage) {
                                    ({ to_message_id } = findedMessage);
                                }
                            }
                            let result = {};
                            await getPhotoAndSend(media, to_channel_id, to_access_hash, captionText, to_message_id, result);   // result -> object pass by ref!
                            newMessage.to_message_id = result.details.updates[0].id
                        }
                        else if (message.media || !message.replyTo) {
                            const result = await forwardFromChannelToChannel(from_channel_id, from_access_hash, from_message_id, to_channel_id, to_access_hash);
                            newMessage.to_message_id = result.updates[0].id

                        }
                        else if (message.replyTo) {
                            const messageText = message.message;
                            const { replyToMsgId } = message.replyTo;
                            const findedMessage = await Message.findOne({ $and: [{ from_channel_id }, { from_message_id: replyToMsgId }] });
                            let result;

                            if (findedMessage) {
                                const { to_message_id } = findedMessage;
                                result = await sendMessageToChannel(to_channel_id, to_access_hash, messageText, to_message_id)
                            } else {
                                result = await forwardFromChannelToChannel(from_channel_id, from_access_hash, from_message_id, to_channel_id, to_access_hash);
                            }
                            newMessage.to_message_id = result.updates[0].id
                        }
                    } else {   // not access to forward!
                        if (/*message.media*/ false) { // can't forward but have photo !
                            let { media } = message;

                            if (media.className === "MessageMediaPhoto") {
                                const captionText = message.message;
                                let to_message_id;
                                if (message.replyTo) {
                                    const { replyToMsgId } = message.replyTo;
                                    const findedMessage = await Message.findOne({ $and: [{ from_channel_id }, { from_message_id: replyToMsgId }] });
                                    if (findedMessage) {
                                        ({ to_message_id } = findedMessage);
                                    }
                                }
                                let result = {};
                                await getPhotoAndSend(media, to_channel_id, to_access_hash, captionText, to_message_id, result);   // result -> object pass by ref!
                                newMessage.to_message_id = result.details.updates[0].id
                            } else {
                                return;  // if the message has file video sticker don't continue
                            }
                        } else {   // only message!  with or without reply
                            const links = [];
                            if (message.replyMarkup) {
                                for (const row of message.replyMarkup.rows) {
                                    for (const button of row.buttons) {
                                        if (button.className === "KeyboardButtonUrl" && checkMTProtoLink(button.url) && !links.includes(button.url)) {

                                            links.push(button.url);
                                        }
                                    }
                                }
                            }

                            if (message.entities) {
                                for (const entity of message.entities) {
                                    if (entity.className === 'MessageEntityTextUrl' && checkMTProtoLink(entity.url) && !links.includes(entity.url)) {
                                        links.push(entity.url);
                                    }
                                }
                            }


                            if (links.length <= 0) {
                                console.log("dont have any link! for new sending ");
                                return;
                            }

                            const proxyJson = store("proxy");

                            if (proxyJson) {
                                const oldProxies = JSON.parse(proxyJson);
                                const Allproxies = [...new Set([...oldProxies, ...links])];   // merge two arrays and remove dublicate
                                store("proxy", JSON.stringify(Allproxies))
                            } else {
                                store("proxy", JSON.stringify(links))
                            }

                            console.log(`${links.length} is stored now ! \nAll proxies till now are ${JSON.parse(store("proxy")).length}\n------------------`)

                            //const messageText = message.message;
                            // let to_message_id;
                            // if (message.replyTo) {
                            //     const { replyToMsgId } = message.replyTo;
                            //     const findedMessage = await Message.findOne({ $and: [{ from_channel_id }, { from_message_id: replyToMsgId }] });
                            //     if (findedMessage) {
                            //         ({ to_message_id } = findedMessage);
                            //     }
                            // }
                            //const result = await sendMessageToChannel(to_channel_id, to_access_hash, links, to_message_id)
                            // newMessage.to_message_id = result.updates[0].id
                        }
                    }

                    //await newMessage.save();

                }
            } else if (update.className === "UpdateEditChannelMessage") {
                // if (update.message.editHide) {
                //     console.log("EditHideWorks!")
                //     return;
                // }
                const { message } = update;
                const from_channel_id = message.peerId.channelId;
                const from_message_id = message.id;
                console.log(`edited message from ${from_channel_id}`)
                for (const channel of allowedChannels) {

                    if (channel.from_channel_id !== from_channel_id.toString()) {
                        continue;
                    }
                    const links = [];
                    if (message.replyMarkup) {
                        for (const row of message.replyMarkup.rows) {
                            for (const button of row.buttons) {
                                if (button.className === "KeyboardButtonUrl" && checkMTProtoLink(button.url) && !links.includes(button.url)) {

                                    links.push(button.url);
                                }
                            }
                        }
                    }

                    if (message.entities) {
                        for (const entity of message.entities) {
                            if (entity.className === 'MessageEntityTextUrl' && checkMTProtoLink(entity.url) && !links.includes(entity.url)) {
                                links.push(entity.url);
                            }
                        }
                    }


                    if (links.length <= 0) {
                        console.log("dont have any link to ! for editing ");
                        return;
                    }

                    const proxyJson = store("proxy");

                    if (proxyJson) {
                        const oldProxies = JSON.parse(proxyJson);
                        const Allproxies = [...new Set([...oldProxies, ...links])];   // merge two arrays and remove dublicate
                        store("proxy", JSON.stringify(Allproxies))
                    } else {
                        store("proxy", JSON.stringify(links))
                    }

                    console.log(`${links.length} is stored now by editing ! \nAll proxies till now are ${JSON.parse(store("proxy")).length}\n------------------`)


                    // const { canForward } = channel;

                    // const { from_access_hash, to_channel_id, to_access_hash } = channel;
                    // const findedMessage = await Message.findOne({ $and: [{ from_channel_id }, { from_message_id }] });
                    // if (findedMessage) {
                    //     const { to_message_id } = findedMessage;
                    //     const messageText = "\u{203C}This message **edited** to👇"
                    //     if (/*canForward*/false) {
                    //         await sendMessageToChannel(to_channel_id, to_access_hash, messageText, to_message_id)
                    //         await forwardFromChannelToChannel(from_channel_id, from_access_hash, from_message_id, to_channel_id, to_access_hash);
                    //     } else {
                    //         if (/*message.media*/ false) { // can't forward but have photo !
                    //             let { media } = message;
                    //             if (media.className === "MessageMediaPhoto") {
                    //                 await sendMessageToChannel(to_channel_id, to_access_hash, messageText, to_message_id)
                    //                 const captionText = message.message;
                    //                 let reply;
                    //                 let result = {};
                    //                 await getPhotoAndSend(media, to_channel_id, to_access_hash, captionText, reply, result);   // result -> object pass by ref!
                    //             }
                    //         } else {   // only message!  with or without reply

                    //             const links = [];
                    //             if (message.replyMarkup) {
                    //                 for (const row of message.replyMarkup.rows) {
                    //                     for (const button of row.buttons) {
                    //                         if (button.className === "KeyboardButtonUrl" && checkMTProtoLink(button.url) && !links.includes(button.url)) {

                    //                             links.push(button.url);
                    //                         }
                    //                     }
                    //                 }
                    //             }

                    //             if (message.entities) {

                    //                 for (const entity of message.entities) {
                    //                     if (entity.className === 'MessageEntityTextUrl' && checkMTProtoLink(entity.url) && !links.includes(entity.url)) {
                    //                         links.push(entity.url);
                    //                     }
                    //                 }
                    //             }


                    //             if (links.length <= 0) {
                    //                 console.log("dont have any link! for new editing ");
                    //                 return;
                    //             }

                    //             // await sendMessageToChannel(to_channel_id, to_access_hash, messageText, to_message_id)
                    //             // const EditedText = message.message;
                    //             // let reply;
                    //             // await sendMessageToChannel(to_channel_id, to_access_hash, EditedText, reply)
                    //             await editChannelMassage(to_channel_id, to_access_hash, links, to_message_id)
                    //         }
                    //     }
                    // }

                }

            } else if (update.className === "UpdateDeleteChannelMessages") {
                return;
                const from_channel_id = update.channelId;
                const from_message_ids = update.messages;
                console.log(`deleted message from ${from_channel_id}`)
                for (const channel of allowedChannels) {
                    if (channel.from_channel_id !== from_channel_id.toString()) {
                        continue;
                    }

                    const { to_channel_id, to_access_hash } = channel;
                    for (const from_message_id of from_message_ids) {
                        const findedMessage = await Message.findOne({ $and: [{ from_channel_id }, { from_message_id }] });
                        if (findedMessage) {
                            const { to_message_id } = findedMessage;
                            await deleteChannelMessage(to_channel_id, to_access_hash, to_message_id);
                            // const messageText = "⛔️This message **deleted** from reference channel"
                            // await sendMessageToChannel(to_channel_id, to_access_hash, messageText, to_message_id)
                        }
                    }
                    await Message.deleteMany({ $and: [{ from_channel_id }, { from_message_id: { $in: from_message_ids } }] });

                }
            }
        } catch (error) {
            console.log(error);
        }
    });

})();

// call every 30 min at 15 or 45 mins

var nextDate = new Date();
const currentMin = nextDate.getMinutes();
if (currentMin === 15 || currentMin === 45) { // You can check for seconds here too
    callEveryHalfHour()
} else if (currentMin < 15) {
    nextDate.setMinutes(15);
} else if (currentMin > 15 && currentMin < 45) {
    nextDate.setMinutes(45);
}
else {
    nextDate.setHours(nextDate.getHours() + 1);
    nextDate.setMinutes(15);
}
nextDate.setSeconds(0);

const difference = nextDate - new Date();
setTimeout(callEveryHalfHour, difference);
console.log(`diffrence is ${difference}`)
//setInterval(callEveryHalfHour, 60000);
async function callEveryHalfHour() {
    setTimeout(callEveryHalfHour, 1000 * 30 * 60);
    //const newMessage = new Message({ from_channel_id, from_message_id });
    const proxiesTillNow = JSON.parse(store("proxy"))
    if (proxiesTillNow) {
        const { to_channel_id, to_access_hash } = fromAllToOneChannel
        let to_message_id;
        const result = await sendMessageToChannel(to_channel_id, to_access_hash, proxiesTillNow, to_message_id)
        store(false)  // clear 
        console.log(`store is now : ${store("proxy")}`)
        // newMessage.to_message_id = result.updates[0].id

        // await newMessage.save();
    } else {
        console.log("no proxy collected till now!")
    }
}


// call every 30 min at 15 or 45 mins



async function deleteChannelMessage(to_channel_id, to_access_hash, messageId) {
    try {
        console.log(`message deleted in ${to_channel_id}`)
        const deleteMessagIds = [];
        deleteMessagIds.push(+messageId);  // first parsInt then ...
        return await client.invoke(
            new Api.channels.DeleteMessages({
                channel: new Api.InputChannel({
                    channelId: to_channel_id,
                    accessHash: to_access_hash
                }),
                id: deleteMessagIds
            })
        )

    } catch (error) {
        throw error
    }
}


mongoose.connect(mongodb_url, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("MONGO CONNECTION OPEN")
    })
    .catch(err => {
        console.log("MONGO CONNECTION ERROR!!!!")
        console.log(err)
    })


async function forwardFromChannelToChannel(from_channel_id, from_access_hash, from_message_id, to_channel_id, to_access_hash) {
    try {
        return await client.invoke(
            new Api.messages.ForwardMessages({
                fromPeer: new Api.InputChannel({ channelId: from_channel_id, accessHash: from_access_hash }),
                id: [from_message_id],
                toPeer: new Api.InputChannel({ channelId: to_channel_id, accessHash: to_access_hash }),
                dropAuthor: true,
                randomId: [Math.ceil(Math.random() * 0xffffff) + Math.ceil(Math.random() * 0xffffff)],
            })
        );

    } catch (error) {
        throw error;
    }

}

async function sendMessageToChannel(to_channel_id, to_access_hash, links, replyToMsgId) {
    try {
        const proxyText = "پروکسی | "
        let messageText = "";
        const entities = [];
        for (let i = 0; i < links.length; i++) {
            messageText += proxyText;

            entities.push(
                new Api.MessageEntityTextUrl({
                    offset: i * (proxyText.length),
                    length: proxyText.length - 2,
                    url: links[i]
                })
            )

        }
        messageText += "\n\n🥀@TProtoProxy"
        console.log(`message sent To ${to_channel_id}`)
        //const [text, entities] = await _parseMessageText(client, messageText, "markdown") // we use this so that can use bold ** markdown
        return await client.invoke(
            new Api.messages.SendMessage({
                peer: new Api.InputPeerChannel({ channelId: to_channel_id, accessHash: to_access_hash }),
                message: messageText,
                replyToMsgId,
                entities,
                randomId: Math.ceil(Math.random() * 0xffffff) + Math.ceil(Math.random() * 0xffffff),
            })
        )

    } catch (error) {
        throw error
    }
}
async function editChannelMassage(to_channel_id, to_access_hash, links, messageId) {
    try {
        const proxyText = "پروکسی | "
        let messageText = "";
        const entities = [];
        for (let i = 0; i < links.length; i++) {
            messageText += proxyText;

            entities.push(
                new Api.MessageEntityTextUrl({
                    offset: i * (proxyText.length),
                    length: proxyText.length - 2,
                    url: links[i]
                })
            )

        }
        messageText += "\n\n🥀@TProtoProxy"
        console.log(`message edited in ${to_channel_id}`)
        return await client.invoke(
            new Api.messages.EditMessage({
                clear_draft: true,
                peer: new Api.InputPeerChannel({ channelId: to_channel_id, accessHash: to_access_hash }),
                message: messageText,
                entities,
                id: +messageId  // cast to int .. 
            })
        )

    } catch (error) {
        if (error.code === 400) {   // MESSAGE_NOT_MODIFIED
            console.log("No message not edited bacause it is as same as before")
            return;
        }
        throw error
    }
}

async function getPhotoAndSend(media, to_channel_id, to_access_hash, captionText, replyToMsgId, result) {


    try {
        const file = await client.downloadFile(new Api.InputPhotoFileLocation({

            id: media.photo.id,
            accessHash: media.photo.accessHash,
            fileReference: media.photo.fileReference,
            thumbSize: "y",

        }), { dcId: media.photo.dcId })
        // const file = await client.invoke(
        //     new Api.upload.GetFile({

        //         location: new Api.InputPhotoFileLocation({

        //             id: media.photo.id,
        //             accessHash: media.photo.accessHash,
        //             fileReference: media.photo.fileReference,
        //             thumbSize: "y",

        //         }),
        //         offset: 0,
        //         limit: 1024 * 1024
        //     }, options))
        result.details = await sendMedia(file, to_channel_id, to_access_hash, captionText, replyToMsgId);

    } catch (error) {
        throw error

    }
}
async function sendMedia(imageBuffer, to_channel_id, to_access_hash, captionText, replyToMsgId) {


    try {
        const partsSizes = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288]
        let fileID = ''
        for (let i = 0; i < 19; ++i) fileID += Math.floor(Math.random() * 10)

        const imageSize = Buffer.byteLength(imageBuffer)
        const partMaxSize = imageSize >= partsSizes[partsSizes.length - 1] ? partsSizes.length - 1 : partsSizes.find(size => imageSize <= size)
        const chunks = Math.ceil(imageSize / partMaxSize)
        for (let i = 0; i < chunks; i++) {
            const partSize = i === chunks - 1 ? imageSize % partMaxSize : partMaxSize
            const part = imageBuffer.slice(i * partMaxSize, i * partMaxSize + partSize)

            await client.invoke(new Api.upload.SaveFilePart({ fileId: fileID, filePart: i, bytes: part }))
        }

        return await client.invoke(new Api.messages.SendMedia({
            media: new Api.InputMediaUploadedPhoto({
                file: new Api.InputFile({ id: fileID, parts: chunks, name: "teste.png", md5Checksum: '' })
            }),
            peer: new Api.InputPeerChannel({ channelId: to_channel_id, accessHash: to_access_hash }),
            message: captionText,
            replyToMsgId,
            randomId: Math.ceil(Math.random() * 0xffffff) + Math.ceil(Math.random() * 0xffffff),
        }))
    } catch (error) {
        throw error
    }
}

