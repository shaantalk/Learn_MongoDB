const { MongoClient } = require("mongodb");

async function main() {
  const uri = "<YOUR_CONNECTION_STRING>";

  const client = new MongoClient(uri);

  try {
    // Connect to the MongoDB cluster
    await client.connect();

    // Make the appropriate DB calls
    await printCheapestSuburbs(client, "Australia", "Sydney", 10);
  } finally {
    // Close the connection to the MongoDB cluster
    await client.close();
  }
}

main().catch(console.error);

// Print 10 cheapest suburbs for a given market

async function printCheapestSuburbs(client, country, market, maxNumberToPrint) {
  const pipeline = [
    {
      $match: {
        bedrooms: 1,
        "address.country": country,
        "address.market": market,
        "address.suburb": {
          $exists: 1,
          $ne: "",
        },
        room_type: "Entire home/apt",
      },
    },
    {
      $group: {
        _id: "$address.suburb",
        averagePrice: {
          $avg: "$price",
        },
      },
    },
    {
      $sort: {
        averagePrice: 1,
      },
    },
    {
      $limit: maxNumberToPrint,
    },
  ];

  const aggCursor = client
    .db("sample_airbnb")
    .collection("listingsAndReviews")
    .aggregate(pipeline);

  await aggCursor.forEach(airbnbListing => {
    console.log(`${airbnbListing._id}: ${airbnbListing.averagePrice}`);
  });
}
