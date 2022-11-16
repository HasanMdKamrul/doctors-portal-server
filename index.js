const { MongoClient, ServerApiVersion } = require("mongodb");
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

// ** DB Connections

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7ikallh.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// ** DB Connection
const run = async () => {
  try {
    await client.connect();
    console.log("db Connected");
  } catch (error) {
    console.log(error.message);
  }
};

run();

// ** DB collections

const appointmentOptionCollection = client
  .db("doctorsPortal")
  .collection("appointmentOptions");

const bookingsCollection = client.db("doctorsPortal").collection("bookings");

// ** Apis

app.get("/appointmentoptions", async (req, res) => {
  try {
    const date = req.query.date;

    const query = {};
    const options = await appointmentOptionCollection.find(query).toArray();

    // ** ekhon amra j date pailam ei date er against a koto gula booking ase total booking ta ber kore felbo

    const bookingQuery = {
      bookingDate: date,
    };

    // ** ei j date ashlo ei date er agaisnt a joto booking ase shob booking k ber kore nibo

    const bookings = await bookingsCollection.find(bookingQuery).toArray();

    // ** kon kon treatment option er jonno oi j amader selected date er against a booking ase sei sei treatment k amra ber kore nibo

    options.forEach((option) => {
      const treatmentOptionBooked = bookings.filter(
        (book) => book.treatmentName === option.name
      );
      console.log(treatmentOptionBooked);
      const slotsBookedInTreatmentOption = treatmentOptionBooked.map(
        (optionBook) => optionBook.slot
      );

      const remainingSlots = option.slots.filter(
        (slot) => !slotsBookedInTreatmentOption.includes(slot)
      );

      option.slots = remainingSlots;
    });

    return res.send({
      success: true,
      data: options,
      message: `appointment options fetched successfully`,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

app.post("/bookings", async (req, res) => {
  try {
    const booking = req.body;
    const result = await bookingsCollection.insertOne(booking);

    return res.send({
      success: true,
      message: `Booking has been confirmed`,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// ** app listen

app.listen(port, () => console.log(`Server is running at ${port}`));
