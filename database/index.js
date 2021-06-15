'use strict';

const moment = require('moment-timezone')
const nedb = require('nedb')
const _ = require('lodash')

var db = {}

class Database {
    constructor() {
        this.cwd = process.cwd();
        this.db = {}
        this.db.siswa = new nedb(this.cwd + '/database/temp/siswa.json')
        this.db.siswa.loadDatabase()
    }

    addClass(nama_kelas, siswa = {}) {
        return new Promise(async (resolve, reject) => {
            this.checkNameClassFromDb(nama_kelas)
                .then(async s => {
                    let data = { kelas: nama_kelas, data_siswa: siswa, absen: {} }
                    await this.db.siswa.insert(data)
                    resolve({ status: true, message: 'data berhasil dimasukan.' })
                })
                .catch(err => {
                    reject({ status: false, message: 'nama kelas sudah terdaftar.' })
                })
        })
    }

    findClass(_id) {
        return new Promise(async (resolve, reject) => {
            
        })
    }
    insertSiswa(_id, siswa = {}) {
        return new Promise((resolve, reject) => {
            this.db.siswa.findOne({ _id: _id }, (e, doc) => {
                if (!doc) reject({ status: false, message: 'id kelas tidak ditemukan.' })
                this.db.siswa.update({ _id: _id }, { $set: { 'data_siswa': { ...siswa }} }, {}, (e, docs) => {
                    resolve({ status: true, message: 'siswa baru telah ditambahkan', data: doc })
                })
            })
        })
    }

    checkNameClassFromDb(name) {
        return new Promise((resolve, reject) => {
            this.db.siswa.find({ kelas: name }, (e, doc) => {
                _.isEmpty(doc) ? resolve(true) : reject(false)
            })
        })
    }

    getIdFromNameClass(name) {
        return new Promise((resolve, reject) => {
            this.db.siswa.findOne({ kelas: name }, (e, doc) => {
                doc ?
                    resolve({
                        status: true,
                        kelas: name,
                        id: doc._id
                    }) :
                    reject({
                        status: false,
                        message: 'nama kelas tidak ditemukan.'
                    })
            })
        })
    }

    updateNameClass(_id, name) {
        return new Promise((resolve) => {
            this.db.siswa.find({ _id: _id }, (e, doc) => {
                resolve(doc)
            })
        })
    }

    get randomId() {
        return "id_" + Math.random().toString(16).slice(2)
    }
}


// new Database().addClass('XI RPL A', { nama: 'Ibnu', no: '6282299265151' })
//     .then(s => console.log(s))
//     .catch(err => console.log(err))



// new Database().updateNameClass("id_9d228cb68dbb7")
//     .then(s => console.log(s))
//     .catch(err => console.log)


// new Database().getIdFromNameClass("XI RPL d")
//     .then(s => console.log(s))
//     .catch(err => console.log(err))


// new Database().checkNameClassFromDb("XI RPL SDD")
//     .then(s => console.log(!s))
//     .catch(err => console.log(err))



new Database(). insertSiswa("w9b3GOqt9wi7ODCR", { name: 'Dafi', no: '6287865437894'})
    .then(s => console.log(s))
    .catch(err => console.log(err))
