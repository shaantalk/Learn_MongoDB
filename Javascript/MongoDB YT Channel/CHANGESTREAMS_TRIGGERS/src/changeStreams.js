const { MongoClient } = require("mongodb");
const stream = require("stream");

async function main() {
  const uri = "<YOUR_CONNECTION_STRING>";

  const client = new MongoClient(uri);

  try {
    // Connect to the MongoDB cluster
    await client.connect();

    // Make the appropriate DB calls
    const pipeline = [
      {
        $match: {
          operationType: "insert",
          "fullDocument.address.country": "Australia",
          "fullDocument.address.market": "Sydney",
        },
      },
    ];

    // await monitorListingsUsingEventEmitter(client, 15000, pipeline);
    // await monitorListingsUsingHasNext(client, 15000);
    await monitorListingsUsingStreamAPI(client);
  } finally {
    // Close the connection to the MongoDB cluster
    await client.close();
  }
}

main().catch(console.error);

// Add functions that make DB calls here

async function monitorListingsUsingStreamAPI(
  client,
  timeInMs = 60000,
  pipeline = []
) {
  const collection = client
    .db("sample_airbnb")
    .collection("listingsAndReviews");
  const changeStream = collection.watch(pipeline);

  changeStream.stream().pipe(
    new stream.Writable({
      objectMode: true,
      write: function (doc, _, cb) {
        console.log(doc);
        cb();
      },
    })
  );
  await closeChangeStream(timeInMs, changeStream);
}

async function monitorListingsUsingHasNext(
  client,
  timeInMs = 60000,
  pipeline = []
) {
  const collection = client
    .db("sample_airbnb")
    .collection("listingsAndReviews");
  const changeStream = collection.watch(pipeline);

  closeChangeStream(timeInMs, changeStream);

  try {
    while (await changeStream.hasNext()) {
      console.log(await changeStream.next());
    }
  } catch (error) {
    if (changeStream.closed) {
      console.log(
        "The change stream is closed. Will not wait on any more changes."
      );
    } else {
      throw error;
    }
  }
}

async function monitorListingsUsingEventEmitter(
  client,
  timeInMs = 60000,
  pipeline = []
) {
  const collection = client
    .db("sample_airbnb")
    .collection("listingsAndReviews");
  const changeStream = collection.watch(pipeline);
  changeStream.on("change", next => {
    console.log(next);
  });
  await closeChangeStream(timeInMs, changeStream);
}

// Helper functions after which the change streams will be closed
function closeChangeStream(timeInMs = 60000, changeStream) {
  return new Promise(resolve => {
    setTimeout(() => {
      console.log("Closing the change stream");
      changeStream.close();
      resolve();
    }, timeInMs);
  });
}
