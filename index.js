// Aku tambahin ini :v
process.on('uncaughtException', console.error)

var qrcode = require("qrcode-terminal")
var fs = require("fs")
var _ = require('lodash')

var handler = require('./handler/index')

var
    {
        WAConnection: _WAConnection,
        MessageType
    } = require("@adiwajshing/baileys")

var simple = require(process.cwd() + '/lib/simple')

var WAConnection = simple.WAConnection(_WAConnection)

var client = new WAConnection()

var initialize = {
    scan: async function(c) {
        c.on('qr', qr => {
            qrcode.generate(qr, { small: true })
            console.log(`[!] Scan kode qr dengan whatsapp!`)
        })
        return
    },
    open: async function(c) {
        c.on('open', () => {
            console.log(`[!] credentials telah diperbaharui!`)
            var authInfo = conn.base64EncodedAuthInfo()
            fs.writeFileSync('./auth_info.json', JSON.stringify(authInfo, null, '\t'))
        })
        return 
    },
    init: async function (c) {
        await this.scan(c)
        await this.open(c)

        fs.existsSync('./auth_info.json') && c.loadAuthInfo('./auth_info.json')

        await c.connect()
    }
}

async function start(c) {
    await initialize.init(c)

    c.on('chat-update', async (m) => {
        if (!m.hasNewMessage) return;
        m = JSON.parse(JSON.stringify(m)).messages[0]

        simple.smsg(this, m)

        if (MessageType) {
            
        }
        handler(this, m)
    })
}


(async () => await start(client))()