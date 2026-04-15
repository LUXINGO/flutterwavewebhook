const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();

/* =========================
   MIDDLEWARE (IMPORTANT)
========================= */

// Flutterwave may send JSON or form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   FIREBASE SETUP
========================= */

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/* =========================
   TEST ROUTE
========================= */

app.get("/", (req, res) => {
  res.send("🚀 Flutterwave Webhook Server is Live");
});

/* =========================
   WEBHOOK ROUTE
========================= */

app.post("/webhook/flutterwave", async (req, res) => {
  try {
    console.log("🔥 WEBHOOK RECEIVED");
    console.log("BODY:", req.body);

    const event = req.body;

    // Flutterwave sends different formats sometimes
    const status = event?.status || event?.data?.status;

    if (status !== "successful") {
      console.log("❌ Payment not successful");
      return res.sendStatus(200);
    }

    const transactionId = event?.id || event?.data?.id;
    const txRef = event?.tx_ref || event?.data?.tx_ref;

    if (!transactionId || !txRef) {
      console.log("❌ Missing transaction data");
      return res.sendStatus(200);
    }

    /* =========================
       VERIFY PAYMENT (CRITICAL)
    ========================= */

    const verify = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET}`
        }
      }
    );

    const data = verify.data.data;

    console.log("✅ VERIFIED:", data.status);

    if (data.status === "successful") {

      /* =========================
         UPDATE FIREBASE
      ========================= */

      await db.collection("verificationRequests")
        .doc(txRef)
        .set(
          {
            status: "approved",
            verified: true,
            plan: data.meta?.plan || "pro",
            amount: data.amount,
            currency: data.currency,
            updatedAt: new Date()
          },
          { merge: true }
        );

      console.log("🔥 FIREBASE UPDATED");
    }

    res.sendStatus(200);

  } catch (error) {
    console.log("❌ WEBHOOK ERROR:", error.message);
    res.sendStatus(500);
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
