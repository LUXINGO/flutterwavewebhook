const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
});

const db = admin.firestore();

app.post("/webhook/flutterwave", async (req, res) => {
  try {
    const event = req.body;

    if (event.status !== "successful") return res.sendStatus(200);

    const txRef = event.tx_ref;
    const transactionId = event.id;

    const verify = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET}`
        }
      }
    );

    if (verify.data.data.status === "successful") {
      await db.collection("verificationRequests")
        .doc(txRef)
        .update({
          status: "approved",
          verified: true
        });
    }

    res.sendStatus(200);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000);
