__path = process.cwd()
fs = require('fs')
const { exec, execSync } = require('child_process')
const moment = require('moment-timezone')

function stickerWm2(media, packname, author) {
      ran = `${moment().format('DDMMYYYYHHmmss')}.webp`
      fs.createWriteStream(ran)

      execSync(`webpmux -set exif ./default.exif ./${media} -o ./${ran}`)
//          if (err) console.log(stderr)
          //if (err) return this.sendMessage(from, String(err), MessageType.text)
          //this.sendMessage(from, fs.readFileSync(ran), MessageType.sticker, options)
          return fs.readFileSync(ran)
      //})
//      return fs.readFileSync(ran)
}

//var t = stickerWm('./23032021181226.webp', 'bot', 'isywl_', null)

//console.log(t)

module.exports = stickerWm2
