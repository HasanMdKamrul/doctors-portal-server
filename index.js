const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 15000;

// ** Middleware

app.use(cors());
app.use(express.json());

// ** test server

app.get("/", async (req, res) => res.send(`Doctors portal is running `));

// ** app listen

app.listen(port, () => console.log(`Server is running at ${port}`));
