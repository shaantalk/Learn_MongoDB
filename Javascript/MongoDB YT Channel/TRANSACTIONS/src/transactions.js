const { MongoClient } = require("mongodb");

async function main() {
  const uri = "<YOUR_CONNECTION_STRING>";

  const client = new MongoClient(uri);

  try {
    // Connect to the MongoDB cluster
    await client.connect();

    // Make the appropriate DB calls
    await createReservation(
      client,
      "tom@example.com",
      "Infinite Views",
      [new Date("2019-12-31"), new Date("2020-01-01")],
      {
        pricePerNight: 180,
        specialRequests: "Late checkout",
        breakfastIncluded: true,
      }
    );
  } finally {
    // Close the connection to the MongoDB cluster
    await client.close();
  }
}

main().catch(console.error);

// Add functions that make DB calls here

// Helper function that will create a reservation in the DB
async function createReservation(
  client,
  userEmail,
  nameOfListing,
  reservationDates,
  reservationDetails
) {
  const usersCollection = client.db("sample_airbnb").collection("users");
  const listingsAndReviewsCollection = client
    .db("sample_airbnb")
    .collection("listingsAndReviews");

  const reservation = createReservationDocument(
    nameOfListing,
    reservationDates,
    reservationDetails
  );

  const session = client.startSession();

  const transactionOptions = {
    readPreference: "primary",
    readConcern: { level: "local" },
    writeConcern: { w: "majority" },
  };

  try {
    const transactionResults = await session.withTransaction(async () => {
      // Adding the reservation to the users collection
      const usersUpdateResults = await usersCollection.updateOne(
        { email: userEmail },
        { $addToSet: { reservations: reservation } },
        { session }
      );
      console.log(
        `${usersUpdateResults.matchedCount} document(s) found in the users collection with the email address ${userEmail}.`
      );
      console.log(
        `${usersUpdateResults.modifiedCount} document(s) was/were updated to include the reservation.`
      );

      // Checking if the property is double booked or not
      const isListingReservedResults =
        await listingsAndReviewsCollection.findOne(
          { name: nameOfListing, datesReserved: { $in: reservationDates } },
          { session }
        );

      // Rollback transaction if the property is double booked
      if (isListingReservedResults) {
        await session.abortTransaction();
        console.error(
          "This listing is already reserved for at least one of the given dates. The reservation could not be created."
        );
        console.error(
          "Any operations that already occurred as part of this transaction will be rolled back."
        );
        return;
      }

      //   Add the dates reserved in the datesReserved array of the propery
      const listingsAndReviewsUpdateResults =
        await listingsAndReviewsCollection.updateOne(
          { name: nameOfListing },
          { $addToSet: { datesReserved: { $each: reservationDates } } },
          { session }
        );
      console.log(
        `${listingsAndReviewsUpdateResults.matchedCount} document(s) found in the listingsAndReviews collection with the name ${nameOfListing}.`
      );
      console.log(
        `${listingsAndReviewsUpdateResults.modifiedCount} document(s) was/were updated to include the reservation dates.`
      );
    }, transactionOptions);

    if (transactionResults) {
      console.log("The reservation was successfully created.");
    } else {
      console.log("The transaction was intentionally aborted.");
    }
  } catch (e) {
    console.log("The transaction was aborted due to an unexpected error: " + e);
  } finally {
    await session.endSession();
  }
}

// Helper function to nicely format a json object that represents a reservation
function createReservationDocument(
  nameOfListing,
  reservationDates,
  reservationDetails
) {
  // Create the reservation
  let reservation = {
    name: nameOfListing,
    dates: reservationDates,
  };

  // Add additional properties from reservationDetails to the reservation
  for (let detail in reservationDetails) {
    reservation[detail] = reservationDetails[detail];
  }

  return reservation;
}
