const mongoose = require("mongoose");

let uri = process.env.DB_URL;
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

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
