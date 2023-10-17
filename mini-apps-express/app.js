const express = require("express");
const mongoose = require("mongoose");
const pgp = require('pg-promise')();
const Transaksi = require('././api/model/TransaksiModel');
const bodyParser = require('body-parser');
const redis = require('redis');
const cors = require('cors');

require('dotenv').config();

const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  db: 0
});
client.connect();
client.on('connect', ()=> {
  console.log("client conected");
})

client.on('ready', ()=> {
  console.log("client ready");
})

const db_postgre = pgp({
  user: 'postgres',        
  password: 'seol12',      
  host: 'localhost',       
  port: 5432,              
  database: 'x-mart'     
});

const app = express();
const port = process.env.PORT || 3000;

let uri = process.env.DB_URL;
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

app.use(bodyParser.json());
app.use(cors());

// Connect MongoDB Atlas using mongoose connect method
mongoose.connect(uri, options).then(
  () => {
    console.log("Database connection established!");
  },
  (err) => {
    {
      console.log("Error connecting Database instance due to:", err);
    }
  }
);

app.get("/transaksi", (req, res) => {
    Transaksi.find({})
    .then((data)=>{
        res.json({found: true, data: data});
    })
    .catch((err)=>{
        console.log(err)
        res.json({found: false, data: null});
    })
});

// app.get("/transfer", async (req, res) => {
//   try{
//     const dataMongo = await Transaksi.find({}).exec();
//     dataMongo.forEach(async (data) => {
//       try {
//         await db_postgre.none('INSERT INTO transaksi (qr_code, rfid, harga_satuan, jumlah, date) VALUES ($1, $2, $3, $4, $5)', 
//                               [data.qr_code, data.rfid, data.harga_satuan, data.jumlah, data.date]);
//         console.log('Data berhasil disimpan di PostgreSQL');
//         res.status(201).json({message:"Data berhasil disimpan di PostgreSQL"});
//       } catch (error) {
//         console.error('Error saat menyimpan data di PostgreSQL:', error);
//         res.status(400).json({message:"Error saat menyimpan data di PostgreSQL"});
//       }
//     });
//   }catch(err){
//     console.log(err);
//     throw err;
//   }
// });

app.get("/transfer", async (req, res) => {
  try {
    const dataMongo = await Transaksi.find({}).exec();

    const results = await Promise.all(
      dataMongo.map(async (data) => {
        try {
          await db_postgre.none('INSERT INTO transaksi (qr_code, rfid, harga_satuan, jumlah, date) VALUES ($1, $2, $3, $4, $5)', 
                                [data.qr_code, data.rfid, data.harga_satuan, data.jumlah, data.date]);
          console.log('Data berhasil disimpan di PostgreSQL');
          return 'Data berhasil disimpan di PostgreSQL';
        } catch (error) {
          console.error('Error saat menyimpan data di PostgreSQL:', error);
          return 'Error saat menyimpan data di PostgreSQL';
        }
      })
    );
    res.status(201).json({ results });
  } catch (err) {
    console.log(err);
    throw err;
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

app.post('/transaksi',(req,res)=>{
  const transaksiData = req.body; 

  Promise.all(
    transaksiData.map(data => {
      return new Transaksi(data)
        .save()
        .then(v_data => {
          console.log(v_data);
          let objectIdString = v_data._id.toString();
          client.set("transaksi:"+objectIdString, JSON.stringify(v_data));
        })
        .catch(err => {
          console.error(err);
        });
    })
  )
    .then(results => {
      res.json({ save: true, results });
    })
    .catch(err => {
      console.error(err);
      res.json({ save: false });
    });

})

app.get("/barang", async (req, res) => {
  try {
    const result = await db_postgre.query('SELECT * FROM barang');
    console.log(result);
    res.json(result);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/barang", async (req, res) => {
  const dataBarang = req.body;
  try {
    const newBarang = await db_postgre
                      .query(
                        'INSERT INTO barang (rfid, nama_barang, harga_satuan) VALUES ($1, $2, $3) RETURNING *',
                        [dataBarang.rfid, dataBarang.nama_barang, dataBarang.harga_satuan]);
    
    const newBarangJSON = JSON.stringify(newBarang);

    await client.SET(dataBarang.rfid, newBarangJSON);
    res.status(201).json(newBarang);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function cache(req, res, next) {
  console.log("yes2");
  const rfid = req.params.rfid;
  console.log(rfid);
  console.log("yes3");

  try{
    const data = await client.get(rfid);
    console.log("data:",data);
    if (data !== null) {
      console.log("yes6");
    
      res.send(data);
    } else {
      console.log("yes8");

      next();
    }
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

app.get("/barang/:rfid", cache, async (req, res) => {
  try {
    console.log("yes");
    const result = await db_postgre.query('SELECT * FROM barang WHERE rfid = $1', [req.params.rfid]);
    console.log("result:",result);
    if (result.length > 0) {
      const response = result[0]; // Ambil data pertama dari hasil query
      client.set(req.params.rfid, JSON.stringify(response));
      res.json(response);
    } else {
      res.status(404).json({ error: 'Barang not found' });
    }
  } catch (error) {
    console.error('Error getting product from PostgreSQL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});