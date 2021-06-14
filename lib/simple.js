__path = process.cwd()

var _ = require('lodash')
const fs = require('fs')
const util = require('util')
const path = require('path')
const FileType = require('file-type')
const fetch = require('node-fetch')
const { spawn, exec } = require('child_process')
const { MessageType, GroupSettingChange, ChatModification } = require('@adiwajshing/baileys')
var { msgFilter } = require(process.cwd() + '/lib/msgFilter')

const needle = require('needle')
const imageToBase64 = require('image-to-base64')

var Exif = require(process.cwd() + '/lib/exif.js')
var exif = new Exif()

const moment = require("moment-timezone")
const ffmpeg = require('fluent-ffmpeg')
const time = moment().tz('Asia/Jakarta').format("HH:mm:ss")

var stickerWm2 = require(__path + '/lib/stcwm.js')

exports.WAConnection = (_WAConnection) => {
    class WAConnection extends _WAConnection {
        constructor(...args) {
            super(...args)
            this.logger.level = 'debug';
            this.setMaxListeners(0)

            this.battery = []

            this.on (`CB:action,,battery`, json => {
                this.battery = { ...json[2][0][1] }
            })

            this.on('CB:Call', json => {
                let callId = json[1]['from']
                this.emit('call-id', { from: callId })
            })

            this.on('group-participants-update', async m => {
                switch (m.action) {
                    case 'add':
                        let addbot = m.participants[0] === this.user.jid ?? false
                        let groupdata = await this.groupMetadata(m.jid)
                        if (addbot)
                            this.emit('add-bot', { ids: m.jid, subject: groupdata.subject })
                        break
                    case 'remove':
                        let removebot = m.participants[0] === this.user.jid ?? false
                        if (removebot)
                            await this.modifyChat(m.jid, ChatModification.delete)
                        this.logger.info(`process deleting chat ${m.jid} ...`)
                        break
                    default:
                        break
                }
            })

            if (!Array.isArray(this._events['CB:action,add:relay,message'])) this._events['CB:action,add:relay,message'] = [this._events['CB:action,add:relay,message']]
            else this._events['CB:action,add:relay,message'] = [this._events['CB:action,add:relay,message'].pop()]

            this._events['CB:action,add:relay,message'].unshift(async function (json) {
                try {
                    let m = json[2][0][2]
                    if (m.message && m.message.protocolMessage && m.message.protocolMessage.type == 0) {
                        let key = m.message.protocolMessage.key
                        let c = this.chats.get(key.remoteJid)
                        let a = c.messages.dict[`${key.id}|${key.fromMe ? 1 : 0}`]
                        let participant = key.fromMe ? this.user.jid : a.participant ? a.participant : key.remoteJid
                        let WAMSG = a.constructor
                        this.emit('message-delete', { key, participant, message: WAMSG.fromObject(WAMSG.toObject(a)) })
                    }
                } catch (e) { }
            })
        }

        async copyNForward(jid, message, idk = false, options = {}) {
            let mtype = Object.keys(message.message)[0]
            let content = await this.generateForwardMessageContent(message, idk)
            let ctype = Object.keys(content)[0]
            let context = {}
            if (mtype != MessageType.text) context = message.message[mtype].contextInfo
            content[ctype].contextInfo = {
                ...context,
                ...content[ctype].contextInfo
            }
            const waMessage = await this.prepareMessageFromContent(jid, content, options)
            await this.relayWAMessage(waMessage)
            return waMessage
        }

        async sendCMod(jid, message, text, sender, options = {}) {
            let copy = await this.prepareMessageFromContent(jid, message, options)
            let mtype = Object.keys(message.message)[0]
            let msg = copy.message[mtype]
            if (typeof msg == 'string') copy.message[mtype] = text || msg
            else if (msg.text) msg.text = text || msg.text
            else if (msg.caption) msg.caption = text || msg.captipn

            if (copy.participant) sender = copy.participant = sender || copy.participant
            else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant

            copy.key.fromMe = sender === this.user.jid

            const waMessage = this.prepareMessageFromContent(jid, copy, options)
            await this.relayWAMessage(waMessage)
            return waMessage
        }

        battery() {
            return this.battery
        }

        waitEvent(eventName, is = () => true, maxTries = 25) {
            return new Promise((resolve, reject) => {
                let tries = 0
                let on = (...args) => {
                    if (++tries > maxTries) reject('Max tries reached')
                    else if (is()) {
                        this.off(eventName, on)
                        resolve(...args)
                    }
                }
                this.on(eventName, on)
            })
        }

        async sendFile(jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) {
            let file = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await fetch(path)).buffer() : fs.existsSync(path) ? fs.readFileSync(path) : typeof path === 'string' ? path : Buffer.alloc(0)
            const type = await FileType(file) || {
                mime: 'application/octet-stream',
                ext: '.bin'
            }
            if (!type) {
                if (!options.asDocument && typeof file === 'string' && path == file) return await this.sendMessage(jid, file, MessageType.extended, options)
                else options.asDocument = true
            }
            let mtype = ''
            let opt = { filename, caption }
            if (options.asSticker) {
                mtype = MessageType.sticker
                try { throw { json: JSON.parse(file) } }
                catch (e) { if (e.json) throw e }
            } else if (!options.asDocument) {
                if (/audio/.test(type.mime)) file = await (ptt ? toPTT : toAudio)(file, type.ext)
                else if (/video/.test(type.mime)) file = await toVideo(file, type.ext)

                if (/image/.test(type.mime)) mtype = MessageType.image
                else if (/video/.test(type.mime)) mtype = MessageType.video
                else opt.caption = filename

                if (/audio/.test(type.mime)) {
                    mtype = MessageType.audio
                    if (!ptt) opt.mimetype = 'audio/mp4'
                    opt.ptt = ptt
                } else if (/pdf/.test(type.ext)) mtype = MessageType.pdf
                else if (!mtype) {
                    mtype = MessageType.document
                    opt.mimetype = type.mime
                }
            } else {
                mtype = MessageType.document
                opt.mimetype = type.mime
            }

            delete options.asDocument
            delete options.asSticker

            if (quoted) opt.quoted = quoted
            if (!opt.caption) delete opt.caption
            return await this.sendMessage(jid, file, mtype, { ...opt, ...options })
        }

        reply(jid, text, quoted, options) {
            return Buffer.isBuffer(text) ? this.sendFile(jid, text, 'file', '', quoted, false, options) : this.sendMessage(jid, text, MessageType.extendedText, { quoted, ...options })
        }

        forwardMessage(f, t, type) {
            var options = {
                contextInfo: { forwardingScore: 1, isForwarded: true }
            }
            this.sendMessage(f, t, type, options)
        }

        fakeReply(f = '', t = '', tg) {
            var ehe = tg.startsWith('08') ? tg.replace(/08/, '628') : tg

            var options = {
                contextInfo: {
                    participant: ehe + '@s.whatsapp.net',
                    quotedMessage: {
                        extendedTextMessage: {
                            text: f
                        }
                    }
                }
            }
            this.sendMessage(f, `${t}`, MessageType.text, options)
        }

        reply2(f, t, m) {
            this.sendMessage(f, t, MessageType.text, { quoted: m })
        }

        sendText(f, t) {
            this.sendMessage(f, t, MessageType.text)
        }

        _batere() {
            this.on('CB:action,,battery', json => {
                let status = json[2][0][1]
                return status
            })
        }

        formatBytes(bytes, decimals = 2) {
            if (bytes === 0) return '0 Bytes';

            var k = 1024;
            var dm = decimals < 0 ? 0 : decimals;
            var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

            var i = Math.floor(Math.log(bytes) / Math.log(k));

            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        }

        getTimeProcess(format) {
            function pad(s) {
                return (s < 10 ? '0' : '') + s
            }
            var hours = Math.floor(format / (60 * 60));
            var minutes = Math.floor(format % (60 * 60) / 60);
            var seconds = Math.floor(format % 60);

            return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
        }

        sendVideoFromUrl(f, u, c = '', m) {
            var path = 'videos.mp4'
            var data = fs.createWriteStream(path)
            needle.get(u).pipe(data).on('finish', () => {
                var file = fs.readFileSync(path)
                this.sendMessage(f, file, MessageType.video, { quoted: m, caption: c })
            })
        }

        sendImageFromUrl(f, u, c = '', id) {
            imageToBase64(u)
                .then(data => {
                    var options = {
                        quoted: id,
                        caption: c
                    }
                    var buffer = Buffer.from(data, 'base64')
                    this.sendMessage(f, buffer, MessageType.image, options)
                })
        }

        /*sendStickerFromUrl(f, u, id) {

        }*/
        sendTtpAsSticker(f, t = 'ttp bro', m) {
            return new Promise((resolve, reject) => {
                var url = `https://api.areltiyan.site/sticker_maker?text=${t}`

                needle(url, async (err, resp, body) => {
                    try {
                        var namafile = 'pel.jpeg'
                        var namastc = 'pel'
                        var datas = body.base64.replace('data:image/png;base64,', '').toString('base64')

                        var imgN = `${moment().format('DDMMYYYYHHmmss')}.jpeg`
                        var stcN = `${moment().format('DDMMYYYYHHmmss')}.webp`

                        var webpName = `${f.split(/@/)[0]}.webp`
                        var packageName = 'aex-bot'
                        var packageAuthor = '@isywl_'
                        fs.writeFileSync(imgN, datas, 'base64')

                        ffmpeg(`./${imgN}`)
                            .input(imgN)
                            .on('start', function (cmd) {
                                console.log(`Started : ${cmd}`)
                            })
                            .on('error', function (err) {
                                console.log(`Error : ${err}`)
                            })
                            .on('end', function () {
                                var bufferstc = stickerWm2('./' + webpName, packageName, packageAuthor)
                                resolve(bufferstc)
                            })
                            .addOutputOptions([`-vcodec`, `libwebp`, `-vf`, `scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`])
                            .toFormat('webp')
                            .save(webpName)
                    } catch (err) {
                        throw err
                    }
                })
            })
        }

        sendStickerFromUrl(f, u, options = {}) {
            return new Promise((resolve, reject) => {
                needle(u, async (err, resp, body) => {
                    try {
                        var imgN = `${moment().format('DDMMYYYYHHmmss')}.jpeg`
                        var stcN = `${moment().format('DDMMYYYYHHmmss')}`

                        var webpName = `${f.split(/@/)[0]}.webp`
                        var packageName = 'aex-bot'
                        var packageAuthor = '@isywl_'

                        var bdata = body.toString('base64')

                        fs.writeFileSync(imgN, bdata, 'base64')

                        console.log(bdata)
                        console.log('uptime: ' + this.convertTime(process.uptime()))

                        var bufferu;
                        ffmpeg(`./${imgN}`)
                            .input(imgN)
                            .on('start', function (cmd) {
                                console.log(`Started : ${cmd}`)
                            })
                            .on('error', function (err) {
                                console.log(`Error : ${err}`)
                            })
                            .on('end', function () {
                                var bufferstc = stickerWm2('./' + webpName, packageName, packageAuthor)
                                resolve(bufferstc)
                            })
                            .addOutputOptions([`-vcodec`, `libwebp`, `-vf`, `scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`])
                            .toFormat('webp')
                            .save(webpName)
                    } catch (err) { console.log(err) }
                })
            })
        }

        setGroupToAdminsOnly(f, s) {
            this.groupSettingChange(f, GroupSettingChange.messageSend, s)
        }

        setSubject(f, t) {
            this.groupUpdateSubject(f, t)
        }

        setDescription(f, t) {
            this.groupUpdateDescription(f, t)
        }

        promoteParticipant(f, p) {
            this.groupMakeAdmin(f, p)
        }

        demoteParticipant(f, p) {
            this.groupDemoteAdmin(f, p)
        }

        addParticipant(f, p = []) {
            this.grupAdd(f, p)
        }

        removeParticipant(f, p = []) {
            this.groupRemove(f, p)
        }

        getGroupInviteLink(f) {
            this.getGroupInviteLink(f)
        }

        setGroupProfilePicture(f, i) {
            var buffer = fs.readFileSync('./' + i)
            this.updateProfilePicture(f, buffer)
        }

        setgcAntiLinkPush(f) {
            var is = antilink.includes(f) ?? false
            if (is) return
            fs.writeFileSync(__path + '/database/antilink.json', JSON.stringify(f))
        }

        setgcAntiLinkCheck(f, u, text, isadmin, isbotadmin) {
            return new Promise(async (resolve, reject) => {
                var is = await checkAntiLink(f)
                if (!is) return
                var regex = new RegExp("(http|https|ftp|ftps)\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,3}(\/\S*)?", 'g')
                if (!(regex.test(text))) return
                if (isadmin) return
                if (!(isbotadmin)) reject(`^anti link bot\n\n*error*: jadikan aku admin untuk memaksimalkan fitur ini.\n*reason*: menyebarkan link.`)
                //if (isadmin) 
                resolve(`^anti link bot\n\n*user*: @${u.split(/@/)[0]}\n*success*: aku telah menendangnya.\n*reason*: menyebarkan link.`)
                this.removeParticipant(f, [u])
            })
        }

        toJSON(json) {
            if (typeof json != 'object') return 'only object'

            return JSON.stringify(json, null, '\t')
        }

        getName(jid) {
            let v = jid === this.user.jid ? this.user : this.contacts[jid] || { notify: jid.replace(/@.+/, '') }
            return v.name || v.vname || v.notify || '~'
        }

        match(body, id, onDisabled = () => { }) {
            return (match, name) => {
                if (true || (name == '.' || name == '!' || name == '#')) {
                    if (match instanceof RegExp) {
                        return match.test(body)
                    } else if (Array.isArray(match)) {
                        return match.includes(body)
                    } else {
                        return match === body
                    }
                } else {
                    let reason = config.msg.notAllowed
                    return false
                }
            }
        }

        async downloadM(m) {
            if (!m) return Buffer.alloc(0)
            if (!m.message) m.message = { m }
            if (!m.message[Object.keys(m.message)[0]].url) await this.updateMediaMessage(m)
            return await this.downloadMediaMessage(m)
        }

        convertTime(sec) {
            var hours = Math.floor(sec / 3600);
            (hours >= 1) ? sec = sec - (hours * 3600) : hours = '00';
            var min = Math.floor(sec / 60);
            (min >= 1) ? sec = sec - (min * 60) : min = '00';
            (sec < 1) ? sec = '00' : void 0;

            (min.toString().length == 1) ? min = '0' + min : void 0;
            (sec.toString().length == 1) ? sec = '0' + sec : void 0;

            return hours + ':' + min + ':' + sec;
        }

        async resend(f, id) {
            let message = await this.loadMessage(f, id)
            this.copyNForward(f, message, true)
        }

        fakeWhatsappReply(from, type, path = 'aex.jpg', isStatus = false, text1, text2) {
            switch (type) {
                case 'text':
                    switch (isStatus) {
                        case true:
                            var options = {
                                contextInfo: {
                                    participant: '0@s.whatsapp.net',
                                    quotedMessage: {
                                        extendedTextMessage: {
                                            text: text1
                                        }
                                    },
                                    remoteJid: 'status@broadcast'
                                }
                            }
                            this.sendMessage(from, text2, MessageType.text, options)
                            break
                        default:
                            var options = {
                                contextInfo: {
                                    participant: '0@s.whatsapp.net',
                                    quotedMessage: {
                                        extendedTextMessage: {
                                            text: text1
                                        }
                                    }
                                }
                            }
                            this.sendMessage(from, text2, MessageType.text, options)
                            break
                    }
                    break
                case 'image':
                    switch (isStatus) {
                        case true:
                            var options = {
                                contextInfo: {
                                    participant: '0@s.whatsapp.net',
                                    quotedMessage: {
                                        "imageMessage": {
                                            "mimetype": 'image/jpeg',
                                            "caption": text1,
                                            "width": 720,
                                            "height": 720,
                                            "jpegThumbnail": fs.readFileSync(path, 'base64')
                                        }
                                    },
                                    remoteJid: 'status@broadcast'
                                }
                            }
                            this.sendMessage(from, text2, MessageType.text, options)
                            break
                        default:
                            var options = {
                                contextInfo: {
                                    participant: '0@s.whatsapp.net',
                                    quotedMessage: {
                                        "imageMessage": {
                                            "mimetype": 'image/jpeg',
                                            "caption": text1,
                                            "width": 720,
                                            "height": 720,
                                            "jpegThumbnail": fs.readFileSync(path, 'base64')
                                        }
                                    }
                                }
                            }
                            this.sendMessage(from, text2, MessageType.text, options)
                            break
                    }
                    break
                case 'ptt':
                    var options = {
                        contextInfo: {
                            participant: '0@s.whatsapp.net',
                            quotedMessage: {
                                "audioMessage": {
                                    "mimetype": 'audio/ogg; codecs=opus',
                                    "seconds": text1,
                                    "ptt": true,
                                }
                            }
                        }
                    }
                    this.sendMessage(from, text2, MessageType.text, options)
                    break
                default:
                    break
            }
        }

    }
    return WAConnection
}

exports.smsg = async (conn, m, hasParent) => {
    if (!m) return m

    if (m.key) {
        m.id = m.key.id
        m.isBaileys = m.id.startsWith('3EB0') && m.id.length === 12
        m.chat = m.key.remoteJid
        m.fromMe = m.key.fromMe
        m.sender = m.fromMe ? conn.user.jid : m.participant ? m.participant : m.key.participant ? m.key.participant : m.chat
        m.isGroup = m.chat.endsWith('@g.us')
        if (m.isGroup) {
            let gc = await conn.groupMetadata(m.chat)
            let { owner, subject, id, participants } = gc
            m.group = {}
            m.group.id = id
            m.group.owner = owner
            m.group.subject = subject
            m.group.admin = {
                bot: participants.filter(admin => admin.jid === conn.user.jid)[0].isAdmin,
                users: participants.filter(admin => admin.jid === m.sender)[0].isAdmin
            }
            m.group.count_user = participants.length
            m.group.count_admin = participants.filter(admin => admin.isAdmin).length
            
        }
        m.isOwner = m.sender === '6282299265151@s.whatsapp.net' ?? false
    }

    if (m.message) {
        m.mtype = Object.keys(m.message)[0]
        m.msg = m.message[m.mtype]
        if (m.mtype === 'ephemeralMessage') {
            exports.smsg(conn, m.msg)
            m.mtype = m.msg.mtype
            m.msg = m.msg.msg
        }
        m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null
        m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []
        if (m.quoted) {
            let type = Object.keys(m.quoted)[0]
            m.quoted = m.quoted[type]
            if (typeof m.quoted == 'string') m.quoted = { text: m.quoted }
            m.quoted.mtype = type
            m.quoted.id = m.msg.contextInfo.stanzaId
            m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith('3EB0') && m.quoted.id.length === 12 : false
            m.quoted.sender = m.msg.contextInfo.participant
            m.quoted.fromMe = m.quoted.sender == conn.user.jid
            m.quoted.text = m.quoted.text || m.quoted.caption || ''
            m.getQuotedObj = async () => {
                let q
                await conn.findMessage(m.chat, 25, s => {
                    q = s
                    return s.key ? m.quoted.id.includes(s.key.id) : false
                })
                return q ? exports.smsg(conn, q) : false
            }
            if (m.quoted.url) m.quoted.download = conn.downloadM({
                message: {
                    [m.quoted.mtype]: m.quoted
                }
            })
        }
        if (m.msg.url) m.download = conn.downloadM(m)
        m.text = m.msg.text || m.msg.caption || m.msg || ''
        m.reply = (text, chatId, options) => conn.reply(chatId ? chatId : m.chat, text, m, options)

        m.logging = {}
        if (m.logging) {
            m.logging.isNotSticker = 'reply stiker dengan caption: .toimg'
            m.logging.userIsNotAdmin = 'kamu bukan admin.'
            m.logging.botIsNotAdmin = 'Jadikan aex sebagai admin untuk memaksimalkan fitur group!'
            m.logging.isNotGroup = 'command ini hanya berlaku didalam group saja.'
            m.logging.isNotOwner = 'command khusus owner bot!'
            m.logging.isNotPremium = 'command khusus member premium ka!'
            m.logging.isUserLimitGame = 'sayangnya limit game kamu telah habis, silahkan tunggu esok untuk mendapatkan limit kembali.'
            m.logging.isSudahDaftar = 'nomor kamu sudah terdaftar di db! mohon untuk tidak melakukan spam!'
            m.logging.isNotDaftar = 'kamu belum terdaftar dalam db bot, ketik *.register* untuk pendaftaran pertama kamu!'
            m.logging.isNotUserDB = 'user tsb tidak terdaftar di database kami, harap untuk mendaftar terlebih dahulu untuk menggunakan command ini!'
            m.logging.active = '_semakin kamu aktif menggunakan bot ini, xp akan otomatis bertambah dengan sistem yang telah ditentukan._'
            m.logging.isUserLimit = 'limit kamu telah habis. Gunakan bot dengan bijak yah kak.Menjadi member premium akan membuat limit kamu tak terbatas lho!, cukup ketik *#daftarpremium* untuk info menjadi premium member!'
        }

        let mfrom = m.chat
        if (m.text === '#ping') conn.emit('bot-ping', { mfrom, m })
    }
}

function toAudio(buffer, ext) {
    return new Promise((resolve, reject) => {
        let tmp = path.join(process.cwd(), '/tmp', (new Date * 1) + '.' + ext)
        let out = tmp.replace(new RegExp(ext + '$'), 'mp3')
        fs.writeFileSync(tmp, buffer)
        spawn('ffmpeg', [
            '-y',
            '-i', tmp,
            '-vn',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100',
            '-f', 'mp3',
            out
        ])
            .on('error', reject)
            .on('error', () => fs.unlinkSync(tmp))
            .on('close', () => {
                //fs.unlinkSync(tmp)
                resolve(fs.readFileSync(out))
                if (fs.existsSync(out)) fs.unlinkSync(out)
            })
    })
}

function toPTT(buffer, ext) {
    return new Promise((resolve, reject) => {
        let tmp = path.join(process.cwd(), '/tmp', (new Date * 1) + '.' + ext)
        let out = tmp.replace(new RegExp(ext + '$'), 'opus')
        fs.writeFileSync(tmp, buffer)
        spawn('ffmpeg', [
            '-y',
            '-i', tmp,
            '-vn',
            '-c:a', 'libopus',
            '-b:a', '128k',
            '-vbr', 'on',
            '-compression_level', '10',
            out,
        ])
            .on('error', reject)
            .on('error', () => fs.unlinkSync(tmp))
            .on('close', () => {
                fs.unlinkSync(tmp)
                resolve(fs.readFileSync(out))
                if (fs.existsSync(out)) fs.unlinkSync(out)
            })
    })
}

function toVideo(buffer, ext) {
    return new Promise((resolve, reject) => {
        let tmp = path.join(__dirname, '../tmp', (new Date * 1) + '.' + ext)
        let out = tmp.replace(new RegExp(ext + '$'), 'mp4')
        fs.writeFileSync(tmp, buffer)
        spawn('ffmpeg', [
            '-y',
            '-i', tmp,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-ab', '192k',
            '-ar', '44100',
            out
        ])
            .on('error', reject)
            .on('error', () => fs.unlinkSync(tmp))
            .on('close', () => {
                fs.unlinkSync(tmp)
                resolve(fs.readFileSync(out))
                if (fs.existsSync(out)) fs.unlinkSync(out)
            })
    })
}
