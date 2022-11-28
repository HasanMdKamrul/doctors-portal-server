const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 15000;
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");

// ** Middleware

app.use(cors());
app.use(express.json());

// ** test server

app.get("/", async (req, res) => res.send(`Doctors portal is running `));

// ** Send Email

const sendEmail = (booking) => {
  const { email, treatmentName, bookingDate, slot } = booking;

  console.log(email);

  let transporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    auth: {
      user: "apikey",
      pass: process.env.SENDGRID_API_KEY,
    },
  });

  transporter.sendMail(
    {
      from: `kamrulhasan@iut-dhaka.edu`, // verified sender email
      to: email, // recipient email
      subject: "Test message subject", // Subject line
      text: "Hello world!", // plain text body
      html: `
    
    <div>
    <p>Your Booking is for ${treatmentName}</p>
    <p>Your Booking in ${bookingDate} at ${slot} is confirmed! </p>
    </div>

    `, // html body
    },
    function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    }
  );
};

// ** DB Connections

const uri = `mongodb+srv://newUser:expoten@cluster0.7ikallh.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

console.log(uri);

// ** DB Connection
const run = async () => {
  try {
    // await client.connect();
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
const userCollection = client.db("doctorsPortal").collection("users");
const doctorCollection = client.db("doctorsPortal").collection("doctors");
const paymentCollection = client.db("doctorsPortal").collection("payments");

// ** Stripe payment intent handle

app.post("/create-payment-intent", async (req, res) => {
  const booking = req.body;
  const price = booking.price;

  // ** Need to convert it into cents
  const amount = price * 100;

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    payment_method_types: ["card"],
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

app.post("/payments", async (req, res) => {
  try {
    const payment = req.body;

    const insertPayment = await paymentCollection.insertOne(payment);

    const bookingId = payment.bookingId;
    const transectionId = payment.transectionId;
    const price = payment.price;

    const filter = {
      _id: ObjectId(bookingId),
    };

    const updatedDoc = {
      $set: {
        transectionId: transectionId,
        paid: true,
      },
    };

    const bookingUpdate = await bookingsCollection.updateOne(
      filter,
      updatedDoc
    );

    return res.send({
      success: true,
      data: insertPayment,
      bookingData: bookingUpdate,
    });
  } catch (error) {
    res.send({
      success: false,
      message: "Treatment Options cannot be fetched",
    });
  }
});

// ** JWT verification

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // console.log(authHeader);

  if (!authHeader) {
    return res.status(401).send({
      success: false,
      message: "Unauthorised access",
    });
  }

  // ** Token verification

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({
        success: false,
        message: "Unauthorised access",
      });
    } else {
      req.decoded = decoded;
      next();
    }
  });
};

// ** verifyAdmin

const verifyAdmin = async (req, res, next) => {
  const decodedEmail = req.decoded.email;

  console.log(decodedEmail);

  if (decodedEmail) {
    const query = {
      email: decodedEmail,
    };

    const user = await userCollection.findOne(query);
    if (user.role && user?.role !== "admin") {
      return res.status(401).send({
        success: false,
        message: "Unauthorised access",
      });
    } else next();
  }
};

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

// ** steps
/* 
    1. Kono perticular date e kono ekta treatment option er kono ekta slot a booking howar por j j slot faka thake ta ber kora holo kaj 
    2. Perticular date a total booking nilam -> koto gula option er vinno vinno time slot a booking ase 
    3. ekhon sort korbo first prottekta treatment option er moddhe diye jabo oi option er sathe kono booking data match kore kina ber korbo 
    4. jodi match kore or jader ta filter kore match korbe -> sei sei booking data r vitor diye map chalay prottektar vitor theke tader joto gula slot booked oi info ber kore nibo 
    5. Eibar remaining ta main option er slots k map kore bookedSlotes.includes(slot) ber kore niye option er slot hisabe set kore dibo 
    */
// ** Prottek option er booked slot theke , main option er slots bad diye remaining slots set korte parlei kaj sesh

app.get("/v2/appointmentoptions", async (req, res) => {
  try {
    const date = req.query.date;

    const options = await appointmentOptionCollection
      .aggregate([
        {
          $lookup: {
            from: "bookings",
            localField: "name",
            foreignField: "treatmentName",
            pipeline: [{ $match: { $expr: { $eq: ["$bookingDate", date] } } }],
            as: "booked",
          },
        },
        {
          $project: {
            name: 1,
            slots: 1,
            price: 1,
            booked: {
              $map: { input: "$booked", as: "book", in: "$$book.slot" },
            },
          },
        },
        {
          $project: {
            name: 1,
            price: 1,
            slots: { $setDifference: ["$slots", "$booked"] },
          },
        },
      ])
      .toArray();

    return res.send({
      success: true,
      data: options,
      message: `Data successfully fetched`,
    });
  } catch (error) {
    res.send({
      success: false,
      message: "Treatment Options cannot be fetched",
    });
  }
});

// ** Load only the treatment names from the appointmentOprions data

app.get("/doctorSpeciality", async (req, res) => {
  try {
    const traetmentNames = await appointmentOptionCollection
      .find({})
      .project({ name: 1 })
      .toArray();

    return res.send({
      success: true,
      data: traetmentNames,
      message: "Treatment names are fetched",
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

    const query = {
      bookingDate: booking?.bookingDate,
      email: booking?.email,
      treatmentName: booking?.treatmentName,
    };

    const bookingsData = await bookingsCollection.find(query).toArray();

    if (bookingsData.length) {
      return res.send({
        success: false,
        message: `You have already booked this once`,
      });
    }

    const result = await bookingsCollection.insertOne(booking);

    // ** Send Email

    sendEmail(booking);

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

// ** get all the bookings according to the user email address

app.get("/bookings", verifyJWT, async (req, res) => {
  try {
    const verifiedEmail = req.decoded.email;
    console.log(verifiedEmail);
    const email = req.query.email;

    if (email !== verifiedEmail) {
      return res.status(403).send({
        success: false,
        message: `Unauthorised access`,
      });
    }

    const query = {
      email: email,
    };

    const bookingsData = await bookingsCollection.find(query).toArray();

    return res.send({
      success: true,
      data: bookingsData,
      message: `Booking retrive for this user: ${email}`,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// ** get a single booking info with their id

app.get("/bookings/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = {
      _id: ObjectId(id),
    };

    const booking = await bookingsCollection.findOne(query);

    return res.send({
      success: true,
      data: booking,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// ** Save the user data to the db

app.post("/users", async (req, res) => {
  try {
    const user = req.body;
    // console.log(user);

    const result = await userCollection.insertOne(user);

    return res.send({
      success: true,
      data: result,
      message: `User Created Successfully`,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// ** grab all the users for the admin

app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const users = await userCollection.find({}).toArray();

    // console.log(users);

    return res.send({
      success: true,
      data: users,
      message: `Users fetched successfully`,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// ** get the specific admin using their email

app.get("/users/admin/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const query = {
      email: email,
    };

    const user = await userCollection.findOne(query);

    if (user?.role === "admin") {
      return res.send({
        success: true,
        isAdmin: true,
      });
    }
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});
// ** Admin role update

app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    console.log(id);

    // ** user jodi token verified na thake take amra admin banate dibo na -> orthat jodi login kora na thake take amra admin banate dibo na (step 1)
    const verifiedEmail = req.decoded.email;

    const query = {
      email: verifiedEmail,
    };

    const verifiedUser = await userCollection.findOne(query);

    // ** step 2 -> ei khane amra check korbo se ashole admin kina , admin role check korbo -> jodi admin na hoi take access dibo na

    if (verifiedUser?.role !== "admin") {
      return res.status(401).send({
        success: false,
        message: "Unauthorised access",
      });
    }

    const filter = {
      _id: ObjectId(id),
    };

    const options = { upsert: true };

    const updatedDoc = {
      $set: {
        role: "admin",
      },
    };

    const result = await userCollection.updateOne(filter, updatedDoc, options);

    return res.send({
      success: true,
      result: result,
      message: "Document Updated",
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// ** add price to the existing db

// app.put("/addPrice", async (req, res) => {
//   try {
//     const filter = {};

//     const updatedDoc = {
//       $set: {
//         price: 99,
//       },
//     };

//     const option = { upsert: true };

//     const result = await appointmentOptionCollection.updateMany(
//       filter,
//       updatedDoc,
//       option
//     );

//     console.log(result);

//     return res.send({
//       success: true,
//       result,
//     });
//   } catch (error) {
//     res.send({
//       success: false,
//       message: error.message,
//     });
//   }
// });

// ** Add doctors

app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const doctorData = req.body;

    const result = await doctorCollection.insertOne(doctorData);

    return res.send({
      success: true,
      data: result,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// ** get doctors

app.get("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const doctors = await doctorCollection.find({}).toArray();
    return res.send({
      success: true,
      data: doctors,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// ** Delete a doctor

app.delete("/doctors/:id", verifyJWT, verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const query = {
      _id: ObjectId(id),
    };
    const result = await doctorCollection.deleteOne(query);

    if (result.deletedCount > 0) {
      return res.send({
        success: true,
        data: result,
      });
    }
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// *** JWT TOKEN ***

// **  logged in howar por user -> server a jwt token er jonno request korbe
// ** Jodi user er data age thke backend a thake amra user k jwt token dibo

app.post("/jwt", async (req, res) => {
  try {
    const email = req.query.email;

    const query = {
      email: email,
    };

    const user = await userCollection.findOne(query);

    if (user) {
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, {
        expiresIn: "1d",
      });

      return res.send({
        success: true,
        token: token,
        message: `Token has been generated`,
      });
    } else {
      return res.send({
        success: false,
        token: "",
        message: `Someting is wrong`,
      });
    }
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
});

// *** JWT TOKEN ***

// ** app listen

app.listen(port, () => console.log(`Server is running at ${port}`));
