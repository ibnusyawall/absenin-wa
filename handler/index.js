__path = process.cwd()

var moment = require("moment-timezone")
// var fs = require("fs")
// var ffmpeg = require('fluent-ffmpeg')
// var needle = require('needle')
// var imageToBase64 = require('image-to-base64')

// var stickerWm2 = require(__path + '/lib/stcwm.js')

// var _ = require('lodash')
// var Exif = require(process.cwd() + '/lib/exif.js')

// var exif = new Exif()
// var { msgFilter } = require(process.cwd() + '/lib/msgFilter')

const time = moment().tz('Asia/Jakarta').format("HH:mm:ss")

const
    {
        MessageType, Mimetype
    } = require("@adiwajshing/baileys")

const { exec, spawnSync } = require("child_process")
prefix = '.'


// // module
// var nulis = require(process.cwd() + '/lib/module/nulis.js')
// var sgif = require(process.cwd() + '/lib/module/sgif.js')
// var ttp = require(process.cwd() + '/lib/module/ttp.js')
// var donasi = require(process.cwd() + '/lib/module/donasi.js')
// var menu = require(process.cwd() + '/lib/module/menu.js')
// // module

const handler = async (client, m) => {
    global.prefix = '/'

    var proses = process.uptime()

    if (!m.message) return
    if (m.key && m.key.remoteJid == 'status@broadcast') return
    if (!m.key.fromMe) return

    const content = JSON.stringify(m.message)

    const from = m.key.remoteJid
    const type = Object.keys(m.message)[0]
    const { text, extendedText, contact, location, liveLocation, image, video, sticker, document, audio, product } = MessageType

    body = (type === 'conversation' && m.message.conversation.startsWith(prefix)) ? m.message.conversation : (type == 'imageMessage') && m.message.imageMessage.caption.startsWith(prefix) ? m.message.imageMessage.caption : (type == 'videoMessage') && m.message.videoMessage.caption.startsWith(prefix) ? m.message.videoMessage.caption : (type == 'extendedTextMessage') && m.message.extendedTextMessage.text.startsWith(prefix) ? m.message.extendedTextMessage.text : ''
    budy = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : ''
    const argv = body.slice(1).trim().split(/ +/).shift().toLowerCase() || ''
    const args = body.trim().split(/ +/).slice(1)

    const isGroup = from.endsWith('@g.us')
    const id = isGroup ? m.participant : m.key.remoteJid
    const owner = '6282299265151@s.whatsapp.net' // insert nomor lo

    const isBot = client.user.jid
    const isOwner = id === owner ? true : false

    const groupMetadata = isGroup ? await client.groupMetadata(m.chat) : ''

    const isMedia = (type === 'imageMessage' || type === 'videoMessage')
    const isQuotedImage = type === 'extendedTextMessage' && content.includes('imageMessage')
    const isQuotedVideo = type === 'extendedTextMessage' && content.includes('videoMessage')

    const isQuotedMessage = type === 'extendedTextMessage' && content.includes('conversation')

    const fromBot = isQuotedMessage ? m.message.extendedTextMessage.contextInfo.participant : null

    var stickerWm = (media, packname, author) => {
        ran = 'stcwm.webp'
        exec(`webpmux -set exif ./default.exif ./${media} -o ./${ran}`, (err, stderr, stdout) => {
            if (err) return client.sendMessage(m.chat, String(err), text, { quoted: m })
            client.sendMessage(m.chat, fs.readFileSync(ran), sticker, { quoted: m })
        })
    }

    var logging = {
        isNotSticker: 'reply stiker dengan caption: .toimg',
        userIsNotAdmin: 'kamu bukan admin.',
        botIsNotAdmin: 'Jadikan aex sebagai admin untuk memaksimalkan fitur group!',
        isNotGroup: 'Command ini hanya berlaku didalam group saja.',
        isNotOwner: 'Command khusus owner bot!',
        isUserLimitGame: 'sayangnya limit game kamu telah habis, silahkan tunggu esok untuk mendapatkan limit kembali.',
        isUserLimit: 'Limit kamu telah habis. Gunakan bot dengan bijak yah kak. Menjadi member premium akan membuat limit kamu tak terbatas lho!, cukup ketik *#daftarpremium* untuk info menjadi premium member!',
        isSudahDaftar: 'nomor kamu sudah terdaftar di db! mohon untuk tidak melakukan spam!',
        isNotDaftar: 'kamu belum terdaftar dalam db bot, ketik *.register* untuk pendaftaran pertama kamu!',
        isNotUserDB: 'user tsb tidak terdaftar di database kami, harap untuk mendaftar terlebih dahulu untuk menggunakan command ini!',
        active: '_semakin kamu aktif menggunakan bot ini, xp akan otomatis bertambah dengan sistem yang telah ditentukan._'
    }


    let c = client.match(argv, m.sender, reason => client.reply2(m.chat, reason, m))

    switch (true) {
        default:
            break
    }
}

module.exports = handler
