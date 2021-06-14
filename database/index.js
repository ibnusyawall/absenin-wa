const moment = require('moment-timezone')
const nedb = require('nedb')

var db = {}

class Database {
    constructor() {
        this.cwd = process.cwd();
        this.db = {}
        this.db.siswa = new nedb(this.cwd + '/database/temp/siswa.json')
        this.db.siswa.loadDatabase()
    }

    addClass(nama_kelas, siswa) {
        return new Promise(async (resolve, reject) => {
            let data = { id: this.randomId, kelas: nama_kelas, data_siswa: siswa }
            let result = this.db.siswa.insert(data)
            resolve(result)
        })
    }

    getIdFromNameClass(name) {

    }
    updateNameClass(id, name) {
        return new Promise((resolve) => {
            this.db.siswa.find({ id: id }, (e, doc) => {
                resolve(doc)
            })
        })
    }

    get randomId() {
        return "id_" + Math.random().toString(16).slice(2)
    }
}


// new Database().addClass('XI RPL C', ['Ibnu', 'Fahri', 'Dafi', 'Ajid', 'Fajar'])
//     .then(s => console.log(s))
//     .catch(err => console.log)



new Database().updateNameClass("id_9d228cb68dbb7")
    .then(s => console.log(s))
    .catch(err => console.log)
