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
    // ** steps
    /* 
    1. Kono perticular date e kono ekta treatment option er kono ekta slot a booking howar por j j slot faka thake ta ber kora holo kaj 
    2. Perticular date a total booking nilam -> koto gula option er vinno vinno time slot a booking ase 
    3. ekhon sort korbo first prottekta treatment option er moddhe diye jabo oi option er sathe kono booking data match kore kina ber korbo 
    4. jodi match kore or jader ta filter kore match korbe -> sei sei booking data r vitor diye map chalay prottektar vitor theke tader joto gula slot booked oi info ber kore nibo 
    5. Eibar remaining ta main option er slots k map kore bookedSlotes.includes(slot) ber kore niye option er slot hisabe set kore dibo 
    */

    const date = req.query.date;

    const query = {};
    const options = await appointmentOptionCollection.find(query).toArray();

    // ** ei date er shob booking chai
    // ** particular date er shob booking dorkar

    const bookingQuery = {
      bookingDate: date,
    };

    const bookings = await bookingsCollection.find(bookingQuery).toArray();

    options.forEach((option) => {
      const treatmentBooked = bookings.filter(
        (book) => book.treatmentName === option.name
      );
      const slotsbookedForThatIndividualTreatment = treatmentBooked.map(
        (book) => book.slot
      );

      const remainingSlots = option.slots.filter(
        (slot) => !slotsbookedForThatIndividualTreatment.includes(slot)
      );

      option.slots = remainingSlots;
    });

    return res.send({
      success: true,
      data: options,
      message: "Data has been fetched successfully",
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// app.get("/v2/appointmentoptions", async (req, res) => {
//   try {
//     const date = req.query.date;

//     const options = await appointmentOptionCollection
//       .aggregate([
//         {
//           $lookup: {
//             from: "bookings",
//             localField: "name",
//             foreignField: "treatmentName",
//             pipeline: [
//               {
//                 $match: {
//                   $expr: {
//                     $eq: ["$bookingDate", date],
//                   },
//                 },
//               },
//               {
//                 $project: {
//                   name: 1,
//                   slots: 1,
//                   booked: {
//                     $map: { input: "$booked", as: "book", in: "$$book.slot" },
//                   },
//                 },
//               },
//               {
//                 $project: {
//                   name: 1,
//                   slots: { $setDifference: ["$slots", "booked"] },
//                 },
//               },
//             ],
//             as: "booked",
//           },
//         },
//       ])
//       .toArray();
//     return res.send({
//       success: true,
//       data: options,
//       message: `appointment options fetched successfully`,
//     });
//   } catch (error) {
//     res.send({
//       success: false,
//       message: error.message,
//     });
//   }
// });

app.post("/bookings", async (req, res) => {
  try {
    const booking = req.body;
    // console.log(booking);

    // const query = {
    //   bookingDate: booking.bookingDate,
    //   email: booking.email,
    //   treatmentName: booking.treatmentName,
    // };

    // const findBookings = await bookingsCollection.find(query).toArray();

    // if (findBookings.length) {
    //   return res.send({
    //     success: false,
    //     message: `Booking has been already made on this date ${booking.bookingDate}`,
    //   });
    // }

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
