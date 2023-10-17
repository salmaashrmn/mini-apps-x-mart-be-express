const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transaksiSchema = new Schema({
  qr_code: String,
  rfid: String,
  harga_satuan: Number,
  jumlah: Number,
  date: {
    type: Date,
    default: Date.now
  }
});

const Transaksi = mongoose.model('transaksi', transaksiSchema);

module.exports = Transaksi;
